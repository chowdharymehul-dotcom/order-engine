export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";
import BulkSelectionControls from "@/components/BulkSelectionControls";

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
  oc_pdf_url: string | null;
  oc_status: string | null;
  oc_document_id: string | null;
};

type EmailRow = {
  id: string;
  external_message_id: string | null;
  gmail_message_id: string | null;
  received_at: string | null;
  subject: string | null;
  from_email: string | null;
};

type GroupedOrder = {
  key: string;
  email_id: string | null;
  received_at: string | null;
  received_sort: number;
  action: string;
  customer: string;
  po_number: string;
  notes: string;
  status: string;
  original_mail: string;
  oc_pdf_url: string | null;
  oc_status: string;
  oc_document_id: string | null;
  items: OrderItem[];
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

function tabClass(active: boolean) {
  return `px-5 py-3 rounded-lg border text-sm font-medium transition ${
    active
      ? "bg-gray-100 border-gray-400 text-black"
      : "bg-white text-black hover:bg-gray-50"
  }`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Missing email date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid email date";
  }

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

function getGroupStatus(items: OrderItem[]) {
  const statuses = items.map((item) => item.status || "New");

  if (statuses.some((status) => status === "New")) return "New";
  if (statuses.some((status) => status === "Approved")) return "Approved";
  if (statuses.every((status) => status === "Done")) return "Done";

  return statuses[0] || "New";
}

function getMessageKey(item: OrderItem) {
  return (
    clean(item.external_message_id) ||
    clean(item.gmail_message_id) ||
    clean(item.email_subject) ||
    clean(item.id)
  );
}

function getGroupKey(item: OrderItem) {
  return [
    getMessageKey(item),
    normalise(item.customer),
    normalise(item.po_number),
    normalise(item.email_subject),
  ].join("::");
}

function getGroupItemIds(items: OrderItem[]) {
  return items.map((item) => item.id).join(",");
}

function findEmailForItem(params: {
  item: OrderItem;
  emailByMessageId: Map<string, EmailRow>;
  emailBySubject: Map<string, EmailRow>;
}) {
  const { item, emailByMessageId, emailBySubject } = params;

  const externalMessageId = clean(item.external_message_id);
  const gmailMessageId = clean(item.gmail_message_id);
  const subject = normalise(item.email_subject);

  if (externalMessageId && emailByMessageId.has(externalMessageId)) {
    return emailByMessageId.get(externalMessageId) || null;
  }

  if (gmailMessageId && emailByMessageId.has(gmailMessageId)) {
    return emailByMessageId.get(gmailMessageId) || null;
  }

  if (subject && emailBySubject.has(subject)) {
    return emailBySubject.get(subject) || null;
  }

  return null;
}

function matchesSearch(order: GroupedOrder, query: string) {
  if (!query) return true;

  const q = query.toLowerCase();

  const haystack = [
    order.key,
    order.customer,
    order.po_number,
    order.notes,
    order.status,
    order.original_mail,
    order.oc_status,
    order.received_at || "",
    ...order.items.map((item) => item.sku || ""),
    ...order.items.map((item) => String(item.quantity || "")),
    ...order.items.map((item) => item.gmail_message_id || ""),
    ...order.items.map((item) => item.external_message_id || ""),
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

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, action, customer, po_number, sku, quantity, notes, status, source_email, email_subject, external_message_id, gmail_message_id, oc_pdf_url, oc_status, oc_document_id"
    )
    .is("deleted_at", null)
    .ilike("action", "Place Order");

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Orders Dashboard</h1>
        <p className="text-red-600">Error loading orders: {error.message}</p>
      </div>
    );
  }

  const items = (data ?? []) as OrderItem[];

  const { data: emailRows } = await supabase
    .from("emails")
    .select(
      "id, external_message_id, gmail_message_id, received_at, subject, from_email"
    )
    .order("received_at", { ascending: false })
    .limit(5000);

  const emailByMessageId = new Map<string, EmailRow>();
  const emailBySubject = new Map<string, EmailRow>();

  for (const email of (emailRows ?? []) as EmailRow[]) {
    if (email.external_message_id) {
      emailByMessageId.set(email.external_message_id, email);
    }

    if (email.gmail_message_id) {
      emailByMessageId.set(email.gmail_message_id, email);
    }

    const subjectKey = normalise(email.subject);

    if (subjectKey && !emailBySubject.has(subjectKey)) {
      emailBySubject.set(subjectKey, email);
    }
  }

  const groupedMap = new Map<string, OrderItem[]>();

  for (const item of items) {
    const key = getGroupKey(item);

    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }

    groupedMap.get(key)!.push(item);
  }

  const groupedOrders: GroupedOrder[] = Array.from(groupedMap.entries()).map(
    ([key, groupItems]) => {
      const first = groupItems[0];

      const email = findEmailForItem({
        item: first,
        emailByMessageId,
        emailBySubject,
      });

      const receivedAt = email?.received_at || null;
      const receivedSort = receivedAt ? new Date(receivedAt).getTime() : 0;

      const ocPdfUrl =
        groupItems.find((item) => item.oc_pdf_url)?.oc_pdf_url || null;

      const ocDocumentId =
        groupItems.find((item) => item.oc_document_id)?.oc_document_id || null;

      const ocStatus =
        groupItems.find((item) => item.oc_status)?.oc_status ||
        "Not Generated";

      return {
        key,
        email_id: email?.id || null,
        received_at: receivedAt,
        received_sort: Number.isNaN(receivedSort) ? 0 : receivedSort,
        action: "New Order",
        customer: first.customer || "",
        po_number: first.po_number || "",
        notes:
          groupItems
            .map((item) => item.notes)
            .filter(Boolean)
            .join(" | ") || "",
        status: getGroupStatus(groupItems),
        original_mail:
          email?.subject ||
          first.email_subject ||
          first.source_email ||
          "Original email not linked",
        oc_pdf_url: ocPdfUrl,
        oc_status: ocStatus,
        oc_document_id: ocDocumentId,
        items: groupItems,
      };
    }
  );

  const filteredOrders = groupedOrders.filter((order) => {
    if (activeAction !== "all" && activeAction !== "new_order") {
      return false;
    }

    if (
      activeStatus !== "all" &&
      order.status.toLowerCase() !== activeStatus.toLowerCase()
    ) {
      return false;
    }

    return matchesSearch(order, searchQuery);
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (a.received_sort !== b.received_sort) {
      return b.received_sort - a.received_sort;
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

          <Link
            href="/cancellations"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancellations
          </Link>

          <Link
            href="/oc-templates"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            OC Templates
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <form className="flex gap-3" action="/orders" method="GET">
          <input type="hidden" name="action" value={activeAction} />
          <input type="hidden" name="status" value={activeStatus} />

          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by SKU, customer, PO, subject, message ID..."
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
        Showing {sortedOrders.length} grouped orders. Latest received emails are
        shown first.
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
                <th className="p-3 border text-left">Received On</th>
                <th className="p-3 border text-left">Action</th>
                <th className="p-3 border text-left">Customer</th>
                <th className="p-3 border text-left">PO Number</th>
                <th className="p-3 border text-left">SKU</th>
                <th className="p-3 border text-left">Quantity</th>
                <th className="p-3 border text-left">Notes</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">OC</th>
                <th className="p-3 border text-left">Original Mail</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order) => {
                  const firstItem = order.items[0];
                  const groupIds = getGroupItemIds(order.items);

                  return (
                    <tr key={order.key} className="hover:bg-gray-50">
                      <td className="p-3 border">
                        <input
                          type="checkbox"
                          name="ids"
                          value={groupIds}
                          data-bulk-form={bulkFormId}
                        />
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {formatDateTime(order.received_at)}
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

                      <td className="p-3 border">
                        <div className="flex items-center gap-2">
                          <select
                            name="status"
                            defaultValue={order.status || "New"}
                            className="border rounded px-2 py-1 bg-white"
                            form={`status-${firstItem.id}`}
                          >
                            <option value="New">New</option>
                            <option value="Approved">Approved</option>
                            <option value="Done">Done</option>
                          </select>

                          <button
                            type="submit"
                            form={`status-${firstItem.id}`}
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            Save
                          </button>
                        </div>
                      </td>

                      <td className="p-3 border">
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-gray-600">
                            {order.oc_status || "Not Generated"}
                          </div>

                          <button
                            type="submit"
                            form={`generate-oc-${firstItem.id}`}
                            className="px-4 py-2 rounded-lg text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 text-center"
                          >
                            Generate OC
                          </button>

                          {order.oc_document_id ? (
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

                          {order.oc_pdf_url ? (
                            <a
                              href={order.oc_pdf_url}
                              target="_blank"
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

                      <td className="p-3 border">{order.original_mail}</td>

                      <td className="p-3 border">
                        <div className="flex flex-col gap-2">
                          {order.email_id ? (
                            <Link
                              href={`/emails/${order.email_id}`}
                              className="px-4 py-2 rounded-lg text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 text-center"
                            >
                              Original Email
                            </Link>
                          ) : (
                            <span className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-400 text-center">
                              Original Email Missing
                            </span>
                          )}

                          <button
                            type="submit"
                            form={`delete-${firstItem.id}`}
                            className="w-full px-4 py-2 rounded-lg text-sm bg-red-100 text-red-700 hover:bg-red-200"
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

      {sortedOrders.map((order) => {
        const firstItem = order.items[0];
        const groupIds = getGroupItemIds(order.items);

        return (
          <div key={`forms-${firstItem.id}`}>
            <form
              id={`status-${firstItem.id}`}
              action="/api/orders/update-status"
              method="POST"
            >
              <input type="hidden" name="ids" value={groupIds} />
            </form>

            <form
              id={`delete-${firstItem.id}`}
              action="/api/bulk/action"
              method="POST"
            >
              <input type="hidden" name="type" value="order_items" />
              <input type="hidden" name="operation" value="delete" />
              <input type="hidden" name="source" value="Place Order" />
              <input type="hidden" name="redirect_to" value="/orders" />
              <input type="hidden" name="ids" value={groupIds} />
            </form>

            <form
              id={`generate-oc-${firstItem.id}`}
              action="/api/orders/generate-oc"
              method="POST"
            >
              <input type="hidden" name="ids" value={groupIds} />
            </form>
          </div>
        );
      })}
    </div>
  );
}