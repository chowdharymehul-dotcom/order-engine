import { PDFParse } from "pdf-parse";

type ExtractTextResult = {
  text: string;
  jobId: string;
  strategy: "direct" | "ocr";
  directTextLength: number;
  ocrTextLength: number;
};

const MIN_USEFUL_TEXT_LENGTH = 5;
const MAX_OCR_PAGES = 10;
const OCR_SCALE = 2;

function cleanExtractedText(text: string) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDirectPdfText(buffer: Buffer) {
  try {
    const parser = new PDFParse({ data: buffer });

    try {
      const parsed = await parser.getText();
      return cleanExtractedText(parsed.text || "");
    } finally {
      await parser.destroy();
    }
  } catch {
    return "";
  }
}


export async function extractTextFromPdfWithCloudConvert(
  buffer: Buffer,
  filename: string
): Promise<ExtractTextResult> {
  const directText = await extractDirectPdfText(buffer);

  if (directText.length >= MIN_USEFUL_TEXT_LENGTH) {
    return {
      text: directText,
      jobId: `pdf-direct-${Date.now()}`,
      strategy: "direct",
      directTextLength: directText.length,
      ocrTextLength: 0,
    };
  }

  throw new Error(
    JSON.stringify({
      step: "pdf_text_extraction",
      error: "No embedded text found in PDF",
      filename,
      directTextLength: directText.length,
      directPreview: directText.slice(0, 500),
    })
  );
}