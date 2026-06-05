import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function nullableDate(formData: FormData, key: string) {
  const raw = value(formData, key);
  return raw || null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const ocId = value(formData, "oc_id");
    const orderItemId = value(formData, "order_item_id");

    if (!ocId || !orderItemId) {
      return NextResponse.json(
        { ok: false, error: "Missing OC ID or order item ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const payload = {
      seller_profile_id: value(formData, "seller_profile_id") || null,
      oc_number: value(formData, "oc_number"),
      oc_date: nullableDate(formData, "oc_date"),
      po_number: value(formData, "po_number"),
      delivery_date: nullableDate(formData, "delivery_date"),
      payment_terms: value(formData, "payment_terms"),
      shipment_terms: value(formData, "shipment_terms"),
      internal_notes: value(formData, "internal_notes"),
      customer_notes: value(formData, "customer_notes"),
      status: "Reviewed",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("order_confirmations")
      .update(payload)
      .eq("id", ocId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    await supabase
      .from("order_items")
      .update({
        oc_status: "Reviewed",
      })
      .eq("id", orderItemId);

    return NextResponse.redirect(new URL(`/orders/${orderItemId}/oc`, req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save OC",
      },
      { status: 500 }
    );
  }
}