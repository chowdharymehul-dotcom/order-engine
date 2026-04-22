export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { google } from "googleapis";
import { uploadAttachmentToSupabase } from "@/lib/attachment-storage";
import { getAppBaseUrl } from "@/lib/ocr";

type AttachmentCategory = "pdf" | "text" | "document" | "image" | "other";

type SelectedAttachment = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  source: "gmail" | "outlook";
  category: AttachmentCategory;
  score: number;
};

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

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLatestConnectionPerProvider(connections: any[]) {
  const latestMap = new Map<string, any>();

  for (const connection of connections) {
    const provider = connection.provider;
    const current = latestMap.get(provider);

    const connectionTime = new Date(
      connection.created_at || connection.updated_at || 0
    ).getTime();

    if (!current) {
      latestMap.set(provider, connection);
      continue;
    }

    const currentTime = new Date(
      current.created_at || current.updated_at || 0
    ).getTime();

    if (connectionTime > currentTime) {
      latestMap.set(provider, connection);
    }
  }

  return Array.from(latestMap.values());
}

function isTokenExpiredError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("token is expired") ||
    lower.includes("lifetime validation failed") ||
    lower.includes("invalid_grant") ||
    lower.includes("expired")
  );
}

async function markConnectionExpired(
  supabaseAdmin: any,
  connectionId: string,
  errorMessage: string
) {
  const { error } = await supabaseAdmin
    .from("inbox_connections")
    .update({
      connection_status: "expired",
      last_error: errorMessage,
    })
    .eq("id", connectionId);

  if (error) {
    console.error("❌ Failed to mark connection expired:", error.message);
  }
}

async function markConnectionActive(
  supabaseAdmin: any,
  connectionId: string
) {
  const { error } = await supabaseAdmin
    .from("inbox_connections")
    .update({
      connection_status: "active",
      last_error: null,
    })
    .eq("id", connectionId);

  if (error) {
    console.error("❌ Failed to mark connection active:", error.message);
  }
}

async function refreshOutlookToken(connection: any, supabaseAdmin: any) {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Refresh failed");
  }

  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token || connection.refresh_token;
  const expiresIn = data.expires_in;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from("inbox_connections")
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
      connection_status: "active",
      last_error: null,
    })
    .eq("id", connection.id);

  if (error) {
    throw new Error(`Failed to save refreshed token: ${error.message}`);
  }

  return newAccessToken;
}

function normalizeFilename(filename: string) {
  return (filename || "").trim().toLowerCase();
}

function isInlineOrSignatureLike(filename: string, mimeType: string) {
  const lower = normalizeFilename(filename);
  const lowerMime = (mimeType || "").toLowerCase();

  return (
    lower.includes("image001") ||
    lower.includes("image002") ||
    lower.includes("logo") ||
    lower.includes("signature") ||
    lower.includes("sig") ||
    lower.includes("banner") ||
    lower.includes("facebook") ||
    lower.includes("instagram") ||
    lower.includes("linkedin") ||
    lower.includes("twitter") ||
    lower.includes("whatsapp") ||
    lowerMime.startsWith("image/")
  );
}

function isSkippableGmailPart(filename: string, mimeType: string) {
  const lowerFilename = normalizeFilename(filename);
  const lowerMime = (mimeType || "").toLowerCase();

  if (lowerMime.startsWith("multipart/")) return true;

  if (
    lowerFilename.includes("multipart") ||
    lowerFilename.startsWith("unnamed") ||
    lowerFilename === "attachment"
  ) {
    return true;
  }

  return false;
}

function getAttachmentCategory(
  filename: string,
  mimeType: string
): AttachmentCategory {
  const lower = normalizeFilename(filename);
  const lowerMime = (mimeType || "").toLowerCase();

  if (lower.endsWith(".pdf") || lowerMime === "application/pdf") {
    return "pdf";
  }

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".csv") ||
    lowerMime === "text/plain" ||
    lowerMime === "text/csv" ||
    lowerMime.startsWith("text/")
  ) {
    return "text";
  }

  if (
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".rtf") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".json") ||
    lowerMime.includes("word") ||
    lowerMime.includes("excel") ||
    lowerMime.includes("spreadsheet") ||
    lowerMime.includes("officedocument")
  ) {
    return "document";
  }

  if (lowerMime.startsWith("image/")) {
    return "image";
  }

  return "other";
}

function getAttachmentScore(filename: string, mimeType: string, size: number) {
  const lower = normalizeFilename(filename);
  const category = getAttachmentCategory(filename, mimeType);

  if (isInlineOrSignatureLike(filename, mimeType)) {
    return -1000;
  }

  let score = 0;

  if (category === "pdf") score += 1000;
  if (category === "text") score += 700;
  if (category === "document") score += 600;
  if (category === "other") score += 50;
  if (category === "image") score -= 200;

  if (
    lower.includes("po") ||
    lower.includes("pedido") ||
    lower.includes("purchase") ||
    lower.includes("order") ||
    lower.includes("invoice") ||
    lower.includes("packing") ||
    lower.includes("proforma")
  ) {
    score += 120;
  }

  if (size > 5_000) score += 20;
  if (size > 20_000) score += 20;
  if (size > 50_000) score += 20;

  return score;
}

function chooseBestAttachment(attachments: SelectedAttachment[]) {
  if (!attachments.length) return null;

  const sorted = [...attachments].sort((a, b) => b.score - a.score);
  return sorted[0];
}

async function extractGmailAttachments(
  gmail: any,
  provider: string,
  msgId: string,
  payload: any
) {
  const allParts = collectAllParts(payload, []);
  let combinedText = "";
  const attachmentNames: string[] = [];
  const candidateAttachments: SelectedAttachment[] = [];

  for (const part of allParts) {
    const filename = part.filename || "";
    const attachmentId = part.body?.attachmentId;
    const mimeType = part.mimeType || "";

    if (!attachmentId && !filename) continue;
    if (isSkippableGmailPart(filename, mimeType)) continue;

    const safeFilename = filename || `file-${Date.now()}`;
    attachmentNames.push(safeFilename);

    let buffer: Buffer | null = null;

    if (part.body?.data) {
      try {
        buffer = decodeBase64Url(part.body.data);
      } catch {
        buffer = null;
      }
    } else if (attachmentId) {
      try {
        const attachmentRes = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: msgId,
          id: attachmentId,
        });

        const rawData = attachmentRes.data.data;
        if (rawData) {
          buffer = decodeBase64Url(rawData);
        }
      } catch (error) {
        console.error("Gmail attachment fetch failed:", safeFilename, error);
      }
    }

    if (!buffer || !buffer.length) continue;

    const category = getAttachmentCategory(safeFilename, mimeType);

    if (category === "text") {
      combinedText += buffer.toString("utf-8") + "\n\n";
    }

    candidateAttachments.push({
      filename: safeFilename,
      mimeType: mimeType || "application/octet-stream",
      buffer,
      source: "gmail",
      category,
      score: getAttachmentScore(safeFilename, mimeType, buffer.length),
    });
  }

  const bestAttachment = chooseBestAttachment(candidateAttachments);

  let attachmentUrl = "";
  let selectedAttachmentName = "";
  let selectedAttachmentMimeType = "";
  let hasPdfAttachment = false;

  if (bestAttachment && bestAttachment.score > 0) {
    try {
      const uploaded = await uploadAttachmentToSupabase({
        provider,
        messageId: msgId,
        filename: bestAttachment.filename,
        fileBuffer: bestAttachment.buffer,
        mimeType: bestAttachment.mimeType,
      });

      attachmentUrl = uploaded.publicUrl;
      selectedAttachmentName = bestAttachment.filename;
      selectedAttachmentMimeType = bestAttachment.mimeType;
      hasPdfAttachment = bestAttachment.category === "pdf";
    } catch (error) {
      console.error(
        "Gmail selected attachment upload failed:",
        bestAttachment.filename,
        error
      );
    }
  }

  return {
    attachmentText: combinedText.trim(),
    attachmentNames,
    hasPdfAttachment,
    attachmentUrl,
    selectedAttachmentName,
    selectedAttachmentMimeType,
  };
}

async function extractOutlookAttachments(
  provider: string,
  accessToken: string,
  messageId: string
) {
  let combinedText = "";
  const attachmentNames: string[] = [];
  const candidateAttachments: SelectedAttachment[] = [];

  const listRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!listRes.ok) {
    return {
      attachmentText: "",
      attachmentNames: [],
      hasPdfAttachment: false,
      attachmentUrl: "",
      selectedAttachmentName: "",
      selectedAttachmentMimeType: "",
    };
  }

  const data = await listRes.json();
  const attachments = data.value || [];

  for (const attachment of attachments) {
    const odataType = attachment["@odata.type"] || "";
    const isFileAttachment = odataType.includes("fileAttachment");
    if (!isFileAttachment) continue;

    const name = attachment.name || "attachment.bin";
    const contentType = attachment.contentType || "application/octet-stream";
    const contentBytes = attachment.contentBytes;
    const isInline =
      attachment.isInline === true ||
      !!attachment.contentId ||
      !!attachment.contentLocation;

    attachmentNames.push(name);

    if (isInline) continue;
    if (isInlineOrSignatureLike(name, contentType)) continue;
    if (!contentBytes) continue;

    try {
      const buffer = Buffer.from(contentBytes, "base64");
      if (!buffer.length) continue;

      const category = getAttachmentCategory(name, contentType);

      if (category === "text") {
        combinedText += buffer.toString("utf-8") + "\n\n";
      }

      candidateAttachments.push({
        filename: name,
        mimeType: contentType,
        buffer,
        source: "outlook",
        category,
        score: getAttachmentScore(name, contentType, buffer.length),
      });
    } catch (error) {
      console.error("Outlook attachment decode failed:", name, error);
    }
  }

  const bestAttachment = chooseBestAttachment(candidateAttachments);

  let attachmentUrl = "";
  let selectedAttachmentName = "";
  let selectedAttachmentMimeType = "";
  let hasPdfAttachment = false;

  if (bestAttachment && bestAttachment.score > 0) {
    try {
      const uploaded = await uploadAttachmentToSupabase({
        provider,
        messageId,
        filename: bestAttachment.filename,
        fileBuffer: bestAttachment.buffer,
        mimeType: bestAttachment.mimeType,
      });

      attachmentUrl = uploaded.publicUrl;
      selectedAttachmentName = bestAttachment.filename;
      selectedAttachmentMimeType = bestAttachment.mimeType;
      hasPdfAttachment = bestAttachment.category === "pdf";
    } catch (error) {
      console.error(
        "Outlook selected attachment upload failed:",
        bestAttachment.filename,
        error
      );
    }
  }

  return {
    attachmentText: combinedText.trim(),
    attachmentNames,
    hasPdfAttachment,
    attachmentUrl,
    selectedAttachmentName,
    selectedAttachmentMimeType,
  };
}

async function processOneMessage({
  supabaseAdmin,
  openai,
  provider,
  externalId,
  subject,
  from,
  bodyText,
  attachmentText,
  attachmentNames,
  attachmentUrl,
  hasPdfAttachment,
  selectedAttachmentName,
  selectedAttachmentMimeType,
  receivedAt,
  existingEmail,
  processedResults,
  needsOcr,
  ignored,
  debug,
}: any) {
  const finalAttachmentText =
    attachmentText || existingEmail?.attachment_text || "";

  const finalAttachmentUrl =
    attachmentUrl || existingEmail?.attachment_url || null;

  const nextStatus =
    hasPdfAttachment && !finalAttachmentText
      ? "needs_ocr"
      : finalAttachmentText
      ? "ready_for_ai"
      : "new";

  const emailPayload = {
    provider,
    gmail_message_id: externalId,
    subject,
    from_email: from,
    body_text: bodyText,
    attachment_text: finalAttachmentText,
    attachment_url: finalAttachmentUrl,
    received_at: receivedAt,
    processing_status: nextStatus,
  };

  if (!existingEmail) {
    const { error: saveEmailError } = await supabaseAdmin
      .from("emails")
      .insert(emailPayload);

    if (saveEmailError) {
      console.error("❌ Failed to insert email:", saveEmailError.message);
      return;
    }
  } else {
    const { error: updateEmailError } = await supabaseAdmin
      .from("emails")
      .update(emailPayload)
      .eq("gmail_message_id", externalId);

    if (updateEmailError) {
      console.error("❌ Failed to update email:", updateEmailError.message);
      return;
    }
  }

  debug.push({
    provider,
    gmail_message_id: externalId,
    subject,
    from,
    hasAttachment: attachmentNames.length > 0,
    hasPdfAttachment,
    needsOcr: hasPdfAttachment && !finalAttachmentText,
    attachmentNames,
    selectedAttachmentName,
    selectedAttachmentMimeType,
    attachmentUrl: finalAttachmentUrl,
    bodyPreview: (bodyText || "").slice(0, 200),
    attachmentPreview: (finalAttachmentText || "").slice(0, 300),
  });

  if (hasPdfAttachment && !finalAttachmentText) {
    needsOcr.push({
      provider,
      gmail_message_id: externalId,
      subject,
      attachmentNames,
      selectedAttachmentName,
      selectedAttachmentMimeType,
      attachmentUrl: finalAttachmentUrl,
    });
    return;
  }

  const combinedInput = `
Subject: ${subject}
From: ${from}

EMAIL BODY:
${bodyText}

ATTACHMENT CONTENT:
${finalAttachmentText}
`;

  const relevanceResponse = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
Classify whether this email is relevant for business workflow processing.

Relevant means the email contains one or more of:
- order placement
- product enquiry
- delivery enquiry
- follow up on products/orders
- cancellation request
- delivery confirmation
- PO / purchase order / SKU / quantity style business instructions

Not relevant means things like:
- travel
- airlines
- hotels
- newsletters
- banking
- service center / repairs
- personal messages
- marketing emails
- general non-product operational emails

Return JSON only:
{
  "is_relevant": true,
  "reason": ""
}
`,
      },
      {
        role: "user",
        content: combinedInput,
      },
    ],
  });

  const relevanceRaw =
    relevanceResponse.choices[0].message.content || '{"is_relevant":false}';

  let relevanceParsed: any = { is_relevant: false, reason: "" };
  try {
    relevanceParsed = JSON.parse(relevanceRaw);
  } catch {
    relevanceParsed = { is_relevant: false, reason: "parse_failed" };
  }

  if (!relevanceParsed.is_relevant) {
    ignored.push({
      provider,
      gmail_message_id: externalId,
      subject,
      reason: relevanceParsed.reason || "not_relevant",
    });

    await supabaseAdmin
      .from("emails")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("gmail_message_id", externalId);

    return;
  }

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
- If attachment exists but no readable order lines are available, do NOT guess order items
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

  if (
    !parsed.items ||
    !Array.isArray(parsed.items) ||
    parsed.items.length === 0
  ) {
    await supabaseAdmin
      .from("emails")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("gmail_message_id", externalId);

    return;
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
      gmail_message_id: externalId,
      email_subject: subject,
    });

    processedResults.push({
      provider,
      gmail_message_id: externalId,
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
    .eq("gmail_message_id", externalId);
}

export async function GET(req: NextRequest) {
  console.log("🚀 process-emails route invoked");
  console.log("🔐 Has authorization header:", !!req.headers.get("authorization"));

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const { data: allConnections, error: connectionError } = await supabaseAdmin
      .from("inbox_connections")
      .select("*")
      .in("provider", ["gmail", "outlook"])
      .order("created_at", { ascending: false });

    if (connectionError) {
      return NextResponse.json(
        { error: connectionError.message },
        { status: 500 }
      );
    }

    if (!allConnections || allConnections.length === 0) {
      return NextResponse.json(
        { error: "No inbox connections found" },
        { status: 404 }
      );
    }

    const connections = getLatestConnectionPerProvider(allConnections);

    console.log(
      "📦 Using latest connections only:",
      connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        created_at: c.created_at,
        connection_status: c.connection_status,
        expires_at: c.expires_at,
      }))
    );

    const processedResults: any[] = [];
    const needsOcr: any[] = [];
    const skipped: any[] = [];
    const ignored: any[] = [];
    const debug: any[] = [];
    const providerErrors: any[] = [];

    for (const connection of connections) {
      try {
        if (connection.provider === "gmail") {
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
            maxResults: 20,
            q: "newer_than:2d",
          });

          await markConnectionActive(supabaseAdmin, connection.id);

          const messages = listRes.data.messages || [];

          console.log("📩 Gmail messages found:", messages.length);

          for (const msg of messages) {
            const externalId = msg.id!;

            const { data: existingEmail } = await supabaseAdmin
              .from("emails")
              .select("*")
              .eq("gmail_message_id", externalId)
              .limit(1)
              .maybeSingle();

            if (
              existingEmail &&
              existingEmail.processing_status === "processed"
            ) {
              skipped.push({
                provider: "gmail",
                gmail_message_id: externalId,
                reason: "already_processed",
              });
              continue;
            }

            const msgRes = await gmail.users.messages.get({
              userId: "me",
              id: externalId,
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

            const bodyText =
              extractPlainText(payload) || msgRes.data.snippet || "";

            const {
              attachmentText,
              attachmentNames,
              hasPdfAttachment,
              attachmentUrl,
              selectedAttachmentName,
              selectedAttachmentMimeType,
            } = await extractGmailAttachments(
              gmail,
              "gmail",
              externalId,
              payload
            );

            await processOneMessage({
              supabaseAdmin,
              openai,
              provider: "gmail",
              externalId,
              subject,
              from,
              bodyText,
              attachmentText,
              attachmentNames,
              attachmentUrl,
              hasPdfAttachment,
              selectedAttachmentName,
              selectedAttachmentMimeType,
              receivedAt: dateHeader
                ? new Date(dateHeader).toISOString()
                : new Date().toISOString(),
              existingEmail,
              processedResults,
              needsOcr,
              ignored,
              debug,
            });
          }
        }

        if (connection.provider === "outlook") {
          let accessToken = connection.access_token;

          if (
            connection.expires_at &&
            new Date(connection.expires_at).getTime() < Date.now()
          ) {
            console.log("🔄 Refreshing Outlook token...");
            accessToken = await refreshOutlookToken(connection, supabaseAdmin);
          }

          const listRes = await fetch(
            "https://graph.microsoft.com/v1.0/me/messages?$top=20&$select=id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments",
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              cache: "no-store",
            }
          );

          const raw = await listRes.text();

          let data: any = null;
          try {
            data = JSON.parse(raw);
          } catch {
            data = { value: [] };
          }

          if (!listRes.ok) {
            throw new Error(data?.error?.message || raw || "Outlook fetch failed");
          }

          await markConnectionActive(supabaseAdmin, connection.id);

          const messages = data.value || [];

          console.log("📩 Outlook messages found:", messages.length);

          for (const msg of messages) {
            const externalId = msg.id;

            const { data: existingEmail } = await supabaseAdmin
              .from("emails")
              .select("*")
              .eq("gmail_message_id", externalId)
              .limit(1)
              .maybeSingle();

            if (
              existingEmail &&
              existingEmail.processing_status === "processed"
            ) {
              skipped.push({
                provider: "outlook",
                gmail_message_id: externalId,
                reason: "already_processed",
              });
              continue;
            }

            const subject = msg.subject || "";
            const from = msg.from?.emailAddress?.address || "";
            const receivedAt = msg.receivedDateTime || new Date().toISOString();
            const rawBody = msg.body?.content || msg.bodyPreview || "";
            const bodyText = stripHtml(rawBody);

            const {
              attachmentText,
              attachmentNames,
              hasPdfAttachment,
              attachmentUrl,
              selectedAttachmentName,
              selectedAttachmentMimeType,
            } = await extractOutlookAttachments(
              "outlook",
              accessToken,
              externalId
            );

            await processOneMessage({
              supabaseAdmin,
              openai,
              provider: "outlook",
              externalId,
              subject,
              from,
              bodyText,
              attachmentText,
              attachmentNames,
              attachmentUrl,
              hasPdfAttachment,
              selectedAttachmentName,
              selectedAttachmentMimeType,
              receivedAt,
              existingEmail,
              processedResults,
              needsOcr,
              ignored,
              debug,
            });
          }
        }
      } catch (providerError: any) {
        console.error(
          `❌ Provider ${connection.provider} failed:`,
          providerError.message
        );

        const errorMessage = providerError.message || "Unknown provider error";

        if (isTokenExpiredError(errorMessage)) {
          await markConnectionExpired(supabaseAdmin, connection.id, errorMessage);
        } else {
          const { error: updateError } = await supabaseAdmin
            .from("inbox_connections")
            .update({
              last_error: errorMessage,
            })
            .eq("id", connection.id);

          if (updateError) {
            console.error("❌ Failed to save provider error:", updateError.message);
          }
        }

        providerErrors.push({
          provider: connection.provider,
          connection_id: connection.id,
          connection_status: isTokenExpiredError(errorMessage)
            ? "expired"
            : connection.connection_status || "active",
          message: errorMessage,
        });

        continue;
      }
    }

    let autoOcrTriggered = false;
    let autoOcrStatus: number | null = null;
    let autoOcrResult: any = null;

    if (needsOcr.length > 0) {
      try {
        const appBaseUrl = getAppBaseUrl();

        const ocrRes = await fetch(`${appBaseUrl}/api/process-ocr`, {
          method: "GET",
          cache: "no-store",
        });

        autoOcrTriggered = true;
        autoOcrStatus = ocrRes.status;

        try {
          autoOcrResult = await ocrRes.json();
        } catch {
          autoOcrResult = null;
        }
      } catch (error: any) {
        autoOcrTriggered = true;
        autoOcrStatus = 500;
        autoOcrResult = {
          ok: false,
          step: "auto_trigger_process_ocr",
          error: error?.message || "Unknown OCR trigger error",
        };
      }
    }

    return NextResponse.json({
      processed: processedResults.length,
      skipped,
      needsOcr,
      ignored,
      results: processedResults,
      debug,
      providerErrors,
      autoOcrTriggered,
      autoOcrStatus,
      autoOcrResult,
    });
  } catch (error: any) {
    console.error("❌ ERROR:", error.message);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}