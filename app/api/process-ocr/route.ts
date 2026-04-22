export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTextFromPdfWithCloudConvert } from "@/lib/cloudconvert-ocr";
import { getAppBaseUrl } from "@/lib/ocr";

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

    const invalidRows: any[] = [];

    for (const email of emails) {
      if (!email.attachment_url) {
        await supabase
          .from("emails")
          .update({
            processing_status: "ocr_failed",
          })
          .eq("id", email.id);

        invalidRows.push({
          emailId: email.id,
          subject: email.subject,
          reason: "missing_attachment_url",
        });

        continue;
      }

      const fileRes = await fetch(email.attachment_url, {
        cache: "no-store",
        redirect: "follow",
      });

      const contentType = fileRes.headers.get("content-type");
      const contentLength = fileRes.headers.get("content-length");

      if (!fileRes.ok) {
        const bodyText = await fileRes.text().catch(() => "");

        await supabase
          .from("emails")
          .update({
            processing_status: "ocr_failed",
          })
          .eq("id", email.id);

        invalidRows.push({
          emailId: email.id,
          subject: email.subject,
          reason: "download_failed",
          status: fileRes.status,
          responseContentType: contentType,
          responseContentLength: contentLength,
          responseBodyPreview: bodyText.slice(0, 300),
          attachmentUrl: email.attachment_url,
        });

        continue;
      }

      const buffer = Buffer.from(await fileRes.arrayBuffer());

      const hexPreview = getHexPreview(buffer, 24);
      const asciiPreview = getAsciiPreview(buffer, 80);
      const isPdf = looksLikePdf(buffer);

      if (!buffer.length) {
        await supabase
          .from("emails")
          .update({
            processing_status: "ocr_failed",
          })
          .eq("id", email.id);

        invalidRows.push({
          emailId: email.id,
          subject: email.subject,
          reason: "empty_attachment_buffer",
          responseContentType: contentType,
          responseContentLength: contentLength,
          attachmentUrl: email.attachment_url,
        });

        continue;
      }

      if (!isPdf) {
        await supabase
          .from("emails")
          .update({
            processing_status: "ocr_failed",
          })
          .eq("id", email.id);

        invalidRows.push({
          emailId: email.id,
          subject: email.subject,
          reason: "not_a_pdf",
          responseContentType: contentType,
          responseContentLength: contentLength,
          downloadedBytes: buffer.length,
          hexPreview,
          asciiPreview,
          attachmentUrl: email.attachment_url,
        });

        continue;
      }

      const result = await extractTextFromPdfWithCloudConvert(
        buffer,
        "attachment.pdf"
      );

      const extractedText = result.text.trim();

      if (!extractedText) {
        await supabase
          .from("emails")
          .update({
            processing_status: "ocr_failed",
          })
          .eq("id", email.id);

        return NextResponse.json(
          {
            ok: false,
            step: "validate_extracted_text",
            error: "OCR returned empty text",
            emailId: email.id,
            subject: email.subject,
            jobId: result.jobId,
            strategy: result.strategy,
            skippedInvalidRows: invalidRows,
          },
          { status: 500 }
        );
      }

      const { error: updateError } = await supabase
        .from("emails")
        .update({
          attachment_text: extractedText,
          processing_status: "ready_for_ai",
        })
        .eq("id", email.id);

      if (updateError) {
        return NextResponse.json(
          {
            ok: false,
            step: "save_ocr_text",
            error: updateError.message,
            emailId: email.id,
            subject: email.subject,
            skippedInvalidRows: invalidRows,
          },
          { status: 500 }
        );
      }

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
        skippedInvalidRows: invalidRows,
        processEmailsTriggered: triggerRes.ok,
        processEmailsStatus: triggerRes.status,
        processEmailsResult: triggerJson,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "No valid PDF attachments found in OCR queue",
      skippedInvalidRows: invalidRows,
    });
  } catch (err: any) {
    const message =
      err instanceof Error ? err.message : "Unknown OCR processing error";

    return NextResponse.json(
      {
        ok: false,
        step: "catch",
        error: message,
      },
      { status: 500 }
    );
  }
}