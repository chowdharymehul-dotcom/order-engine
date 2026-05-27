export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const entryKey = String(formData.get("entry_key") || "");
    const action = String(formData.get("action") || "");
    const redirectTo = String(formData.get("redirect_to") || "/");

    if (!entryKey) {
      return NextResponse.json(
        { ok: false, error: "Missing entry_key" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Missing action" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: externalError } = await supabase
      .from("order_items")
      .delete()
      .eq("action", action)
      .eq("external_message_id", entryKey);

    const { error: gmailError } = await supabase
      .from("order_items")
      .delete()
      .eq("action", action)
      .eq("gmail_message_id", entryKey);

    if (externalError && gmailError) {
      return NextResponse.json(
        {
          ok: false,
          error: externalError.message || gmailError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL(redirectTo, req.url));
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Delete failed",
      },
      { status: 500 }
    );
  }
}