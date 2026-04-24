export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { extractTextFromPdfWithCloudConvert } from "@/lib/cloudconvert-ocr";
import { getAppBaseUrl } from "@/lib/ocr";

const MAX_OCR_ATTEMPTS = 3;

function getHexPreview(buffer: Buffer, length = 16) {
  return buffer.subarray(0, length).toString("hex");
}

function getAsciiPreview(buffer: Buffer, length = 32) {
  return buffer
    .subarray(0, length)
    .toString("utf8")
    .replace(/[^\x20-\x7E]/g, ".");
}

function looksLikePdf(buffer: Buffer) {
  if (!buffer || buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown OCR processing error";
}

function extractStructuredError(errorMessage: string) {
  try {
    return JSON.parse(errorMessage);
  } catch {
    return null;
  }
}

function isCreditsExceeded(errorMessage: string) {
  const structured = extractStructuredError(errorMessage);

  if (
    structured?.error?.code === "CREDITS_EXCEEDED" ||
    structured?.code === "CREDITS_EXCEEDED"
  ) {
    return true;
  }

  const lower = errorMessage.toLowerCase();

  return (
    lower.includes("credits_exceeded") ||
    lower.includes("run out of conversion credits") ||
    lower.includes("out of conversion credits")
  );
}

async function markEmailOcrState(params: {
  supabase: any;
  emailId: string;
  status: "ocr_failed" | "ocr_blocked" | "ready_for_ai" | "processed" | "ignored";
  errorMessage?: string | null;
  attachmentText?: string | null;
  incrementAttempts?: boolean;
}) {
  const {
    supabase,
    emailId,
    status,
    errorMessage = null,
    attachmentText = null,
    incrementAttempts = false,
  } = params;

  const { data: existingRow } = await supabase
    .from("emails")
    .select("ocr_attempts")
    .eq("id", emailId)
    .maybeSingle();

  const currentAttempts = Number(existingRow?.ocr_attempts || 0);
  const nextAttempts = incrementAttempts ? currentAttempts + 1 : currentAttempts;

  const updatePayload: Record<string, any> = {
    processing_status: status,
    last_processing_error: errorMessage,
    ocr_attempts: nextAttempts,
  };

  if (status === "processed" || status === "ignored") {
    updatePayload.processed_at = new Date().toISOString();
  }

  if (attachmentText !== null) {
    updatePayload.attachment_text = attachmentText;
  }

  const { error } = await supabase
    .from("emails")
    .update(updatePayload)
    .eq("id", emailId);

  if (error) {
    throw new Error(`Failed to update OCR state: ${error.message}`);
  }

  return nextAttempts;
}

async function fallbackToAiUsingEmailBody(params: {
  supabase: any;
  openai: OpenAI;
  email: any;
  ocrErrorMessage: string;
}) {
  const { supabase, openai, email, ocrErrorMessage } = params;

  const combinedInput = `
Subject: ${email.subject || ""}
From: ${email.from_email || ""}

EMAIL BODY:
${email.body_text || ""}

ATTACHMENT CONTENT:
OCR was unavailable because CloudConvert credits were exhausted.
Do not invent details from the PDF.
Use only the email body content.
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
    relevanceResponse.choices[0]?.message?.content || '{"is_relevant":false}';

  let relevanceParsed: any = {
    is_relevant: false,
    reason: "No relevance response",
  };

  try {
    relevanceParsed = JSON.parse(relevanceRaw);
  } catch {
    relevanceParsed = {
      is_relevant: false,
      reason: "Relevance JSON parse failed",
    };
  }

  if (!relevanceParsed.is_relevant) {
    const attempts = await markEmailOcrState({
      supabase,
      emailId: email.id,
      status: "ignored",
      errorMessage: `OCR blocked, fallback AI ignored email. OCR error: ${ocrErrorMessage}. Reason: ${
        relevanceParsed.reason || "not_relevant"
      }`,
      incrementAttempts: true,
    });

    return {
      fallbackUsed: true,
      fallbackStatus: "ignored",
      fallbackReason: relevanceParsed.reason || "not_relevant",
      createdItems: [],
      ocrAttempts: attempts,
    };
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
- Use ONLY the email body content.
- OCR/PDF text is unavailable. Do NOT invent details from the PDF.
- Extract multiple SKUs as separate items only if explicitly present in the email body.
- Valid actions: Place Order, Reply to Enquiry, Follow Up, Cancel Order, Confirm Delivery
- NEVER create an item with blank SKU.
- NEVER create a Place Order item unless SKU is explicitly present in the email body.
- If the email only says a PDF/PO is attached but the body does not include SKU/order details, return an empty items array.
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

  const raw = aiResponse.choices[0]?.message?.content || "{}";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { customer: "", po_number: "", items: [] };
  }

  const createdItems: any[] = [];

  if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    const attempts = await markEmailOcrState({
      supabase,
      emailId: email.id,
      status: "processed",
      errorMessage: `OCR blocked, fallback AI ran but found no extractable items. OCR error: ${ocrErrorMessage}`,
      incrementAttempts: true,
    });

    return {
      fallbackUsed: true,
      fallbackStatus: "processed",
      fallbackReason: "No extractable body-only items",
      createdItems,
      ocrAttempts: attempts,
    };
  }

  for (const item of parsed.items) {
    if (!item.sku) continue;

    const payload = {
      provider: email.provider || "",
      action: item.action || "Reply to Enquiry",
      customer: parsed.customer || "",
      po_number: parsed.po_number || "",
      sku: item.sku,
      quantity: item.quantity || null,
      notes: item.notes || "Created by OCR fallback using email body only.",
      status: "New",
      source_email: email.from_email || "",
      gmail_message_id: email.external_message_id || email.gmail_message_id || "",
      external_message_id: email.external_message_id || email.gmail_message_id || "",
      email_subject: email.subject || "",
    };

    const { error: insertError } = await supabase
      .from("order_items")
      .insert(payload);

    if (!insertError) {
      createdItems.push({
        sku: payload.sku,
        action: payload.action,
      });
    }
  }

  const attempts = await markEmailOcrState({
    supabase,
    emailId: email.id,
    status: "processed",
    errorMessage: `OCR blocked, fallback AI processed using email body only. OCR error: ${ocrErrorMessage}`,
    incrementAttempts: true,
  });

  return {
    fallbackUsed: true,
    fallbackStatus: "processed",
    fallbackReason: "Body-only fallback completed",
    createdItems,
    ocrAttempts: attempts,
  };
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  try {
    const { data: emails, error } = await supabase
      .from("emails")
      .select("*")
      .eq("processing_status", "needs_ocr")
      .not("attachment_url", "is", null)
      .order("received_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: "load_email_queue",
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No OCR-ready emails found",
      });
    }

    const skippedRows: any[] = [];

    for (const email of emails) {
      const currentAttempts = Number(email.ocr_attempts || 0);

      if (currentAttempts >= MAX_OCR_ATTEMPTS) {
        skippedRows.push({
          emailId: email.id,
          subject: email.subject,
          reason: "max_ocr_attempts_reached",
          ocrAttempts: currentAttempts,
        });

        await markEmailOcrState({
          supabase,
          emailId: email.id,
          status: "ocr_failed",
          errorMessage: `Max OCR attempts reached (${MAX_OCR_ATTEMPTS})`,
          incrementAttempts: false,
        });

        continue;
      }

      if (!email.attachment_url) {
        await markEmailOcrState({
          supabase,
          emailId: email.id,
          status: "ocr_failed",
          errorMessage: "Missing attachment_url",
          incrementAttempts: true,
        });

        skippedRows.push({
          emailId: email.id,
          subject: email.subject,
          reason: "missing_attachment_url",
        });

        continue;
      }

      try {
        const fileRes = await fetch(email.attachment_url, {
          cache: "no-store",
          redirect: "follow",
        });

        const contentType = fileRes.headers.get("content-type");
        const contentLength = fileRes.headers.get("content-length");

        if (!fileRes.ok) {
          const responsePreview = await fileRes.text().catch(() => "");

          throw new Error(
            JSON.stringify({
              step: "download_attachment",
              error: "Failed to download attachment",
              status: fileRes.status,
              responseContentType: contentType,
              responseContentLength: contentLength,
              responsePreview: responsePreview.slice(0, 500),
              attachmentUrl: email.attachment_url,
            })
          );
        }

        const buffer = Buffer.from(await fileRes.arrayBuffer());

        if (!buffer.length) {
          throw new Error(
            JSON.stringify({
              step: "download_attachment",
              error: "Downloaded attachment buffer is empty",
              responseContentType: contentType,
              responseContentLength: contentLength,
              attachmentUrl: email.attachment_url,
            })
          );
        }

        const hexPreview = getHexPreview(buffer, 24);
        const asciiPreview = getAsciiPreview(buffer, 80);

        if (!looksLikePdf(buffer)) {
          const attempts = await markEmailOcrState({
            supabase,
            emailId: email.id,
            status: "ocr_failed",
            errorMessage: JSON.stringify({
              step: "validate_pdf_signature",
              error: "Downloaded attachment is not a valid PDF signature",
              responseContentType: contentType,
              responseContentLength: contentLength,
              downloadedBytes: buffer.length,
              hexPreview,
              asciiPreview,
              attachmentUrl: email.attachment_url,
            }),
            incrementAttempts: true,
          });

          skippedRows.push({
            emailId: email.id,
            subject: email.subject,
            reason: "not_a_pdf",
            ocrAttempts: attempts,
          });

          continue;
        }

        const result = await extractTextFromPdfWithCloudConvert(
          buffer,
          email.attachment_name || "attachment.pdf"
        );

        const extractedText = result.text.trim();

        if (!extractedText) {
          throw new Error(
            JSON.stringify({
              step: "validate_extracted_text",
              error: "OCR returned empty text",
              jobId: result.jobId,
              strategy: result.strategy,
            })
          );
        }

        const attempts = await markEmailOcrState({
          supabase,
          emailId: email.id,
          status: "ready_for_ai",
          errorMessage: null,
          attachmentText: extractedText,
          incrementAttempts: true,
        });

        const appBaseUrl = getAppBaseUrl();

        const triggerRes = await fetch(`${appBaseUrl}/api/process-emails`, {
          method: "GET",
          cache: "no-store",
        });

        let triggerJson: any = null;

        try {
          triggerJson = await triggerRes.json();
        } catch {
          triggerJson = null;
        }

        return NextResponse.json({
          ok: true,
          emailId: email.id,
          provider: email.provider,
          external_message_id:
            email.external_message_id || email.gmail_message_id || null,
          subject: email.subject,
          attachmentUrl: email.attachment_url,
          responseContentType: contentType,
          responseContentLength: contentLength,
          downloadedBytes: buffer.length,
          hexPreview,
          asciiPreview,
          textPreview: extractedText.slice(0, 1000),
          textLength: extractedText.length,
          ocrJobId: result.jobId,
          ocrStrategy: result.strategy,
          directTextLength: result.directTextLength,
          ocrTextLength: result.ocrTextLength,
          ocrAttempts: attempts,
          skippedRows,
          processEmailsTriggered: triggerRes.ok,
          processEmailsStatus: triggerRes.status,
          processEmailsResult: triggerJson,
        });
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        const creditsExceeded = isCreditsExceeded(errorMessage);
        const nextAttempts = currentAttempts + 1;

        if (creditsExceeded) {
          const fallbackResult = await fallbackToAiUsingEmailBody({
            supabase,
            openai,
            email,
            ocrErrorMessage: errorMessage,
          });

          return NextResponse.json({
            ok: true,
            step: "ocr_blocked_fallback_to_ai",
            emailId: email.id,
            provider: email.provider,
            external_message_id:
              email.external_message_id || email.gmail_message_id || null,
            subject: email.subject,
            originalOcrError: errorMessage,
            fallbackResult,
            skippedRows,
          });
        }

        const attempts = await markEmailOcrState({
          supabase,
          emailId: email.id,
          status: "ocr_failed",
          errorMessage:
            nextAttempts >= MAX_OCR_ATTEMPTS
              ? `Max OCR attempts reached (${MAX_OCR_ATTEMPTS}). Last error: ${errorMessage}`
              : errorMessage,
          incrementAttempts: true,
        });

        skippedRows.push({
          emailId: email.id,
          subject: email.subject,
          reason:
            nextAttempts >= MAX_OCR_ATTEMPTS
              ? "max_ocr_attempts_reached"
              : "ocr_failed",
          error: errorMessage,
          ocrAttempts: attempts,
        });

        continue;
      }
    }

    return NextResponse.json({
      ok: true,
      message: "OCR cycle completed",
      skippedRows,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        step: "catch",
        error: getErrorMessage(err),
      },
      { status: 500 }
    );
  }
}