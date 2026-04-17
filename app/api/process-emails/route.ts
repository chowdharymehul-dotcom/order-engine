export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export async function GET(req: NextRequest) {
  console.log("🚀 process-emails route invoked");
  console.log(
    "🔐 Has authorization header:",
    !!req.headers.get("authorization")
  );

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const { data: connections, error: connectionError } = await supabaseAdmin
      .from("inbox_connections")
      .select("*")
      .eq("provider", "gmail")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("📦 Gmail connection query result:", connections);
    console.log("📦 Gmail connection query error:", connectionError);

    const connection = connections?.[0];

    if (!connection) {
      console.error("❌ No Gmail connection found");
      return NextResponse.json({
        error: "No Gmail connection",
        queryError: connectionError?.message || null,
        foundRows: connections?.length || 0,
      });
    }

    const accessToken = connection.access_token;

    // ✅ Inbox-only + recent emails so cron does not miss fresh mails
    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox newer_than:1d",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const gmailData = await gmailRes.json();

    console.log("📩 Gmail raw response:", gmailData);

    const messages = gmailData.messages || [];

    console.log("📩 Gmail messages found:", messages.length);
    console.log(
      "📩 Gmail message IDs:",
      messages.map((m: any) => m.id)
    );

    let processedResults: any[] = [];
    let needsOcr: any[] = [];
    let skipped: any[] = [];

    for (const msg of messages) {
      const msgId = msg.id;

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      const msgData = await msgRes.json();

      if (!msgData.payload) {
        console.log("⚠️ No payload found for message:", msgId);
        continue;
      }

      const headers = msgData.payload.headers || [];

      const subject =
        headers.find((h: any) => h.name === "Subject")?.value || "";
      const from =
        headers.find((h: any) => h.name === "From")?.value || "";

      console.log("✉️ Processing subject:", subject);

      let body = "";

      if (msgData.payload.parts && Array.isArray(msgData.payload.parts)) {
        for (const part of msgData.payload.parts) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            body = Buffer.from(part.body.data, "base64").toString("utf-8");
            break;
          }
        }
      }

      if (!body && msgData.payload.body?.data) {
        body = Buffer.from(msgData.payload.body.data, "base64").toString("utf-8");
      }

      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("gmail_message_id", msgId)
        .maybeSingle();

      console.log("🔎 Existing email check for:", msgId, !!existing);

      if (existing) {
        skipped.push(msgId);
        continue;
      }

      const { data: emailRecord, error: emailInsertError } = await supabaseAdmin
        .from("emails")
        .insert([
          {
            gmail_message_id: msgId,
            subject,
            from_email: from,
            body_text: body,
            attachment_text: "",
            processing_status: "pending",
            received_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (emailInsertError || !emailRecord) {
        console.error("❌ Failed to insert email:", emailInsertError?.message);
        continue;
      }

      // Very simple OCR flag for low-text emails
      if (!body || body.trim().length < 20) {
        await supabaseAdmin
          .from("emails")
          .update({ processing_status: "needs_ocr" })
          .eq("id", emailRecord.id);

        needsOcr.push(msgId);
        continue;
      }

      const prompt = `
Extract structured business actions from this email.

Email:
${body}

Return ONLY simple structured text. Identify:
- Action
- Customer
- PO Number
- SKU
- Quantity
- Deadline

If multiple SKUs exist, list all of them clearly.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const output = completion.choices[0]?.message?.content || "";

      console.log("🤖 AI output:", output);

      // Current simplified insert logic
      await supabaseAdmin.from("order_items").insert([
        {
          action: "Place Order",
          customer: from,
          po_number: "",
          sku: "UNKNOWN",
          quantity: 0,
          notes: output,
          status: "New",
          email_subject: subject,
          gmail_message_id: msgId,
        },
      ]);

      processedResults.push(msgId);

      await supabaseAdmin
        .from("emails")
        .update({ processing_status: "processed" })
        .eq("id", emailRecord.id);
    }

    console.log("✅ Processed count:", processedResults.length);
    console.log("📄 Needs OCR count:", needsOcr.length);
    console.log("⏭️ Skipped count:", skipped.length);

    return NextResponse.json({
      processed: processedResults.length,
      needsOcr: needsOcr.length,
      skipped: skipped.length,
      processedIds: processedResults,
      needsOcrIds: needsOcr,
      skippedIds: skipped,
    });
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}