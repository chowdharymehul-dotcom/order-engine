export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/ocr";

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const userAgent = req.headers.get("user-agent") || "";

  if (userAgent.toLowerCase().includes("vercel-cron")) {
    return true;
  }

  if (!cronSecret) {
    return true;
  }

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

async function callRoute(appBaseUrl: string, route: string) {
  const res = await fetch(`${appBaseUrl}${route}`, {
    method: "GET",
    cache: "no-store",
  });

  return {
    route,
    status: res.status,
    result: await safeJson(res),
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          step: "auth",
          error: "Unauthorized",
          userAgent: req.headers.get("user-agent"),
        },
        { status: 401 }
      );
    }

    const appBaseUrl = getAppBaseUrl();

    const gmailFetch = await callRoute(appBaseUrl, "/api/gmail/fetch");

    const processEmailsPass1 = await callRoute(
      appBaseUrl,
      "/api/process-emails"
    );

    const processOcr = await callRoute(appBaseUrl, "/api/process-ocr");

    const processEmailsPass2 = await callRoute(
      appBaseUrl,
      "/api/process-emails"
    );

    return NextResponse.json({
      ok: true,
      engine: "run-engine",
      appBaseUrl,
      gmailFetch,
      processEmailsPass1,
      processOcr,
      processEmailsPass2,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "run_engine_catch",
        error: error?.message || "Unknown engine error",
        appBaseUrlEnv: process.env.APP_BASE_URL || null,
        hasCronSecret: !!process.env.CRON_SECRET,
      },
      { status: 500 }
    );
  }
}