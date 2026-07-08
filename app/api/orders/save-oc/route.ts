import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type CustomField = {
  name?: string;
  value?: string;
};

type ManualItem = {
  id?: string;
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const ocId = clean(formData.get("oc_id"));
    const orderItemId = clean(formData.get("order_item_id"));
    const customerId = clean(formData.get("customer_id"));
    const poNumber = clean(formData.get("po_number"));
    const deliveryDate = dateOrNull(formData.get("delivery_date"));
    const orderNotes = clean(formData.get("notes"));
    const actionType = clean(formData.get("action_type"));
    const items = parseItems(formData.get("items"));

    if (!ocId || !orderItemId) {
      return NextResponse.json(
        { ok: false, error: "Missing OC ID or order item ID" },
        { status: 400 }
      );
    }


    const validItems = items
      .map((item) => ({
        id: clean(item.id),
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

    const { data: primaryOrder, error: primaryError } = await supabase
      .from("order_items")
      .select("*")
      .eq("id", orderItemId)
      .maybeSingle();

    if (primaryError || !primaryOrder) {
      return NextResponse.json(
        {
          ok: false,
          error: primaryError?.message || "Primary order not found",
        },
        { status: 404 }
      );
    }

    const customerName = clean(customer.company_name) || "Manual Customer";
    const manualMessageId =
      clean(primaryOrder.external_message_id) || `manual-${crypto.randomUUID()}`;

    const savedIds: string[] = [];

    for (const item of validItems) {
      const row = {
        action: "Place Order",
        customer: customerName,
        customer_id: customerId,
        po_number: poNumber,
        sku: item.sku,
        quantity: item.quantity,
        notes: orderNotes,
        status: primaryOrder.status || "New",
        source_email: "Manual Entry",
        email_subject: "Manual Order",
        external_message_id: manualMessageId,
        gmail_message_id: null,
        oc_status: "Reviewed",
        unit_price: item.unitPrice,
        currency: item.currency,
        custom_fields: item.customFields,
        delivery_date: deliveryDate,
        deleted_at: null,
      };

      if (item.id) {
        const { error: updateError } = await supabase
          .from("order_items")
          .update(row)
          .eq("id", item.id);

        if (updateError) {
          return NextResponse.json(
            { ok: false, error: updateError.message },
            { status: 500 }
          );
        }

        savedIds.push(item.id);
      } else {
        const { data: insertedRow, error: insertError } = await supabase
          .from("order_items")
          .insert({
            ...row,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError) {
          return NextResponse.json(
            { ok: false, error: insertError.message },
            { status: 500 }
          );
        }

        savedIds.push(insertedRow.id);
      }
    }

    const { data: existingOc } = await supabase
      .from("order_confirmations")
      .select("order_item_ids")
      .eq("id", ocId)
      .maybeSingle();

    const previousIds = Array.isArray(existingOc?.order_item_ids)
      ? existingOc.order_item_ids
      : [orderItemId];

    const removedIds = previousIds.filter(
      (id: string) => !savedIds.includes(id)
    );

    if (removedIds.length > 0) {
      await supabase
        .from("order_items")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .in("id", removedIds);
    }

    const { error: ocError } = await supabase
      .from("order_confirmations")
      .update({
        customer_id: customerId,
        po_number: poNumber,
        delivery_date: deliveryDate,
        internal_notes: orderNotes,
        customer_notes: orderNotes,
        order_item_id: savedIds[0],
        order_item_ids: savedIds,
        status: "Reviewed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ocId);

    if (ocError) {
      return NextResponse.json(
        { ok: false, error: ocError.message },
        { status: 500 }
      );
    }

    if (actionType === "generate_oc") {
  const generateUrl = new URL("/api/orders/generate-oc-pdf", req.url);
  generateUrl.searchParams.set("oc_id", ocId);
  generateUrl.searchParams.set("order_item_id", savedIds[0]);
  generateUrl.searchParams.set("redirect", "editor");

  return NextResponse.redirect(generateUrl, { status: 303 });
}

    return NextResponse.redirect(
      new URL(`/orders/${savedIds[0]}/oc?saved=1`, req.url),
      { status: 303 }
    );
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