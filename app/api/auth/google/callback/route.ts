import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);

  // 🔐 SERVER-ONLY CLIENT (BYPASSES RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin.from("inbox_connections").insert({
    provider: "gmail",
    access_token: tokens.access_token || "",
    refresh_token: tokens.refresh_token || "",
    scope: tokens.scope || "",
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to save Gmail connection", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.redirect(new URL("/", req.url));
}