export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import OCTemplateVisualEditor from "@/components/oc-template-visual-editor";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string; seller_id?: string; r?: string }>;
};

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  swift_code: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  signature_url: string | null;
  is_default: boolean | null;
};

type TemplateRecord = {
  id: string;
  company_name: string | null;
  template_name: string | null;
  template_url: string | null;
  approved_pdf_url: string | null;
  template_status: string | null;
};

const sampleCustomer = {
  name: "SHIATZY CHEN",
  address: "Taipei",
  country: "TAIWAN",
  email: "customer@example.com",
  phone: "",
};

const sampleAgent = {
  name: "CHIH FAN TEXTILE CO. LTD.(A)",
  company: "CHIH FAN TEXTILE CO. LTD.(A)",
};

const sampleOrder = {
  oc_number: "OC-SAMPLE-1001",
  oc_date: "2026-06-10",
  po_number: "PO-6664",
  po_date: "2026-06-01",
  reference: "REF-SAMPLE",
  payment_terms: "ADVANCE",
  shipment_terms: "FOB",
  shipping_address: "Taipei, Taiwan",
  shipping_instructions: "Ship as per buyer instruction",
  delivery_date: "2026-08-15",
  attention_of: "Purchase Department",
  notes: "Please confirm delivery schedule.",
  total_amount: "USD 1,250.00",
};

const sampleManual = {
  agent_name: "CHIH FAN TEXTILE CO. LTD.(A)",
  attention_of: "Purchase Department",
  notes: "Manual note",
  custom_text: "Manual text",
};

function sellerAddress(profile: SellerProfile | null) {
  if (!profile) {
    return "1, JANAN GOSWAMI SARANI, 16-S, BLOCK A, 4TH FLOOR, NEW ALIPORE, KOLKATA-700053";
  }

  return [
    profile.address_line_1,
    profile.address_line_2,
    profile.city,
    profile.state,
    profile.postal_code,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function makePreviewData(selectedSeller: SellerProfile | null) {
  return {
    seller: {
      logo: selectedSeller?.logo_url || "",
      company_name: selectedSeller?.company_name || "PINX INTERNATIONAL",
      address: sellerAddress(selectedSeller),
      gst_no: selectedSeller?.gst_number || "19ACNPC5141K1ZG",
      phone: selectedSeller?.phone || "+91 33 0000 0000",
      fax: "",
      email: selectedSeller?.email || "sales@example.com",
      bank_name: selectedSeller?.bank_name || "KOTAK MAHINDRA",
      account_number: selectedSeller?.account_number || "5548655149",
      swift_code: selectedSeller?.swift_code || "KKBKINBBCPC",
      bank_address: "Kolkata, India",
    },
    customer: sampleCustomer,
    agent: sampleAgent,
    order: sampleOrder,
    item: {
      sku: "A13116",
      article_no: "A13116",
      color: "WHITE",
      color_no: "001",
      size: "STANDARD",
      width: "135",
      piece_length: "50",
      quantity: "60",
      unit_price: "12.50",
      currency: "USD",
      amount: "750.00",
      notes: "",
    },
    manual: sampleManual,
  };
}

async function getPdfPageSize(pdfUrl: string | null) {
  if (!pdfUrl) {
    return { width: 595, height: 842 };
  }

  try {
    const response = await fetch(pdfUrl, { cache: "no-store" });

    if (!response.ok) {
      return { width: 595, height: 842 };
    }

    const arrayBuffer = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const firstPage = pdfDoc.getPages()[0];

    if (!firstPage) {
      return { width: 595, height: 842 };
    }

    const { width, height } = firstPage.getSize();

    return {
      width,
      height,
    };
  } catch {
    return { width: 595, height: 842 };
  }
}

export default async function SampleOCEditorPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { draft: draftId, seller_id: sellerId } = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: templateRaw, error: templateError } = await supabase
    .from("oc_templates")
    .select(
      "id, company_name, template_name, template_url, approved_pdf_url, template_status"
    )
    .eq("id", id)
    .maybeSingle();

  const template = (templateRaw || null) as TemplateRecord | null;

  const { data: draft, error: draftError } = draftId
    ? await supabase
        .from("oc_template_ai_drafts")
        .select("id, template_id, analysis, image_url, status")
        .eq("id", draftId)
        .eq("template_id", id)
        .maybeSingle()
    : { data: null, error: null };

  const { data: sellersData } = await supabase
    .from("seller_profiles")
    .select(
      "id, profile_name, company_name, address_line_1, address_line_2, city, state, country, postal_code, gst_number, bank_name, account_number, swift_code, email, phone, logo_url, signature_url, is_default"
    )
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true });

  const sellers = (sellersData || []) as SellerProfile[];

  const selectedSeller =
    sellers.find((seller) => seller.id === sellerId) ||
    sellers.find((seller) => seller.is_default === true) ||
    sellers[0] ||
    null;

  const selectedSellerId = selectedSeller?.id || "";
  const previewData = makePreviewData(selectedSeller);

  const previewUrl = `/oc-templates/${id}/preview?draft=${draft?.id || ""}${
    selectedSellerId ? `&seller_id=${selectedSellerId}` : ""
  }`;

  const pageSize = await getPdfPageSize(template?.template_url || null);

  const editorBackgroundUrl = draft?.image_url || template?.template_url || "";
  const generatedPdfUrl = template?.approved_pdf_url || "";

  if (templateError || draftError) {
    return (
      <div className="min-h-screen bg-gray-100 p-10">
        <div className="max-w-3xl mx-auto bg-white border rounded-xl p-6 text-red-700">
          {templateError?.message || draftError?.message}
        </div>
      </div>
    );
  }

  if (!template || !draft) {
    return (
      <div className="min-h-screen bg-gray-100 p-10">
        <div className="max-w-3xl mx-auto bg-white border rounded-xl p-6">
          <h1 className="text-xl font-semibold">Sample editor unavailable</h1>
          <p className="text-sm text-gray-500 mt-2">
            Template or AI draft was not found.
          </p>
          <Link
            href="/oc-templates"
            className="inline-block mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white"
          >
            Back to Templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <OCTemplateVisualEditor
      templateId={id}
      draftId={draft.id}
      analysis={draft.analysis || {}}
      previewData={previewData}
      sampleData={previewData}
      originalImageUrl={editorBackgroundUrl}
      generatedPdfUrl={generatedPdfUrl}
      pageWidth={pageSize.width}
      pageHeight={pageSize.height}
      fullScreen
      templateName={template.template_name || "Untitled Template"}
      backUrl={previewUrl}
      sellerProfileId={selectedSellerId}
    />
  );
}