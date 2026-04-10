import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const formData = await req.formData();

  const orderId = formData.get("order_id") as string;
  const action = formData.get("action") as string;
  const customer = formData.get("customer") as string;
  const poNumber = formData.get("po_number") as string;
  const sku = formData.get("sku") as string;
  const quantityRaw = formData.get("quantity") as string;
  const notes = formData.get("notes") as string;

  const quantity =
    quantityRaw && quantityRaw.trim() !== "" ? Number(quantityRaw) : null;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabaseAdmin
    .from("order_items")
    .update({
      action,
      customer,
      po_number: poNumber,
      sku,
      quantity,
      notes,
    })
    .eq("id", orderId);

  return NextResponse.redirect(new URL("/orders", req.url));
}