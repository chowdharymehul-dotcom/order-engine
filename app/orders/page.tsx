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

function tabClass(active: boolean) {
  return `px-5 py-3 rounded-lg border text-sm font-medium transition ${
    active
      ? "bg-gray-100 border-gray-400 text-black"
      : "bg-white text-black hover:bg-gray-50"
  }`;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    action?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;

  const activeAction = params?.action || "all";
  const activeStatus = params?.status || "all";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .eq("action", "Place Order");

  const items = (data || []) as OrderItem[];

  const emailMap = new Map<string, EmailRow>();

  const { data: emailRows } = await supabase
    .from("emails")
    .select("external_message_id, gmail_message_id, received_at");

  (emailRows || []).forEach((email: any) => {
    const key = email.external_message_id || email.gmail_message_id;
    if (key) emailMap.set(key, email);
  });

  const groupedMap = new Map<string, OrderItem[]>();

  for (const item of items) {
    const key =
      item.external_message_id ||
      item.gmail_message_id ||
      item.email_subject ||
      item.id;

    if (!groupedMap.has(key)) groupedMap.set(key, []);

    groupedMap.get(key)!.push(item);
  }

  const groupedOrders: GroupedOrder[] = Array.from(
    groupedMap.entries()
  ).map(([key, groupItems]) => {
    const first = groupItems[0];

    const email =
      emailMap.get(first.external_message_id || "") ||
      emailMap.get(first.gmail_message_id || "");

    return {
      key,
      received_at: email?.received_at || null,
      action: "New Order",
      customer: first.customer || "",
      po_number: first.po_number || "",
      notes:
        groupItems
          .map((i) => i.notes)
          .filter(Boolean)
          .join(" | ") || "",
      status: first.status || "New",
      original_mail: first.email_subject || "",
      items: groupItems,
    };
  });

  const filtered = groupedOrders.filter((order) => {
    if (
      activeStatus !== "all" &&
      order.status.toLowerCase() !== activeStatus.toLowerCase()
    ) {
      return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    const t1 = a.received_at ? new Date(a.received_at).getTime() : 0;
    const t2 = b.received_at ? new Date(b.received_at).getTime() : 0;

    return t2 - t1;
  });

  return (
    <div className="p-10 space-y-8">
      <AutoRefresh interval={10000} />

      <h1 className="text-3xl font-bold">Orders Dashboard</h1>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="font-semibold mb-3">Filter by Action</h2>

          <div className="flex gap-3">
            <Link
              href="/orders"
              className={tabClass(activeAction === "all")}
            >
              All
            </Link>

            <Link
              href="/orders?action=new_order"
              className={tabClass(activeAction === "new_order")}
            >
              New Order
            </Link>
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Filter by Status</h2>

          <div className="flex gap-3">
            <Link
              href="/orders"
              className={tabClass(activeStatus === "all")}
            >
              All
            </Link>

            <Link
              href="/orders?status=new"
              className={tabClass(activeStatus === "new")}
            >
              New
            </Link>

            <Link
              href="/orders?status=approved"
              className={tabClass(activeStatus === "approved")}
            >
              Approved
            </Link>

            <Link
              href="/orders?status=done"
              className={tabClass(activeStatus === "done")}
            >
              Done
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-sm">
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
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((order) => (
              <tr key={order.key}>
                <td className="p-3 border whitespace-nowrap">
                  {order.received_at
                    ? new Date(order.received_at).toLocaleString()
                    : ""}
                </td>

                <td className="p-3 border">{order.action}</td>

                <td className="p-3 border">{order.customer}</td>

                <td className="p-3 border">{order.po_number}</td>

                <td className="p-3 border">
                  {order.items.map((item) => (
                    <div key={item.id}>{item.sku}</div>
                  ))}
                </td>

                <td className="p-3 border">
                  {order.items.map((item) => (
                    <div key={item.id}>{item.quantity}</div>
                  ))}
                </td>

                <td className="p-3 border">{order.notes}</td>

                <td className="p-3 border">{order.status}</td>

                <td className="p-3 border">{order.original_mail}</td>

                <td className="p-3 border">
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/emails/${order.items[0].id}`}
                      className="px-3 py-2 rounded bg-gray-200 text-center hover:bg-gray-300"
                    >
                      Original Email
                    </Link>

                    <form action="/api/entries/delete" method="POST">
                      <input
                        type="hidden"
                        name="entry_key"
                        value={order.key}
                      />

                      <input
                        type="hidden"
                        name="action"
                        value="Place Order"
                      />

                      <input
                        type="hidden"
                        name="redirect_to"
                        value="/orders"
                      />

                      <button className="px-3 py-2 rounded bg-red-100 text-red-700 hover:bg-red-200">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}