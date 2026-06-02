export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: "google_callback_error",
          error,
          error_description: errorDescription,
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          step: "missing_code",
          error: "Missing code",
        },
        { status: 400 }
      );
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          step: "token_exchange",
          error: tokenData,
        },
        { status: 400 }
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          step: "missing_access_token",
          error: "Google did not return an access token",
          tokenData,
        },
        { status: 400 }
      );
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          ok: false,
          step: "missing_refresh_token",
          error:
            "Google did not return a refresh token. Visit /api/auth/gmail/login again after ensuring prompt=consent and access_type=offline are set.",
          tokenData,
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(
      Date.now() + Number(expiresIn || 3600) * 1000
    ).toISOString();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: insertError } = await supabase
      .from("inbox_connections")
      .insert({
        provider: "gmail",
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        connection_status: "active",
        last_error: null,
      });

    if (insertError) {
      return NextResponse.json(
        {
          ok: false,
          step: "save_connection",
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    const appBaseUrl =
      process.env.APP_BASE_URL ||
      req.nextUrl.origin ||
      "http://localhost:3000";

    return NextResponse.redirect(appBaseUrl);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "gmail_callback_catch",
        error: err?.message || "Unknown Gmail callback error",
      },
      { status: 500 }
    );
  }
}