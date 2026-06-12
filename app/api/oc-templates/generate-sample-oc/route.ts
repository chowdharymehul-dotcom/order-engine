import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateTemplateOCPdfBuffer } from "@/lib/oc-template-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  swift_code: string | null;
  ifsc_code: string | null;
  logo_url: string | null;
};

type OCTemplate = {
  id: string;
  seller_profile_id: string | null;
  company_name: string | null;
  template_name: string | null;
  template_url: string | null;
  storage_path: string | null;
  template_type: string | null;
  default_font: string | null;
  default_font_size: number | null;
  default_text_color: string | null;
};

type AIDraft = {
  id: string;
  template_id: string | null;
  analysis: any;
  image_url: string | null;
  status: string | null;
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

    const templateId = value(formData, "template_id");
    const draftId = value(formData, "draft_id");
    const sellerProfileId = value(formData, "seller_profile_id");

    if (!templateId || !draftId) {
      return NextResponse.json(
        { ok: false, error: "Missing template ID or draft ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: templateData, error: templateError } = await supabase
      .from("oc_templates")
      .select(
        "id, seller_profile_id, company_name, template_name, template_url, storage_path, template_type, default_font, default_font_size, default_text_color"
      )
      .eq("id", templateId)
      .maybeSingle();

    if (templateError) {
      return NextResponse.json(
        { ok: false, error: templateError.message },
        { status: 500 }
      );
    }

    if (!templateData) {
      return NextResponse.json(
        { ok: false, error: "Template not found" },
        { status: 404 }
      );
    }

    const template = templateData as OCTemplate;

    if (!template.template_url) {
      return NextResponse.json(
        { ok: false, error: "Template PDF URL missing" },
        { status: 400 }
      );
    }

    const { data: draftData, error: draftError } = await supabase
      .from("oc_template_ai_drafts")
      .select("id, template_id, analysis, image_url, status")
      .eq("id", draftId)
      .eq("template_id", templateId)
      .maybeSingle();

    if (draftError) {
      return NextResponse.json(
        { ok: false, error: draftError.message },
        { status: 500 }
      );
    }

    if (!draftData) {
      return NextResponse.json(
        { ok: false, error: "AI draft not found" },
        { status: 404 }
      );
    }

    const draft = draftData as AIDraft;

    const finalSellerProfileId =
      sellerProfileId || template.seller_profile_id || "";

    const { data: sellerData, error: sellerError } = finalSellerProfileId
      ? await supabase
          .from("seller_profiles")
          .select(
            "id, company_name, email, phone, website, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number, bank_name, account_name, account_number, swift_code, ifsc_code, logo_url"
          )
          .eq("id", finalSellerProfileId)
          .maybeSingle()
      : { data: null, error: null };

    if (sellerError) {
      return NextResponse.json(
        { ok: false, error: sellerError.message },
        { status: 500 }
      );
    }

    const seller = (sellerData || {
      id: "sample-seller",
      company_name: "M S INCORPORATION",
      email: "sales@example.com",
      phone: "+91 90000 00000",
      website: "",
      address_line_1: "1, JANAN GOSWAMI SARANI",
      address_line_2: "NEW ALIPORE",
      city: "KOLKATA",
      state: "WEST BENGAL",
      country: "INDIA",
      postal_code: "700053",
      gst_number: "19ACNPC5141K1ZG",
      pan_number: "",
      iec_number: "",
      bank_name: "Kotak Mahindra Bank",
      account_name: "M S Incorporation",
      account_number: "5548655149",
      swift_code: "KKBKINBBCPC",
      ifsc_code: "",
      logo_url: "",
    }) as SellerProfile;

    const customer = {
      id: "sample-customer",
      company_name: "SHIATZY CHEN",
      contact_person: "Purchase Department",
      email: "buyer@example.com",
      phone: "",
      address_line_1: "Taipei",
      address_line_2: "",
      city: "Taipei",
      state: "",
      country: "TAIWAN",
      postal_code: "",
      gst_number: "",
      pan_number: "",
      iec_number: "",
    };

    const oc = {
      id: "sample-oc",
      oc_number: "OC-SAMPLE-1001",
      oc_date: "2026-06-10",
      po_number: "PO-6664",
      po_date: "2026-06-01",
      reference: "REF-SAMPLE",
      delivery_date: "2026-08-15",
      payment_terms: "ADVANCE",
      shipment_terms: "FOB",
      shipping_address: "Taipei, Taiwan",
      shipping_instructions: "Ship as per buyer instruction",
      attention_of: "Purchase Department",
      internal_notes: "",
      customer_notes: "Please confirm delivery schedule.",
      total_amount: "USD 1,250.00",
    };

    const lineItems = [
      {
        id: "sample-line-1",
        sku: "A13116",
        quantity: 60,
        unit_price: 12.5,
        currency: "USD",
        line_total: 750,
        notes: "",
        custom_fields: {
          article_no: "A13116",
          color: "WHITE",
          color_no: "001",
          size: "STANDARD",
          width: "135",
          piece_length: "50",
        },
      },
      {
        id: "sample-line-2",
        sku: "T28090/1",
        quantity: 2,
        unit_price: 250,
        currency: "USD",
        line_total: 500,
        notes: "Color change to white",
        custom_fields: {
          article_no: "T28090/1",
          color: "WHITE",
          color_no: "002",
          size: "STANDARD",
          width: "110",
          piece_length: "25",
        },
      },
    ];

    const templateBytes = await fetchArrayBuffer(template.template_url);

    const pdfBuffer = await generateTemplateOCPdfBuffer({
      template,
      mappings: [],
      columns: [],
      seller,
      customer,
      oc,
      lineItems,
      templateBytes,
      analysis: draft.analysis || {},
    });

    const storagePath = `sample-ocs/${Date.now()}-${safeFileName(
      `${template.template_name || "sample-oc"}.pdf`
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
      .from("oc_templates")
      .update({
        template_status: "pending_approval",
        approved_template_json: draft.analysis || {},
        approved_pdf_url: pdfUrl,
      })
      .eq("id", templateId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL(`/oc-templates/${templateId}/preview?draft=${draftId}`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate sample OC PDF",
      },
      { status: 500 }
    );
  }
}