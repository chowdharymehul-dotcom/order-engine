export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  console.log("CRON route invoked");
  console.log("Has auth header:", !!authHeader);

  if (authHeader !== expected) {
    console.error("CRON unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!;

    const response = await fetch(`${baseUrl}/api/process-emails`, {
      method: "GET",
      headers: {
        authorization: expected,
      },
      cache: "no-store",
    });

    const text = await response.text();

    console.log("process-emails status:", response.status);
    console.log("process-emails raw response:", text);

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return NextResponse.json({
      ok: true,
      processStatus: response.status,
      processResult: parsed,
    });
  } catch (error: any) {
    console.error("CRON execution failed:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}