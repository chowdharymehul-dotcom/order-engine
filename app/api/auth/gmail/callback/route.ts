export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function clean(value: any) {
  return String(value || "").trim();
}

function decodeJwtPayload(token: string | null | undefined) {
  try {
    const value = clean(token);
    const payload = value.split(".")[1];

    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getEmailFromTokenData(tokenData: any) {
  const decoded = decodeJwtPayload(tokenData?.id_token);

  return (
    clean(decoded?.email).toLowerCase() ||
    clean(decoded?.upn).toLowerCase() ||
    clean(decoded?.unique_name).toLowerCase() ||
    ""
  );
}

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

    const accessToken = clean(tokenData.access_token);
    const refreshToken = clean(tokenData.refresh_token);
    const expiresIn = Number(tokenData.expires_in || 3600);
    const scope = clean(tokenData.scope);
    const accountEmail = getEmailFromTokenData(tokenData);

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
            "Google did not return a refresh token. Please disconnect the app from Google Account permissions and reconnect Gmail.",
          tokenData,
        },
        { status: 400 }
      );
    }

    if (!scope.includes("https://www.googleapis.com/auth/gmail.send")) {
      return NextResponse.json(
        {
          ok: false,
          step: "missing_gmail_send_scope",
          error: "Gmail send permission was not granted.",
          scope,
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("inbox_connections")
      .update({
        connection_status: "inactive",
        last_error: "Replaced by newer Gmail connection",
      })
      .eq("provider", "gmail");

    const { error: insertError } = await supabase
      .from("inbox_connections")
      .insert({
        provider: "gmail",
        account_email: accountEmail || null,
        access_token: accessToken,
        refresh_token: refreshToken,
        scope,
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

    return NextResponse.redirect(`${appBaseUrl}/customers`);
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