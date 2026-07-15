export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";
import BulkSelectionControls from "@/components/BulkSelectionControls";

type EnquiryItem = {
  id: string;
  order_group_id: string | null;
  customer: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  email_subject: string | null;
  action: string | null;
  follow_up_due_at: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
  parent_email_id: string | null;
};

type EmailRow = {
  id: string;
  external_message_id: string | null;
  gmail_message_id: string | null;
  received_at: string | null;
  subject: string | null;
};

type GroupedEnquiry = {
  key: string;
  email_id: string | null;
  received_at: string | null;
  customer: string;
  query: string;
  status: string;
  follow_up_due_at: string | null;
  has_new_activity: boolean;
  new_activity_count: number;
  items: EnquiryItem[];
};

type ActivityGroup = {
  id: string;
  has_new_activity: boolean | null;
  new_activity_count: number | null;
};

type EnquiriesPageProps = {
  searchParams?: Promise<{
    filter?: string;
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

function getGroupStatus(items: EnquiryItem[]) {
  const statuses = items.map((item) => item.status || "Pending");

  if (statuses.some((status) => status === "Follow Up with Customer")) {
    return "Follow Up with Customer";
  }

  if (statuses.some((status) => status === "Pending")) {
    return "Pending";
  }

  if (statuses.some((status) => status === "Replied")) {
    return "Replied";
  }

  if (statuses.every((status) => status === "Close Enquiry")) {
    return "Close Enquiry";
  }

  return statuses[0] || "Pending";
}

function getEarliestFollowUp(items: EnquiryItem[]) {
  const dates = items
    .map((item) => item.follow_up_due_at)
    .filter((date): date is string => !!date)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return dates[0] || null;
}

function getPriorityMeta(row: GroupedEnquiry) {
  const now = new Date();

  if (row.status === "Pending") {
    return {
      label: "New",
      style: "bg-purple-100 text-purple-700",
    };
  }

  if (row.status === "Follow Up with Customer" && row.follow_up_due_at) {
    const due = new Date(row.follow_up_due_at);
    const diffHours = (now.getTime() - due.getTime()) / (1000 * 60 * 60);

    if (diffHours >= 48) {
      return {
        label: "Critical",
        style: "bg-red-100 text-red-700",
      };
    }

    if (diffHours >= 0) {
      return {
        label: "Overdue",
        style: "bg-orange-100 text-orange-700",
      };
    }

    return {
      label: "Due Soon",
      style: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: null as string | null,
    style: "",
  };
}

function getMessageKey(item: EnquiryItem) {
  return (
    clean(item.external_message_id) ||
    clean(item.gmail_message_id) ||
    clean(item.email_subject) ||
    clean(item.id)
  );
}

function stripReplyPrefix(value: string | null | undefined) {
  return normalise(value)
    .replace(/^(re|fw|fwd|res)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getGroupKey(item: EnquiryItem) {
  const customer = normalise(item.customer);
  const subject = stripReplyPrefix(item.email_subject);

  if (subject) {
    return ["enquiry-subject", customer, subject].join("::");
  }

  return ["enquiry-message", customer, getMessageKey(item)].join("::");
}

function getGroupItemIds(items: EnquiryItem[]) {
  return items.map((item) => item.id).join(",");
}

function findEmailForItem(params: {
  item: EnquiryItem;
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

export default async function EnquiriesPage({
  searchParams,
}: EnquiriesPageProps) {
  const params = await searchParams;
  const activeFilter = params?.filter || "all";
  const bulkFormId = "enquiries-bulk-form";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const nowIso = new Date().toISOString();

  await supabase
    .from("order_items")
    .update({
      status: "Follow Up with Customer",
    })
    .is("deleted_at", null)
    .eq("status", "Replied")
    .not("follow_up_due_at", "is", null)
    .lt("follow_up_due_at", nowIso);

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, order_group_id, customer, sku, quantity, notes, status, email_subject, action, follow_up_due_at, external_message_id, gmail_message_id, parent_email_id"
    )
    .is("deleted_at", null)
    .in("action", ["Reply to Enquiry", "Follow Up", "Confirm Delivery"]);

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Enquiries and Follow Up</h1>
        <p className="text-red-600">
          Error loading enquiries: {error.message}
        </p>
      </div>
    );
  }

  const items = (data ?? []) as EnquiryItem[];

  const activityGroupIds = Array.from(
    new Set(
      items
        .map((item) => clean(item.order_group_id))
        .filter((groupId): groupId is string => !!groupId)
    )
  );

  const { data: activityGroupRows } =
    activityGroupIds.length > 0
      ? await supabase
          .from("order_groups")
          .select("id, has_new_activity, new_activity_count")
          .in("id", activityGroupIds)
      : { data: [] };

  const activityByGroupId = new Map<string, ActivityGroup>();

  for (const group of (activityGroupRows ?? []) as ActivityGroup[]) {
    activityByGroupId.set(group.id, group);
  }

  const { data: emailRows } = await supabase
    .from("emails")
    .select("id, external_message_id, gmail_message_id, received_at, subject")
    .order("received_at", { ascending: false })
    .limit(5000);

  const emailByMessageId = new Map<string, EmailRow>();

  for (const email of (emailRows ?? []) as EmailRow[]) {
    if (email.external_message_id) {
      emailByMessageId.set(email.external_message_id, email);
    }

    if (email.gmail_message_id) {
      emailByMessageId.set(email.gmail_message_id, email);
    }
  }

  const groupedMap = new Map<string, EnquiryItem[]>();

  for (const item of items) {
    const key = getGroupKey(item);

    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }

    groupedMap.get(key)!.push(item);
  }

  const groupedRows: GroupedEnquiry[] = Array.from(groupedMap.entries()).map(
    ([key, groupItems]) => {
      const first = groupItems[0];

      const email = findEmailForItem({
        item: first,
        emailByMessageId,
      });

      const activityGroup = groupItems
        .map((item) => clean(item.order_group_id))
        .filter(Boolean)
        .map((groupId) => activityByGroupId.get(groupId))
        .find((group): group is ActivityGroup => !!group);

      return {
        key,
        email_id: email?.id || null,
        received_at: email?.received_at || null,
        customer: first.customer || "",
        query:
          groupItems
            .map((item) => item.notes)
            .filter(Boolean)
            .join(" | ") ||
          first.email_subject ||
          "",
        status: getGroupStatus(groupItems),
        follow_up_due_at: getEarliestFollowUp(groupItems),
        has_new_activity: !!activityGroup?.has_new_activity,
        new_activity_count: Number(activityGroup?.new_activity_count || 0),
        items: groupItems,
      };
    }
  );

  const counts = {
    all: groupedRows.length,
    pending: groupedRows.filter((row) => row.status === "Pending").length,
    replied: groupedRows.filter((row) => row.status === "Replied").length,
    followup: groupedRows.filter(
      (row) => row.status === "Follow Up with Customer"
    ).length,
    closed: groupedRows.filter((row) => row.status === "Close Enquiry").length,
  };

  const filteredRows = groupedRows.filter((row) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "pending") return row.status === "Pending";
    if (activeFilter === "replied") return row.status === "Replied";
    if (activeFilter === "followup") {
      return row.status === "Follow Up with Customer";
    }
    if (activeFilter === "closed") {
      return row.status === "Close Enquiry";
    }
    return true;
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
          <h1 className="text-3xl font-bold">Enquiries and Follow Up</h1>

          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2 rounded-full bg-orange-100 text-orange-800 text-sm font-medium">
              {counts.followup} follow up{counts.followup !== 1 ? "s" : ""} due
            </div>

            <div className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
              {counts.pending} pending
            </div>

            <div className="px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-medium">
              {counts.replied} replied
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
            href="/cancellations"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancellations
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/enquiries-follow-up?filter=all"
          className={tabClass(activeFilter === "all")}
        >
          All ({counts.all})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=pending"
          className={tabClass(activeFilter === "pending")}
        >
          Pending ({counts.pending})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=replied"
          className={tabClass(activeFilter === "replied")}
        >
          Replied ({counts.replied})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=followup"
          className={tabClass(activeFilter === "followup")}
        >
          Follow Up ({counts.followup})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=closed"
          className={tabClass(activeFilter === "closed")}
        >
          Closed ({counts.closed})
        </Link>
      </div>

      <BulkSelectionControls
        formId={bulkFormId}
        label="Select All Enquiries"
        showDelete={true}
        showMove={true}
      />

      <form id={bulkFormId} action="/api/bulk/action" method="POST">
        <input type="hidden" name="type" value="order_items" />
        <input type="hidden" name="source" value="Reply to Enquiry" />
        <input
          type="hidden"
          name="redirect_to"
          value="/enquiries-follow-up"
        />

        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Select</th>
                <th className="p-3 border text-left">Received On</th>
                <th className="p-3 border text-left">Customer</th>
                <th className="p-3 border text-left">Items</th>
                <th className="p-3 border text-left">Query</th>
                <th className="p-3 border text-left">Priority</th>
                <th className="p-3 border text-left">Action</th>
                <th className="p-3 border text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No items found
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const firstItem = row.items[0];
                  const priority = getPriorityMeta(row);
                  const groupIds = getGroupItemIds(row.items);

                  const parentEmailId =
                    firstItem.parent_email_id || row.email_id || "";

                  const rowHref = parentEmailId
                    ? `/emails/${parentEmailId}`
                    : "";

                  return (
                    <tr
                      key={row.key}
                      className={
                        row.has_new_activity
                          ? "bg-yellow-50 hover:bg-yellow-100"
                          : "hover:bg-gray-50"
                      }
                    >
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

                            {row.has_new_activity && (
                              <div className="text-xs text-yellow-700 font-semibold">
                                New activity ({row.new_activity_count || 1})
                              </div>
                            )}
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
                        <div className="font-semibold text-gray-900">
                          {row.items.length}{" "}
                          {row.items.length === 1 ? "Item" : "Items"}
                        </div>
                      </td>

                      <td className="p-3 border">
                        <div className="space-y-2">
                          <div className="line-clamp-2 max-w-[420px] text-sm">
                            {row.query}
                          </div>

                          {row.follow_up_due_at && (
                            <div className="text-xs text-gray-500">
                              Follow up: {formatDateTime(row.follow_up_due_at)}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-3 border">
                        {priority.label ? (
                          <span
                            className={`px-2 py-1 text-xs rounded ${priority.style}`}
                          >
                            {priority.label}
                          </span>
                        ) : (
                          ""
                        )}
                      </td>

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
                            <option value="Replied">Replied</option>
                            <option value="Pending">Pending</option>
                            <option value="Follow Up with Customer">
                              Follow Up with Customer
                            </option>
                            <option value="Close Enquiry">Close Enquiry</option>
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
              action="/api/enquiries/update-status"
              method="POST"
            >
              <input type="hidden" name="id" value={firstItem.id} />
            </form>

            <form
              id={`delete-${firstItem.id}`}
              action="/api/bulk/action"
              method="POST"
            >
              <input type="hidden" name="type" value="order_items" />
              <input type="hidden" name="operation" value="delete" />
              <input type="hidden" name="source" value="Reply to Enquiry" />
              <input
                type="hidden"
                name="redirect_to"
                value="/enquiries-follow-up"
              />
              <input type="hidden" name="ids" value={groupIds} />
            </form>
          </div>
        );
      })}
    </div>
  );
}