export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

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
  notes: string | null;
  status: string | null;
};

function statusClass(status: string | null) {
  if (status === "processed") return "bg-green-100 text-green-700";
  if (status === "needs_ocr") return "bg-orange-100 text-orange-700";
  if (status === "ocr_failed" || status === "ocr_blocked")
    return "bg-red-100 text-red-700";
  if (status === "ready_for_ai") return "bg-blue-100 text-blue-700";

  return "bg-gray-100 text-gray-700";
}

function prettyError(value: string | null) {
  if (!value) return "";

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
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

  let orderItemsQuery = supabaseAdmin
    .from("order_items")
    .select("id, action, customer, po_number, sku, quantity, notes, status");

  if (typedEmail.external_message_id) {
    orderItemsQuery = orderItemsQuery.eq(
      "external_message_id",
      typedEmail.external_message_id
    );
  } else if (typedEmail.gmail_message_id) {
    orderItemsQuery = orderItemsQuery.eq(
      "gmail_message_id",
      typedEmail.gmail_message_id
    );
  } else {
    orderItemsQuery = orderItemsQuery.eq("gmail_message_id", "__none__");
  }

  const { data: orderItems } = await orderItemsQuery;

  const items = (orderItems ?? []) as OrderItem[];

  const hasAttachment = !!typedEmail.attachment_url;
  const hasAttachmentText = !!typedEmail.attachment_text?.trim();

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Email Detail</h1>

        <div className="flex gap-3">
          <Link
            href="/emails"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Back to Emails
          </Link>

          <form action="/api/process-ocr" method="GET">
            <input type="hidden" name="emailId" value={typedEmail.id} />
            <input type="hidden" name="force" value="true" />

            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Run OCR
            </button>
          </form>
        </div>
      </div>

      <div className="border rounded-xl bg-white p-6 space-y-4">
        <div>
          <strong>Subject:</strong> {typedEmail.subject || "(No subject)"}
        </div>

        <div>
          <strong>From:</strong> {typedEmail.from_email || ""}
        </div>

        <div>
          <strong>Received:</strong>{" "}
          {typedEmail.received_at
            ? new Date(typedEmail.received_at).toLocaleString()
            : ""}
        </div>

        <div>
          <strong>Provider:</strong> {typedEmail.provider || ""}
        </div>

        <div>
          <strong>Status:</strong>{" "}
          <span
            className={`px-3 py-1 rounded-full text-sm ${statusClass(
              typedEmail.processing_status
            )}`}
          >
            {typedEmail.processing_status || "unknown"}
          </span>
        </div>

        <div>
          <strong>OCR Attempts:</strong> {typedEmail.ocr_attempts ?? 0}
        </div>

        <div className="break-all">
          <strong>External Message ID:</strong>{" "}
          {typedEmail.external_message_id || typedEmail.gmail_message_id || ""}
        </div>
      </div>

      <div className="border rounded-xl bg-white p-6">
        <h2 className="text-xl font-semibold mb-3">Email Body</h2>

        <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm max-h-[500px] overflow-auto">
          {typedEmail.body_text || "(No body text)"}
        </div>
      </div>

      <div className="border rounded-xl bg-white p-6 space-y-4">
        <h2 className="text-xl font-semibold">Attachment</h2>

        {hasAttachment ? (
          <div className="space-y-3">
            <div>
              <strong>Name:</strong>{" "}
              {typedEmail.attachment_name || "(attachment saved)"}
            </div>

            <div>
              <strong>Type:</strong>{" "}
              {typedEmail.attachment_type ||
                typedEmail.attachment_mime_type ||
                "unknown"}
            </div>

            <div className="break-all">
              <strong>Attachment:</strong>{" "}
              <a
                href={typedEmail.attachment_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Open Attachment
              </a>
            </div>

            {!hasAttachmentText && (
              <div className="rounded-lg bg-orange-50 text-orange-800 p-4 text-sm">
                Attachment exists, but no readable text has been extracted yet.
                Click <strong>Run OCR</strong> above to retry extraction for
                this email.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            No attachment URL saved for this email.
          </div>
        )}
      </div>

      <div className="border rounded-xl bg-white p-6">
        <h2 className="text-xl font-semibold mb-3">Attachment Text</h2>

        <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm max-h-[500px] overflow-auto">
          {hasAttachmentText
            ? typedEmail.attachment_text
            : "(No readable attachment text extracted)"}
        </div>
      </div>

      {typedEmail.last_processing_error && (
        <div className="border rounded-xl bg-white p-6">
          <h2 className="text-xl font-semibold mb-3 text-red-700">
            Last Processing Error
          </h2>

          <div className="bg-red-50 text-red-800 p-4 rounded whitespace-pre-wrap text-sm max-h-[400px] overflow-auto">
            {prettyError(typedEmail.last_processing_error)}
          </div>
        </div>
      )}

      <div className="border rounded-xl bg-white p-6">
        <h2 className="text-xl font-semibold mb-4">Related Items</h2>

        {items.length === 0 ? (
          <p className="text-sm text-gray-600">
            No extracted order/enquiry/cancellation items found for this email.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-300 border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-left">Action</th>
                  <th className="p-2 border text-left">Customer</th>
                  <th className="p-2 border text-left">PO Number</th>
                  <th className="p-2 border text-left">SKU</th>
                  <th className="p-2 border text-left">Quantity</th>
                  <th className="p-2 border text-left">Notes</th>
                  <th className="p-2 border text-left">Status</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-2 border">{item.action || ""}</td>
                    <td className="p-2 border">{item.customer || ""}</td>
                    <td className="p-2 border">{item.po_number || ""}</td>
                    <td className="p-2 border">{item.sku || ""}</td>
                    <td className="p-2 border">{item.quantity ?? ""}</td>
                    <td className="p-2 border">{item.notes || ""}</td>
                    <td className="p-2 border">{item.status || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}