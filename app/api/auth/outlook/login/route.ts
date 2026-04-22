import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
    response_mode: "query",
    scope: "openid profile email offline_access Mail.Read",
  });

  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

  return NextResponse.redirect(url);
}