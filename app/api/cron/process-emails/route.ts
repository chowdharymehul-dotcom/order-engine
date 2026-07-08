export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

async function runStep(name: string, url: string, authHeader: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: authHeader,
      },
      cache: "no-store",
    });

    const text = await response.text();

    let parsed: any = null;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return {
      name,
      ok: response.ok,
      status: response.status,
      result: parsed,
    };
  } catch (error: any) {
    return {
      name,
      ok: false,
      status: 500,
      error: error?.message || String(error),
    };
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const gmailFetch = await runStep(
    "gmail_fetch",
    `${baseUrl}/api/gmail/fetch`,
    expected
  );

  const outlookFetch = await runStep(
    "outlook_fetch",
    `${baseUrl}/api/outlook/fetch`,
    expected
  );

  const processEmails = await runStep(
    "process_emails",
    `${baseUrl}/api/process-emails`,
    expected
  );

  return NextResponse.json({
    ok: gmailFetch.ok && outlookFetch.ok && processEmails.ok,
    steps: [gmailFetch, outlookFetch, processEmails],
  });
}