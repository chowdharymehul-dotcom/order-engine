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
  source_email: string | null;
  email_subject: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
};

type EmailRow = {
  external_message_id: string | null;
  gmail_message_id: string | null;
  received_at: string | null;
};

type GroupedOrder = {
  key: string;
  received_at: string | null;
  action: string;
  customer: string;
  po_number: string;
  notes: string;
  status: string;
  original_mail: string;
  items: OrderItem[];
};

type OrdersPageProps = {
  searchParams?: Promise<{
    action?: string;
    status?: string;
  }>;
};

function tabClass(active: boolean) {
  return `px-5 py-3 rounded-lg border text-sm font-medium transition ${
    active
      ? "bg-gray-100 border-gray-400 text-black"
      : "bg-white text-black hover:bg-gray-50"
  }`;
}

function normalizeAction(action: string | null) {
  if (!action) return "";
  if (action === "Place Order") return "New Order";
  return action;
}

function getGroupStatus(items: OrderItem[]) {
  const statuses = items.map((item) => item.status || "New");

  if (statuses.some((status) => status === "New")) return "New";
  if (statuses.some((status) => status === "Approved")) return "Approved";
  if (statuses.every((status) => status === "Done")) return "Done";

  return statuses[0] || "New";
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const activeAction = params?.action || "all";
  const activeStatus = params?.status || "all";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, action, customer, po_number, sku, quantity, notes, status, source_email, email_subject, external_message_id, gmail_message_id"
    )
    .eq("action", "Place Order")
    .order("id", { ascending: false });

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Orders Dashboard</h1>
        <p className="text-red-600">Error loading orders: {error.message}</p>
      </div>
    );
  }

  const items = (data ?? []) as OrderItem[];

  const externalIds = Array.from(
    new Set(
      items
        .map((item) => item.external_message_id)
        .filter((id): id is string => !!id)
    )
  );

  const gmailIds = Array.from(
    new Set(
      items
        .map((item) => item.gmail_message_id)
        .filter((id): id is string => !!id)
    )
  );

  const emailMap = new Map<string, EmailRow>();

  if (externalIds.length > 0) {
    const { data: emailRows } = await supabase
      .from("emails")
      .select("external_message_id, gmail_message_id, received_at")
      .in("external_message_id", externalIds);

    for (const email of (emailRows ?? []) as EmailRow[]) {
      if (email.external_message_id) {
        emailMap.set(email.external_message_id, email);
      }
    }
  }

  if (gmailIds.length > 0) {
    const { data: gmailEmailRows } = await supabase
      .from("emails")
      .select("external_message_id, gmail_message_id, received_at")
      .in("gmail_message_id", gmailIds);

    for (const email of (gmailEmailRows ?? []) as EmailRow[]) {
      if (email.gmail_message_id) {
        emailMap.set(email.gmail_message_id, email);
      }
    }
  }

  const groupedMap = new Map<string, OrderItem[]>();

  for (const item of items) {
    const key =
      item.external_message_id ||
      item.gmail_message_id ||
      item.email_subject ||
      item.id;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }

    groupedMap.get(key)!.push(item);
  }

  const groupedOrders: GroupedOrder[] = Array.from(groupedMap.entries()).map(
    ([key, groupItems]) => {
      const first = groupItems[0];
      const email =
        emailMap.get(first.external_message_id || "") ||
        emailMap.get(first.gmail_message_id || "");

      return {
        key,
        received_at: email?.received_at || null,
        action: normalizeAction(first.action),
        customer: first.customer || "",
        po_number: first.po_number || "",
        notes: groupItems
          .map((item) => item.notes)
          .filter(Boolean)
          .join(" | "),
        status: getGroupStatus(groupItems),
        original_mail: first.email_subject || first.source_email || "",
        items: groupItems,
      };
    }
  );

  const filteredOrders = groupedOrders.filter((order) => {
    if (activeAction !== "all") {
      if (activeAction === "new_order" && order.action !== "New Order") {
        return false;
      }
    }

    if (activeStatus !== "all") {
      if (order.status.toLowerCase() !== activeStatus.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aTime = a.received_at ? new Date(a.received_at).getTime() : 0;
    const bTime = b.received_at ? new Date(b.received_at).getTime() : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return String(b.key).localeCompare(String(a.key));
  });

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
            href="/enquiries-follow-up"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Enquiries
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="font-semibold mb-3">Filter by Action</h2>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/orders?status=${activeStatus}`}
              className={tabClass(activeAction === "all")}
            >
              All
            </Link>

            <Link
              href={`/orders?action=new_order&status=${activeStatus}`}
              className={tabClass(activeAction === "new_order")}
            >
              New Order
            </Link>
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Filter by Status</h2>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/orders?action=${activeAction}`}
              className={tabClass(activeStatus === "all")}
            >
              All
            </Link>

            <Link
              href={`/orders?action=${activeAction}&status=new`}
              className={tabClass(activeStatus === "new")}
            >
              New
            </Link>

            <Link
              href={`/orders?action=${activeAction}&status=approved`}
              className={tabClass(activeStatus === "approved")}
            >
              Approved
            </Link>

            <Link
              href={`/orders?action=${activeAction}&status=done`}
              className={tabClass(activeStatus === "done")}
            >
              Done
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Received On</th>
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
            {sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-500">
                  No orders found
                </td>
              </tr>
            ) : (
              sortedOrders.map((order) => (
                <tr key={order.key} className="hover:bg-gray-50">
                  <td className="p-3 border whitespace-nowrap">
                    {order.received_at
                      ? new Date(order.received_at).toLocaleString()
                      : ""}
                  </td>

                  <td className="p-3 border">{order.action}</td>

                  <td className="p-3 border">{order.customer}</td>

                  <td className="p-3 border">{order.po_number}</td>

                  <td className="p-3 border">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id}>{item.sku || ""}</div>
                      ))}
                    </div>
                  </td>

                  <td className="p-3 border">
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id}>{item.quantity ?? ""}</div>
                      ))}
                    </div>
                  </td>

                  <td className="p-3 border">{order.notes}</td>

                  <td className="p-3 border">{order.status}</td>

                  <td className="p-3 border">{order.original_mail}</td>

                  <td className="p-3 border">
                    <div className="flex flex-col gap-2">
                      <form action="/api/orders/approve" method="POST">
                        <input
                          type="hidden"
                          name="external_message_id"
                          value={order.key}
                        />
                        <button className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                          Approve
                        </button>
                      </form>

                      <form action="/api/orders/mark-done" method="POST">
                        <input
                          type="hidden"
                          name="external_message_id"
                          value={order.key}
                        />
                        <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                          Mark Done
                        </button>
                      </form>

                      <Link
                        href={`/orders/${order.items[0].id}/edit`}
                        className="px-4 py-2 rounded-lg bg-gray-200 text-center hover:bg-gray-300"
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