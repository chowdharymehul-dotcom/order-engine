import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const formData = await req.formData();
  const orderId = formData.get("order_id") as string;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabaseAdmin
    .from("order_items")
    .update({ status: "Approved" })
    .eq("id", orderId);

  return NextResponse.redirect(new URL("/orders", req.url));
}