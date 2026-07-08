export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import GenerateOCButton from "@/components/orders/GenerateOCButton";

type ManualOrderItem = {
  id: string;
  customer: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  oc_status: string | null;
  oc_pdf_url: string | null;
  oc_document_id: string | null;
  unit_price: number | null;
  currency: string | null;
  custom_fields: Record<string, string> | null;
  delivery_date: string | null;
  external_message_id: string | null;
  created_at: string | null;
};

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
};

type PageProps = {
  searchParams?: {
    deleted?: string;
    restored?: string;
  };
};

type GroupedManualOrder = {
  key: string;
  customer: string;
  po_number: string;
  notes: string;
  status: string;
  oc_status: string;
  oc_pdf_url: string | null;
  oc_document_id: string | null;
  delivery_date: string | null;
  created_at: string | null;
  items: ManualOrderItem[];
};

function clean(value: any) {
  return String(value || "").trim();
}

function formatDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

  if (value === "done") return "bg-green-50 text-green-700 border-green-200";
  if (value === "approved") return "bg-blue-50 text-blue-700 border-blue-200";

  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function ocClass(status: string | null) {
  const value = clean(status).toLowerCase();

  if (value === "generated")
    return "bg-green-50 text-green-700 border-green-200";
  if (value === "reviewed") return "bg-blue-50 text-blue-700 border-blue-200";
  if (value === "draft") return "bg-yellow-50 text-yellow-700 border-yellow-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function getGroupStatus(items: ManualOrderItem[]) {
  const statuses = items.map((item) => clean(item.status) || "New");

  if (statuses.some((status) => status === "New")) return "New";
  if (statuses.some((status) => status === "Approved")) return "Approved";
  if (statuses.every((status) => status === "Done")) return "Done";

  return statuses[0] || "New";
}

function getGroupKey(item: ManualOrderItem) {
  return (
    clean(item.external_message_id) ||
    [clean(item.customer), clean(item.po_number), clean(item.created_at)].join(
      "::"
    )
  );
}

function getGroupItemIds(items: ManualOrderItem[]) {
  return items.map((item) => item.id).join(",");
}

function customFieldText(fields: Record<string, string> | null) {
  const entries = Object.entries(fields || {});

  if (entries.length === 0) return "";

  return entries.map(([key, value]) => `${key}: ${value}`).join(" | ");
}

export default async function ManualOrdersPage({ searchParams }: PageProps) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const deletedIds = clean(searchParams?.deleted);
  const restoredIds = clean(searchParams?.restored);

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, customer, po_number, sku, quantity, notes, status, oc_status, oc_pdf_url, oc_document_id, unit_price, currency, custom_fields, delivery_date, external_message_id, created_at"
    )
    .is("deleted_at", null)
    .eq("source_email", "Manual Entry")
    .order("created_at", { ascending: false });

  const { data: sellerRows } = await supabase
    .from("seller_profiles")
    .select("id, profile_name, company_name")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true });

  const sellers = ((sellerRows || []) as SellerProfile[]).map((seller) => ({
    id: seller.id,
    label: seller.profile_name || seller.company_name || "Unnamed Seller",
  }));

  const items = (data || []) as ManualOrderItem[];

  const groupedMap = new Map<string, ManualOrderItem[]>();

  for (const item of items) {
    const key = getGroupKey(item);

    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }

    groupedMap.get(key)!.push(item);
  }

  const groupedOrders: GroupedManualOrder[] = Array.from(groupedMap.entries())
    .map(([key, groupItems]) => {
      const first = groupItems[0];

      return {
        key,
        customer: first.customer || "",
        po_number: first.po_number || "",
        notes: first.notes || "",
        status: getGroupStatus(groupItems),
        oc_status:
          groupItems.find((item) => item.oc_status)?.oc_status ||
          "Not Generated",
        oc_pdf_url:
          groupItems.find((item) => item.oc_pdf_url)?.oc_pdf_url || null,
        oc_document_id:
          groupItems.find((item) => item.oc_document_id)?.oc_document_id ||
          null,
        delivery_date: first.delivery_date || null,
        created_at: first.created_at || null,
        items: groupItems,
      };
    })
    .sort((a, b) => {
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manual Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Orders entered manually from phone, WhatsApp, meetings or walk-ins.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/orders/new"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            + New Manual Order / OC
          </Link>

          <Link href="/orders" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Orders Dashboard
          </Link>

          <Link
            href="/order-confirmations"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Order Confirmations
          </Link>
        </div>
      </div>

      {deletedIds && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center justify-between">
          <div>Manual order deleted.</div>

          <form action="/api/orders/manual/undo-delete" method="POST">
            <input type="hidden" name="ids" value={deletedIds} />
            <button className="px-4 py-2 rounded-lg bg-white border border-red-200 hover:bg-red-100">
              Undo Delete
            </button>
          </form>
        </div>
      )}

      {restoredIds && (
        <div className="p-4 rounded-lg bg-green-50 text-green-700 border border-green-200">
          Deleted manual order restored.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      )}

      {sellers.length === 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          No active seller profile found. Create a seller profile before
          generating an OC.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{groupedOrders.length}</div>
          <div className="text-sm text-gray-500">Manual Orders</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{items.length}</div>
          <div className="text-sm text-gray-500">Manual Line Items</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">
            {
              groupedOrders.filter(
                (order) => clean(order.status).toLowerCase() === "new"
              ).length
            }
          </div>
          <div className="text-sm text-gray-500">New</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">
            {
              groupedOrders.filter((order) =>
                clean(order.oc_status).toLowerCase().includes("generated")
              ).length
            }
          </div>
          <div className="text-sm text-gray-500">OCs Generated</div>
        </div>
      </div>

      <form action="/api/orders/manual/delete" method="POST" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Select one or more manual orders for bulk delete.
          </div>

          <button className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
            Bulk Delete Selected
          </button>
        </div>

        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Select</th>
                <th className="p-3 border text-left">Created On</th>
                <th className="p-3 border text-left">Customer</th>
                <th className="p-3 border text-left">PO Number</th>
                <th className="p-3 border text-left">Delivery Date</th>
                <th className="p-3 border text-left">SKU</th>
                <th className="p-3 border text-left">Qty</th>
                <th className="p-3 border text-left">Price</th>
                <th className="p-3 border text-left">Optional Fields</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">OC</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {groupedOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-gray-500">
                    No manual orders found.
                  </td>
                </tr>
              ) : (
                groupedOrders.map((order) => {
                  const firstItem = order.items[0];
                  const groupIds = getGroupItemIds(order.items);

                  return (
                    <tr key={order.key} className="hover:bg-gray-50">
                      <td className="p-3 border">
                        <input
                          type="checkbox"
                          name="ids"
                          value={groupIds}
                          className="h-4 w-4"
                        />
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {formatDateTime(order.created_at)}
                      </td>

                      <td className="p-3 border font-medium">
                        {order.customer}
                      </td>

                      <td className="p-3 border">{order.po_number}</td>

                      <td className="p-3 border whitespace-nowrap">
                        {formatDate(order.delivery_date)}
                      </td>

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

                      <td className="p-3 border">
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id}>
                              {item.unit_price ?? ""}
                              {item.unit_price ? ` ${item.currency || ""}` : ""}
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 border max-w-md">
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="text-xs">
                              {customFieldText(item.custom_fields)}
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 border">
                        <span
                          className={`px-3 py-1 rounded-full border text-xs ${statusClass(
                            order.status
                          )}`}
                        >
                          {order.status || "New"}
                        </span>
                      </td>

                      <td className="p-3 border">
                        <span
                          className={`px-3 py-1 rounded-full border text-xs ${ocClass(
                            order.oc_status
                          )}`}
                        >
                          {order.oc_status || "Not Generated"}
                        </span>
                      </td>

                      <td className="p-3 border">
                        <div className="flex gap-2 flex-wrap">
                          <GenerateOCButton
                            ids={groupIds}
                            sellers={sellers}
                            buttonClassName="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                          />

                          <Link
                            href={`/orders/${firstItem.id}/oc`}
                            className="px-4 py-2 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100"
                          >
                            Review/Edit
                          </Link>

                          {order.oc_pdf_url ? (
                            <a
                              href={order.oc_pdf_url}
                              target="_blank"
                              className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                            >
                              View OC
                            </a>
                          ) : (
                            <span className="px-4 py-2 rounded-lg bg-gray-50 text-gray-400 border">
                              View OC
                            </span>
                          )}

                          <button
                            formAction="/api/orders/manual/delete"
                            formMethod="POST"
                            name="ids"
                            value={groupIds}
                            className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}