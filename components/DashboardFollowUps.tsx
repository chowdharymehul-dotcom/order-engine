export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type FollowUp = {
  id: string;
  customer_id: string;
  title: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
};

function priorityClass(priority: string | null) {
  if (priority === "high") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "medium")
    return "bg-yellow-50 text-yellow-700 border-yellow-200";

  return "bg-green-50 text-green-700 border-green-200";
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
  });
}

function isOverdue(dateText: string | null) {
  if (!dateText) return false;

  const due = new Date(dateText);
  const now = new Date();

  return due.getTime() < now.getTime();
}

function isToday(dateText: string | null) {
  if (!dateText) return false;

  const date = new Date(dateText);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function priorityHref(priority: string | null) {
  return `/sales-followups?priority=${priority || "medium"}&status=pending`;
}

export default async function DashboardFollowUps() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("customer_followups")
    .select("id, customer_id, title, due_date, priority, status")
    .eq("status", "pending")
    .eq("is_active", true)
    .order("due_date", { ascending: true })
    .limit(10);

  const followUps = (data || []) as FollowUp[];

  const customerIds = Array.from(
    new Set(followUps.map((item) => item.customer_id))
  );

  const { data: customersData } =
    customerIds.length > 0
      ? await supabase
          .from("company_profiles")
          .select("id, company_name")
          .in("id", customerIds)
      : { data: [] };

  const customers = new Map<string, Customer>();

  for (const customer of (customersData || []) as Customer[]) {
    customers.set(customer.id, customer);
  }

  const overdueCount = followUps.filter((x) => isOverdue(x.due_date)).length;
  const dueTodayCount = followUps.filter((x) => isToday(x.due_date)).length;
  const highPriorityCount = followUps.filter(
    (x) => x.priority === "high"
  ).length;

  return (
    <div className="bg-white border rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Sales Follow Ups</h2>

        <Link
          href="/sales-followups"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link
          href="/sales-followups?due=today&status=pending"
          className="block cursor-pointer border rounded-lg p-3 hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition"
        >
          <div className="text-2xl font-bold">{dueTodayCount}</div>
          <div className="text-sm text-gray-500">Due Today</div>
        </Link>

        <Link
          href="/sales-followups?due=overdue&status=pending"
          className="block cursor-pointer border rounded-lg p-3 hover:bg-red-50 hover:border-red-200 hover:shadow-sm transition"
        >
          <div className="text-2xl font-bold">{overdueCount}</div>
          <div className="text-sm text-gray-500">Overdue</div>
        </Link>

        <Link
          href="/sales-followups?priority=high&status=pending"
          className="block cursor-pointer border rounded-lg p-3 hover:bg-yellow-50 hover:border-yellow-200 hover:shadow-sm transition"
        >
          <div className="text-2xl font-bold">{highPriorityCount}</div>
          <div className="text-sm text-gray-500">High Priority</div>
        </Link>
      </div>

      {followUps.length === 0 ? (
        <div className="text-sm text-gray-500">
          No pending sales follow ups.
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map((followUp) => {
            const customer = customers.get(followUp.customer_id);

            return (
              <div key={followUp.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/customers/${followUp.customer_id}/timeline`}
                      className="font-medium hover:text-blue-700 hover:underline"
                    >
                      {customer?.company_name || "Customer"}
                    </Link>

                    <Link
                      href={`/sales-followups/${followUp.id}/edit`}
                      className="block text-sm text-gray-600 hover:text-blue-700 hover:underline mt-1"
                    >
                      {followUp.title}
                    </Link>

                    <Link
                      href={`/sales-followups/${followUp.id}/edit`}
                      className="block text-xs text-gray-500 hover:text-blue-700 hover:underline mt-1"
                    >
                      Due On: {formatDateTime(followUp.due_date)}
                    </Link>
                  </div>

                  <Link
                    href={priorityHref(followUp.priority)}
                    className={`px-2 py-1 text-xs rounded-full border capitalize hover:opacity-80 ${priorityClass(
                      followUp.priority
                    )}`}
                  >
                    {followUp.priority || "medium"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}