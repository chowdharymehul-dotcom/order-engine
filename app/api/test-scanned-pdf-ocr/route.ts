import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function cleanText(value: string) {
  return String(value || "")
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

function toImageDataUrl(imageBuffer: Buffer) {
  return `data:image/png;base64,${Buffer.from(imageBuffer).toString("base64")}`;
}

async function getRecognize() {
  const tesseract = await runtimeImport("tesseract.js");
  const recognize = tesseract.recognize || tesseract.default?.recognize;

  if (!recognize) {
    throw new Error("Tesseract recognize function not found");
  }

  return recognize;
}

async function renderPdfPageToPng(params: {
  pdf: any;
  pageNumber: number;
  scale?: number;
}) {
  const { pdf, pageNumber, scale = 2 } = params;

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

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json({
        ok: false,
        error: "Missing ?url=PDF_URL",
      });
    }

    const pdfjsLib = await runtimeImport("pdfjs-dist/legacy/build/pdf.mjs");
    const recognize = await getRecognize();

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "download_pdf",
          error: `Failed to download PDF: ${response.status}`,
        },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    } as any).promise;

    const maxPages = Math.min(Number(pdf.numPages || 0), 3);
    const pageResults: any[] = [];
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const imageBuffer = await renderPdfPageToPng({
        pdf,
        pageNumber,
        scale: 2,
      });

      const ocrResult = await recognize(toImageDataUrl(imageBuffer), "eng");
      const text = cleanText(ocrResult?.data?.text || "");

      pageResults.push({
        pageNumber,
        imageBytes: imageBuffer.length,
        textLength: text.length,
        preview: text.slice(0, 500),
      });

      if (text) pageTexts.push(text);
    }

    await (pdf as any).destroy?.();

    const finalText = cleanText(pageTexts.join("\n\n"));

    return NextResponse.json({
      ok: true,
      method: "pdfjs_canvas_tesseract",
      pdfjsVersion: pdfjsLib.version || null,
      bytes: buffer.length,
      pages: pdf.numPages,
      processedPages: maxPages,
      textLength: finalText.length,
      textPreview: finalText.slice(0, 1500),
      pageResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "test_scanned_pdf_ocr",
        error: error?.message || "Failed scanned PDF OCR test",
        stack: error?.stack || null,
      },
      { status: 500 }
    );
  }
}