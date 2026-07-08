import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateTemplateOCPdfBuffer } from "@/lib/oc-template-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function clean(value: any) {
  return String(value || "").trim();
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function numberOrNull(input: any) {
  if (input === null || input === undefined) return null;
  const number = Number(input);
  return Number.isFinite(number) ? number : null;
}

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to download template PDF: ${response.status}`);
  }

  return response.arrayBuffer();
}

function getOrderItemIds(oc: any, fallbackOrderItemId: string) {
  if (Array.isArray(oc.order_item_ids) && oc.order_item_ids.length > 0) {
    return oc.order_item_ids;
  }

  if (oc.order_item_id) return [oc.order_item_id];

  return fallbackOrderItemId ? [fallbackOrderItemId] : [];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const ocId = clean(formData.get("oc_id"));
    const orderItemId = clean(formData.get("order_item_id"));
    const generatePdf = clean(formData.get("generate_pdf")) === "1";
    const analysisRaw = clean(formData.get("analysis"));

    if (!ocId || !orderItemId) {
      return NextResponse.json(
        { ok: false, error: "Missing OC ID or order item ID" },
        { status: 400 }
      );
    }

    let analysis: any = {};

    try {
      analysis = JSON.parse(analysisRaw || "{}");
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid final OC layout JSON" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: ocData, error: ocError } = await supabase
      .from("order_confirmations")
      .select("*")
      .eq("id", ocId)
      .maybeSingle();

    if (ocError || !ocData) {
      return NextResponse.json(
        { ok: false, error: ocError?.message || "OC not found" },
        { status: 404 }
      );
    }

    const oc = ocData as any;

    const { error: saveLayoutError } = await supabase
      .from("order_confirmations")
      .update({
        final_oc_json: analysis,
        final_oc_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ocId);

    if (saveLayoutError) {
      return NextResponse.json(
        { ok: false, error: saveLayoutError.message },
        { status: 500 }
      );
    }

    if (!generatePdf) {
      return NextResponse.json({ ok: true });
    }

    if (!oc.seller_profile_id) {
      return NextResponse.json(
        { ok: false, error: "Seller profile missing from OC" },
        { status: 400 }
      );
    }

    const orderItemIds = getOrderItemIds(oc, orderItemId);

    const { data: sellerData, error: sellerError } = await supabase
      .from("seller_profiles")
      .select(
        "id, company_name, email, phone, website, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number, bank_name, account_name, account_number, swift_code, ifsc_code, logo_url"
      )
      .eq("id", oc.seller_profile_id)
      .maybeSingle();

    if (sellerError) {
      return NextResponse.json(
        { ok: false, error: sellerError.message },
        { status: 500 }
      );
    }

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
        "id, template_url, storage_path, template_type, default_font, default_font_size, default_text_color, approved_template_json"
      )
      .eq("seller_profile_id", oc.seller_profile_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (templateError || !templateData?.template_url) {
      return NextResponse.json(
        {
          ok: false,
          error:
            templateError?.message ||
            "Approved template not found for this seller profile",
        },
        { status: 400 }
      );
    }

    const { data: lineItemsData, error: lineItemsError } = await supabase
      .from("order_confirmation_line_items")
      .select("id, sku, quantity, unit_price, currency, line_total, notes, custom_fields")
      .eq("order_confirmation_id", ocId)
      .order("created_at", { ascending: true });

    if (lineItemsError) {
      return NextResponse.json(
        { ok: false, error: lineItemsError.message },
        { status: 500 }
      );
    }

    const lineItems = ((lineItemsData || []) as any[]).map((line) => ({
      id: line.id,
      sku: clean(line.sku),
      quantity: numberOrNull(line.quantity),
      unit_price: numberOrNull(line.unit_price),
      currency: clean(line.currency || "USD"),
      line_total: numberOrNull(line.line_total),
      notes: clean(line.notes),
      custom_fields: line.custom_fields || {},
    }));

    const templateBytes = await fetchArrayBuffer(templateData.template_url);

    const pdfBuffer = await generateTemplateOCPdfBuffer({
      template: templateData,
      mappings: [],
      columns: [],
      seller: sellerData as any,
      customer: customerData as any,
      oc,
      lineItems,
      templateBytes,
      analysis,
    });

    const storagePath = `final-ocs/${Date.now()}-${safeFileName(
      `${oc.oc_number || "OC"}.pdf`
    )}`;

    const { error: uploadError } = await supabase.storage
      .from("oc-documents")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("oc-documents")
      .getPublicUrl(storagePath);

    const pdfUrl = publicUrlData.publicUrl;

   const { error: updateError } = await supabase
  .from("order_confirmations")
  .update({
    pdf_url: pdfUrl,
    final_oc_pdf_url: pdfUrl,
    status: "Generated",
    oc_date: oc.oc_date || new Date().toISOString().slice(0, 10),
    po_number: oc.po_number || null,
    delivery_date: oc.delivery_date || null,
    customer_id: oc.customer_id || null,
    final_oc_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq("id", ocId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("order_items")
      .update({
        oc_pdf_url: pdfUrl,
        oc_status: "Generated",
        oc_document_id: ocId,
      })
      .in("id", orderItemIds);

    return NextResponse.json({
      ok: true,
      pdf_url: pdfUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save final OC",
      },
      { status: 500 }
    );
  }
}