export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { assertOcrConfig } from "@/lib/ocr";

export async function GET() {
  try {
    const result = assertOcrConfig();

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      message: "OCR config is valid",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
