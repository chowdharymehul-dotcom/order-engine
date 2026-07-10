import { PDFParse } from "pdf-parse";

type ExtractTextResult = {
  text: string;
  jobId: string;
  strategy: "direct" | "ocr";
  directTextLength: number;
  ocrTextLength: number;
};

const MIN_USEFUL_TEXT_LENGTH = 20;
const MAX_OCR_PAGES = 3;
const OCR_SCALE = 2;

function cleanExtractedText(text: string) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function runtimeImport(moduleName: string) {
  const importer = new Function("moduleName", "return import(moduleName)");
  return importer(moduleName);
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

async function extractScannedPdfTextWithTesseract(buffer: Buffer) {
  const pdfjsLib = await runtimeImport("pdfjs-dist/legacy/build/pdf.mjs");
  const tesseract = await runtimeImport("tesseract.js");

  const recognize = tesseract.recognize || tesseract.default?.recognize;

  if (!recognize) {
    throw new Error("Tesseract recognize function not found");
  }

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  } as any).promise;

  try {
    const pageCount = Math.min(Number(pdf.numPages || 0), MAX_OCR_PAGES);
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const imageBuffer = await renderPdfPageToPng({
        pdf,
        pageNumber,
        scale: OCR_SCALE,
      });

      const result = await recognize(imageBuffer, "eng");
      const text = cleanExtractedText(result?.data?.text || "");

      if (text) pageTexts.push(text);
    }

    return cleanExtractedText(pageTexts.join("\n\n"));
  } finally {
    await (pdf as any).destroy?.();
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
      jobId: `local-pdf-parse-${Date.now()}`,
      strategy: "direct",
      directTextLength: directText.length,
      ocrTextLength: 0,
    };
  }

  const ocrText = await extractScannedPdfTextWithTesseract(buffer);

  if (ocrText.length >= MIN_USEFUL_TEXT_LENGTH) {
    return {
      text: ocrText,
      jobId: `local-tesseract-pdf-${Date.now()}`,
      strategy: "ocr",
      directTextLength: directText.length,
      ocrTextLength: ocrText.length,
    };
  }

  throw new Error(
    JSON.stringify({
      step: "local_pdf_ocr",
      error:
        "Both local PDF text extraction and local scanned-PDF OCR returned empty/too-short text",
      filename,
      directTextLength: directText.length,
      ocrTextLength: ocrText.length,
      directPreview: directText.slice(0, 300),
      ocrPreview: ocrText.slice(0, 300),
    })
  );
}