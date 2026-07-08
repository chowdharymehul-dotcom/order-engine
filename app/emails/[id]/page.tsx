export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import GenerateOCButton from "@/components/orders/GenerateOCButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

type EmailRecord = {
  id: string;
  provider: string | null;
  subject: string | null;
  from_email: string | null;
  body_text: string | null;
  attachment_text: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_type: string | null;
  processing_status: string | null;
  received_at: string | null;
  gmail_message_id: string | null;
  external_message_id: string | null;
  last_processing_error: string | null;
  ocr_attempts: number | null;
};

type OrderItem = {
  id: string;
  action: string | null;
  customer: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  currency: string | null;
  notes: string | null;
  status: string | null;
oc_pdf_url: string | null;
oc_document_id: string | null;
};
type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
};

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalise(value: string | null | undefined) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function decodeHtml(value: string | null | undefined) {
  return clean(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#65279;/g, "")
    .replace(/&#39;/g, "'");
}

function formatDateTime(value: string | null) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function statusClass(status: string | null) {
  if (status === "processed") return "bg-green-50 text-green-700 border-green-200";
  if (status === "needs_ocr") return "bg-orange-50 text-orange-700 border-orange-200";
  if (status === "ocr_failed" || status === "ocr_blocked")
    return "bg-red-50 text-red-700 border-red-200";
  if (status === "ready_for_ai") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function prettyError(value: string | null) {
  if (!value) return "";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function detectWorkspaceType(items: OrderItem[]) {
  if (items.some((item) => normalise(item.action) === "place order")) {
    return "Order";
  }

  if (items.some((item) => normalise(item.action).includes("cancel"))) {
    return "Cancellation";
  }

  if (
    items.some(
      (item) =>
        normalise(item.action).includes("enquiry") ||
        normalise(item.action).includes("follow")
    )
  ) {
    return "Enquiry";
  }

  return "Communication";
}

function typeClass(type: string) {
  if (type === "Order") return "bg-purple-50 text-purple-700 border-purple-200";
  if (type === "Enquiry") return "bg-blue-50 text-blue-700 border-blue-200";
  if (type === "Cancellation") return "bg-red-50 text-red-700 border-red-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function getPrimaryCustomer(items: OrderItem[], email: EmailRecord) {
  const orderCustomer = items.find(
    (item) =>
      normalise(item.action) === "place order" &&
      clean(item.customer)
  )?.customer;

  return clean(orderCustomer) || clean(items.find((item) => item.customer)?.customer) || clean(email.from_email) || "Unknown customer";
}

function getPrimaryPO(items: OrderItem[]) {
  return clean(items.find((item) => item.po_number)?.po_number);
}

function orderItemsOnly(items: OrderItem[]) {
  const map = new Map<string, OrderItem>();
  const acceptedChanges: OrderItem[] = [];

  for (const item of items) {
    if (normalise(item.action) !== "place order") continue;

    const sku = normalise(item.sku);
    if (!sku) continue;

    if (normalise(item.status).startsWith("added vide mail dated")) {
      acceptedChanges.push(item);
      continue;
    }

    if (!map.has(sku)) {
      map.set(sku, item);
    }
  }

  return [...Array.from(map.values()), ...acceptedChanges];
}

function sumAmount(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
}

function getCurrency(items: OrderItem[]) {
  return clean(items.find((item) => item.currency)?.currency) || "USD";
}

function splitConversation(bodyText: string | null) {
  const text = decodeHtml(bodyText);

  if (!text) return [];

  const prepared = text
    .replace(/\s+On\s+([A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}.*?wrote:)/g, "\n\nOn $1")
    .replace(/\s+From:\s+/g, "\n\nFrom: ")
    .replace(/\s+Sent:\s+/g, "\nSent: ")
    .replace(/\s+To:\s+/g, "\nTo: ")
    .replace(/\s+Subject:\s+/g, "\nSubject: ")
    .replace(/\s+Sent from my iPhone/g, "\n\nSent from my iPhone")
    .replace(/\s+Sent from my iPad/g, "\n\nSent from my iPad")
    .replace(/\s+Thanks\s+/g, "\n\nThanks\n")
    .replace(/\s+Regards\s+/g, "\n\nRegards\n")
    .replace(/\s+Dear\s+/g, "\nDear ")
    .replace(/\s+Hello\s+/g, "\nHello ");

  const parts = prepared
    .split(/\n(?=On .+ wrote:|From: )/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return [text];

  return parts;
}

function shortPreview(value: string, limit = 900) {
  if (value.length <= limit) return value;

  return `${value.slice(0, limit).trim()}...`;
}

function getSummaryBullets(params: {
  workspaceType: string;
  customer: string;
  poNumber: string;
  orderItems: OrderItem[];
  email: EmailRecord;
}) {
  const { workspaceType, customer, poNumber, orderItems, email } = params;
  const bullets: string[] = [];

  bullets.push(`${workspaceType} communication detected.`);
  bullets.push(`Customer: ${customer}.`);

  if (poNumber) bullets.push(`PO Number: ${poNumber}.`);

  if (workspaceType === "Order") {
    bullets.push(`${orderItems.length} order line item${orderItems.length === 1 ? "" : "s"} found.`);

    const total = sumAmount(orderItems);
    if (total > 0) bullets.push(`Estimated total value: ${getCurrency(orderItems)} ${total.toFixed(2)}.`);
  }

  if (workspaceType === "Enquiry") {
    bullets.push("This looks like a customer question or follow-up.");
  }

  if (workspaceType === "Cancellation") {
    bullets.push("This appears to need cancellation review.");
  }

  if (email.last_processing_error) {
    bullets.push("Processing error exists and should be reviewed.");
  }

  return bullets;
}

export default async function EmailDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: email, error: emailError } = await supabaseAdmin
    .from("emails")
    .select("*")
    .eq("id", id)
    .single();

  if (emailError || !email) {
    return notFound();
  }

  const typedEmail = email as EmailRecord;

let orderItems: any[] = [];

if (typedEmail.external_message_id) {
  const { data } = await supabaseAdmin
    .from("order_items")
    .select(
  "id, action, customer, po_number, sku, quantity, unit_price, total_amount, currency, notes, status, oc_pdf_url, oc_document_id"
)
.is("deleted_at", null)
    .eq("external_message_id", typedEmail.external_message_id);

  orderItems = data || [];
}

if (orderItems.length === 0 && typedEmail.gmail_message_id) {
  const { data } = await supabaseAdmin
    .from("order_items")
    .select(
  "id, action, customer, po_number, sku, quantity, unit_price, total_amount, currency, notes, status, oc_pdf_url, oc_document_id"
)
.is("deleted_at", null)
    .eq("gmail_message_id", typedEmail.gmail_message_id);

  orderItems = data || [];
}

if (orderItems.length === 0 && typedEmail.subject) {
  const { data } = await supabaseAdmin
    .from("order_items")
    .select(
  "id, action, customer, po_number, sku, quantity, unit_price, total_amount, currency, notes, status, oc_pdf_url, oc_document_id"
)
.is("deleted_at", null)
    .eq("email_subject", typedEmail.subject);

  orderItems = data || [];
}

  const items = (orderItems ?? []) as OrderItem[];
  const orderLines = orderItemsOnly(items);
const { data: sellerRows } = await supabaseAdmin
  .from("seller_profiles")
  .select("id, profile_name, company_name")
  .eq("is_active", true)
  .order("is_default", { ascending: false })
  .order("company_name", { ascending: true });

const sellers = ((sellerRows || []) as SellerProfile[]).map((seller) => ({
  id: seller.id,
  label: seller.profile_name || seller.company_name || "Unnamed Seller",
}));

const orderLineIds = orderLines.map((item) => item.id).join(",");
  const workspaceType = detectWorkspaceType(items);
  const customer = getPrimaryCustomer(items, typedEmail);
  const poNumber = getPrimaryPO(items);

  const hasAttachment = !!typedEmail.attachment_url;
  const hasAttachmentText = !!typedEmail.attachment_text?.trim();
  const conversationParts = splitConversation(typedEmail.body_text);
  const summaryBullets = getSummaryBullets({
    workspaceType,
    customer,
    poNumber,
    orderItems: orderLines,
    email: typedEmail,
  });

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Link href="/orders" className="text-sm text-blue-600 hover:underline">
                ← Back to Orders
              </Link>

              <span
                className={`px-3 py-1 rounded-full border text-xs font-semibold ${typeClass(
                  workspaceType
                )}`}
              >
                {workspaceType}
              </span>

              <span
                className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusClass(
                  typedEmail.processing_status
                )}`}
              >
                {typedEmail.processing_status || "unknown"}
              </span>
            </div>

            <h1 className="text-3xl font-bold mb-2">
              {typedEmail.subject || "(No subject)"}
            </h1>

            <div className="text-sm text-gray-600 space-y-1">
              <div>
                <strong>Customer:</strong> {customer}
              </div>
              <div>
                <strong>From:</strong> {typedEmail.from_email || ""}
              </div>
              <div>
                <strong>Received:</strong> {formatDateTime(typedEmail.received_at)}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <form action="/api/process-emails" method="GET">
              <input type="hidden" name="emailId" value={typedEmail.id} />
              <input type="hidden" name="force" value="true" />

              <button className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                Reprocess
              </button>
            </form>

            <form action="/api/process-ocr" method="GET">
              <input type="hidden" name="emailId" value={typedEmail.id} />
              <input type="hidden" name="force" value="true" />

              <button className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">
                Run OCR
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">

          {orderLines.length > 0 && (
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Order Details</h2>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-3 border text-left">SKU</th>
                      <th className="p-3 border text-right">Qty</th>
                      <th className="p-3 border text-right">Unit Price</th>
                      <th className="p-3 border text-right">Amount</th>
                      <th className="p-3 border text-left">Notes</th>
                      <th className="p-3 border text-left">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orderLines.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 border font-medium">{item.sku || ""}</td>
                        <td className="p-3 border text-right">{item.quantity ?? ""}</td>
                        <td className="p-3 border text-right">
                          {item.unit_price ?? ""}
                        </td>
                        <td className="p-3 border text-right">
                          {item.total_amount ?? ""}
                        </td>
                        <td className="p-3 border">{item.notes || ""}</td>
                        <td className="p-3 border">{item.status || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
{items.length > orderLines.length && (
  <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm">
    <h2 className="text-xl font-semibold mb-3 text-red-700">
      Changes / Additional Mentions Detected
    </h2>

    <p className="text-sm text-red-700 mb-4">
      This email thread contains repeated item mentions or possible requested changes.
      The Order Details table above shows the unique ordered items only.
    </p>

    <div className="space-y-2 text-sm">
      {items
        .filter((item) => normalise(item.action) === "place order")
        .filter((item) => !orderLines.some((line) => line.id === item.id))
        .map((item) => (
          <div key={item.id} className="bg-white border border-red-100 rounded-lg p-3">
            <div>
              <strong>SKU:</strong> {item.sku || "Not detected"}
            </div>
            <div>
              <strong>Qty:</strong> {item.quantity ?? ""}
            </div>
            <div>
              <strong>Notes:</strong> {item.notes || ""}
<div className="flex gap-2 mt-3">
  <form action="/api/email-order-change" method="POST">
    <input type="hidden" name="item_id" value={item.id} />
    <input type="hidden" name="email_id" value={typedEmail.id} />
    <input type="hidden" name="received_at" value={typedEmail.received_at || ""} />
    <button
      type="submit"
      name="operation"
      value="accept"
      className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700"
    >
      Accept Request
    </button>
  </form>

  <form action="/api/email-order-change" method="POST">
    <input type="hidden" name="item_id" value={item.id} />
    <input type="hidden" name="email_id" value={typedEmail.id} />
    <button
      type="submit"
      name="operation"
      value="ignore"
      className="px-3 py-2 rounded-lg bg-white border text-xs hover:bg-gray-50"
    >
      Ignore
    </button>
  </form>
</div>
            </div>
          </div>
        ))}
    </div>
  </div>
)}
          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">AI Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
              <div className="border rounded-xl p-4 bg-gray-50">
                <div className="text-xs text-gray-500">Type</div>
                <div className="font-semibold">{workspaceType}</div>
              </div>

              <div className="border rounded-xl p-4 bg-gray-50">
                <div className="text-xs text-gray-500">PO Number</div>
                <div className="font-semibold">{poNumber || "Not detected"}</div>
              </div>

              <div className="border rounded-xl p-4 bg-gray-50">
                <div className="text-xs text-gray-500">Line Items</div>
                <div className="font-semibold">{orderLines.length}</div>
              </div>

              <div className="border rounded-xl p-4 bg-gray-50">
                <div className="text-xs text-gray-500">Total Value</div>
                <div className="font-semibold">
                  {sumAmount(orderLines) > 0
                    ? `${getCurrency(orderLines)} ${sumAmount(orderLines).toFixed(2)}`
                    : "Not available"}
                </div>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-gray-700">
              {summaryBullets.map((bullet) => (
                <li key={bullet}>✓ {bullet}</li>
              ))}
            </ul>
          </div>

          
          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Conversation</h2>
              <div className="text-sm text-gray-500">
                {conversationParts.length} message section
                {conversationParts.length === 1 ? "" : "s"}
              </div>
            </div>

            {conversationParts.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                No body text found.
              </div>
            ) : (
              <div className="space-y-4">
                {conversationParts.slice(0, 3).map((part, index) => (
                  <div
                    key={`${index}-${part.slice(0, 30)}`}
                    className="border rounded-xl p-5 bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">
                        {index === 0 ? "Latest Message" : `Previous Message ${index}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {index === 0 ? "Most recent" : "Thread history"}
                      </div>
                    </div>

                   <div className="whitespace-pre-wrap text-[15px] leading-8 text-gray-800 bg-white border rounded-lg p-4">
  {shortPreview(part)}
</div>
                  </div>
                ))}

                {conversationParts.length > 3 && (
                  <details className="border rounded-xl bg-white">
                    <summary className="cursor-pointer p-4 font-medium text-gray-700">
                      Show {conversationParts.length - 3} older message sections
                    </summary>

                    <div className="p-4 space-y-4">
                      {conversationParts.slice(3).map((part, index) => (
                        <div
                          key={`${index}-older-${part.slice(0, 30)}`}
                          className="border rounded-xl p-5 bg-gray-50"
                        >
                          <div className="font-semibold mb-3">
                            Older Message {index + 1}
                          </div>

                          <div className="whitespace-pre-wrap text-[15px] leading-8 text-gray-800 bg-white border rounded-lg p-4">
  {shortPreview(part)}
</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {hasAttachmentText && (
            <details className="bg-white border rounded-2xl shadow-sm">
              <summary className="cursor-pointer p-6 text-xl font-semibold">
                Attachment / OCR Text
              </summary>

              <div className="px-6 pb-6">
                <div className="bg-gray-50 p-4 rounded-xl whitespace-pre-wrap text-sm max-h-[500px] overflow-auto leading-7">
                  {typedEmail.attachment_text}
                </div>
              </div>
            </details>
          )}

          {typedEmail.last_processing_error && (
            <details className="bg-white border rounded-2xl shadow-sm">
              <summary className="cursor-pointer p-6 text-xl font-semibold text-red-700">
                Processing Error
              </summary>

              <div className="px-6 pb-6">
                <div className="bg-red-50 text-red-800 p-4 rounded-xl whitespace-pre-wrap text-sm max-h-[400px] overflow-auto">
                  {prettyError(typedEmail.last_processing_error)}
                </div>
              </div>
            </details>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 self-start">
          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>

            <div className="space-y-3">
             <Link
  href="/orders"
  className="block w-full px-4 py-3 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-center hover:bg-blue-100"
>
  Back to Orders
</Link>

              {workspaceType === "Order" && orderLines[0] && (
  <GenerateOCButton
    ids={orderLineIds}
    sellers={sellers}
    buttonClassName="block w-full px-4 py-3 rounded-lg bg-purple-100 text-purple-700 text-center hover:bg-purple-200 disabled:opacity-50"
  />
)}
{orderLines[0]?.oc_document_id && (
  <Link
    href={`/orders/${orderLines[0].id}/oc`}
    className="block w-full px-4 py-3 rounded-lg bg-yellow-100 text-yellow-700 text-center hover:bg-yellow-200"
  >
    Edit OC
  </Link>
)}

{orderLines[0]?.oc_pdf_url && (
  <a
    href={orderLines[0].oc_pdf_url}
    target="_blank"
    rel="noreferrer"
    className="block w-full px-4 py-3 rounded-lg bg-green-100 text-green-700 text-center hover:bg-green-200"
  >
    View OC
  </a>
)}
{orderLines[0]?.oc_document_id && (
  <Link
    href={`/orders/${orderLines[0].id}/oc`}
    className="block w-full px-4 py-3 rounded-lg bg-yellow-100 text-yellow-700 text-center hover:bg-yellow-200"
  >
   View OC
  </Link>
)}

{orderLines[0]?.oc_pdf_url && (
  <a
    href={orderLines[0].oc_pdf_url}
    target="_blank"
    rel="noreferrer"
    className="block w-full px-4 py-3 rounded-lg bg-green-100 text-green-700 text-center hover:bg-green-200"
  >
    View OC
  </a>
)}

              {workspaceType === "Enquiry" && items[0] && (
                <Link
                  href={`/enquiries-follow-up/${items[0].id}/reply`}
                  className="block w-full px-4 py-3 rounded-lg bg-blue-100 text-blue-700 text-center hover:bg-blue-200"
                >
                  Reply to Enquiry
                </Link>
              )}

              {hasAttachment && (
                <a
                  href={typedEmail.attachment_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full px-4 py-3 rounded-lg bg-green-100 text-green-700 text-center hover:bg-green-200"
                >
                  Open Attachment
                </a>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Message Details</h2>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-500">Provider</div>
                <div className="font-medium">{typedEmail.provider || "Unknown"}</div>
              </div>

              <div>
                <div className="text-gray-500">OCR Attempts</div>
                <div className="font-medium">{typedEmail.ocr_attempts ?? 0}</div>
              </div>

              <div>
                <div className="text-gray-500">Attachment</div>
                <div className="font-medium">
                  {hasAttachment
                    ? typedEmail.attachment_name || "Attachment saved"
                    : "No attachment URL saved"}
                </div>
              </div>

              <div>
                <div className="text-gray-500">Message ID</div>
                <div className="break-all text-xs">
                  {typedEmail.external_message_id ||
                    typedEmail.gmail_message_id ||
                    typedEmail.id}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Related Items</h2>

            {items.length === 0 ? (
              <p className="text-sm text-gray-600">
                No extracted order, enquiry, or cancellation items found.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-xl p-4 bg-gray-50">
                    <div className="font-semibold">{item.action || "Item"}</div>
                    <div className="text-sm text-gray-600">
                      {item.sku ? `SKU: ${item.sku}` : "No SKU"}
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.quantity ? `Qty: ${item.quantity}` : ""}
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.status || ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!hasAttachmentText && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-orange-800 text-sm">
              No readable attachment text extracted. Use Run OCR if this email
              has an attachment that should be processed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}