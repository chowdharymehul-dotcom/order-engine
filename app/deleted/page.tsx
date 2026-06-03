export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import BulkSelectionControls from "@/components/BulkSelectionControls";

type DeletedEmail = {
  id: string;
  from_email: string | null;
  subject: string | null;
  received_at: string | null;
  deleted_at: string | null;
  deleted_from: string | null;
  deleted_reason: string | null;
};

type DeletedOrderItem = {
  id: string;
  action: string | null;
  customer: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  email_subject: string | null;
  deleted_at: string | null;
  deleted_from: string | null;
  deleted_reason: string | null;
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

export default async function DeletedItemsPage() {
  const emailBulkFormId = "deleted-emails-bulk-form";
  const itemsBulkFormId = "deleted-items-bulk-form";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: deletedEmails, error: emailsError } = await supabase
    .from("emails")
    .select(
      "id, from_email, subject, received_at, deleted_at, deleted_from, deleted_reason"
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const { data: deletedItems, error: itemsError } = await supabase
    .from("order_items")
    .select(
      "id, action, customer, po_number, sku, quantity, notes, status, email_subject, deleted_at, deleted_from, deleted_reason"
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const emails = (deletedEmails || []) as DeletedEmail[];
  const items = (deletedItems || []) as DeletedOrderItem[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Deleted Items</h1>

        <div className="flex gap-3">
          <Link href="/emails" className="px-4 py-2 border rounded-lg">
            Emails
          </Link>

          <Link href="/orders" className="px-4 py-2 border rounded-lg">
            Orders
          </Link>

          <Link
            href="/enquiries-follow-up"
            className="px-4 py-2 border rounded-lg"
          >
            Enquiries
          </Link>

          <Link
            href="/cancellations"
            className="px-4 py-2 border rounded-lg"
          >
            Cancellations
          </Link>
        </div>
      </div>

      {(emailsError || itemsError) && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {emailsError?.message || itemsError?.message}
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Deleted Emails</h2>

        <BulkSelectionControls
          formId={emailBulkFormId}
          label="Select All Deleted Emails"
          showDelete={false}
          showMove={false}
          showRestore={true}
          showPermanentDelete={true}
        />

        <form id={emailBulkFormId} action="/api/bulk/action" method="POST">
          <input type="hidden" name="type" value="emails" />
          <input type="hidden" name="redirect_to" value="/deleted" />

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border text-left">Select</th>
                  <th className="p-3 border text-left">Deleted On</th>
                  <th className="p-3 border text-left">Received On</th>
                  <th className="p-3 border text-left">From</th>
                  <th className="p-3 border text-left">Subject</th>
                  <th className="p-3 border text-left">Deleted From</th>
                  <th className="p-3 border text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      No deleted emails
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
                          data-bulk-form={emailBulkFormId}
                        />
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {formatDateTime(email.deleted_at)}
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {formatDateTime(email.received_at)}
                      </td>

                      <td className="p-3 border">{email.from_email || ""}</td>

                      <td className="p-3 border">{email.subject || ""}</td>

                      <td className="p-3 border">
                        {email.deleted_from || "emails"}
                      </td>

                      <td className="p-3 border">
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            form={`restore-email-${email.id}`}
                            className="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            Restore
                          </button>

                          <button
                            type="submit"
                            form={`permanent-delete-email-${email.id}`}
                            className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Delete Permanently
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
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">
          Deleted Orders / Enquiries / Cancellations
        </h2>

        <BulkSelectionControls
          formId={itemsBulkFormId}
          label="Select All Deleted Business Items"
          showDelete={false}
          showMove={false}
          showRestore={true}
          showPermanentDelete={true}
        />

        <form id={itemsBulkFormId} action="/api/bulk/action" method="POST">
          <input type="hidden" name="type" value="order_items" />
          <input type="hidden" name="redirect_to" value="/deleted" />

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border text-left">Select</th>
                  <th className="p-3 border text-left">Deleted On</th>
                  <th className="p-3 border text-left">Deleted From</th>
                  <th className="p-3 border text-left">Action</th>
                  <th className="p-3 border text-left">Customer</th>
                  <th className="p-3 border text-left">PO Number</th>
                  <th className="p-3 border text-left">SKU</th>
                  <th className="p-3 border text-left">Qty</th>
                  <th className="p-3 border text-left">Subject / Notes</th>
                  <th className="p-3 border text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-gray-500">
                      No deleted business items
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3 border">
                        <input
                          type="checkbox"
                          name="ids"
                          value={item.id}
                          data-bulk-form={itemsBulkFormId}
                        />
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {formatDateTime(item.deleted_at)}
                      </td>

                      <td className="p-3 border">{item.deleted_from || ""}</td>

                      <td className="p-3 border">{item.action || ""}</td>

                      <td className="p-3 border">{item.customer || ""}</td>

                      <td className="p-3 border">{item.po_number || ""}</td>

                      <td className="p-3 border">{item.sku || ""}</td>

                      <td className="p-3 border">{item.quantity ?? ""}</td>

                      <td className="p-3 border">
                        {item.email_subject || item.notes || ""}
                      </td>

                      <td className="p-3 border">
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            form={`restore-item-${item.id}`}
                            className="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            Restore
                          </button>

                          <button
                            type="submit"
                            form={`permanent-delete-item-${item.id}`}
                            className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Delete Permanently
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
      </div>

      {emails.map((email) => (
        <div key={`email-forms-${email.id}`}>
          <form
            id={`restore-email-${email.id}`}
            action="/api/deleted/restore"
            method="POST"
          >
            <input type="hidden" name="type" value="email" />
            <input type="hidden" name="id" value={email.id} />
          </form>

          <form
            id={`permanent-delete-email-${email.id}`}
            action="/api/deleted/permanent-delete"
            method="POST"
          >
            <input type="hidden" name="type" value="email" />
            <input type="hidden" name="id" value={email.id} />
          </form>
        </div>
      ))}

      {items.map((item) => (
        <div key={`item-forms-${item.id}`}>
          <form
            id={`restore-item-${item.id}`}
            action="/api/deleted/restore"
            method="POST"
          >
            <input type="hidden" name="type" value="order_item" />
            <input type="hidden" name="id" value={item.id} />
          </form>

          <form
            id={`permanent-delete-item-${item.id}`}
            action="/api/deleted/permanent-delete"
            method="POST"
          >
            <input type="hidden" name="type" value="order_item" />
            <input type="hidden" name="id" value={item.id} />
          </form>
        </div>
      ))}
    </div>
  );
}