import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader && authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: connection } = await supabaseAdmin
      .from("inbox_connections")
      .select("*")
      .eq("provider", "gmail")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json({ error: "No Gmail connection found" });
    }

    const accessToken = connection.access_token;

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const gmailData = await gmailRes.json();

    if (!gmailData.messages) {
      return NextResponse.json({ processed: 0, results: [] });
    }

    let processed = 0;
    const results: any[] = [];
    const skipped: any[] = [];
    const needsOcr: any[] = [];
    const debug: any[] = [];

    for (const msg of gmailData.messages) {
      const messageId = msg.id;

      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("gmail_message_id", messageId)
        .maybeSingle();

      if (existing) {
        skipped.push({
          gmail_message_id: messageId,
          reason: "email_already_saved",
        });
        continue;
      }

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers || [];

      const subject =
        headers.find((h: any) => h.name === "Subject")?.value || "";
      const from =
        headers.find((h: any) => h.name === "From")?.value || "";

      let body = "";
      let hasPdfAttachment = false;
      const attachmentNames: string[] = [];

      const parts = msgData.payload?.parts || [];

      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString("utf-8");
        }

        if (part.filename && part.filename.toLowerCase().includes(".pdf")) {
          hasPdfAttachment = true;
          attachmentNames.push(part.filename);
        }
      }

      if (hasPdfAttachment) {
        await supabaseAdmin.from("emails").insert({
          gmail_message_id: messageId,
          subject,
          from_email: from,
          body_text: body,
          attachment_text: "",
          processing_status: "needs_ocr",
          received_at: new Date().toISOString(),
        });

        needsOcr.push({
          gmail_message_id: messageId,
          subject,
          attachmentNames,
        });

        debug.push({
          gmail_message_id: messageId,
          subject,
          hasAttachment: true,
          hasPdfAttachment: true,
          needsOcr: true,
        });

        continue;
      }

      const combinedInput = `
Subject: ${subject}
From: ${from}

EMAIL BODY:
${body}
`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4.1",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
Extract structured business actions.

Return JSON:
{
  "customer": "",
  "po_number": "",
  "items": [
    {
      "action": "",
      "sku": "",
      "quantity": 0,
      "notes": ""
    }
  ]
}

Rules:
- Extract multiple SKUs as separate items
- Valid actions: Place Order, Reply to Enquiry, Follow Up, Cancel Order, Confirm Delivery
- NEVER create item with empty SKU
- If no actionable content, return empty items.
`,
          },
          {
            role: "user",
            content: combinedInput,
          },
        ],
      });

      const raw = aiResponse.choices[0].message.content || "{}";

      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { customer: "", po_number: "", items: [] };
      }

      await supabaseAdmin.from("emails").insert({
        gmail_message_id: messageId,
        subject,
        from_email: from,
        body_text: body,
        attachment_text: "",
        processing_status: "processed",
        received_at: new Date().toISOString(),
      });

      for (const item of parsed.items || []) {
        if (!item.sku) continue;

        await supabaseAdmin.from("order_items").insert({
          action: item.action,
          customer: parsed.customer || "",
          po_number: parsed.po_number || "",
          sku: item.sku,
          quantity: item.quantity || null,
          notes: item.notes || "",
          status: "New",
          source_email: from,
          gmail_message_id: messageId,
          email_subject: subject,
        });

        results.push({
          gmail_message_id: messageId,
          sku: item.sku,
          action: item.action,
          subject,
        });
      }

      processed++;
    }

    return NextResponse.json({
      processed,
      skipped,
      needsOcr,
      results,
      debug,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}
