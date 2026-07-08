export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type OrderConfirmation = {
  id: string;
  order_item_id: string | null;
  order_item_ids: string[] | null;
  oc_number: string | null;
  po_number: string | null;
  final_oc_pdf_url: string | null;
  status: string | null;
  sent_at: string | null;
  recipient_email: string | null;
};

type EmailLog = {
  id: string;
  provider: string | null;
  sender_account: string | null;
  recipient_email: string | null;
  subject: string | null;
  message: string | null;
  send_type: string | null;
  status: string | null;
  error_message: string | null;
  pdf_url: string | null;
  attachment_name: string | null;
  sent_at: string | null;
  created_at: string | null;
};

function clean(value: any) {
  return String(value || "").trim();
}

function formatDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

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
  const value = clean(status).toLowerCase();

  if (value === "sent") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (value === "failed") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function primaryOrderItemId(oc: OrderConfirmation | null) {
  if (!oc) return "";

  if (oc.order_item_id) return oc.order_item_id;

  if (Array.isArray(oc.order_item_ids) && oc.order_item_ids.length > 0) {
    return oc.order_item_ids[0];
  }

  return "";
}

export default async function OCEmailHistoryPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: ocData, error: ocError } = await supabase
    .from("order_confirmations")
    .select(
      "id, order_item_id, order_item_ids, oc_number, po_number, final_oc_pdf_url, status, sent_at, recipient_email"
    )
    .eq("id", id)
    .maybeSingle();

  const oc = (ocData || null) as OrderConfirmation | null;
  const orderItemId = primaryOrderItemId(oc);

  const { data: logsData, error: logsError } = await supabase
    .from("customer_email_logs")
    .select(
      "id, provider, sender_account, recipient_email, subject, message, send_type, status, error_message, pdf_url, attachment_name, sent_at, created_at"
    )
    .eq("order_confirmation_id", id)
    .order("created_at", { ascending: false });

  const logs = (logsData || []) as EmailLog[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OC Email History</h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete send and resend history for this final order confirmation.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/order-confirmations"
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            Back to Final OCs
          </Link>

          {orderItemId && (
            <Link
              href={`/orders/${orderItemId}/oc/send`}
              className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            >
              Send / Resend
            </Link>
          )}
        </div>
      </div>

      {ocError && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {ocError.message}
        </div>
      )}

      {logsError && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {logsError.message}
        </div>
      )}

      {oc && (
        <div className="bg-white border rounded-xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">OC Number</div>
            <div className="font-semibold">{oc.oc_number || "OC"}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">PO Number</div>
            <div className="font-semibold">{oc.po_number || ""}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Current Status</div>
            <div className="font-semibold">{oc.status || ""}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Last Sent</div>
            <div className="font-semibold">{formatDateTime(oc.sent_at)}</div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Date</th>
              <th className="p-3 border text-left">Status</th>
              <th className="p-3 border text-left">From</th>
              <th className="p-3 border text-left">To</th>
              <th className="p-3 border text-left">Provider</th>
              <th className="p-3 border text-left">Subject</th>
              <th className="p-3 border text-left">Attachment</th>
              <th className="p-3 border text-left">Message</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No email history found for this OC.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 align-top">
                  <td className="p-3 border whitespace-nowrap">
                    {formatDateTime(log.sent_at || log.created_at)}
                  </td>

                  <td className="p-3 border">
                    <span
                      className={`px-3 py-1 rounded-full border text-xs capitalize ${statusClass(
                        log.status
                      )}`}
                    >
                      {log.status || "unknown"}
                    </span>

                    {log.error_message && (
                      <div className="text-xs text-red-600 mt-2">
                        {log.error_message}
                      </div>
                    )}
                  </td>

                  <td className="p-3 border">{log.sender_account || ""}</td>

                  <td className="p-3 border">{log.recipient_email || ""}</td>

                  <td className="p-3 border capitalize">
                    {log.provider || ""}
                  </td>

                  <td className="p-3 border">{log.subject || ""}</td>

                  <td className="p-3 border">
                    {log.pdf_url ? (
                      <a
                        href={log.pdf_url}
                        target="_blank"
                        className="text-blue-700 hover:underline"
                      >
                        {log.attachment_name || "View PDF"}
                      </a>
                    ) : (
                      ""
                    )}
                  </td>

                  <td className="p-3 border max-w-md">
                    <div className="whitespace-pre-wrap line-clamp-6">
                      {log.message || ""}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}