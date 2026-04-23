import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
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
          error: "Missing code",
        },
        { status: 400 }
      );
    }

    const tokenRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.OUTLOOK_CLIENT_ID!,
          client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
          code,
          redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
          grant_type: "authorization_code",
        }),
      }
    );

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
    const scope = tokenData.scope || "";

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          step: "token_validation",
          error: "No access_token returned",
          tokenData,
        },
        { status: 400 }
      );
    }

    if (!scope.toLowerCase().includes("mail.send")) {
      return NextResponse.json(
        {
          ok: false,
          step: "scope_validation",
          error: "Mail.Send scope was not granted on the returned Outlook token",
          granted_scope: scope,
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: insertError } = await supabaseAdmin
      .from("inbox_connections")
      .insert({
        provider: "outlook",
        access_token: accessToken,
        refresh_token: refreshToken || "",
        expires_at: expiresAt,
        connection_status: "active",
        last_error: null,
      });

    if (insertError) {
      return NextResponse.json(
        {
          ok: false,
          step: "supabase_insert",
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/", req.url));
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "callback_catch",
        error: error.message,
      },
      { status: 500 }
    );
  }
}