export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { uploadAttachmentToSupabase } from "@/lib/attachment-storage";

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function extractPlainText(payload: any): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).toString("utf-8");
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
      .toString("utf-8")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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

function getAttachmentCategory(filename: string, mimeType: string) {
  const lowerName = (filename || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  if (lowerName.endsWith(".pdf") || lowerMime === "application/pdf") {
    return "pdf";
  }

  if (
    lowerMime.startsWith("image/") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp")
  ) {
    return "image";
  }

  if (
    lowerMime.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".xml")
  ) {
    return "text";
  }

  if (
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".xlsx") ||
    lowerMime.includes("word") ||
    lowerMime.includes("excel") ||
    lowerMime.includes("spreadsheet") ||
    lowerMime.includes("officedocument")
  ) {
    return "document";
  }

  return "other";
}

function isInlineOrSignature(filename: string, mimeType: string) {
  const lowerName = (filename || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  return (
    lowerMime.startsWith("image/") &&
    (lowerName.includes("logo") ||
      lowerName.includes("signature") ||
      lowerName.includes("image001") ||
      lowerName.includes("image002") ||
      lowerName.includes("banner"))
  );
}

function scoreAttachment(filename: string, mimeType: string, size: number) {
  const lower = (filename || "").toLowerCase();
  const category = getAttachmentCategory(filename, mimeType);

  if (isInlineOrSignature(filename, mimeType)) return -1000;

  let score = 0;

  if (category === "pdf") score += 1000;
  if (category === "document") score += 700;
  if (category === "text") score += 600;
  if (category === "image") score += 300;
  if (category === "other") score += 50;

  if (
    lower.includes("po") ||
    lower.includes("purchase") ||
    lower.includes("order") ||
    lower.includes("invoice") ||
    lower.includes("pedido") ||
    lower.includes("proforma")
  ) {
    score += 200;
  }

  if (size > 5000) score += 20;
  if (size > 20000) score += 20;

  return score;
}

async function fetchBestAttachment(params: {
  gmail: any;
  messageId: string;
}) {
  const { gmail, messageId } = params;

  const msgRes = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const payload = msgRes.data.payload;
  const parts = collectAllParts(payload, []);

  const attachments: any[] = [];

  for (const part of parts) {
    const filename = part.filename || "";
    const mimeType = part.mimeType || "application/octet-stream";
    const attachmentId = part.body?.attachmentId;

    if (!filename && !attachmentId) continue;

    let buffer: Buffer | null = null;

    if (part.body?.data) {
      buffer = decodeBase64Url(part.body.data);
    } else if (attachmentId) {
      const attachmentRes = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
      });

      if (attachmentRes.data.data) {
        buffer = decodeBase64Url(attachmentRes.data.data);
      }
    }

    if (!buffer || !buffer.length) continue;

    attachments.push({
      filename: filename || `attachment-${Date.now()}`,
      mimeType,
      buffer,
      size: buffer.length,
      category: getAttachmentCategory(filename, mimeType),
      score: scoreAttachment(filename, mimeType, buffer.length),
    });
  }

  const best = attachments
    .filter((attachment) => attachment.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return {
    message: msgRes.data,
    attachment: best || null,
    attachmentCount: attachments.length,
    attachmentCandidates: attachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      category: a.category,
      score: a.score,
    })),
  };
}

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("inbox_connections")
      .select("*")
      .eq("provider", "gmail")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Gmail connection found",
        },
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

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: 20,
      q: "newer_than:2d",
    });

    const messages = listRes.data.messages || [];
    const results: any[] = [];

    for (const msg of messages) {
      const messageId = msg.id!;
      const threadId = msg.threadId || null;

      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select(
          "id, attachment_url, attachment_name, attachment_mime_type, attachment_type, processing_status"
        )
        .eq("provider", "gmail")
        .eq("external_message_id", messageId)
        .maybeSingle();

      if (existing) {
        if (existing.attachment_url) {
          results.push({
            messageId,
            skipped: true,
            reason: "already_exists_with_attachment",
            emailId: existing.id,
            attachment_url: existing.attachment_url,
            attachment_name: existing.attachment_name,
          });

          continue;
        }

        const { attachment, attachmentCount, attachmentCandidates } =
          await fetchBestAttachment({
            gmail,
            messageId,
          });

        if (!attachment) {
          results.push({
            messageId,
            skipped: true,
            reason: "already_exists_no_attachment_found",
            emailId: existing.id,
            attachmentCount,
            attachmentCandidates,
          });

          continue;
        }

        const uploaded = await uploadAttachmentToSupabase({
          provider: "gmail",
          messageId,
          filename: attachment.filename,
          fileBuffer: attachment.buffer,
          mimeType: attachment.mimeType,
        });

        const { error: updateError } = await supabaseAdmin
          .from("emails")
          .update({
            attachment_url: uploaded.publicUrl,
            attachment_name: attachment.filename,
            attachment_mime_type: attachment.mimeType,
            attachment_type: attachment.category,
            attachment_text: "",
            processing_status: "needs_ocr",
            ocr_attempts: 0,
            last_processing_error: null,
          })
          .eq("id", existing.id);

        results.push({
          messageId,
          repaired: !updateError,
          emailId: existing.id,
          attachment_name: attachment.filename,
          attachment_url: uploaded.publicUrl,
          attachment_mime_type: attachment.mimeType,
          attachment_type: attachment.category,
          updateError: updateError?.message || null,
          attachmentCount,
          attachmentCandidates,
        });

        continue;
      }

      const { message, attachment, attachmentCount, attachmentCandidates } =
        await fetchBestAttachment({
          gmail,
          messageId,
        });

      const payload = message.payload;
      const headers = payload?.headers || [];

      const subject =
        headers.find((h: any) => h.name === "Subject")?.value || "";
      const from =
        headers.find((h: any) => h.name === "From")?.value || "";
      const dateHeader =
        headers.find((h: any) => h.name === "Date")?.value || "";

      const bodyText = extractPlainText(payload) || message.snippet || "";

      let uploadedAttachment: any = null;

      if (attachment) {
        const uploaded = await uploadAttachmentToSupabase({
          provider: "gmail",
          messageId,
          filename: attachment.filename,
          fileBuffer: attachment.buffer,
          mimeType: attachment.mimeType,
        });

        uploadedAttachment = {
          attachment_url: uploaded.publicUrl,
          attachment_name: attachment.filename,
          attachment_mime_type: attachment.mimeType,
          attachment_type: attachment.category,
        };
      }

      const { error: insertError } = await supabaseAdmin.from("emails").insert({
        provider: "gmail",
        gmail_message_id: messageId,
        external_message_id: messageId,
        external_thread_id: threadId,
        subject,
        from_email: from,
        body_text: bodyText,
        received_at: dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString(),
        processing_status: uploadedAttachment ? "needs_ocr" : "new",
        attachment_text: "",
        attachment_url: uploadedAttachment?.attachment_url || null,
        attachment_name: uploadedAttachment?.attachment_name || null,
        attachment_mime_type:
          uploadedAttachment?.attachment_mime_type || null,
        attachment_type: uploadedAttachment?.attachment_type || null,
        ocr_attempts: 0,
        last_processing_error: null,
      });

      results.push({
        messageId,
        subject,
        from,
        inserted: !insertError,
        error: insertError?.message || null,
        attachmentCount,
        attachmentCandidates,
        selectedAttachment: uploadedAttachment,
      });
    }

    return NextResponse.json({
      ok: true,
      provider: "gmail",
      checked: messages.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        provider: "gmail",
        step: "gmail_fetch_catch",
        error: error?.message || "Unknown Gmail fetch error",
      },
      { status: 500 }
    );
  }
}