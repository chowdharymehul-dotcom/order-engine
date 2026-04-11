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

    // 🔽 Get Gmail connection
    const { data: connection } = await supabaseAdmin
      .from("inbox_connections")
      .select("*")
      .eq("provider", "gmail")
      .single();

    if (!connection) {
      console.error("❌ No Gmail connection found");
      return NextResponse.json({ error: "No Gmail connection" });
    }

    const accessToken = connection.access_token;

    // 🔽 Fetch emails from Gmail
    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const gmailData = await gmailRes.json();
    const messages = gmailData.messages || [];

    console.log("📩 Gmail messages found:", messages.length);

    let processedResults: any[] = [];
    let needsOcr: any[] = [];
    let skipped: any[] = [];

    for (const msg of messages) {
      const msgId = msg.id;

      // 🔽 Get full email
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const msgData = await msgRes.json();

      const headers = msgData.payload.headers;

      const subject =
        headers.find((h: any) => h.name === "Subject")?.value || "";
      const from =
        headers.find((h: any) => h.name === "From")?.value || "";

      let body = "";

      if (msgData.payload.parts) {
        for (const part of msgData.payload.parts) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            body = Buffer.from(part.body.data, "base64").toString("utf-8");
          }
        }
      }

      // 🔽 Check if already exists
      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("gmail_message_id", msgId)
        .single();

      if (existing) {
        skipped.push(msgId);
        continue;
      }

      // 🔽 Insert email
      const { data: emailRecord } = await supabaseAdmin
        .from("emails")
        .insert([
          {
            gmail_message_id: msgId,
            subject,
            from_email: from,
            body_text: body,
            processing_status: "pending",
          },
        ])
        .select()
        .single();

      if (!emailRecord) continue;

      // 🔽 Simple OCR detection (if body empty)
      if (!body || body.length < 20) {
        await supabaseAdmin
          .from("emails")
          .update({ processing_status: "needs_ocr" })
          .eq("id", emailRecord.id);

        needsOcr.push(msgId);
        continue;
      }

      // 🔽 Send to OpenAI
      const prompt = `
Extract structured actions from this email.

Email:
${body}

Return format:
Action,Customer,PO Number,SKU,Quantity,Deadline
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const output =
        completion.choices[0]?.message?.content || "";

      console.log("🤖 AI output:", output);

      // 🔽 Insert order
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
    });
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}