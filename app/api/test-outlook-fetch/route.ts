export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: connections, error: connectionError } = await supabaseAdmin
      .from("inbox_connections")
      .select("*")
      .eq("provider", "outlook")
      .order("created_at", { ascending: false })
      .limit(1);

    const connection = connections?.[0];

    if (!connection) {
      return NextResponse.json(
        {
          error: "No Outlook connection found",
          details: connectionError?.message || null,
        },
        { status: 404 }
      );
    }

    const listRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=10&$select=id,subject,from,receivedDateTime,bodyPreview,hasAttachments",
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
        cache: "no-store",
      }
    );

    const raw = await listRes.text();

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }

    return NextResponse.json({
      status: listRes.status,
      result: parsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}