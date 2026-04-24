export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const externalMessageId = String(formData.get("external_message_id") || "");
  const status = String(formData.get("status") || "Pending");

  if (!externalMessageId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing external_message_id",
      },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: externalError } = await supabase
    .from("order_items")
    .update({ status })
    .eq("action", "Cancel Order")
    .eq("external_message_id", externalMessageId);

  const { error: gmailError } = await supabase
    .from("order_items")
    .update({ status })
    .eq("action", "Cancel Order")
    .eq("gmail_message_id", externalMessageId);

  if (externalError && gmailError) {
    return NextResponse.json(
      {
        ok: false,
        error: externalError.message || gmailError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.redirect(new URL("/cancellations", req.url));
}