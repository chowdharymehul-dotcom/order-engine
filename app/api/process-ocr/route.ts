export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAppBaseUrl } from "@/lib/ocr";

const MAX_OCR_ATTEMPTS = 5;
const MIN_USEFUL_TEXT_LENGTH = 20;
const MAX_SCANNED_PDF_PAGES = 3;
const OCR_SCALE = 2;

type OcrResult = {
  text: string;
  method: string;
  jobId?: string | null;
  strategy?: string | null;
  directTextLength?: number | null;
  ocrTextLength?: number | null;
};

function cleanOcrText(value: any) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown OCR error";
}

function looksLikePdf(buffer: Buffer) {
  return (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("utf8") === "%PDF-"
  );
}

function isTextLike(filename: string | null, contentType: string | null) {
  const lowerName = (filename || "").toLowerCase();
  const lowerType = (contentType || "").toLowerCase();

  return (
    lowerType.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".xml")
  );
}

function isImageLike(filename: string | null, contentType: string | null) {
  const lowerName = (filename || "").toLowerCase();
  const lowerType = (contentType || "").toLowerCase();

  return (
    lowerType.startsWith("image/") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp")
  );
}

function isCreditsExceeded(errorMessage: string) {
  const lower = errorMessage.toLowerCase();

  return (
    lower.includes("credits_exceeded") ||
    lower.includes("run out of conversion credits") ||
    lower.includes("out of conversion credits")
  );
}

function getAsciiPreview(buffer: Buffer, length = 120) {
  return buffer
    .subarray(0, length)
    .toString("utf8")
    .replace(/[^\x20-\x7E]/g, ".");
}

function getHexPreview(buffer: Buffer, length = 24) {
  return buffer.subarray(0, length).toString("hex");
}

async function runtimeImport(moduleName: string) {
  const importer = new Function("moduleName", "return import(moduleName)");
  return importer(moduleName);
}

async function getRecognize() {
  const tesseract = await runtimeImport("tesseract.js");
  const recognize = tesseract.recognize || tesseract.default?.recognize;

  if (!recognize) {
    throw new Error("Tesseract recognize function not found");
  }

  return recognize;
}

async function markOutboundIgnored(params: {
  supabase: any;
  emailId: string;
}) {
  const { supabase, emailId } = params;

  await supabase
    .from("emails")
    .update({
      processing_status: "ignored",
      last_processing_error: "Outbound/sent email permanently ignored before OCR",
      processed_at: new Date().toISOString(),
    })
    .eq("id", emailId);
}

async function renderPdfPageToPng(params: {
  pdf: any;
  pageNumber: number;
  scale?: number;
}) {
  const { pdf, pageNumber, scale = OCR_SCALE } = params;

  const canvasModule = await runtimeImport("@napi-rs/canvas");
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = canvasModule.createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height)
  );

  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toBuffer("image/png");
}

async function extractScannedPdfWithTesseract(buffer: Buffer) {
  const pdfjsLib = await runtimeImport("pdfjs-dist/legacy/build/pdf.mjs");
  const recognize = await getRecognize();

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  } as any).promise;

  try {
    const maxPages = Math.min(
      Number(pdf.numPages || 0),
      MAX_SCANNED_PDF_PAGES
    );

    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const imageBuffer = await renderPdfPageToPng({
        pdf,
        pageNumber,
        scale: OCR_SCALE,
      });

      const result = await recognize(imageBuffer, "eng");
      const text = cleanOcrText(result?.data?.text || "");

      if (text) pageTexts.push(text);
    }

    return cleanOcrText(pageTexts.join("\n\n"));
  } finally {
    await (pdf as any).destroy?.();
  }
}

async function extractTextFromImageWithTesseract(params: {
  buffer: Buffer;
}) {
  const recognize = await getRecognize();
  const result = await recognize(params.buffer, "eng");

  return cleanOcrText(result?.data?.text || "");
}

async function extractTextFromAttachment(params: {
  attachmentUrl: string;
  filename: string;
  contentType: string | null;
  buffer: Buffer;
}) {
  const { attachmentUrl, filename, contentType, buffer } = params;
if (looksLikePdf(buffer)) {
  const {
    extractTextFromPdfWithCloudConvert,
  } = await import("@/lib/cloudconvert-ocr");

  const result = await extractTextFromPdfWithCloudConvert(
    buffer,
    filename
  );

  return {
    text: result.text,
    method: "local_pdf_pipeline",
    jobId: result.jobId,
    strategy: result.strategy,
    directTextLength: result.directTextLength,
    ocrTextLength: result.ocrTextLength,
  };
}

  if (isTextLike(filename, contentType)) {
    return {
      text: buffer.toString("utf8").trim(),
      method: "direct_text",
      jobId: null,
      strategy: "direct_text",
      directTextLength: buffer.length,
      ocrTextLength: 0,
    } satisfies OcrResult;
  }

  if (isImageLike(filename, contentType)) {
    const text = await extractTextFromImageWithTesseract({ buffer });

    return {
      text,
      method: "local_image_tesseract",
      jobId: null,
      strategy: "image_tesseract",
      directTextLength: 0,
      ocrTextLength: text.length,
    } satisfies OcrResult;
  }

  throw new Error(
    JSON.stringify({
      step: "unsupported_attachment_type",
      error: "Attachment is not PDF, text, or image-readable",
      filename,
      contentType,
      downloadedBytes: buffer.length,
      hexPreview: getHexPreview(buffer),
      asciiPreview: getAsciiPreview(buffer),
      attachmentUrl,
    })
  );
}

async function markEmail(params: {
  supabase: any;
  emailId: string;
  processingStatus: string;
  attachmentText?: string | null;
  errorMessage?: string | null;
  incrementAttempts?: boolean;
}) {
  const {
    supabase,
    emailId,
    processingStatus,
    attachmentText = null,
    errorMessage = null,
    incrementAttempts = false,
  } = params;

  const { data: existing } = await supabase
    .from("emails")
    .select("ocr_attempts")
    .eq("id", emailId)
    .maybeSingle();

  const currentAttempts = Number(existing?.ocr_attempts || 0);
  const nextAttempts = incrementAttempts ? currentAttempts + 1 : currentAttempts;

  const payload: Record<string, any> = {
    processing_status: processingStatus,
    last_processing_error: errorMessage,
    ocr_attempts: nextAttempts,
  };

  if (attachmentText !== null) {
    payload.attachment_text = attachmentText;
  }

  const { error } = await supabase
    .from("emails")
    .update(payload)
    .eq("id", emailId);

  if (error) {
    throw new Error(`Failed to update email OCR state: ${error.message}`);
  }

  return nextAttempts;
}

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const emailId = req.nextUrl.searchParams.get("emailId");
    const force = req.nextUrl.searchParams.get("force") === "true";

    let query = supabase
      .from("emails")
      .select("*")
      .not("attachment_url", "is", null)
      .order("received_at", { ascending: false })
      .limit(emailId ? 1 : 10);

    if (emailId) {
      query = query.eq("id", emailId);
    }

    const { data: rows, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: "load_ocr_candidates",
          error: error.message,
        },
        { status: 500 }
      );
    }

    const outboundRows = (rows || []).filter(
      (email: any) => email.direction === "OUTBOUND"
    );

    for (const email of outboundRows) {
      await markOutboundIgnored({
        supabase,
        emailId: email.id,
      });
    }

    const emails = (rows || []).filter((email: any) => {
      if (email.direction === "OUTBOUND") return false;

      const hasText = !!String(email.attachment_text || "").trim();
      const attempts = Number(email.ocr_attempts || 0);
      const status = email.processing_status || "";

      if (force) return true;
      if (hasText) return false;
      if (status === "processed" || status === "ignored") return false;
      if (attempts >= MAX_OCR_ATTEMPTS && !emailId) return false;

      return true;
    });

    if (emails.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No OCR-ready attachments found",
        checkedRows: rows?.length || 0,
        outboundIgnored: outboundRows.length,
        hint:
          "If testing one email, use /api/process-ocr?emailId=EMAIL_UUID&force=true",
      });
    }

    const results: any[] = [];

    for (const email of emails) {
      const currentAttempts = Number(email.ocr_attempts || 0);

      if (!force && currentAttempts >= MAX_OCR_ATTEMPTS) {
        const attempts = await markEmail({
          supabase,
          emailId: email.id,
          processingStatus: "ocr_failed",
          errorMessage: `Max OCR attempts reached (${MAX_OCR_ATTEMPTS})`,
          incrementAttempts: false,
        });

        results.push({
          ok: false,
          emailId: email.id,
          subject: email.subject,
          step: "max_attempts",
          ocrAttempts: attempts,
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
          throw new Error(
            JSON.stringify({
              step: "download_attachment",
              error: "Failed to download attachment",
              status: fileRes.status,
              contentType,
              contentLength,
              attachmentUrl: email.attachment_url,
            })
          );
        }

        const buffer = Buffer.from(await fileRes.arrayBuffer());

        if (!buffer.length) {
          throw new Error(
            JSON.stringify({
              step: "download_attachment",
              error: "Downloaded attachment was empty",
              contentType,
              contentLength,
              attachmentUrl: email.attachment_url,
            })
          );
        }

        const filename =
          email.attachment_name ||
          email.subject ||
          `attachment-${email.id}.pdf`;

        const extracted = await extractTextFromAttachment({
          attachmentUrl: email.attachment_url,
          filename,
          contentType,
          buffer,
        });

        const text = extracted.text.trim();

        if (!text) {
          throw new Error(
            JSON.stringify({
              step: "validate_extracted_text",
              error: "OCR completed but returned empty text",
              method: extracted.method,
              jobId: extracted.jobId || null,
              strategy: extracted.strategy || null,
              contentType,
              contentLength,
              downloadedBytes: buffer.length,
              hexPreview: getHexPreview(buffer),
              asciiPreview: getAsciiPreview(buffer),
            })
          );
        }

        const attempts = await markEmail({
          supabase,
          emailId: email.id,
          processingStatus: "ready_for_ai",
          attachmentText: text,
          errorMessage: null,
          incrementAttempts: true,
        });

        let processEmailsResult: any = null;
        let processEmailsStatus: number | null = null;

        try {
          const appBaseUrl = getAppBaseUrl();

          const processRes = await fetch(`${appBaseUrl}/api/process-emails`, {
            method: "GET",
            cache: "no-store",
          });

          processEmailsStatus = processRes.status;

          try {
            processEmailsResult = await processRes.json();
          } catch {
            processEmailsResult = null;
          }
        } catch (triggerError: any) {
          processEmailsResult = {
            ok: false,
            error: triggerError?.message || "Failed to trigger process-emails",
          };
        }

        results.push({
          ok: true,
          emailId: email.id,
          provider: email.provider,
          subject: email.subject,
          attachmentName: email.attachment_name,
          attachmentUrl: email.attachment_url,
          contentType,
          contentLength,
          downloadedBytes: buffer.length,
          method: extracted.method,
          strategy: extracted.strategy,
          jobId: extracted.jobId || null,
          directTextLength: extracted.directTextLength || 0,
          ocrTextLength: extracted.ocrTextLength || 0,
          textLength: text.length,
          textPreview: text.slice(0, 1000),
          ocrAttempts: attempts,
          processEmailsStatus,
          processEmailsResult,
        });
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        const creditsExceeded = isCreditsExceeded(errorMessage);

        const attempts = await markEmail({
          supabase,
          emailId: email.id,
          processingStatus: creditsExceeded ? "ocr_blocked" : "ocr_failed",
          errorMessage,
          incrementAttempts: true,
        });

        results.push({
          ok: false,
          emailId: email.id,
          provider: email.provider,
          subject: email.subject,
          step: creditsExceeded ? "ocr_blocked" : "ocr_failed",
          error: errorMessage,
          ocrAttempts: attempts,
        });

        continue;
      }
    }

    return NextResponse.json({
      ok: true,
      outboundIgnored: outboundRows.length,
      processed: results.length,
      results,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        step: "process_ocr_catch",
        error: getErrorMessage(err),
      },
      { status: 500 }
    );
  }
}