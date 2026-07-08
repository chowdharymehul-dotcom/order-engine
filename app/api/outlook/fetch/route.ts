export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadAttachmentToSupabase } from "@/lib/attachment-storage";
import { isRelevantBusinessEmail } from "@/lib/email-relevance";
import { getValidOutlookAccessToken } from "@/lib/outlook-token";

function stripHtml(html: string) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAttachmentCategory(filename: string, mimeType: string) {
  const lowerName = (filename || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  if (lowerName.endsWith(".pdf") || lowerMime === "application/pdf") return "pdf";

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
      lowerName.includes("banner") ||
      lowerName.includes("outlook-horizontal"))
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
    lower.includes("proforma") ||
    lower.includes("trim") ||
    lower.includes("fabric")
  ) {
    score += 200;
  }

  if (size > 5000) score += 20;
  if (size > 20000) score += 20;

  return score;
}

async function fetchBestOutlookAttachment(params: {
  accessToken: string;
  messageId: string;
}) {
  const { accessToken, messageId } = params;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(
      messageId
    )}/attachments`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return {
      attachment: null,
      attachmentCount: 0,
      attachmentCandidates: [],
      error: await res.text(),
    };
  }

  const data = await res.json();
  const attachments = data.value || [];
  const candidates: any[] = [];

  for (const attachment of attachments) {
    const type = attachment["@odata.type"] || "";

    if (!type.includes("fileAttachment")) continue;

    const filename = attachment.name || `attachment-${Date.now()}`;
    const mimeType = attachment.contentType || "application/octet-stream";

    if (attachment.isInline) continue;
    if (isInlineOrSignature(filename, mimeType)) continue;
    if (!attachment.contentBytes) continue;

    const buffer = Buffer.from(attachment.contentBytes, "base64");

    if (!buffer.length) continue;

    candidates.push({
      filename,
      mimeType,
      buffer,
      size: buffer.length,
      category: getAttachmentCategory(filename, mimeType),
      score: scoreAttachment(filename, mimeType, buffer.length),
    });
  }

  const best = candidates
    .filter((attachment) => attachment.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return {
    attachment: best || null,
    attachmentCount: candidates.length,
    attachmentCandidates: candidates.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      category: a.category,
      score: a.score,
    })),
    error: null,
  };
}

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

const { data: activeConnection } = await supabaseAdmin
  .from("inbox_connections")
  .select("account_email")
  .eq("provider", "outlook")
  .eq("connection_status", "active")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const connectedEmail = String(
  activeConnection?.account_email || ""
)
  .trim()
  .toLowerCase();

  try {
    const { accessToken, refreshed } = await getValidOutlookAccessToken();

    const listRes = await fetch(
 "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$select=id,conversationId,subject,from,receivedDateTime,bodyPreview,body,hasAttachments",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const listJson = await listRes.json();

    if (!listRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: "outlook",
          step: "list_messages",
          status: listRes.status,
          tokenRefreshed: refreshed,
          error: listJson,
        },
        { status: listRes.status }
      );
    }

    const messages = listJson.value || [];
    const results: any[] = [];

    for (const msg of messages) {
      const messageId = msg.id;
      const threadId = msg.conversationId || null;
      const subject = msg.subject || "";
      const from =
        msg.from?.emailAddress?.address ||
        msg.from?.emailAddress?.name ||
        "";
if (
  connectedEmail &&
  from.toLowerCase().includes(connectedEmail)
) {
  results.push({
    messageId,
    subject,
    from,
    skipped: true,
    reason: "own_sent_email",
  });

  continue;
}
      const bodyText = stripHtml(msg.body?.content || msg.bodyPreview || "");

      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select(
          "id, attachment_url, attachment_name, attachment_mime_type, attachment_type, processing_status"
        )
        .eq("provider", "outlook")
        .eq("external_message_id", messageId)
        .maybeSingle();

      if (existing) {
        results.push({
          messageId,
          subject,
          skipped: true,
          reason: existing.attachment_url
            ? "already_exists_with_attachment"
            : "already_exists_no_attachment_found",
          emailId: existing.id,
          attachment_url: existing.attachment_url,
          attachment_name: existing.attachment_name,
        });

        continue;
      }

      const attachmentResult = msg.hasAttachments
        ? await fetchBestOutlookAttachment({
            accessToken,
            messageId,
          })
        : {
            attachment: null,
            attachmentCount: 0,
            attachmentCandidates: [],
            error: null,
          };

      const attachment = attachmentResult.attachment;

      const relevance = isRelevantBusinessEmail({
        subject,
        fromEmail: from,
        bodyText,
        attachmentName: attachment?.filename || "",
        hasAttachment: !!attachment,
      });

      if (!relevance.relevant) {
        results.push({
          messageId,
          subject,
          from,
          skipped: true,
          reason: "irrelevant_email_not_saved",
          relevanceReason: relevance.reason,
          relevanceConfidence: relevance.confidence,
          attachmentCount: attachmentResult.attachmentCount,
          attachmentCandidates: attachmentResult.attachmentCandidates,
          attachmentError: attachmentResult.error,
        });

        continue;
      }

      let uploadedAttachment: any = null;

      if (attachment) {
        const uploaded = await uploadAttachmentToSupabase({
          provider: "outlook",
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
        provider: "outlook",
direction: "INBOUND",
        external_message_id: messageId,
        gmail_message_id: messageId,
        external_thread_id: threadId,
        subject,
        from_email: from,
        body_text: bodyText,
        received_at: msg.receivedDateTime || new Date().toISOString(),
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
        relevanceReason: relevance.reason,
        relevanceConfidence: relevance.confidence,
        attachmentCount: attachmentResult.attachmentCount,
        attachmentCandidates: attachmentResult.attachmentCandidates,
        selectedAttachment: uploadedAttachment,
      });
    }

    return NextResponse.json({
      ok: true,
      provider: "outlook",
      tokenRefreshed: refreshed,
      checked: messages.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        provider: "outlook",
        step: "outlook_fetch_catch",
        error: error?.message || "Unknown Outlook fetch error",
      },
      { status: 500 }
    );
  }
}