export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";
import BulkSelectionControls from "@/components/BulkSelectionControls";
import GenerateOCButton from "@/components/orders/GenerateOCButton";

type OrderGroup = {
  id: string;
  parent_email_id: string | null;
  latest_email_id: string | null;
  last_activity_email_id: string | null;
  external_thread_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  po_number: string | null;
  group_key: string;
  subject: string | null;
  status: string | null;
  oc_status: string | null;
  oc_document_id: string | null;
  oc_pdf_url: string | null;
  last_activity_at: string | null;
  has_new_activity: boolean | null;
  new_activity_count: number | null;
  source: string | null;
  created_at: string | null;
};

type OrderItem = {
  id: string;
  order_group_id: string | null;
  action: string | null;
  customer: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  oc_pdf_url: string | null;
  oc_status: string | null;
  oc_document_id: string | null;
};

type EmailRow = {
  id: string;
  subject: string | null;
  received_at: string | null;
  from_email: string | null;
};

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
};

type OrdersPageProps = {
  searchParams?: Promise<{
    action?: string;
    status?: string;
    q?: string;
  }>;
};

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalise(value: string | null | undefined) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function formatDateTime(value: string | null) {
  if (!value) return "Missing date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

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

function tabClass(active: boolean) {
  return `px-5 py-3 rounded-lg border text-sm font-medium transition ${
    active
      ? "bg-gray-100 border-gray-400 text-black"
      : "bg-white text-black hover:bg-gray-50"
  }`;
}

function getItemIds(items: OrderItem[]) {
  return items.map((item) => item.id).join(",");
}

function getGroupStatus(group: OrderGroup, items: OrderItem[]) {
  const statuses = items.map((item) => item.status || "New");

  if (statuses.some((status) => status === "New")) return "New";
  if (statuses.some((status) => status === "Approved")) return "Approved";
  if (statuses.length > 0 && statuses.every((status) => status === "Done")) {
    return "Done";
  }

  return group.status || statuses[0] || "New";
}

function getOcStatus(group: OrderGroup, items: OrderItem[]) {
  return (
    group.oc_status ||
    items.find((item) => item.oc_status)?.oc_status ||
    "Not Generated"
  );
}

function getOcDocumentId(group: OrderGroup, items: OrderItem[]) {
  return (
    group.oc_document_id ||
    items.find((item) => item.oc_document_id)?.oc_document_id ||
    null
  );
}

function getOcPdfUrl(group: OrderGroup, items: OrderItem[]) {
  return (
    group.oc_pdf_url ||
    items.find((item) => item.oc_pdf_url)?.oc_pdf_url ||
    null
  );
}

function matchesSearch(params: {
  group: OrderGroup;
  items: OrderItem[];
  email: EmailRow | null;
  query: string;
}) {
  const { group, items, email, query } = params;

  if (!query) return true;

  const q = query.toLowerCase();

  const haystack = [
    group.id,
    group.customer_name || "",
    group.po_number || "",
    group.subject || "",
    group.status || "",
    group.oc_status || "",
    email?.subject || "",
    email?.from_email || "",
    ...items.map((item) => item.sku || ""),
    ...items.map((item) => String(item.quantity || "")),
    ...items.map((item) => item.notes || ""),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const activeAction = params?.action || "all";
  const activeStatus = params?.status || "all";
  const searchQuery = params?.q || "";
  const bulkFormId = "orders-bulk-form";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: groupsData, error: groupsError } = await supabase
    .from("order_groups")
    .select(
      "id, parent_email_id, latest_email_id, last_activity_email_id, external_thread_id, customer_id, customer_name, po_number, group_key, subject, status, oc_status, oc_document_id, oc_pdf_url, last_activity_at, has_new_activity, new_activity_count, source, created_at"
    )
    .order("last_activity_at", { ascending: false })
    .limit(500);

  if (groupsError) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Orders Dashboard</h1>
        <p className="text-red-600">
          Error loading order groups: {groupsError.message}
        </p>
      </div>
    );
  }

  const groups = (groupsData || []) as OrderGroup[];
  const groupIds = groups.map((group) => group.id);

  const { data: itemsData } =
    groupIds.length > 0
      ? await supabase
          .from("order_items")
          .select(
            "id, order_group_id, action, customer, po_number, sku, quantity, notes, status, oc_pdf_url, oc_status, oc_document_id"
          )
          .is("deleted_at", null)
          .in("order_group_id", groupIds)
          .ilike("action", "Place Order")
      : { data: [] };

  const items = (itemsData || []) as OrderItem[];

  const itemsByGroupId = new Map<string, OrderItem[]>();

  for (const item of items) {
    const groupId = clean(item.order_group_id);
    if (!groupId) continue;

    if (!itemsByGroupId.has(groupId)) {
      itemsByGroupId.set(groupId, []);
    }

    itemsByGroupId.get(groupId)!.push(item);
  }

  const emailIds = Array.from(
    new Set(
      groups
        .flatMap((group) => [
          group.last_activity_email_id,
          group.latest_email_id,
          group.parent_email_id,
        ])
        .filter((id): id is string => !!id)
    )
  );

  const { data: emailRows } =
    emailIds.length > 0
      ? await supabase
          .from("emails")
          .select("id, subject, received_at, from_email")
          .eq("direction", "INBOUND")
          .in("id", emailIds)
      : { data: [] };

  const emailById = new Map<string, EmailRow>();

  for (const email of (emailRows || []) as EmailRow[]) {
    emailById.set(email.id, email);
  }

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

  const hydratedGroups = groups
    .map((group) => {
      const groupItems = itemsByGroupId.get(group.id) || [];

      const activityEmail =
        emailById.get(clean(group.last_activity_email_id)) ||
        emailById.get(clean(group.latest_email_id)) ||
        emailById.get(clean(group.parent_email_id)) ||
        null;

      return {
        group,
        items: groupItems,
        email: activityEmail,
        status: getGroupStatus(group, groupItems),
        ocStatus: getOcStatus(group, groupItems),
        ocDocumentId: getOcDocumentId(group, groupItems),
        ocPdfUrl: getOcPdfUrl(group, groupItems),
      };
    })
    .filter((row) => row.items.length > 0);

  const filteredRows = hydratedGroups.filter((row) => {
    if (activeAction !== "all" && activeAction !== "new_order") return false;

    if (
      activeStatus !== "all" &&
      row.status.toLowerCase() !== activeStatus.toLowerCase()
    ) {
      return false;
    }

    return matchesSearch({
      group: row.group,
      items: row.items,
      email: row.email,
      query: searchQuery,
    });
  });

  return (
    <div className="p-10 space-y-8">
      <AutoRefresh interval={10000} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders Dashboard</h1>

        <div className="flex gap-3">
          <Link
            href="/orders/new"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            + New Manual Order / OC
          </Link>

          <Link
            href="/orders/manual"
            className="px-4 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
          >
            Manual Orders
          </Link>

          <Link
            href="/order-confirmations"
            className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
          >
            Order Confirmations
          </Link>

          <Link
            href="/oc-templates"
            className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          >
            OC Templates
          </Link>
        </div>
      </div>

      {sellers.length === 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          No active seller profile found. Create a seller profile before
          generating an OC.
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <form className="flex gap-3" action="/orders" method="GET">
          <input type="hidden" name="action" value={activeAction} />
          <input type="hidden" name="status" value={activeStatus} />

          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by SKU, customer, PO, subject..."
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />

          <button className="px-5 py-3 rounded-lg bg-gray-900 text-white text-sm">
            Search
          </button>

          <Link
            href="/orders?action=all&status=all"
            className="px-5 py-3 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            Clear
          </Link>
        </form>

        <div>
          <h2 className="font-semibold mb-3">Filter by Action</h2>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/orders?status=${activeStatus}&q=${encodeURIComponent(
                searchQuery
              )}`}
              className={tabClass(activeAction === "all")}
            >
              All
            </Link>

            <Link
              href={`/orders?action=new_order&status=${activeStatus}&q=${encodeURIComponent(
                searchQuery
              )}`}
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
              href={`/orders?action=${activeAction}&q=${encodeURIComponent(
                searchQuery
              )}`}
              className={tabClass(activeStatus === "all")}
            >
              All
            </Link>

            <Link
              href={`/orders?action=${activeAction}&status=new&q=${encodeURIComponent(
                searchQuery
              )}`}
              className={tabClass(activeStatus === "new")}
            >
              New
            </Link>

            <Link
              href={`/orders?action=${activeAction}&status=approved&q=${encodeURIComponent(
                searchQuery
              )}`}
              className={tabClass(activeStatus === "approved")}
            >
              Approved
            </Link>

            <Link
              href={`/orders?action=${activeAction}&status=done&q=${encodeURIComponent(
                searchQuery
              )}`}
              className={tabClass(activeStatus === "done")}
            >
              Done
            </Link>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Showing {filteredRows.length} order groups. Latest activity is shown
        first.
      </div>

      <BulkSelectionControls
        formId={bulkFormId}
        label="Select All Orders"
        showDelete={true}
        showMove={true}
      />

      <form id={bulkFormId} action="/api/bulk/action" method="POST">
        <input type="hidden" name="type" value="order_items" />
        <input type="hidden" name="source" value="Place Order" />
        <input type="hidden" name="redirect_to" value="/orders" />

        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Select</th>
                <th className="p-3 border text-left">Last Activity</th>
                <th className="p-3 border text-left">Action</th>
                <th className="p-3 border text-left">Customer</th>
                <th className="p-3 border text-left">PO Number</th>
                <th className="p-3 border text-left">Items</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">OC</th>
                <th className="p-3 border text-left">Original Mail</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const group = row.group;
                  const firstItem = row.items[0];
                  const itemIds = getItemIds(row.items);
                  const emailHref = row.email ? `/emails/${row.email.id}` : "";

                  return (
                    <tr
                      key={group.id}
                      className={
                        group.has_new_activity
                          ? "bg-yellow-50 hover:bg-yellow-100"
                          : "hover:bg-blue-50"
                      }
                    >
                      <td className="p-3 border">
                        <input
                          type="checkbox"
                          name="ids"
                          value={itemIds}
                          data-bulk-form={bulkFormId}
                        />
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {emailHref ? (
                          <Link href={emailHref} className="block">
                            {formatDateTime(group.last_activity_at)}
                            {group.has_new_activity && (
                              <div className="text-xs text-yellow-700 font-semibold">
                                New activity ({group.new_activity_count || 1})
                              </div>
                            )}
                          </Link>
                        ) : (
                          formatDateTime(group.last_activity_at)
                        )}
                      </td>

                      <td className="p-3 border">
                        {emailHref ? (
                          <Link href={emailHref} className="block">
                            New Order
                          </Link>
                        ) : (
                          "New Order"
                        )}
                      </td>

                      <td className="p-3 border">
                        {emailHref ? (
                          <Link href={emailHref} className="block">
                            {group.customer_name || firstItem.customer || ""}
                          </Link>
                        ) : (
                          group.customer_name || firstItem.customer || ""
                        )}
                      </td>

                      <td className="p-3 border">
                        {emailHref ? (
                          <Link href={emailHref} className="block">
                            {group.po_number || firstItem.po_number || ""}
                          </Link>
                        ) : (
                          group.po_number || firstItem.po_number || ""
                        )}
                      </td>

                      <td className="p-3 border">
                        {emailHref ? (
                          <Link href={emailHref} className="block">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900">
                                {row.items.length}{" "}
                                {row.items.length === 1 ? "Item" : "Items"}
                              </span>
                              <span className="text-xs text-gray-500">
                                Click to view order workspace
                              </span>
                            </div>
                          </Link>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">
                              {row.items.length}{" "}
                              {row.items.length === 1 ? "Item" : "Items"}
                            </span>
                            <span className="text-xs text-gray-500">
                              Order email missing
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="p-3 border">
                        <div className="flex items-center gap-2">
                          <select
                            name="status"
                            defaultValue={row.status}
                            className="border rounded px-2 py-1 bg-white"
                            form={`status-${group.id}`}
                          >
                            <option value="New">New</option>
                            <option value="Approved">Approved</option>
                            <option value="Done">Done</option>
                          </select>

                          <button
                            type="submit"
                            form={`status-${group.id}`}
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            Save
                          </button>
                        </div>
                      </td>

                      <td className="p-3 border">
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-gray-600">
                            {row.ocStatus}
                          </div>

                          <GenerateOCButton
                            ids={itemIds}
                            sellers={sellers}
                            buttonClassName="px-4 py-2 rounded-lg text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 text-center disabled:opacity-50"
                          />

                          {row.ocDocumentId ? (
                            <Link
                              href={`/orders/${firstItem.id}/oc`}
                              className="px-4 py-2 rounded-lg text-sm bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-center"
                            >
                              Review/Edit OC
                            </Link>
                          ) : (
                            <span className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-400 text-center">
                              Review/Edit OC
                            </span>
                          )}

                          {row.ocPdfUrl ? (
                            <a
                              href={row.ocPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 rounded-lg text-sm bg-green-100 text-green-700 hover:bg-green-200 text-center"
                            >
                              View OC
                            </a>
                          ) : (
                            <span className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-400 text-center">
                              View OC
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 border">
                        {row.email?.subject || group.subject || "Original email not linked"}
                      </td>

                      <td className="p-3 border">
                        <button
                          type="submit"
                          form={`delete-${group.id}`}
                          className="w-full px-4 py-2 rounded-lg text-sm bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </form>

      {filteredRows.map((row) => {
        const group = row.group;
        const itemIds = getItemIds(row.items);

        return (
          <div key={`forms-${group.id}`}>
            <form
              id={`status-${group.id}`}
              action="/api/orders/update-status"
              method="POST"
            >
              <input type="hidden" name="ids" value={itemIds} />
            </form>

            <form
              id={`delete-${group.id}`}
              action="/api/bulk/action"
              method="POST"
            >
              <input type="hidden" name="type" value="order_items" />
              <input type="hidden" name="operation" value="delete" />
              <input type="hidden" name="source" value="Place Order" />
              <input type="hidden" name="redirect_to" value="/orders" />
              <input type="hidden" name="ids" value={itemIds} />
            </form>
          </div>
        );
      })}
    </div>
  );
}