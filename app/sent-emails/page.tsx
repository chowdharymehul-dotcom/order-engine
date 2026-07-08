export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type EmailLog = {
  id: string;
  customer_id: string | null;
  provider: string | null;
  sender_account: string | null;
  recipient_email: string | null;
  subject: string | null;
  message: string | null;
  send_type: string | null;
  status: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
};

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
  if (status === "sent") return "bg-green-50 text-green-700 border-green-200";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-200";
  if (status === "skipped")
    return "bg-yellow-50 text-yellow-700 border-yellow-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

export default async function SentEmailsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("customer_email_logs")
    .select(
      "id, customer_id, provider, sender_account, recipient_email, subject, message, send_type, status, error_message, sent_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const logs = (data || []) as EmailLog[];

  const sentCount = logs.filter((log) => log.status === "sent").length;
  const failedCount = logs.filter((log) => log.status === "failed").length;
  const skippedCount = logs.filter((log) => log.status === "skipped").length;

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sent Emails</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track individual and bulk customer emails sent from Order Engine.
          </p>
        </div>

        <Link href="/customers" className="px-4 py-2 border rounded-lg">
          Customers
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{logs.length}</div>
          <div className="text-sm text-gray-500">Total Logs</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{sentCount}</div>
          <div className="text-sm text-gray-500">Sent</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{failedCount}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{skippedCount}</div>
          <div className="text-sm text-gray-500">Skipped</div>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Date</th>
              <th className="p-3 border text-left">Recipient</th>
              <th className="p-3 border text-left">Subject</th>
              <th className="p-3 border text-left">Provider</th>
              <th className="p-3 border text-left">Sender</th>
              <th className="p-3 border text-left">Type</th>
              <th className="p-3 border text-left">Status</th>
              <th className="p-3 border text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No sent email logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-3 border whitespace-nowrap">
                    {formatDateTime(log.sent_at || log.created_at)}
                  </td>

                  <td className="p-3 border">{log.recipient_email || ""}</td>

                  <td className="p-3 border font-medium">
                    {log.subject || ""}
                  </td>

                  <td className="p-3 border uppercase">
                    {log.provider || ""}
                  </td>

                  <td className="p-3 border">{log.sender_account || ""}</td>

                  <td className="p-3 border capitalize">
                    {log.send_type || ""}
                  </td>

                  <td className="p-3 border">
                    <span
                      className={`px-3 py-1 rounded-full border text-xs capitalize ${statusClass(
                        log.status
                      )}`}
                    >
                      {log.status || "unknown"}
                    </span>
                  </td>

                  <td className="p-3 border">
                    <Link
                      href={`/sent-emails/${log.id}`}
                      className="px-4 py-2 rounded-lg bg-gray-100 border hover:bg-gray-200"
                    >
                      View
                    </Link>
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