export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import FinalOCVisualEditor from "@/components/orders/FinalOCVisualEditor";

type PageProps = {
  params: Promise<{ id: string }>;
};

function clean(value: any) {
  return String(value || "").trim();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function joinAddress(parts: Array<string | null | undefined>) {
  return parts.map(clean).filter(Boolean).join(", ");
}

function lineAmount(line: any) {
  const total = Number(line.line_total);
  if (Number.isFinite(total)) return total.toFixed(2);

  const qty = Number(line.quantity);
  const price = Number(line.unit_price);

  if (Number.isFinite(qty) && Number.isFinite(price)) {
    return (qty * price).toFixed(2);
  }

  return "";
}

async function getPdfPageSize(pdfUrl: string | null) {
  if (!pdfUrl) return { width: 595, height: 842 };

  try {
    const response = await fetch(pdfUrl, { cache: "no-store" });
    if (!response.ok) return { width: 595, height: 842 };

    const arrayBuffer = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const firstPage = pdfDoc.getPages()[0];

    if (!firstPage) return { width: 595, height: 842 };

    return firstPage.getSize();
  } catch {
    return { width: 595, height: 842 };
  }
}

export default async function FinalOCEditorPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: primaryOrderData, error: orderError } = await supabase
    .from("order_items")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (orderError || !primaryOrderData) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Final OC Editor</h1>
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {orderError?.message || "Order not found"}
        </div>
        <Link href="/orders" className="px-4 py-2 rounded-lg border">
          Back to Orders
        </Link>
      </div>
    );
  }

  const { data: ocData, error: ocError } = await supabase
    .from("order_confirmations")
    .select("*")
    .or(`order_item_id.eq.${id},order_item_ids.cs.{${id}}`)
    .maybeSingle();

  if (ocError || !ocData) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Final OC Editor</h1>
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {ocError?.message || "OC not found"}
        </div>
        <Link href={`/orders/${id}/oc`} className="px-4 py-2 rounded-lg border">
          Back to Review/Edit OC
        </Link>
      </div>
    );
  }

  const oc = ocData as any;

  if (!oc.seller_profile_id) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Final OC Editor</h1>
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          Seller profile missing. Please generate OC again and select seller
          profile.
        </div>
        <Link href={`/orders/${id}/oc`} className="px-4 py-2 rounded-lg border">
          Back to Review/Edit OC
        </Link>
      </div>
    );
  }

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select(
      "id, company_name, email, phone, website, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number, bank_name, account_name, account_number, swift_code, ifsc_code, logo_url"
    )
    .eq("id", oc.seller_profile_id)
    .maybeSingle();

  const { data: customer } = oc.customer_id
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
      "id, template_url, approved_template_json, default_font, default_font_size, default_text_color"
    )
    .eq("seller_profile_id", oc.seller_profile_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (templateError || !templateData?.template_url) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Final OC Editor</h1>
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {templateError?.message ||
            "Approved template not found for this seller profile."}
        </div>
        <Link href={`/orders/${id}/oc`} className="px-4 py-2 rounded-lg border">
          Back to Review/Edit OC
        </Link>
      </div>
    );
  }

  const { data: lineItemsData } = await supabase
    .from("order_confirmation_line_items")
    .select("id, sku, quantity, unit_price, currency, line_total, notes, custom_fields")
    .eq("order_confirmation_id", oc.id)
    .order("created_at", { ascending: true });

  const lineItems = (lineItemsData || []) as any[];

  const sellerAddress = joinAddress([
    seller?.address_line_1,
    seller?.address_line_2,
    seller?.city,
    seller?.state,
    seller?.postal_code,
    seller?.country,
  ]);

  const customerAddress = joinAddress([
    customer?.address_line_1,
    customer?.address_line_2,
    customer?.city,
    customer?.state,
    customer?.postal_code,
    customer?.country,
  ]);

  const totalAmount = lineItems
    .map((line) => Number(line.line_total))
    .filter((value) => Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);

  const previewItems = lineItems.map((line) => {
    const customFields = line.custom_fields || {};

    return {
      sku: clean(line.sku),
      article_no: clean(customFields.article_no || line.sku),
      color: clean(customFields.color),
      color_no: clean(customFields.color_no),
      size: clean(customFields.size),
      width: clean(customFields.width),
      piece_length: clean(customFields.piece_length),
      quantity: clean(line.quantity),
      unit_price: clean(line.unit_price),
      currency: clean(line.currency || "USD"),
      amount: lineAmount(line),
      notes: clean(line.notes),
      ...customFields,
    };
  });

  const previewData = {
    seller: {
      logo: clean(seller?.logo_url),
      company_name: clean(seller?.company_name),
      address: sellerAddress,
      gst_no: clean(seller?.gst_number),
      phone: clean(seller?.phone),
      email: clean(seller?.email),
      bank_name: clean(seller?.bank_name),
      account_name: clean(seller?.account_name),
      account_number: clean(seller?.account_number),
      swift_code: clean(seller?.swift_code),
      ifsc_code: clean(seller?.ifsc_code),
    },
    customer: {
      name: clean(customer?.company_name),
      company_name: clean(customer?.company_name),
      contact_person: clean(customer?.contact_person),
      address: customerAddress,
      country: clean(customer?.country),
      email: clean(customer?.email),
      phone: clean(customer?.phone),
    },
    order: {
      oc_number: clean(oc.oc_number),
      oc_date: formatDate(oc.oc_date),
      po_number: clean(oc.po_number),
      delivery_date: formatDate(oc.delivery_date),
      payment_terms: clean(oc.payment_terms),
      shipment_terms: clean(oc.shipment_terms),
      notes: clean(oc.customer_notes || oc.internal_notes),
      internal_notes: clean(oc.internal_notes),
      customer_notes: clean(oc.customer_notes),
      total_amount: totalAmount ? totalAmount.toFixed(2) : "",
    },
    manual: {
      custom_text: "",
      notes: clean(oc.customer_notes || oc.internal_notes),
    },
    items: previewItems,
    item: previewItems[0] || {},
  };

  const pageSize = await getPdfPageSize(templateData.template_url);

  const initialAnalysis =
    oc.final_oc_json || templateData.approved_template_json || {};

  const generatedPdfUrl = oc.final_oc_pdf_url || oc.pdf_url || "";

  return (
    <FinalOCVisualEditor
      ocId={oc.id}
      orderItemId={id}
      initialAnalysis={initialAnalysis}
      previewData={previewData}
      originalImageUrl={templateData.template_url}
      generatedPdfUrl={generatedPdfUrl}
      pageWidth={pageSize.width}
      pageHeight={pageSize.height}
      backUrl={`/orders/${id}/oc`}
      title={`Final OC Editor — ${oc.oc_number || "OC"}`}
    />
  );
}