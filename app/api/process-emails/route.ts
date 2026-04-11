import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function extractPlainText(payload: any): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).toString("utf-8");
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }

  return "";
}

function collectAllParts(payload: any, allParts: any[] = []) {
  if (!payload) return allParts;

  allParts.push(payload);

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      collectAllParts(part, allParts);
    }
  }

  return allParts;
}

async function extractAttachments(gmail: any, msgId: string, payload: any) {
  const allParts = collectAllParts(payload, []);
  let combinedText = "";
  const attachmentNames: string[] = [];
  let hasPdfAttachment = false;

  for (const part of allParts) {
    const filename = part.filename || "";
    const attachmentId = part.body?.attachmentId;
    const mimeType = part.mimeType || "";

    const looksLikeAttachment = !!attachmentId || !!filename;
    if (!looksLikeAttachment) continue;

    if (filename) {
      attachmentNames.push(filename);
    } else {
      attachmentNames.push(`unnamed-${mimeType}`);
    }

    if (
      filename.toLowerCase().endsWith(".pdf") ||
      mimeType === "application/pdf"
    ) {
      hasPdfAttachment = true;
    }

    if (part.body?.data && mimeType === "text/plain") {
      try {
        const inlineText = decodeBase64Url(part.body.data).toString("utf-8");
        combinedText += inlineText + "\n\n";
      } catch (error) {
        console.error("Inline text attachment decode failed:", error);
      }
      continue;
    }

    if (!attachmentId) continue;

    try {
      const attachmentRes = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: msgId,
        id: attachmentId,
      });

      const rawData = attachmentRes.data.data;
      if (!rawData) continue;

      const buffer = decodeBase64Url(rawData);

      if (
        filename.toLowerCase().endsWith(".txt") ||
        mimeType === "text/plain"
      ) {
        combinedText += buffer.toString("utf-8") + "\n\n";
      }
    } catch (error) {
      console.error("Attachment fetch failed:", filename || mimeType, error);
    }
  }

  return {
    attachmentText: combinedText.trim(),
    attachmentNames,
    hasPdfAttachment,
  };
}

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

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("inbox_connections")
      .select("*")
      .eq("provider", "gmail")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "No Gmail connection found" },
        { status: 404 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      q: "newer_than:2d",
    });

    const messages = listRes.data.messages || [];

    const processedResults: any[] = [];
    const skipped: any[] = [];
    const needsOcr: any[] = [];
    const debug: any[] = [];

    for (const msg of messages) {
      const gmailMessageId = msg.id!;

      const { data: existingEmail } = await supabaseAdmin
        .from("emails")
        .select("id, processing_status")
        .eq("gmail_message_id", gmailMessageId)
        .limit(1)
        .maybeSingle();

      if (existingEmail && existingEmail.processing_status === "processed") {
        skipped.push({
          gmail_message_id: gmailMessageId,
          reason: "already_processed",
        });
        continue;
      }

      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: gmailMessageId,
        format: "full",
      });

      const payload = msgRes.data.payload;
      const headers = payload?.headers || [];

      const subject =
        headers.find((h: any) => h.name === "Subject")?.value || "";
      const from =
        headers.find((h: any) => h.name === "From")?.value || "";
      const dateHeader =
        headers.find((h: any) => h.name === "Date")?.value || "";

      const bodyText = extractPlainText(payload) || msgRes.data.snippet || "";

      const { attachmentText, attachmentNames, hasPdfAttachment } =
        await extractAttachments(gmail, gmailMessageId, payload);

      const nextStatus =
        hasPdfAttachment && !attachmentText ? "needs_ocr" : "new";

      if (!existingEmail) {
        await supabaseAdmin.from("emails").insert({
          provider: "gmail",
          gmail_message_id: gmailMessageId,
          thread_id: msgRes.data.threadId || "",
          subject,
          from_email: from,
          body_text: bodyText,
          attachment_text: attachmentText,
          received_at: dateHeader
            ? new Date(dateHeader).toISOString()
            : new Date().toISOString(),
          processing_status: nextStatus,
        });
      } else {
        await supabaseAdmin
          .from("emails")
          .update({
            thread_id: msgRes.data.threadId || "",
            subject,
            from_email: from,
            body_text: bodyText,
            attachment_text: attachmentText,
            received_at: dateHeader
              ? new Date(dateHeader).toISOString()
              : new Date().toISOString(),
            processing_status: nextStatus,
          })
          .eq("gmail_message_id", gmailMessageId);
      }

      debug.push({
        gmail_message_id: gmailMessageId,
        subject,
        from,
        hasAttachment: attachmentNames.length > 0,
        hasPdfAttachment,
        needsOcr: hasPdfAttachment && !attachmentText,
        attachmentNames,
        bodyPreview: bodyText.slice(0, 200),
        attachmentPreview: attachmentText.slice(0, 300),
      });

      if (hasPdfAttachment && !attachmentText) {
        needsOcr.push({
          gmail_message_id: gmailMessageId,
          subject,
          attachmentNames,
        });
        continue;
      }

      const combinedInput = `
Subject: ${subject}
From: ${from}

EMAIL BODY:
${bodyText}

ATTACHMENT CONTENT:
${attachmentText}
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
- Use both email body and attachment content
- Valid actions: Place Order, Reply to Enquiry, Follow Up, Cancel Order, Confirm Delivery
- NEVER create an item with blank SKU
- NEVER create a Place Order item unless SKU is explicitly present in email body or attachment content
- If there is no actionable order/enquiry content, return:
{
  "customer": "",
  "po_number": "",
  "items": []
}
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

      if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        await supabaseAdmin
          .from("emails")
          .update({
            processing_status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("gmail_message_id", gmailMessageId);
        continue;
      }

      for (const item of parsed.items) {
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
          gmail_message_id: gmailMessageId,
          email_subject: subject,
        });

        processedResults.push({
          gmail_message_id: gmailMessageId,
          subject,
          sku: item.sku,
          action: item.action,
        });
      }

      await supabaseAdmin
        .from("emails")
        .update({
          processing_status: "processed",
          processed_at: new Date().toISOString(),
        })
        .eq("gmail_message_id", gmailMessageId);
    }

    return NextResponse.json({
      processed: processedResults.length,
      skipped,
      needsOcr,
      results: processedResults,
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