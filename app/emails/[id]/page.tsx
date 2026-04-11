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
  subject: string | null;
  from_email: string | null;
  body_text: string | null;
  attachment_text: string | null;
  processing_status: string | null;
  received_at: string | null;
  gmail_message_id: string | null;
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

  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("id, action, customer, po_number, sku, quantity, notes, status")
    .eq("gmail_message_id", typedEmail.gmail_message_id || "");

  const items = (orderItems ?? []) as OrderItem[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Email Detail</h1>
        <div className="flex gap-3">
          <Link href="/emails" className="px-4 py-2 border rounded">
            Back to Emails
          </Link>
          <Link href="/needs-ocr" className="px-4 py-2 border rounded">
            Needs OCR
          </Link>
        </div>
      </div>

      <div className="border rounded bg-white p-6 space-y-3">
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
          <strong>Status:</strong> {typedEmail.processing_status || ""}
        </div>
        <div>
          <strong>Gmail Message ID:</strong> {typedEmail.gmail_message_id || ""}
        </div>
      </div>

      <div className="border rounded bg-white p-6">
        <h2 className="text-xl font-semibold mb-3">Email Body</h2>
        <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm">
          {typedEmail.body_text || "(No body text)"}
        </div>
      </div>

      <div className="border rounded bg-white p-6">
        <h2 className="text-xl font-semibold mb-3">Attachment Text</h2>
        <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm">
          {typedEmail.attachment_text || "(No readable attachment text extracted)"}
        </div>
      </div>

      <div className="border rounded bg-white p-6">
        <h2 className="text-xl font-semibold mb-4">Related Order Items</h2>

        {items.length === 0 ? (
          <p className="text-sm text-gray-600">No order items found for this email.</p>
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