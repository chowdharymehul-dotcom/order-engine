import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = req.nextUrl.origin;

  const response = await fetch(`${baseUrl}/api/process-emails`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    cache: "no-store",
  });

  const result = await response.json();

  return NextResponse.json({
    ok: true,
    triggered: true,
    processResult: result,
  });
}