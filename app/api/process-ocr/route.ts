export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

function extractStructuredError(errorMessage: string) {
  try {
    return JSON.parse(errorMessage);
  } catch {
    return null;
  }
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown OCR processing error";
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
  status: "ocr_failed" | "ocr_blocked" | "ready_for_ai";
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

  const nextAttempts = incrementAttempts
    ? Number(existingRow?.ocr_attempts || 0) + 1
    : Number(existingRow?.ocr_attempts || 0);

  const updatePayload: Record<string, any> = {
    processing_status: status,
    last_processing_error: errorMessage,
    ocr_attempts: nextAttempts,
  };

  if (attachmentText !== null) {
    updatePayload.attachment_text = attachmentText;
  }

  await supabase.from("emails").update(updatePayload).eq("id", emailId);
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: emails, error } = await supabase
      .from("emails")
      .select("*")
      .eq("processing_status", "needs_ocr")
      .not("attachment_url", "is", null)
      .lt("ocr_attempts", MAX_OCR_ATTEMPTS) // 🔥 retry limit
      .order("received_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { ok: false, step: "load_email_queue", error: error.message },
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
      try {
        const fileRes = await fetch(email.attachment_url, {
          cache: "no-store",
          redirect: "follow",
        });

        const contentType = fileRes.headers.get("content-type");
        const contentLength = fileRes.headers.get("content-length");

        if (!fileRes.ok) {
          throw new Error("Download failed");
        }

        const buffer = Buffer.from(await fileRes.arrayBuffer());

        if (!buffer.length) {
          throw new Error("Empty file buffer");
        }

        const isPdf = looksLikePdf(buffer);

        if (!isPdf) {
          await markEmailOcrState({
            supabase,
            emailId: email.id,
            status: "ocr_failed",
            errorMessage: "Not a valid PDF",
            incrementAttempts: true,
          });
          continue;
        }

        const result = await extractTextFromPdfWithCloudConvert(
          buffer,
          email.attachment_name || "attachment.pdf"
        );

        const extractedText = result.text.trim();

        if (!extractedText) {
          throw new Error("OCR returned empty text");
        }

        await markEmailOcrState({
          supabase,
          emailId: email.id,
          status: "ready_for_ai",
          attachmentText: extractedText,
          incrementAttempts: true,
        });

        // 🔥 trigger AI processing automatically
        const appBaseUrl = getAppBaseUrl();
        await fetch(`${appBaseUrl}/api/process-emails`, {
          method: "GET",
          cache: "no-store",
        });

        return NextResponse.json({
          ok: true,
          emailId: email.id,
          textLength: extractedText.length,
          ocrAttempts: Number(email.ocr_attempts || 0) + 1,
          strategy: result.strategy,
        });
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        const creditsExceeded = isCreditsExceeded(errorMessage);

        const nextAttempts = Number(email.ocr_attempts || 0) + 1;

        // 🔥 if max reached → permanently fail
        if (nextAttempts >= MAX_OCR_ATTEMPTS && !creditsExceeded) {
          await markEmailOcrState({
            supabase,
            emailId: email.id,
            status: "ocr_failed",
            errorMessage: "Max OCR attempts reached",
            incrementAttempts: true,
          });

          continue;
        }

        await markEmailOcrState({
          supabase,
          emailId: email.id,
          status: creditsExceeded ? "ocr_blocked" : "ocr_failed",
          errorMessage,
          incrementAttempts: true,
        });

        if (creditsExceeded) {
          return NextResponse.json(
            {
              ok: false,
              step: "ocr_blocked",
              emailId: email.id,
              error: errorMessage,
            },
            { status: 402 }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "OCR cycle completed",
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