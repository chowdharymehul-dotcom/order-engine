import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateTemplateOCPdfBuffer } from "@/lib/oc-template-pdf";

export const dynamic = "force-dynamic";

type OrderConfirmation = {
  id: string;
  order_item_id: string | null;
  order_item_ids: string[] | null;
  customer_id: string | null;
  seller_profile_id: string | null;
  oc_number: string | null;
  oc_date: string | null;
  po_number: string | null;
  delivery_date: string | null;
  payment_terms: string | null;
  shipment_terms: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  pdf_url: string | null;
  status: string | null;
};

type OrderItem = {
  id: string;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  currency: string | null;
  notes: string | null;
  custom_fields: Record<string, any> | null;
};

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function queryValue(req: Request, key: string) {
  const url = new URL(req.url);
  return String(url.searchParams.get(key) || "").trim();
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function numberOrNull(input: any) {
  if (input === null || input === undefined) return null;

  const num = Number(input);
  return Number.isFinite(num) ? num : null;
}

function calculateLineTotal(quantity: number | null, unitPrice: number | null) {
  const qty = numberOrNull(quantity);
  const price = numberOrNull(unitPrice);

  if (qty === null || price === null) return null;

  return qty * price;
}

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to download template PDF: ${response.status}`);
  }

  return response.arrayBuffer();
}

function getOrderItemIds(oc: OrderConfirmation, fallbackOrderItemId: string) {
  if (Array.isArray(oc.order_item_ids) && oc.order_item_ids.length > 0) {
    return oc.order_item_ids;
  }

  if (oc.order_item_id) return [oc.order_item_id];

  return fallbackOrderItemId ? [fallbackOrderItemId] : [];
}

async function generateAndStorePdf(req: Request, ocId: string, orderItemId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: ocData, error: ocError } = await supabase
    .from("order_confirmations")
    .select("*")
    .eq("id", ocId)
    .maybeSingle();

  if (ocError) throw new Error(ocError.message);
  if (!ocData) throw new Error("OC draft not found");

  const oc = ocData as OrderConfirmation;

  if (!oc.seller_profile_id) {
    throw new Error("OC does not have a seller profile selected");
  }

  const orderItemIds = getOrderItemIds(oc, orderItemId);

  const { data: latestOrderItemsData, error: latestOrderItemsError } =
    await supabase
      .from("order_items")
      .select(
        "id, sku, quantity, unit_price, total_amount, currency, notes, custom_fields"
      )
      .in("id", orderItemIds)
      .is("deleted_at", null);

  if (latestOrderItemsError) throw new Error(latestOrderItemsError.message);

  const latestOrderItems = ((latestOrderItemsData || []) as OrderItem[]).sort(
    (a, b) => orderItemIds.indexOf(a.id) - orderItemIds.indexOf(b.id)
  );

  if (latestOrderItems.length === 0) {
    throw new Error("No active order items found for this OC");
  }

  const lineItems = latestOrderItems.map((item) => {
    const unitPrice = numberOrNull(item.unit_price);
    const lineTotal =
      numberOrNull(item.total_amount) ??
      calculateLineTotal(item.quantity, unitPrice);

    return {
      id: item.id,
      sku: item.sku || "",
      quantity: numberOrNull(item.quantity),
      unit_price: unitPrice,
      currency: item.currency || "USD",
      line_total: lineTotal,
      notes: item.notes || "",
      custom_fields: item.custom_fields || {},
    };
  });

  await supabase
    .from("order_confirmation_line_items")
    .delete()
    .eq("order_confirmation_id", oc.id);

  const { error: syncLineItemsError } = await supabase
    .from("order_confirmation_line_items")
    .insert(
      lineItems.map((item) => ({
        order_confirmation_id: oc.id,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency: item.currency,
        line_total: item.line_total,
        notes: item.notes,
        custom_fields: item.custom_fields || {},
      }))
    );

  if (syncLineItemsError) throw new Error(syncLineItemsError.message);

  const { data: sellerData, error: sellerError } = await supabase
    .from("seller_profiles")
    .select(
      "id, company_name, email, phone, website, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number, bank_name, account_name, account_number, swift_code, ifsc_code, logo_url"
    )
    .eq("id", oc.seller_profile_id)
    .maybeSingle();

  if (sellerError) throw new Error(sellerError.message);

  const { data: customerData } = oc.customer_id
    ? await supabase
        .from("company_profiles")
        .select(
          "id, company_name, contact_person, email, phone, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number"
        )
        .eq("id", oc.customer_id)
        .maybeSingle()
    : { data: null };

  const { data: templateData, error: templateError } = await supabase
    .from("oc_templates")
    .select(
      "id, template_url, storage_path, template_type, default_font, default_font_size, default_text_color, approved_template_json, template_status"
    )
    .eq("seller_profile_id", oc.seller_profile_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (templateError) throw new Error(templateError.message);

  if (!templateData) {
    throw new Error("No active approved OC template found for this seller profile.");
  }

  if (!templateData.template_url) {
    throw new Error("Approved template PDF URL is missing.");
  }

  if (!templateData.approved_template_json) {
    throw new Error("Approved template layout JSON is missing. Please approve the OC template first.");
  }

  const templateBytes = await fetchArrayBuffer(templateData.template_url);

  const pdfBuffer = await generateTemplateOCPdfBuffer({
    template: templateData,
    mappings: [],
    columns: [],
    seller: sellerData,
    customer: customerData,
    oc,
    lineItems,
    templateBytes,
    analysis: templateData.approved_template_json,
  });

  const storagePath = `generated/${Date.now()}-${safeFileName(
    `${oc.oc_number || "OC"}.pdf`
  )}`;

  const { error: uploadError } = await supabase.storage
    .from("oc-documents")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage
    .from("oc-documents")
    .getPublicUrl(storagePath);

  const pdfUrl = publicUrlData.publicUrl;

  const { error: updateOCError } = await supabase
    .from("order_confirmations")
    .update({
      pdf_url: pdfUrl,
      status: "Generated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", oc.id);

  if (updateOCError) throw new Error(updateOCError.message);

  await supabase
    .from("order_items")
    .update({
      oc_pdf_url: pdfUrl,
      oc_status: "Generated",
      oc_document_id: oc.id,
    })
    .in("id", orderItemIds);

  return pdfUrl;
}

export async function GET(req: Request) {
  try {
    const ocId = queryValue(req, "oc_id");
    const orderItemId = queryValue(req, "order_item_id");
    const redirectMode = queryValue(req, "redirect");

    if (!ocId || !orderItemId) {
      return NextResponse.json(
        { ok: false, error: "Missing OC ID or order item ID" },
        { status: 400 }
      );
    }

    const pdfUrl = await generateAndStorePdf(req, ocId, orderItemId);

  if (redirectMode === "pdf") {
  return NextResponse.redirect(pdfUrl, { status: 303 });
}

if (redirectMode === "editor") {
  return NextResponse.redirect(
    new URL(`/orders/${orderItemId}/oc/final-editor?generated=1`, req.url),
    { status: 303 }
  );
}

    return NextResponse.redirect(
      new URL(`/orders/${orderItemId}/oc?generated=1`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    const orderItemId = queryValue(req, "order_item_id");
    const message = encodeURIComponent(
      error?.message || "Failed to generate OC PDF"
    );

    if (orderItemId) {
      return NextResponse.redirect(
        new URL(`/orders/${orderItemId}/oc?error=${message}`, req.url),
        { status: 303 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to generate OC PDF" },
      { status: 500 }
    );
  }
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

    await generateAndStorePdf(req, ocId, orderItemId);

    return NextResponse.redirect(
      new URL(`/orders/${orderItemId}/oc?generated=1`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to generate OC PDF" },
      { status: 500 }
    );
  }
}