import pdfParse from "pdf-parse/lib/pdf-parse.js";

type ExtractTextResult = {
  text: string;
  jobId: string;
  strategy: "direct" | "ocr";
  directTextLength: number;
  ocrTextLength: number;
};

const MIN_USEFUL_TEXT_LENGTH = 5;

function cleanExtractedText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDirectPdfText(buffer: Buffer) {
  try {
    const parsed = await pdfParse(buffer);

    return {
      text: cleanExtractedText(parsed.text),
      pages: Number(parsed.numpages || 0),
      info: parsed.info || null,
      error: null as string | null,
    };
  } catch (error: unknown) {
    return {
      text: "",
      pages: 0,
      info: null,
      error:
        error instanceof Error
          ? error.message
          : "Unknown direct PDF extraction error",
    };
  }
}

export async function extractTextFromPdfWithCloudConvert(
  buffer: Buffer,
  filename: string
): Promise<ExtractTextResult> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(
      JSON.stringify({
        step: "validate_pdf_buffer",
        error: "PDF buffer is empty or invalid",
        filename,
        downloadedBytes: Buffer.isBuffer(buffer) ? buffer.length : 0,
      })
    );
  }

  const pdfHeader = buffer.subarray(0, 5).toString("utf8");

  if (pdfHeader !== "%PDF-") {
    throw new Error(
      JSON.stringify({
        step: "validate_pdf_signature",
        error: "Downloaded attachment does not have a valid PDF signature",
        filename,
        downloadedBytes: buffer.length,
        header: pdfHeader,
      })
    );
  }

  const directResult = await extractDirectPdfText(buffer);
  const directText = directResult.text;

  console.log("PDF TEXT EXTRACTION", {
    filename,
    downloadedBytes: buffer.length,
    pages: directResult.pages,
    directTextLength: directText.length,
    directPreview: directText.slice(0, 500),
    extractionError: directResult.error,
  });

  if (directText.length >= MIN_USEFUL_TEXT_LENGTH) {
    return {
      text: directText,
      jobId: `local-pdf-parse-v1-${Date.now()}`,
      strategy: "direct",
      directTextLength: directText.length,
      ocrTextLength: 0,
    };
  }

  throw new Error(
    JSON.stringify({
      step: "direct_pdf_text_extraction",
      error: directResult.error
        ? `PDF parsing failed: ${directResult.error}`
        : "PDF contains no readable embedded text",
      filename,
      downloadedBytes: buffer.length,
      pages: directResult.pages,
      directTextLength: directText.length,
      directPreview: directText.slice(0, 500),
      requiresScannedPdfOcr: true,
    })
  );
}