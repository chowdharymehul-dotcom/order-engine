export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type OrderItem = {
  id: string;
  action: string | null;
  customer: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  email_subject: string | null;
  gmail_message_id: string | null;
};

type EmailLookup = {
  id: string;
  gmail_message_id: string | null;
};

type OrdersPageProps = {
  searchParams?: Promise<{
    action?: string;
    status?: string;
  }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const selectedAction = params?.action || "All";
  const selectedStatus = params?.status || "All";

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabaseAdmin
    .from("order_items")
    .select(
      "id, action, customer, po_number, sku, quantity, notes, status, email_subject, gmail_message_id"
    )
    .order("id", { ascending: false });

  if (selectedAction !== "All") {
    query = query.eq("action", selectedAction);
  }

  if (selectedStatus !== "All") {
    query = query.eq("status", selectedStatus);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Orders Dashboard</h1>
        <p className="text-red-600">Error loading orders: {error.message}</p>
      </div>
    );
  }

  const orders = (data ?? []) as OrderItem[];

  const gmailIds = Array.from(
    new Set(
      orders
        .map((order) => order.gmail_message_id)
        .filter((id): id is string => !!id)
    )
  );

  let emailMap = new Map<string, string>();

  if (gmailIds.length > 0) {
    const { data: emailRows } = await supabaseAdmin
      .from("emails")
      .select("id, gmail_message_id")
      .in("gmail_message_id", gmailIds);

    const emails = (emailRows ?? []) as EmailLookup[];

    emailMap = new Map(
      emails
        .filter((email) => email.gmail_message_id)
        .map((email) => [email.gmail_message_id as string, email.id])
    );
  }

  const actions = [
    "All",
    "Place Order",
    "Reply to Enquiry",
    "Follow Up",
    "Cancel Order",
    "Confirm Delivery",
  ];

  const statuses = ["All", "New", "Approved", "Done"];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders Dashboard</h1>
        <div className="flex gap-3">
          <Link href="/emails" className="px-4 py-2 border rounded">
            Emails
          </Link>
          <Link href="/needs-ocr" className="px-4 py-2 border rounded">
            Needs OCR
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold mb-2">Filter by Action</div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action}
                href={
                  action === "All"
                    ? `/orders${
                        selectedStatus !== "All"
                          ? `?status=${encodeURIComponent(selectedStatus)}`
                          : ""
                      }`
                    : `/orders?action=${encodeURIComponent(action)}${
                        selectedStatus !== "All"
                          ? `&status=${encodeURIComponent(selectedStatus)}`
                          : ""
                      }`
                }
                className={`px-3 py-2 rounded border text-sm ${
                  selectedAction === action
                    ? "bg-black text-white"
                    : "bg-white text-black"
                }`}
              >
                {action}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Filter by Status</div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Link
                key={status}
                href={
                  status === "All"
                    ? `/orders${
                        selectedAction !== "All"
                          ? `?action=${encodeURIComponent(selectedAction)}`
                          : ""
                      }`
                    : `/orders?status=${encodeURIComponent(status)}${
                        selectedAction !== "All"
                          ? `&action=${encodeURIComponent(selectedAction)}`
                          : ""
                      }`
                }
                className={`px-3 py-2 rounded border text-sm ${
                  selectedStatus === status
                    ? "bg-black text-white"
                    : "bg-white text-black"
                }`}
              >
                {status}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border rounded">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Action</th>
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">PO Number</th>
              <th className="p-3 border text-left">SKU</th>
              <th className="p-3 border text-left">Quantity</th>
              <th className="p-3 border text-left">Notes</th>
              <th className="p-3 border text-left">Status</th>
              <th className="p-3 border text-left">Source</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No order items found.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const emailId = order.gmail_message_id
                  ? emailMap.get(order.gmail_message_id)
                  : undefined;

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="p-3 border">{order.action || ""}</td>
                    <td className="p-3 border">{order.customer || ""}</td>
                    <td className="p-3 border">{order.po_number || ""}</td>
                    <td className="p-3 border font-medium">{order.sku || ""}</td>
                    <td className="p-3 border">{order.quantity ?? ""}</td>
                    <td className="p-3 border">{order.notes || ""}</td>
                    <td className="p-3 border">{order.status || ""}</td>
                    <td className="p-3 border">
                      {emailId ? (
                        <Link
                          href={`/emails/${emailId}`}
                          className="text-blue-600 underline"
                        >
                          {order.email_subject || "View Email"}
                        </Link>
                      ) : (
                        order.email_subject || ""
                      )}
                    </td>
                    <td className="p-3 border">
                      <div className="flex gap-2 flex-wrap">
                        <form action="/api/orders/approve" method="POST">
                          <input type="hidden" name="order_id" value={order.id} />
                          <button className="px-3 py-1 bg-green-600 text-white rounded text-xs">
                            Approve
                          </button>
                        </form>

                        <form action="/api/orders/done" method="POST">
                          <input type="hidden" name="order_id" value={order.id} />
                          <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs">
                            Mark Done
                          </button>
                        </form>

                        <Link
                          href={`/orders/${order.id}/edit`}
                          className="px-3 py-1 bg-gray-800 text-white rounded text-xs"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}