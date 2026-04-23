export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";

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
  external_message_id: string | null;
  gmail_message_id: string | null;
};

type EmailLookup = {
  id: string;
  external_message_id: string | null;
  gmail_message_id: string | null;
  received_at: string | null;
};

type OrderRow = OrderItem & {
  source_email_id?: string;
  source_received_at?: string | null;
};

type OrdersPageProps = {
  searchParams?: Promise<{
    action?: string;
    status?: string;
  }>;
};

type ActionFilter = {
  label: string;
  value: string;
};

type StatusFilter = {
  label: string;
  value: string;
};

function buildOrdersHref(action: string, status: string) {
  const params = new URLSearchParams();

  if (action !== "All") {
    params.set("action", action);
  }

  if (status !== "All") {
    params.set("status", status);
  }

  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

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
      "id, action, customer, po_number, sku, quantity, notes, status, email_subject, external_message_id, gmail_message_id"
    );

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

  const externalIds = Array.from(
    new Set(
      orders
        .map((order) => order.external_message_id)
        .filter((id): id is string => !!id)
    )
  );

  const legacyIds = Array.from(
    new Set(
      orders
        .map((order) => order.gmail_message_id)
        .filter((id): id is string => !!id)
    )
  );

  let emailMap = new Map<string, EmailLookup>();

  if (externalIds.length > 0) {
    const { data: emailRows } = await supabaseAdmin
      .from("emails")
      .select("id, external_message_id, gmail_message_id, received_at")
      .in("external_message_id", externalIds);

    const emails = (emailRows ?? []) as EmailLookup[];

    for (const email of emails) {
      if (email.external_message_id) {
        emailMap.set(email.external_message_id, email);
      }
    }
  }

  if (legacyIds.length > 0) {
    const { data: legacyEmailRows } = await supabaseAdmin
      .from("emails")
      .select("id, external_message_id, gmail_message_id, received_at")
      .in("gmail_message_id", legacyIds);

    const legacyEmails = (legacyEmailRows ?? []) as EmailLookup[];

    for (const email of legacyEmails) {
      if (email.gmail_message_id && !emailMap.has(email.gmail_message_id)) {
        emailMap.set(email.gmail_message_id, email);
      }
    }
  }

  const enrichedOrders: OrderRow[] = orders.map((order) => {
    const emailKey = order.external_message_id || order.gmail_message_id || "";
    const linkedEmail = emailKey ? emailMap.get(emailKey) : undefined;

    return {
      ...order,
      source_email_id: linkedEmail?.id,
      source_received_at: linkedEmail?.received_at || null,
    };
  });

  enrichedOrders.sort((a, b) => {
    const aTime = a.source_received_at
      ? new Date(a.source_received_at).getTime()
      : 0;
    const bTime = b.source_received_at
      ? new Date(b.source_received_at).getTime()
      : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return Number(b.id) - Number(a.id);
  });

  const actionFilters: ActionFilter[] = [
    { label: "All", value: "All" },
    { label: "New Order", value: "Place Order" },
    { label: "Enquiry", value: "Reply to Enquiry" },
    { label: "Follow Up", value: "Follow Up" },
    { label: "Cancel", value: "Cancel Order" },
  ];

  const statusFilters: StatusFilter[] = [
    { label: "All", value: "All" },
    { label: "New", value: "New" },
    { label: "Approved", value: "Approved" },
    { label: "Done", value: "Done" },
  ];

  return (
    <div className="p-10 space-y-8">
      <AutoRefresh interval={10000} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders Dashboard</h1>
        <div className="flex gap-3">
          <Link
            href="/emails"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Emails
          </Link>
          <Link
            href="/needs-ocr"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Needs OCR
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <div>
          <div className="text-sm font-semibold mb-3">Filter by Action</div>
          <div className="flex flex-wrap gap-3">
            {actionFilters.map((action) => {
              const isActive = selectedAction === action.value;

              return (
                <Link
                  key={action.value}
                  href={buildOrdersHref(action.value, selectedStatus)}
                  className={`px-5 py-3 rounded-lg border text-sm font-medium transition ${
                    isActive
                      ? "bg-gray-100 border-gray-400 text-black"
                      : "bg-white text-black hover:bg-gray-50"
                  }`}
                >
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-3">Filter by Status</div>
          <div className="flex flex-wrap gap-3">
            {statusFilters.map((status) => {
              const isActive = selectedStatus === status.value;

              return (
                <Link
                  key={status.value}
                  href={buildOrdersHref(selectedAction, status.value)}
                  className={`px-5 py-3 rounded-lg border text-sm font-medium transition ${
                    isActive
                      ? "bg-gray-100 border-gray-400 text-black"
                      : "bg-white text-black hover:bg-gray-50"
                  }`}
                >
                  {status.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border rounded-xl">
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
              <th className="p-3 border text-left">Original Mail</th>
              <th className="p-3 border text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {enrichedOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No order items found.
                </td>
              </tr>
            ) : (
              enrichedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 align-top">
                  <td className="p-3 border">{order.action || ""}</td>
                  <td className="p-3 border">{order.customer || ""}</td>
                  <td className="p-3 border">{order.po_number || ""}</td>
                  <td className="p-3 border font-medium">{order.sku || ""}</td>
                  <td className="p-3 border">{order.quantity ?? ""}</td>
                  <td className="p-3 border">{order.notes || ""}</td>
                  <td className="p-3 border">{order.status || ""}</td>
                  <td className="p-3 border">
                    {order.source_email_id ? (
                      <Link
                        href={`/emails/${order.source_email_id}`}
                        className="text-blue-600 underline"
                      >
                        {order.email_subject || "View Email"}
                      </Link>
                    ) : (
                      order.email_subject || ""
                    )}
                  </td>
                  <td className="p-3 border">
                    <div className="flex flex-col gap-2">
                      <form action="/api/orders/approve" method="POST">
                        <input type="hidden" name="order_id" value={order.id} />
                        <button className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                          Approve
                        </button>
                      </form>

                      <form action="/api/orders/done" method="POST">
                        <input type="hidden" name="order_id" value={order.id} />
                        <button className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
                          Mark Done
                        </button>
                      </form>

                      <Link
                        href={`/orders/${order.id}/edit`}
                        className="w-full px-3 py-2 bg-gray-200 text-black rounded-lg text-sm text-center hover:bg-gray-300 transition"
                      >
                        Edit
                      </Link>
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