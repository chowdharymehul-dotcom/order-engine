export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";
import BulkSelectionControls from "@/components/BulkSelectionControls";

type Email = {
  id: string;
  from_email: string | null;
  subject: string | null;
  received_at: string | null;
  processing_status: string | null;
direction: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
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

export default async function EmailsPage() {
  const bulkFormId = "emails-bulk-form";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

 const { data, error } = await supabase
  .from("emails")
  .select(
    "id, from_email, subject, received_at, processing_status, direction, external_message_id, gmail_message_id"
  )
  .is("deleted_at", null)
  .eq("direction", "INBOUND")
  .neq("processing_status", "ignored")
  .order("received_at", { ascending: false });

  const emails = (data || []) as Email[];

  return (
    <div className="p-10 space-y-8">
      <AutoRefresh interval={10000} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Emails</h1>

        <div className="flex gap-3">
          <Link
            href="/orders"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Orders
          </Link>

          <Link
            href="/enquiries-follow-up"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Enquiries
          </Link>

          <Link
            href="/cancellations"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancellations
          </Link>
        </div>
      </div>

      <BulkSelectionControls
        formId={bulkFormId}
        label="Select All Emails"
        showDelete={true}
        showMove={false}
      />

      <form id={bulkFormId} action="/api/bulk/action" method="POST">
        <input type="hidden" name="type" value="emails" />
        <input type="hidden" name="redirect_to" value="/emails" />

        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Select</th>
                <th className="p-3 border text-left">Received On</th>
                <th className="p-3 border text-left">From</th>
                <th className="p-3 border text-left">Subject</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No emails found
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50">
                    <td className="p-3 border">
                      <input
                        type="checkbox"
                        name="ids"
                        value={email.id}
                        data-bulk-form={bulkFormId}
                      />
                    </td>

                    <td className="p-3 border whitespace-nowrap">
                      {formatDateTime(email.received_at)}
                    </td>

                    <td className="p-3 border">
                      {email.from_email || ""}
                    </td>

                    <td className="p-3 border">
                      {email.subject || ""}
                    </td>

                    <td className="p-3 border">
                      {email.processing_status || ""}
                    </td>

                    <td className="p-3 border">
                      <div className="flex gap-2">
                        <Link
                          href={`/emails/${email.id}`}
                          className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                        >
                          Open
                        </Link>

                        <button
                          type="submit"
                          form={`delete-${email.id}`}
                          className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </form>

      {emails.map((email) => (
        <form
          key={`delete-${email.id}`}
          id={`delete-${email.id}`}
          action="/api/bulk/action"
          method="POST"
        >
          <input type="hidden" name="type" value="emails" />
          <input type="hidden" name="operation" value="delete" />
          <input type="hidden" name="redirect_to" value="/emails" />
          <input type="hidden" name="ids" value={email.id} />
        </form>
      ))}
    </div>
  );
}