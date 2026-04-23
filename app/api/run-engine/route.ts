export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/ocr";

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // ✅ Allow Vercel cron automatically
  const userAgent = req.headers.get("user-agent") || "";
  if (userAgent.toLowerCase().includes("vercel")) {
    return true;
  }

  // ✅ Allow if no secret set (dev fallback)
  if (!cronSecret) {
    return true;
  }

  // ✅ Allow manual calls with secret
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const appBaseUrl = getAppBaseUrl();

    const processEmailsRes1 = await fetch(`${appBaseUrl}/api/process-emails`, {
      method: "GET",
      cache: "no-store",
    });

    const processEmailsJson1 = await safeJson(processEmailsRes1);

    const processOcrRes = await fetch(`${appBaseUrl}/api/process-ocr`, {
      method: "GET",
      cache: "no-store",
    });

    const processOcrJson = await safeJson(processOcrRes);

    const processEmailsRes2 = await fetch(`${appBaseUrl}/api/process-emails`, {
      method: "GET",
      cache: "no-store",
    });

    const processEmailsJson2 = await safeJson(processEmailsRes2);

    return NextResponse.json({
      ok: true,
      engine: "run-engine",
      processEmailsPass1: {
        status: processEmailsRes1.status,
        result: processEmailsJson1,
      },
      processOcr: {
        status: processOcrRes.status,
        result: processOcrJson,
      },
      processEmailsPass2: {
        status: processEmailsRes2.status,
        result: processEmailsJson2,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "run_engine_catch",
        error: error?.message || "Unknown engine error",
      },
      { status: 500 }
    );
  }
}