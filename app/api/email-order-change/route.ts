import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const itemId = String(formData.get("item_id") || "");
  const emailId = String(formData.get("email_id") || "");
  const operation = String(formData.get("operation") || "");
  const receivedAt = String(formData.get("received_at") || "");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (!itemId || !emailId || !operation) {
    return NextResponse.json(
      { ok: false, error: "Missing item_id, email_id, or operation" },
      { status: 400 }
    );
  }

  if (operation === "ignore") {
    const { error } = await supabase
      .from("order_items")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_from: "email_workspace",
        deleted_reason: "Ignored requested change",
      })
      .eq("id", itemId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  if (operation === "accept") {
    const mailDate = receivedAt
      ? new Date(receivedAt).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "unknown date";

    const { error } = await supabase
      .from("order_items")
      .update({
        status: `Added vide mail dated ${mailDate}`,
      })
      .eq("id", itemId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.redirect(new URL(`/emails/${emailId}`, req.url));
}