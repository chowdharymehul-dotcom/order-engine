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
  const text = await res.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

async function callRoute(appBaseUrl: string, route: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const res = await fetch(`${appBaseUrl}${route}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      ok: res.ok,
      route,
      status: res.status,
      result: await safeJson(res),
    };
  } catch (error: any) {
    return {
      ok: false,
      route,
      status: 500,
      error: error?.message || "Route call failed",
    };
  }
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
    const outlookFetch = await callRoute(appBaseUrl, "/api/outlook/fetch");

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
      outlookFetch,
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