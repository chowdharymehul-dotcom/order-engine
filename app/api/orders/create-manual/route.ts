import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type CustomField = {
  name?: string;
  value?: string;
};

type ManualItem = {
  sku?: string;
  quantity?: string;
  unitPrice?: string;
  currency?: string;
  customFields?: CustomField[];
};

function clean(value: any) {
  return String(value || "").trim();
}

function numberOrNull(value: any) {
  const text = clean(value);

  if (!text) return null;

  const number = Number(text);

  if (!Number.isFinite(number)) return null;

  return number;
}

function dateOrNull(value: any) {
  const text = clean(value);

  if (!text) return null;

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return null;

  return text;
}

function normalizeCurrency(value: any) {
  const text = clean(value).toUpperCase();

  return text || "USD";
}

function customFieldsToObject(fields: CustomField[] | undefined) {
  const output: Record<string, string> = {};

  for (const field of fields || []) {
    const name = clean(field.name);
    const value = clean(field.value);

    if (!name) continue;

    output[name] = value;
  }

  return output;
}

function parseItems(value: any) {
  try {
    const parsed = JSON.parse(clean(value));

    if (!Array.isArray(parsed)) return [];

    return parsed as ManualItem[];
  } catch {
    return [];
  }
}

function makeOCNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const timestamp = String(now.getTime()).slice(-6);

  return `OC-${year}-${timestamp}`;
}

function calculateLineTotal(quantity: number | null, unitPrice: number | null) {
  if (quantity === null || unitPrice === null) return null;

  return quantity * unitPrice;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const customerId = clean(formData.get("customer_id"));
    const poNumber = clean(formData.get("po_number"));
    const deliveryDate = dateOrNull(formData.get("delivery_date"));
    const orderNotes = clean(formData.get("notes"));
    const actionType = clean(formData.get("action_type"));
const sellerProfileId = clean(formData.get("seller_profile_id"));
    const items = parseItems(formData.get("items"));

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Customer is required" },
        { status: 400 }
      );
    }

    const validItems = items
      .map((item) => ({
        sku: clean(item.sku),
        quantity: numberOrNull(item.quantity),
        unitPrice: numberOrNull(item.unitPrice),
        currency: normalizeCurrency(item.currency),
        customFields: customFieldsToObject(item.customFields),
      }))
      .filter((item) => item.sku);

    if (validItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "At least one SKU is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: customer, error: customerError } = await supabase
      .from("company_profiles")
      .select("id, company_name, email")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          ok: false,
          error: customerError?.message || "Customer not found",
        },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const manualMessageId = `manual-${crypto.randomUUID()}`;
    const customerName = clean(customer.company_name) || "Manual Customer";

    const rows = validItems.map((item) => ({
      action: "Place Order",
      customer: customerName,
      customer_id: customerId,
      po_number: poNumber,
      sku: item.sku,
      quantity: item.quantity,
      notes: orderNotes,
      status: "New",
      source_email: "Manual Entry",
      email_subject: "Manual Order",
      external_message_id: manualMessageId,
      gmail_message_id: null,
      oc_status: "Not Generated",
      unit_price: item.unitPrice,
      total_amount: calculateLineTotal(item.quantity, item.unitPrice),
      currency: item.currency,
      custom_fields: item.customFields,
      delivery_date: deliveryDate,
      created_at: now,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("order_items")
      .insert(rows)
      .select("id, sku, quantity, unit_price, total_amount, currency, notes, custom_fields");

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    const savedRows = insertedRows || [];
    const ids = savedRows.map((row) => row.id);
    const primaryOrderItemId = ids[0];

    if (!primaryOrderItemId) {
      return NextResponse.json(
        { ok: false, error: "Manual order was not created" },
        { status: 500 }
      );
    }

    if (actionType === "generate_oc") {
if (!sellerProfileId) {
  return NextResponse.redirect(
    new URL("/orders/new?sellerProfileMissing=1", req.url),
    { status: 303 }
  );
}
      

      const ocNumber = makeOCNumber();
      const today = new Date().toISOString().slice(0, 10);

      const { data: ocData, error: ocInsertError } = await supabase
        .from("order_confirmations")
        .insert({
          order_item_id: primaryOrderItemId,
          order_item_ids: ids,
          customer_id: customerId,
          seller_profile_id: sellerProfileId,
          oc_number: ocNumber,
          oc_date: today,
          po_number: poNumber,
          delivery_date: deliveryDate,
          payment_terms: "",
          shipment_terms: "",
          internal_notes: orderNotes,
          customer_notes: orderNotes,
          pdf_url: null,
          final_oc_pdf_url: null,
          status: "Draft",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (ocInsertError || !ocData) {
        return NextResponse.json(
          {
            ok: false,
            error: ocInsertError?.message || "Failed to create OC draft",
          },
          { status: 500 }
        );
      }

      const lineItemsPayload = savedRows.map((item) => ({
        order_confirmation_id: ocData.id,
        sku: item.sku || "",
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency: item.currency || "USD",
        line_total:
          item.total_amount ??
          calculateLineTotal(item.quantity, item.unit_price),
        notes: item.notes || "",
        custom_fields: item.custom_fields || {},
      }));

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
          oc_document_id: ocData.id,
        })
        .in("id", ids);

      return NextResponse.redirect(
        new URL(`/orders/${primaryOrderItemId}/oc/final-editor`, req.url),
        { status: 303 }
      );
    }

    return NextResponse.redirect(
      new URL("/orders/manual?manualOrderCreated=1", req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create manual order",
      },
      { status: 500 }
    );
  }
}