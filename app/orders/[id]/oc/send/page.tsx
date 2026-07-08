export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  params: Promise<{ id: string }>;
};

function clean(value: any) {
  return String(value || "").trim();
}

function defaultSubject(ocNumber: string) {
  return ocNumber ? `Order Confirmation ${ocNumber}` : "Order Confirmation";
}

function defaultMessage(params: {
  customerName: string;
  ocNumber: string;
  pdfUrl: string;
}) {
  return `Dear ${params.customerName || "Customer"},

Please find the order confirmation below for your review.

Order Confirmation: ${params.ocNumber || ""}


Kindly review and confirm.

Best regards`;
}

export default async function SendOCPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: ocData, error: ocError } = await supabase
    .from("order_confirmations")
    .select("*")
    .or(`order_item_id.eq.${id},order_item_ids.cs.{${id}}`)
    .maybeSingle();

  if (ocError || !ocData) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Send Final OC</h1>
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {ocError?.message || "Order confirmation not found"}
        </div>
        <Link href={`/orders/${id}/oc`} className="px-4 py-2 rounded-lg border">
          Back to OC
        </Link>
      </div>
    );
  }

  const oc = ocData as any;
  const pdfUrl = clean(oc.final_oc_pdf_url || oc.pdf_url);

  const { data: customerData } = oc.customer_id
    ? await supabase
        .from("company_profiles")
        .select("id, company_name, email, contact_person")
        .eq("id", oc.customer_id)
        .maybeSingle()
    : { data: null };

  const customer = customerData as any;

  const { data: connectionsData } = await supabase
    .from("inbox_connections")
    .select("id, provider, account_email, connection_status, created_at")
    .order("created_at", { ascending: false });

  const connections = (connectionsData || []) as any[];

  const customerName = clean(customer?.contact_person || customer?.company_name);
  const customerEmail = clean(customer?.email);
  const subject = defaultSubject(clean(oc.oc_number));
  const message = defaultMessage({
    customerName,
    ocNumber: clean(oc.oc_number),
    pdfUrl,
  });

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Send Final OC</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review the email before sending the final order confirmation.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/orders/${id}/oc/final-editor`}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            Back to Final Editor
          </Link>

          <Link
            href={`/orders/${id}/oc`}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            Back to Review/Edit OC
          </Link>
        </div>
      </div>

      {!pdfUrl && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          No final PDF found. Please generate the final PDF first.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        <form
          action="/api/orders/send-oc"
          method="POST"
          className="bg-white border rounded-xl p-6 space-y-5"
        >
          <input type="hidden" name="order_item_id" value={id} />
          <input type="hidden" name="oc_id" value={oc.id} />
          <input type="hidden" name="customer_id" value={clean(oc.customer_id)} />
          <input type="hidden" name="pdf_url" value={pdfUrl} />

          <div>
            <label className="block text-sm font-medium mb-1">
              Send From
            </label>
            <select
              name="connection_id"
              required
              className="w-full border rounded-lg px-4 py-3 bg-white"
            >
              <option value="">Select Email Account</option>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {clean(connection.account_email) || clean(connection.provider)}
                  {connection.connection_status
                    ? ` — ${connection.connection_status}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To</label>
            <input
              name="to"
              required
              defaultValue={customerEmail}
              placeholder="customer@example.com"
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input
              name="subject"
              required
              defaultValue={subject}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              name="message"
              required
              rows={12}
              defaultValue={message}
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={!pdfUrl}
            className="px-6 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Send Final OC
          </button>
        </form>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">OC Preview</h2>

          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <span className="font-medium">OC Number:</span>{" "}
              {clean(oc.oc_number)}
            </div>
            <div>
              <span className="font-medium">PO Number:</span>{" "}
              {clean(oc.po_number)}
            </div>
            <div>
              <span className="font-medium">Customer:</span>{" "}
              {clean(customer?.company_name)}
            </div>
          </div>

          {pdfUrl ? (
            <>
              <a
                href={pdfUrl}
                target="_blank"
                className="inline-block text-sm text-blue-700 hover:underline"
              >
                Open PDF
              </a>

              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1`}
                className="w-full h-[560px] border rounded-lg bg-white"
              />
            </>
          ) : (
            <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
              No PDF available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}