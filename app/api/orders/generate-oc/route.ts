import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OrderItem = {
  id: string;
  customer: string | null;
  customer_id: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  unit_price: number | null;
  total_amount: number | null;
  currency: string | null;
};

function parseIds(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function makeOCNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const timestamp = String(now.getTime()).slice(-6);

  return `OC-${year}-${timestamp}`;
}

function numericValue(value: number | null | undefined) {
  if (value === null || value === undefined) return null;

  const num = Number(value);

  if (!Number.isFinite(num)) return null;

  return num;
}

function calculateLineTotal(quantity: number | null, unitPrice: number | null) {
  const qty = numericValue(quantity);
  const price = numericValue(unitPrice);

  if (qty === null || price === null) return null;

  return qty * price;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const idsValue = String(formData.get("ids") || "").trim();
    const singleId = String(formData.get("id") || "").trim();

    const ids = idsValue ? parseIds(idsValue) : singleId ? [singleId] : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing order item id" },
        { status: 400 }
      );
    }

    const primaryOrderItemId = ids[0];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: orderRows, error: orderError } = await supabase
      .from("order_items")
      .select(
        "id, customer, customer_id, po_number, sku, quantity, notes, unit_price, total_amount, currency"
      )
      .in("id", ids);

    if (orderError) {
      return NextResponse.json(
        { ok: false, error: orderError.message },
        { status: 500 }
      );
    }

    const orderItems = ((orderRows || []) as OrderItem[]).sort(
      (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
    );

    if (orderItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Order items not found" },
        { status: 404 }
      );
    }

    const first = orderItems[0];

    const { data: existingOC, error: existingError } = await supabase
      .from("order_confirmations")
      .select("id")
      .or(`order_item_id.eq.${primaryOrderItemId},order_item_ids.cs.{${primaryOrderItemId}}`)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500 }
      );
    }

    if (existingOC?.id) {
      return NextResponse.redirect(
        new URL(`/orders/${primaryOrderItemId}/oc`, req.url),
        { status: 303 }
      );
    }

    const { data: sellerProfile, error: sellerError } = await supabase
      .from("seller_profiles")
      .select("id")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (sellerError) {
      return NextResponse.json(
        { ok: false, error: sellerError.message },
        { status: 500 }
      );
    }

    if (!sellerProfile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active seller profile found. Please create a seller profile first.",
        },
        { status: 400 }
      );
    }

    const ocNumber = makeOCNumber();
    const today = new Date().toISOString().slice(0, 10);

    const notes = orderItems
      .map((item) => item.notes)
      .filter(Boolean)
      .join(" | ");

    const { data: ocData, error: insertError } = await supabase
      .from("order_confirmations")
      .insert({
        order_item_id: primaryOrderItemId,
        order_item_ids: ids,
        customer_id: first.customer_id,
        seller_profile_id: sellerProfile.id,
        oc_number: ocNumber,
        oc_date: today,
        po_number: first.po_number || "",
        delivery_date: null,
        payment_terms: "",
        shipment_terms: "",
        internal_notes: notes,
        customer_notes: "",
        pdf_url: null,
        status: "Draft",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !ocData) {
      return NextResponse.json(
        {
          ok: false,
          error: insertError?.message || "Failed to create OC draft",
        },
        { status: 500 }
      );
    }

    const ocId = ocData.id;

    const lineItemsPayload = orderItems.map((item) => {
      const unitPrice = numericValue(item.unit_price);
      const lineTotal =
        numericValue(item.total_amount) ??
        calculateLineTotal(item.quantity, unitPrice);

      return {
        order_confirmation_id: ocId,
        sku: item.sku || "",
        quantity: numericValue(item.quantity),
        unit_price: unitPrice,
        currency: item.currency || "USD",
        line_total: lineTotal,
        notes: item.notes || "",
        custom_fields: {},
      };
    });

    const { error: lineItemsError } = await supabase
      .from("order_confirmation_line_items")
      .insert(lineItemsPayload);

    if (lineItemsError) {
      return NextResponse.json(
        { ok: false, error: lineItemsError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("order_items")
      .update({
        oc_status: "Draft",
      })
      .in("id", ids);

    return NextResponse.redirect(
      new URL(`/orders/${primaryOrderItemId}/oc`, req.url),
      {
        status: 303,
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create OC draft",
      },
      { status: 500 }
    );
  }
}