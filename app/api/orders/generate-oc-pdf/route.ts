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

type SellerProfile = {
  id: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;
};

type OCTemplate = {
  id: string;
  template_url: string | null;
  storage_path: string | null;
  template_type: string | null;
  default_font: string | null;
  default_font_size: number | null;
  default_text_color: string | null;
};

type Mapping = {
  id: string;
  field_name: string | null;
  display_label: string | null;
  field_type: string | null;
  page_number: number | null;
  x_position: number | null;
  y_position: number | null;
  font_size: number | null;
  background_fill: string | null;
  background_width: number | null;
  background_height: number | null;
};

type TemplateColumn = {
  id: string;
  display_label: string | null;
  source_field: string | null;
  column_order: number | null;
};

type OCLineItem = {
  id: string;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  currency: string | null;
  line_total: number | null;
  notes: string | null;
  custom_fields: Record<string, any> | null;
};

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download template PDF: ${response.status}`);
  }

  return response.arrayBuffer();
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

    const { data: ocData, error: ocError } = await supabase
      .from("order_confirmations")
      .select("*")
      .eq("id", ocId)
      .maybeSingle();

    if (ocError) {
      return NextResponse.json(
        { ok: false, error: ocError.message },
        { status: 500 }
      );
    }

    if (!ocData) {
      return NextResponse.json(
        { ok: false, error: "OC draft not found" },
        { status: 404 }
      );
    }

    const oc = ocData as OrderConfirmation;

    if (!oc.seller_profile_id) {
      return NextResponse.json(
        { ok: false, error: "OC does not have a seller profile selected" },
        { status: 400 }
      );
    }

    const { data: sellerData, error: sellerError } = await supabase
      .from("seller_profiles")
      .select(
        "id, company_name, email, phone, website, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number"
      )
      .eq("id", oc.seller_profile_id)
      .maybeSingle();

    if (sellerError) {
      return NextResponse.json(
        { ok: false, error: sellerError.message },
        { status: 500 }
      );
    }

    const seller = (sellerData || null) as SellerProfile | null;

    const { data: customerData } = oc.customer_id
      ? await supabase
          .from("company_profiles")
          .select(
            "id, company_name, contact_person, email, phone, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number"
          )
          .eq("id", oc.customer_id)
          .maybeSingle()
      : { data: null };

    const customer = (customerData || null) as Customer | null;

    const { data: templateData, error: templateError } = await supabase
      .from("oc_templates")
      .select(
        "id, template_url, storage_path, template_type, default_font, default_font_size, default_text_color"
      )
      .eq("seller_profile_id", oc.seller_profile_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (templateError) {
      return NextResponse.json(
        { ok: false, error: templateError.message },
        { status: 500 }
      );
    }

    if (!templateData) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active OC template found for this seller profile. Please upload and map a template first.",
        },
        { status: 400 }
      );
    }

    const template = templateData as OCTemplate;

    if (!template.template_url) {
      return NextResponse.json(
        { ok: false, error: "Active template does not have a PDF URL" },
        { status: 400 }
      );
    }

    const { data: mappingsData, error: mappingsError } = await supabase
      .from("oc_template_mappings")
      .select(
        "id, field_name, display_label, field_type, page_number, x_position, y_position, font_size, background_fill, background_width, background_height"
      )
      .eq("template_id", template.id);

    if (mappingsError) {
      return NextResponse.json(
        { ok: false, error: mappingsError.message },
        { status: 500 }
      );
    }

    const mappings = (mappingsData || []) as Mapping[];

    if (mappings.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This template has no field mappings yet. Please use Design Template first.",
        },
        { status: 400 }
      );
    }

    const { data: columnsData, error: columnsError } = await supabase
      .from("oc_template_columns")
      .select("id, display_label, source_field, column_order")
      .eq("template_id", template.id)
      .order("column_order", { ascending: true });

    if (columnsError) {
      return NextResponse.json(
        { ok: false, error: columnsError.message },
        { status: 500 }
      );
    }

    const columns = (columnsData || []) as TemplateColumn[];

    const { data: lineItemsData, error: lineItemsError } = await supabase
      .from("order_confirmation_line_items")
      .select("id, sku, quantity, unit_price, currency, line_total, notes, custom_fields")
      .eq("order_confirmation_id", oc.id)
      .order("created_at", { ascending: true });

    if (lineItemsError) {
      return NextResponse.json(
        { ok: false, error: lineItemsError.message },
        { status: 500 }
      );
    }

    const lineItems = (lineItemsData || []) as OCLineItem[];

    const templateBytes = await fetchArrayBuffer(template.template_url);

    const pdfBuffer = await generateTemplateOCPdfBuffer({
      template,
      mappings,
      columns,
      seller,
      customer,
      oc,
      lineItems,
      templateBytes,
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

    const { error: updateOCError } = await supabase
      .from("order_confirmations")
      .update({
        pdf_url: pdfUrl,
        status: "Generated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", oc.id);

    if (updateOCError) {
      return NextResponse.json(
        { ok: false, error: updateOCError.message },
        { status: 500 }
      );
    }

    const orderItemIds =
      oc.order_item_ids && oc.order_item_ids.length > 0
        ? oc.order_item_ids
        : oc.order_item_id
        ? [oc.order_item_id]
        : [orderItemId];

    await supabase
      .from("order_items")
      .update({
        oc_pdf_url: pdfUrl,
        oc_status: "Generated",
      })
      .in("id", orderItemIds);

    return NextResponse.redirect(new URL(`/orders/${orderItemId}/oc`, req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate template OC PDF",
      },
      { status: 500 }
    );
  }
}