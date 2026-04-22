export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { extractTextFromPdfWithCloudConvert } from "@/lib/cloudconvert-ocr";

export async function GET(req: NextRequest) {
  try {
    const file = req.nextUrl.searchParams.get("file");

    if (!file) {
      return NextResponse.json(
        { error: "Missing file path" },
        { status: 400 }
      );
    }

    const filePath = path.resolve(file);
    const buffer = await readFile(filePath);

    const result = await extractTextFromPdfWithCloudConvert(
      buffer,
      path.basename(filePath)
    );

    return NextResponse.json({
      ok: true,
      textPreview: result.text.slice(0, 1000),
      textLength: result.text.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}