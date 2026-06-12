export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string; seller_id?: string }>;
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

const previewItems = [
  {
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
  {
    sku: "T28090/1",
    article_no: "T28090/1",
    color: "WHITE",
    color_no: "002",
    size: "STANDARD",
    width: "110",
    piece_length: "25",
    quantity: "2",
    unit_price: "250.00",
    currency: "USD",
    amount: "500.00",
    notes: "Color change to white",
  },
];

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function valueAt(row: any, key: string) {
  return String(row?.[key] ?? "");
}

function mappedValue(row: any) {
  return (
    row?.mapped_to ||
    row?.source_field ||
    row?.field_name ||
    row?.total_key ||
    row?.block_key ||
    ""
  );
}

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
    item: previewItems[0],
    manual: sampleManual,
  };
}

function getByPath(data: any, path: string) {
  if (!path) return "";

  const parts = path.split(".");
  let current = data;

  for (const part of parts) {
    if (current == null) return "";
    current = current[part];
  }

  return current == null ? "" : String(current);
}

function labelForMappedPath(path: string, displayLabel: string) {
  const normalized = displayLabel.trim();

  const labels: Record<string, string> = {
    "seller.gst_no": "GST No",
    "seller.phone": "TEL",
    "seller.fax": "FAX",
    "seller.email": "E-MAIL",
    "seller.bank_name": "Bank",
    "seller.account_number": "A/C NO",
    "seller.swift_code": "SWIFT CODE",
    "customer.name": normalized.toLowerCase().includes("mess")
      ? "Messers."
      : "Customer",
    "customer.address": "Address",
    "customer.country": "Country",
    "agent.name": "AGENT",
    "agent.company": "AGENT",
    "order.oc_number": "ORDER NO.",
    "order.oc_date": "ORDER DATE",
    "order.po_number": "CUSTOMER P.O.",
    "order.po_date": "P.O. DATE",
    "order.reference": "REFERENCE",
    "order.payment_terms": "PAYMENT TERMS",
    "order.shipment_terms": "SHIPMENT TERMS",
    "order.shipping_address": "SHIPPING ADDRESS",
    "order.shipping_instructions": "SHIPPING INSTRUCTIONS",
    "order.delivery_date": "DELIVERY DATE",
    "order.attention_of": "TO THE ATTENTION OF",
    "order.total_amount": "TOTAL",
  };

  return labels[path] || normalized;
}

function shouldRenderAsLabelValue(path: string) {
  return [
    "seller.gst_no",
    "seller.phone",
    "seller.fax",
    "seller.email",
    "seller.bank_name",
    "seller.account_number",
    "seller.swift_code",
    "customer.name",
    "customer.address",
    "customer.country",
    "agent.name",
    "agent.company",
    "order.oc_number",
    "order.oc_date",
    "order.po_number",
    "order.po_date",
    "order.reference",
    "order.payment_terms",
    "order.shipment_terms",
    "order.shipping_address",
    "order.shipping_instructions",
    "order.delivery_date",
    "order.attention_of",
    "order.total_amount",
  ].includes(path);
}

function previewValue(row: any, previewData: any) {
  const mapped = mappedValue(row);
  const value = getByPath(previewData, mapped);
  const displayLabel = valueAt(row, "display_label");

  if (value) {
    if (shouldRenderAsLabelValue(mapped)) {
      return `${labelForMappedPath(mapped, displayLabel)}: ${value}`;
    }

    return value;
  }

  return displayLabel || mapped || "";
}

function confidenceLabel(value: any) {
  const confidence = Number(value || 0);

  if (!confidence) return "No confidence";
  if (confidence >= 0.95) return `High ${(confidence * 100).toFixed(0)}%`;
  if (confidence >= 0.8) return `Review ${(confidence * 100).toFixed(0)}%`;
  return `Low ${(confidence * 100).toFixed(0)}%`;
}

function confidenceClass(value: any) {
  const confidence = Number(value || 0);

  if (!confidence) return "bg-gray-50 text-gray-500 border-gray-200";
  if (confidence >= 0.95) return "bg-green-50 text-green-700 border-green-200";
  if (confidence >= 0.8)
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function statusLabel(status: string | null) {
  if (!status) return "Draft";
  if (status === "pending_approval") return "Pending Approval";
  if (status === "approved") return "Approved";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function OCTemplatePreviewPage({
  params,
  searchParams,
}: PreviewPageProps) {
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
        .select("id, analysis, image_url, status")
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
  const analysis = draft?.analysis || {};
  const previewData = makePreviewData(selectedSeller);

  const basePreviewUrl = `/oc-templates/${id}/preview?draft=${draft?.id || ""}${
    selectedSellerId ? `&seller_id=${selectedSellerId}` : ""
  }`;

  const sampleEditorUrl = `/oc-templates/${id}/sample-editor?draft=${
    draft?.id || ""
  }${selectedSellerId ? `&seller_id=${selectedSellerId}` : ""}`;

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Visual Preview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate a Sample OC, edit the layout if required, then approve the
            template.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/oc-templates/${id}/ai-review${
              draftId ? `?draft=${draftId}` : ""
            }`}
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Back to Review
          </Link>

          <Link
            href="/oc-templates"
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Back to Templates
          </Link>
        </div>
      </div>

      {(templateError || draftError) && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {templateError?.message || draftError?.message}
        </div>
      )}

      {!template && (
        <div className="p-6 rounded-xl border bg-yellow-50 text-yellow-800">
          Template not found.
        </div>
      )}

      {template && !draft && (
        <div className="p-6 rounded-xl border bg-yellow-50 text-yellow-800">
          No AI draft found. Open this page from the AI Review page.
        </div>
      )}

      {template && draft && (
        <>
          <div className="bg-white border rounded-xl p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">Template</div>
                <div className="text-xl font-semibold">
                  {template.template_name || "Untitled Template"}
                </div>
                <div className="text-sm text-gray-600">
                  {template.company_name || ""}
                </div>
                <div className="text-sm text-gray-500">
                  Draft Status: {draft.status || "draft"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-500">Template Status</div>
                <span className="inline-block mt-1 px-3 py-1 rounded-full bg-gray-100 text-gray-800 border text-sm">
                  {statusLabel(template.template_status)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Preview Controls</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review the AI layout and generated Sample OC. Use the
                  full-screen editor to adjust the actual Sample OC layout.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href={basePreviewUrl}
                  className="px-4 py-2 rounded-lg border bg-gray-100 text-gray-700 border-gray-300"
                >
                  View Mode
                </Link>

                <Link
                  href={sampleEditorUrl}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-100"
                >
                  Edit Sample OC Layout
                </Link>
              </div>
            </div>

            <form method="GET" className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="hidden" name="draft" value={draft.id} />

              <label className="text-sm text-gray-600 md:col-span-2">
                Seller Profile
                <select
                  name="seller_id"
                  defaultValue={selectedSellerId}
                  className="mt-1 w-full border rounded-lg px-4 py-3 text-sm bg-white text-gray-900"
                >
                  {sellers.length === 0 ? (
                    <option value="">No seller profiles found</option>
                  ) : (
                    sellers.map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.profile_name || seller.company_name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <button className="self-end px-5 py-3 rounded-lg bg-gray-800 text-white hover:bg-gray-900">
                Update Preview
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold">Original Blank Template</h2>

              {draft.image_url ? (
                <img
                  src={draft.image_url}
                  alt="Original OC"
                  className="w-full border rounded-lg"
                />
              ) : template.template_url ? (
                <iframe
                  src={template.template_url}
                  className="w-full h-[900px] border rounded-lg"
                />
              ) : (
                <div className="p-6 bg-gray-50 rounded-lg text-gray-500">
                  No original template file available.
                </div>
              )}
            </div>

            <div className="bg-white border rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold">AI Layout Draft</h2>

              <div className="relative mx-auto bg-white border rounded-lg overflow-hidden w-full max-w-[595px] h-[842px]">
                <GeneratedCanvas analysis={analysis} previewData={previewData} />
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Sample OC Review</h2>
              <p className="text-sm text-gray-500 mt-1">
                Generate a Sample OC using demo data. If anything is misplaced,
                open the full-screen editor, drag the values into place, save,
                and regenerate.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <form action="/api/oc-templates/generate-sample-oc" method="POST">
                <input type="hidden" name="template_id" value={id} />
                <input type="hidden" name="draft_id" value={draft.id} />
                <input
                  type="hidden"
                  name="seller_profile_id"
                  value={selectedSellerId}
                />

                <button className="px-5 py-3 rounded-lg bg-gray-700 text-white hover:bg-gray-800">
                  {template.approved_pdf_url
                    ? "Regenerate Sample OC"
                    : "Generate Sample OC"}
                </button>
              </form>

              <Link
                href={sampleEditorUrl}
                className="px-5 py-3 rounded-lg bg-gray-50 text-gray-800 border hover:bg-gray-100"
              >
                Edit Sample OC Layout
              </Link>

              <form action="/api/oc-templates/apply-ai-draft" method="POST">
                <input type="hidden" name="template_id" value={id} />
                <input type="hidden" name="draft_id" value={draft.id} />

                <button className="px-5 py-3 rounded-lg bg-gray-800 text-white hover:bg-gray-900">
                  Apply AI Template Structure
                </button>
              </form>

              <Link
                href={`/oc-templates/${id}/ai-review?draft=${draft.id}`}
                className="px-5 py-3 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              >
                Advanced AI Review
              </Link>
            </div>
          </div>

          {template.approved_pdf_url && (
            <div className="bg-white border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Generated Sample OC</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Review the generated Sample OC. If values are misplaced,
                    open the full-screen editor.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={sampleEditorUrl}
                    className="px-5 py-3 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
                  >
                    Edit Sample OC Layout
                  </Link>

                  <a
                    href={template.approved_pdf_url}
                    target="_blank"
                    className="px-5 py-3 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                  >
                    Open PDF in New Tab
                  </a>
                </div>
              </div>

              <iframe
                src={template.approved_pdf_url}
                className="w-full h-[900px] border rounded-lg"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GeneratedCanvas({
  analysis,
  previewData,
}: {
  analysis: any;
  previewData: any;
}) {
  const logos = asArray(analysis.logos);
  const regions = asArray(analysis.regions);
  const fields = asArray(analysis.fields);
  const columns = asArray(analysis.columns);
  const totals = asArray(analysis.totals);
  const staticBlocks = asArray(analysis.static_blocks);
  const lines = asArray(analysis.lines);
  const rectangles = asArray(analysis.rectangles);
  const tableBorders = asArray(analysis.table_borders);

  return (
    <>
      {tableBorders.map((table, index) => (
        <PreviewTableBorder key={`table-border-${index}`} table={table} />
      ))}

      {rectangles.map((rectangle, index) => (
        <PreviewRectangle key={`rectangle-${index}`} rectangle={rectangle} />
      ))}

      {lines.map((line, index) => (
        <PreviewLine key={`line-${index}`} line={line} />
      ))}

      {regions.map((region, index) => (
        <PreviewBox
          key={`region-${index}`}
          label={valueAt(region, "display_label")}
          x={Number(region.x_position || 0)}
          y={Number(region.y_position || 0)}
          width={Number(region.width || 100)}
          height={Number(region.height || 40)}
        />
      ))}

      {logos.map((logo, index) => (
        <PreviewLogo
          key={`logo-${index}`}
          logo={logo}
          previewData={previewData}
          x={Number(logo.x_position || 30)}
          y={Number(logo.y_position || 760)}
          width={Number(logo.width || 100)}
          height={Number(logo.height || 50)}
        />
      ))}

      {fields.map((field, index) => (
        <PreviewText
          key={`field-${index}`}
          label={previewValue(field, previewData)}
          x={Number(field.x_position || 0)}
          y={Number(field.y_position || 0)}
          fontSize={Number(field.font_size || 10)}
          confidence={field.confidence}
        />
      ))}

      <PreviewTable columns={columns} items={previewItems} />

      {totals.map((total, index) => (
        <PreviewText
          key={`total-${index}`}
          label={`${valueAt(total, "display_label")}: ${
            getByPath(previewData, mappedValue(total)) ||
            previewData.order.total_amount
          }`}
          x={Number(total.x_position || 360)}
          y={Number(total.y_position || 180 - index * 18)}
          fontSize={Number(total.font_size || 10)}
          confidence={total.confidence}
        />
      ))}

      {staticBlocks.map((block, index) => (
        <PreviewText
          key={`static-${index}`}
          label={valueAt(block, "content") || valueAt(block, "display_label")}
          x={Number(block.x_position || 40)}
          y={Number(block.y_position || 80)}
          fontSize={Number(block.font_size || 9)}
          confidence={block.confidence}
        />
      ))}
    </>
  );
}

function PreviewTableBorder({ table }: { table: any }) {
  const x = Number(table.x_position || 35);
  const y = Number(table.y_position || 530);
  const width = Number(table.width || 520);
  const height = Number(table.height || 150);
  const rows = Math.max(Number(table.row_count || 4), 1);
  const columns = Math.max(Number(table.column_count || 6), 1);
  const borderThickness = Number(table.border_thickness || 1);
  const borderColor = table.border_color || "#111827";

  return (
    <div
      className="absolute bg-transparent"
      style={{
        left: `${x}px`,
        top: `${842 - y - height}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: `${borderThickness}px solid ${borderColor}`,
      }}
    >
      {Array.from({ length: Math.max(rows - 1, 0) }).map((_, index) => (
        <span
          key={`row-${index}`}
          className="absolute left-0 w-full"
          style={{
            top: `${((index + 1) / rows) * 100}%`,
            borderTop: `${borderThickness}px solid ${borderColor}`,
          }}
        />
      ))}

      {Array.from({ length: Math.max(columns - 1, 0) }).map((_, index) => (
        <span
          key={`column-${index}`}
          className="absolute top-0 h-full"
          style={{
            left: `${((index + 1) / columns) * 100}%`,
            borderLeft: `${borderThickness}px solid ${borderColor}`,
          }}
        />
      ))}
    </div>
  );
}

function PreviewRectangle({ rectangle }: { rectangle: any }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${Number(rectangle.x_position || 0)}px`,
        top: `${
          842 -
          Number(rectangle.y_position || 0) -
          Number(rectangle.height || 0)
        }px`,
        width: `${Number(rectangle.width || 100)}px`,
        height: `${Number(rectangle.height || 40)}px`,
        border: `${Number(rectangle.border_thickness || 1)}px solid ${
          rectangle.border_color || "#111827"
        }`,
        background:
          rectangle.fill_color && rectangle.fill_color !== "transparent"
            ? rectangle.fill_color
            : "transparent",
      }}
    />
  );
}

function PreviewLine({ line }: { line: any }) {
  const x1 = Number(line.x1 || 0);
  const y1 = Number(line.y1 || 0);
  const x2 = Number(line.x2 || 100);
  const y2 = Number(line.y2 || y1);

  return (
    <div
      className="absolute"
      style={{
        left: `${Math.min(x1, x2)}px`,
        top: `${842 - Math.max(y1, y2)}px`,
        width: `${Math.max(Math.abs(x2 - x1), 1)}px`,
        borderTop: `${Number(line.thickness || 1)}px solid ${
          line.color || "#111827"
        }`,
      }}
    />
  );
}

function PreviewTable({ columns, items }: { columns: any[]; items: any[] }) {
  const sortedColumns = [...columns].sort((a, b) => {
    return Number(a.column_order || 0) - Number(b.column_order || 0);
  });

  if (sortedColumns.length === 0) return null;

  return (
    <>
      {sortedColumns.map((column, index) => {
        const x = Number(column.x_position || 35 + index * 65);
        const y = Number(column.y_position || 530);
        const width = Number(column.width || 65);
        const height = Number(column.height || 30);
        const fontSize = Number(column.font_size || 8);
        const rowHeight = 22;

        return (
          <div key={`column-${index}`}>
            <div
              className="absolute border border-green-400 bg-green-50 text-green-900 p-1 overflow-hidden font-medium"
              style={{
                left: `${x}px`,
                top: `${842 - y}px`,
                width: `${width}px`,
                height: `${height}px`,
                fontSize: `${fontSize}px`,
              }}
            >
              {valueAt(column, "display_label")}
            </div>

            {items.map((item, itemIndex) => {
              const mapped = mappedValue(column);
              const itemPath = mapped.startsWith("item.")
                ? mapped.replace("item.", "")
                : valueAt(column, "source_field");
              const value = String(item?.[itemPath] ?? "");

              return (
                <div
                  key={`table-cell-${index}-${itemIndex}`}
                  className="absolute border border-gray-300 bg-white text-gray-900 p-1 overflow-hidden"
                  style={{
                    left: `${x}px`,
                    top: `${842 - y + height + itemIndex * rowHeight}px`,
                    width: `${width}px`,
                    height: `${rowHeight}px`,
                    fontSize: `${fontSize}px`,
                  }}
                >
                  {value}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function PreviewLogo({
  logo,
  previewData,
  x,
  y,
  width,
  height,
}: {
  logo: any;
  previewData: any;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const logoUrl = getByPath(previewData, mappedValue(logo));

  return (
    <div
      className="absolute border border-purple-400 bg-purple-50 text-purple-800 text-[9px] flex items-center justify-center overflow-hidden"
      style={{
        left: `${x}px`,
        top: `${842 - y - height}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="Seller Logo" className="max-w-full max-h-full" />
      ) : (
        <span>Seller Logo</span>
      )}
    </div>
  );
}

function PreviewBox({
  label,
  x,
  y,
  width,
  height,
}: {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <div
      className="absolute border border-blue-300 bg-blue-50/20 text-[9px] text-blue-700 p-1 overflow-hidden"
      style={{
        left: `${x}px`,
        top: `${842 - y - height}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {label}
    </div>
  );
}

function PreviewText({
  label,
  x,
  y,
  fontSize,
  confidence,
}: {
  label: string;
  x: number;
  y: number;
  fontSize: number;
  confidence?: any;
}) {
  return (
    <div
      className={`absolute text-gray-900 bg-white/90 border px-1 whitespace-nowrap max-w-[280px] overflow-hidden ${confidenceClass(
        confidence
      )}`}
      style={{
        left: `${x}px`,
        top: `${842 - y}px`,
        fontSize: `${fontSize}px`,
      }}
      title={confidenceLabel(confidence)}
    >
      {label}
    </div>
  );
}