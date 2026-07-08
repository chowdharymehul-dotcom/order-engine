export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";
import BulkSelectionControls from "@/components/BulkSelectionControls";

type CancellationItem = {
  id: string;
  customer: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  email_subject: string | null;
  action: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
  parent_email_id: string | null;
};

type EmailRow = {
  id: string;
  external_message_id: string | null;
  gmail_message_id: string | null;
  received_at: string | null;
};

type GroupedCancellation = {
  key: string;
  email_id: string | null;
  received_at: string | null;
  customer: string;
  po_number: string;
  notes: string;
  status: string;
  items: CancellationItem[];
};

type CancellationsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function tabClass(active: boolean) {
  return `px-5 py-3 rounded-lg border text-sm font-medium transition ${
    active
      ? "bg-gray-100 border-gray-400 text-black"
      : "bg-white text-black hover:bg-gray-50"
  }`;
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

function getGroupStatus(items: CancellationItem[]) {
  const statuses = items.map((item) => item.status || "Pending");

  if (statuses.some((status) => status === "Pending")) return "Pending";
  if (statuses.some((status) => status === "Approved")) return "Approved";
  if (statuses.some((status) => status === "Denied")) return "Denied";

  return statuses[0] || "Pending";
}

function getGroupItemIds(items: CancellationItem[]) {
  return items.map((item) => item.id).join(",");
}

function getMessageKey(item: CancellationItem) {
  return (
    clean(item.parent_email_id) ||
    clean(item.external_message_id) ||
    clean(item.gmail_message_id) ||
    clean(item.email_subject) ||
    clean(item.id)
  );
}

function findEmailForItem(params: {
  item: CancellationItem;
  emailByMessageId: Map<string, EmailRow>;
}) {
  const { item, emailByMessageId } = params;

  const externalMessageId = clean(item.external_message_id);
  const gmailMessageId = clean(item.gmail_message_id);

  if (externalMessageId && emailByMessageId.has(externalMessageId)) {
    return emailByMessageId.get(externalMessageId) || null;
  }

  if (gmailMessageId && emailByMessageId.has(gmailMessageId)) {
    return emailByMessageId.get(gmailMessageId) || null;
  }

  return null;
}

export default async function CancellationsPage({
  searchParams,
}: CancellationsPageProps) {
  const params = await searchParams;
  const activeStatus = params?.status || "all";
  const bulkFormId = "cancellations-bulk-form";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, customer, po_number, sku, quantity, notes, status, email_subject, action, external_message_id, gmail_message_id, parent_email_id"
    )
    .is("deleted_at", null)
    .eq("action", "Cancel Order")
    .order("id", { ascending: false });

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Cancellations</h1>
        <p className="text-red-600">
          Error loading cancellations: {error.message}
        </p>
      </div>
    );
  }

  const items = (data ?? []) as CancellationItem[];

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

  const emailByMessageId = new Map<string, EmailRow>();

  if (externalIds.length > 0) {
    const { data: emailRows } = await supabase
      .from("emails")
      .select("id, external_message_id, gmail_message_id, received_at")
      .in("external_message_id", externalIds);

    for (const email of (emailRows ?? []) as EmailRow[]) {
      if (email.external_message_id) {
        emailByMessageId.set(email.external_message_id, email);
      }
    }
  }

  if (gmailIds.length > 0) {
    const { data: gmailEmailRows } = await supabase
      .from("emails")
      .select("id, external_message_id, gmail_message_id, received_at")
      .in("gmail_message_id", gmailIds);

    for (const email of (gmailEmailRows ?? []) as EmailRow[]) {
      if (email.gmail_message_id) {
        emailByMessageId.set(email.gmail_message_id, email);
      }
    }
  }

  const groupedMap = new Map<string, CancellationItem[]>();

  for (const item of items) {
    const key = getMessageKey(item);

    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }

    groupedMap.get(key)!.push(item);
  }

  const groupedRows: GroupedCancellation[] = Array.from(
    groupedMap.entries()
  ).map(([key, groupItems]) => {
    const first = groupItems[0];

    const email = findEmailForItem({
      item: first,
      emailByMessageId,
    });

    return {
      key,
      email_id: email?.id || null,
      received_at: email?.received_at || null,
      customer: first.customer || "",
      po_number: first.po_number || "",
      notes:
        groupItems
          .map((item) => item.notes)
          .filter(Boolean)
          .join(" | ") ||
        first.email_subject ||
        "",
      status: getGroupStatus(groupItems),
      items: groupItems,
    };
  });

  const counts = {
    all: groupedRows.length,
    pending: groupedRows.filter((row) => row.status === "Pending").length,
    approved: groupedRows.filter((row) => row.status === "Approved").length,
    denied: groupedRows.filter((row) => row.status === "Denied").length,
  };

  const filteredRows = groupedRows.filter((row) => {
    if (activeStatus === "all") return true;
    return row.status.toLowerCase() === activeStatus.toLowerCase();
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
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
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Cancellations</h1>

          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
              {counts.pending} pending
            </div>

            <div className="px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-medium">
              {counts.approved} approved
            </div>

            <div className="px-4 py-2 rounded-full bg-red-100 text-red-700 text-sm font-medium">
              {counts.denied} denied
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/emails"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Emails
          </Link>

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
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/cancellations?status=all"
          className={tabClass(activeStatus === "all")}
        >
          All ({counts.all})
        </Link>

        <Link
          href="/cancellations?status=pending"
          className={tabClass(activeStatus === "pending")}
        >
          Pending ({counts.pending})
        </Link>

        <Link
          href="/cancellations?status=approved"
          className={tabClass(activeStatus === "approved")}
        >
          Approved ({counts.approved})
        </Link>

        <Link
          href="/cancellations?status=denied"
          className={tabClass(activeStatus === "denied")}
        >
          Denied ({counts.denied})
        </Link>
      </div>

      <BulkSelectionControls
        formId={bulkFormId}
        label="Select All Cancellations"
        showDelete={true}
        showMove={true}
      />

      <form id={bulkFormId} action="/api/bulk/action" method="POST">
        <input type="hidden" name="type" value="order_items" />
        <input type="hidden" name="source" value="Cancel Order" />
        <input type="hidden" name="redirect_to" value="/cancellations" />

        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Select</th>
                <th className="p-3 border text-left">Received On</th>
                <th className="p-3 border text-left">Customer</th>
                <th className="p-3 border text-left">PO Number</th>
                <th className="p-3 border text-left">Items</th>
                <th className="p-3 border text-left">Notes</th>
                <th className="p-3 border text-left">Action</th>
                <th className="p-3 border text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No cancellations found
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const firstItem = row.items[0];
                  const groupIds = getGroupItemIds(row.items);

                  const parentEmailId =
                    firstItem.parent_email_id || row.email_id || "";

                  const rowHref = parentEmailId
                    ? `/emails/${parentEmailId}`
                    : "";

                  return (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="p-3 border">
                        <input
                          type="checkbox"
                          name="ids"
                          value={groupIds}
                          data-bulk-form={bulkFormId}
                        />
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {rowHref ? (
                          <Link href={rowHref} className="block">
                            {formatDateTime(row.received_at)}
                          </Link>
                        ) : (
                          formatDateTime(row.received_at)
                        )}
                      </td>

                      <td className="p-3 border">
                        {rowHref ? (
                          <Link href={rowHref} className="block">
                            {row.customer}
                          </Link>
                        ) : (
                          row.customer
                        )}
                      </td>

                      <td className="p-3 border">
                        {rowHref ? (
                          <Link href={rowHref} className="block">
                            {row.po_number}
                          </Link>
                        ) : (
                          row.po_number
                        )}
                      </td>

                      <td className="p-3 border">
                        {rowHref ? (
                          <Link href={rowHref} className="block">
                            <div className="font-semibold text-gray-900">
                              {row.items.length}{" "}
                              {row.items.length === 1 ? "Item" : "Items"}
                            </div>
                          </Link>
                        ) : (
                          <div className="font-semibold text-gray-900">
                            {row.items.length}{" "}
                            {row.items.length === 1 ? "Item" : "Items"}
                          </div>
                        )}
                      </td>

                      <td className="p-3 border">{row.notes}</td>

                      <td className="p-3 border">
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/enquiries-follow-up/${firstItem.id}/reply`}
                            className="px-4 py-2 rounded-lg text-sm bg-gray-200 text-black hover:bg-gray-300 text-center"
                          >
                            Reply
                          </Link>

                          {rowHref ? (
                            <Link
                              href={rowHref}
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

                      <td className="p-3 border">
                        <div className="flex items-center gap-2">
                          <select
                            name="status"
                            defaultValue={row.status || "Pending"}
                            className="border rounded px-2 py-1 bg-white"
                            form={`status-${firstItem.id}`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Denied">Denied</option>
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </form>

      {sortedRows.map((row) => {
        const firstItem = row.items[0];
        const groupIds = getGroupItemIds(row.items);

        return (
          <div key={`forms-${firstItem.id}`}>
            <form
              id={`status-${firstItem.id}`}
              action="/api/cancellations/update-status"
              method="POST"
            >
              <input type="hidden" name="external_message_id" value={row.key} />
            </form>

            <form
              id={`delete-${firstItem.id}`}
              action="/api/bulk/action"
              method="POST"
            >
              <input type="hidden" name="type" value="order_items" />
              <input type="hidden" name="operation" value="delete" />
              <input type="hidden" name="source" value="Cancel Order" />
              <input type="hidden" name="redirect_to" value="/cancellations" />
              <input type="hidden" name="ids" value={groupIds} />
            </form>
          </div>
        );
      })}
    </div>
  );
}