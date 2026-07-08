export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    due?: string;
    deleted?: string;
    restored?: string;
  }>;
};

type FollowUp = {
  id: string;
  customer_id: string;
  email_log_id: string | null;
  title: string;
  notes: string | null;
  due_date: string;
  priority: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  is_active: boolean | null;
  deleted_at: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
};

function clean(value: any) {
  return String(value || "").trim();
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

function statusClass(status: string) {
  if (status === "done") return "bg-green-50 text-green-700 border-green-200";
  if (status === "cancelled") return "bg-gray-50 text-gray-700 border-gray-200";

  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function priorityClass(priority: string | null) {
  if (priority === "high") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "low") return "bg-green-50 text-green-700 border-green-200";

  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);

  return date;
}

function endOfThisWeek() {
  const date = endOfToday();
  date.setDate(date.getDate() + 7);

  return date;
}

function matchesDueFilter(followUp: FollowUp, due: string) {
  if (!due || due === "all") return true;

  const dueDate = new Date(followUp.due_date);

  if (Number.isNaN(dueDate.getTime())) return true;

  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const weekEnd = endOfThisWeek();

  if (due === "overdue") return dueDate < todayStart;
  if (due === "today") return dueDate >= todayStart && dueDate <= todayEnd;
  if (due === "week") return dueDate >= todayStart && dueDate <= weekEnd;

  return true;
}

function queryString(params: Record<string, string>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") {
      query.set(key, value);
    }
  });

  const text = query.toString();

  return text ? `?${text}` : "";
}

export default async function SalesFollowUpsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const selectedStatus = clean(params.status) || "all";
  const selectedPriority = clean(params.priority) || "all";
  const selectedDue = clean(params.due) || "all";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: followUpsData, error } = await supabase
    .from("customer_followups")
    .select(
      "id, customer_id, email_log_id, title, notes, due_date, priority, status, created_at, completed_at, is_active, deleted_at"
    )
    .order("due_date", { ascending: true });

  const allFollowUps = (followUpsData || []) as FollowUp[];

  const activeFollowUps = allFollowUps.filter(
    (item) => item.is_active !== false
  );

  const deletedFollowUps = allFollowUps.filter(
    (item) => item.is_active === false
  );

  const filteredFollowUps = activeFollowUps.filter((item) => {
    const statusOk =
      selectedStatus === "all" || clean(item.status) === selectedStatus;

    const priorityOk =
      selectedPriority === "all" ||
      clean(item.priority || "medium") === selectedPriority;

    const dueOk = matchesDueFilter(item, selectedDue);

    return statusOk && priorityOk && dueOk;
  });

  const customerIds = Array.from(
    new Set(allFollowUps.map((item) => item.customer_id).filter(Boolean))
  );

  const { data: customersData } =
    customerIds.length > 0
      ? await supabase
          .from("company_profiles")
          .select("id, company_name, contact_person, email")
          .in("id", customerIds)
      : { data: [] };

  const customers = new Map<string, Customer>();

  for (const customer of (customersData || []) as Customer[]) {
    customers.set(customer.id, customer);
  }

  const pending = activeFollowUps.filter((item) => item.status === "pending");
  const done = activeFollowUps.filter((item) => item.status === "done");

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Follow Ups</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track outbound sales follow-ups and customer reminders.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/sales-followups/new"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            + New Sales Follow Up
          </Link>

          <Link href="/customers" className="px-4 py-2 border rounded-lg">
            Customers
          </Link>
        </div>
      </div>

      {params.deleted && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-200">
          Deleted {params.deleted} sales follow up(s). Use Undo Delete below if
          needed.
        </div>
      )}

      {params.restored && (
        <div className="p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
          Restored deleted sales follow ups.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{activeFollowUps.length}</div>
          <div className="text-sm text-gray-500">Total Active Follow Ups</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{pending.length}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{done.length}</div>
          <div className="text-sm text-gray-500">Done</div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Filters</h2>
            <p className="text-sm text-gray-500">
              Showing {filteredFollowUps.length} of {activeFollowUps.length}{" "}
              active follow ups.
            </p>
          </div>

          <Link
            href="/sales-followups"
            className="px-4 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100 text-sm"
          >
            Clear Filters
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Status</div>
            <div className="flex gap-2 flex-wrap">
              {["all", "pending", "done", "cancelled"].map((status) => (
                <Link
                  key={status}
                  href={`/sales-followups${queryString({
                    status,
                    priority: selectedPriority,
                    due: selectedDue,
                  })}`}
                  className={`px-3 py-2 rounded-lg border text-sm capitalize ${
                    selectedStatus === status
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {status}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">
              Priority
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "high", "medium", "low"].map((priority) => (
                <Link
                  key={priority}
                  href={`/sales-followups${queryString({
                    status: selectedStatus,
                    priority,
                    due: selectedDue,
                  })}`}
                  className={`px-3 py-2 rounded-lg border text-sm capitalize ${
                    selectedPriority === priority
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {priority}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Due</div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "all", label: "All" },
                { key: "overdue", label: "Overdue" },
                { key: "today", label: "Today" },
                { key: "week", label: "This Week" },
              ].map((item) => (
                <Link
                  key={item.key}
                  href={`/sales-followups${queryString({
                    status: selectedStatus,
                    priority: selectedPriority,
                    due: item.key,
                  })}`}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    selectedDue === item.key
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <div className="p-4 border-b flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Sales Follow Up List</h2>

          <form
            action="/api/customer-followups/bulk-delete"
            method="POST"
            id="bulk-delete-followups"
          >
            <button className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
              Delete Selected
            </button>
          </form>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Select</th>
              <th className="p-3 border text-left">Due On</th>
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">Title</th>
              <th className="p-3 border text-left">Priority</th>
              <th className="p-3 border text-left">Notes</th>
              <th className="p-3 border text-left">Status</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredFollowUps.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No follow-ups found
                </td>
              </tr>
            ) : (
              filteredFollowUps.map((followUp) => {
                const customer = customers.get(followUp.customer_id);

                return (
                  <tr key={followUp.id} className="hover:bg-gray-50">
                    <td className="p-3 border">
                      <input
                        type="checkbox"
                        name="followup_ids"
                        value={followUp.id}
                        form="bulk-delete-followups"
                      />
                    </td>

                    <td className="p-3 border whitespace-nowrap font-medium">
                      Due On: {formatDateTime(followUp.due_date)}
                    </td>

                    <td className="p-3 border">
                      <div className="font-medium">
                        {customer?.company_name || "Customer"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {customer?.email || ""}
                      </div>
                    </td>

                    <td className="p-3 border font-medium">
                      {followUp.title}
                    </td>

                    <td className="p-3 border">
                      <span
                        className={`px-3 py-1 rounded-full border text-xs capitalize ${priorityClass(
                          followUp.priority
                        )}`}
                      >
                        {followUp.priority || "medium"}
                      </span>
                    </td>

                    <td className="p-3 border">{followUp.notes || ""}</td>

                    <td className="p-3 border">
                      <span
                        className={`px-3 py-1 rounded-full border text-xs capitalize ${statusClass(
                          followUp.status
                        )}`}
                      >
                        {followUp.status}
                      </span>
                    </td>

                    <td className="p-3 border">
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/sales-followups/${followUp.id}/edit`}
                          className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        >
                          Edit
                        </Link>

                        <Link
                          href={`/customers/${followUp.customer_id}/timeline`}
                          className="px-4 py-2 rounded-lg bg-gray-100 border hover:bg-gray-200"
                        >
                          Timeline
                        </Link>

                        {followUp.status === "pending" && (
                          <form
                            action="/api/customer-followups/mark-done"
                            method="POST"
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={followUp.id}
                            />

                            <button className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
                              Mark Done
                            </button>
                          </form>
                        )}

                        <form
                          action="/api/customer-followups/delete"
                          method="POST"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={followUp.id}
                          />

                          <button className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {deletedFollowUps.length > 0 && (
        <div className="bg-gray-50 border rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recently Deleted</h2>
            <p className="text-sm text-gray-500">
              {deletedFollowUps.length} deleted sales follow up(s) can be
              restored.
            </p>
          </div>

          <form action="/api/customer-followups/undo-delete" method="POST">
            <button className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
              Undo Delete All
            </button>
          </form>
        </div>
      )}
    </div>
  );
}