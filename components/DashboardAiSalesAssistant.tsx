export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  updated_at: string | null;
};

type FollowUp = {
  id: string;
  customer_id: string;
  title: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
};

type EmailLog = {
  customer_id: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type OrderItem = {
  id: string;
  action: string | null;
  customer: string | null;
  sku: string | null;
  quantity: number | null;
  status: string | null;
  created_at: string | null;
};

type Suggestion = {
  id: string;
  customerId: string;
  customerName: string;
  reason: string;
  urgency: "high" | "medium";
  followUpId?: string;
};

function clean(value: any) {
  return String(value || "").trim();
}

function daysAgo(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyClass(urgency: string) {
  if (urgency === "high") return "bg-red-50 text-red-700 border-red-200";
  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function isOverdue(value: string | null) {
  if (!value) return false;

  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;

  return due.getTime() < Date.now();
}

function latestEmailDate(logs: EmailLog[]) {
  const sorted = logs
    .map((item) => item.sent_at || item.created_at)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return sorted[0]?.toISOString() || null;
}

function customerKey(value: string | null) {
  return clean(value).toLowerCase();
}

function followUpHref(item: Suggestion) {
  const params = new URLSearchParams();

  params.set("customer_id", item.customerId);
  params.set("title", `Follow up with ${item.customerName || "customer"}`);
  params.set("priority", item.urgency === "high" ? "high" : "medium");
  params.set("notes", item.reason);

  return `/sales-followups/new?${params.toString()}`;
}

export default async function DashboardAiSalesAssistant() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customersData } = await supabase
    .from("company_profiles")
    .select("id, company_name, contact_person, email, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: true })
    .limit(150);

  const { data: followUpsData } = await supabase
    .from("customer_followups")
    .select("id, customer_id, title, due_date, priority, status")
    .eq("is_active", true)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(150);

  const { data: emailLogsData } = await supabase
    .from("customer_email_logs")
    .select("customer_id, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(3000);

  const { data: orderItemsData } = await supabase
    .from("order_items")
    .select("id, action, customer, sku, quantity, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const customers = (customersData || []) as Customer[];
  const followUps = (followUpsData || []) as FollowUp[];
  const emailLogs = (emailLogsData || []) as EmailLog[];
  const orderItems = (orderItemsData || []) as OrderItem[];

  const customerByName = new Map<string, Customer>();
  const followUpsByCustomer = new Map<string, FollowUp[]>();
  const emailsByCustomer = new Map<string, EmailLog[]>();

  for (const customer of customers) {
    customerByName.set(customerKey(customer.company_name), customer);
  }

  for (const followUp of followUps) {
    const list = followUpsByCustomer.get(followUp.customer_id) || [];
    list.push(followUp);
    followUpsByCustomer.set(followUp.customer_id, list);
  }

  for (const log of emailLogs) {
    const customerId = clean(log.customer_id);
    if (!customerId) continue;

    const list = emailsByCustomer.get(customerId) || [];
    list.push(log);
    emailsByCustomer.set(customerId, list);
  }

  const suggestions: Suggestion[] = [];

  for (const followUp of followUps) {
    if (!isOverdue(followUp.due_date)) continue;

    const customer = customers.find((item) => item.id === followUp.customer_id);

    suggestions.push({
      id: `overdue-${followUp.id}`,
      customerId: followUp.customer_id,
      customerName: customer?.company_name || "Customer",
      reason: `Sales follow up is overdue: ${followUp.title || "Follow up"}`,
      urgency: "high",
      followUpId: followUp.id,
    });
  }

  for (const item of orderItems) {
    if (suggestions.length >= 10) break;

    const action = clean(item.action).toLowerCase();
    const status = clean(item.status).toLowerCase();

    const isOpenEnquiry =
      (action.includes("enquiry") || action.includes("follow")) &&
      status !== "done" &&
      status !== "closed" &&
      status !== "replied";

    if (!isOpenEnquiry) continue;

    const age = daysAgo(item.created_at);
    if (age === null || age < 7) continue;

    const customer = customerByName.get(customerKey(item.customer));
    if (!customer) continue;

    const existingFollowUps = followUpsByCustomer.get(customer.id) || [];

    if (existingFollowUps.length > 0) continue;

    suggestions.push({
      id: `open-enquiry-${item.id}`,
      customerId: customer.id,
      customerName: customer.company_name || "Customer",
      reason: `Open enquiry pending for ${age} days${
        item.sku ? ` · SKU: ${item.sku}` : ""
      }`,
      urgency: age >= 14 ? "high" : "medium",
    });
  }

  for (const customer of customers) {
    if (suggestions.length >= 10) break;

    const existingFollowUps = followUpsByCustomer.get(customer.id) || [];
    if (existingFollowUps.length > 0) continue;

    const lastEmail = latestEmailDate(emailsByCustomer.get(customer.id) || []);
    const emailAge = daysAgo(lastEmail);

    if (emailAge !== null && emailAge >= 30) {
      suggestions.push({
        id: `no-email-${customer.id}`,
        customerId: customer.id,
        customerName: customer.company_name || "Customer",
        reason: `No email sent in ${emailAge} days`,
        urgency: emailAge >= 60 ? "high" : "medium",
      });

      continue;
    }

    if (!lastEmail) {
      suggestions.push({
        id: `never-emailed-${customer.id}`,
        customerId: customer.id,
        customerName: customer.company_name || "Customer",
        reason: "No email has been sent to this customer yet",
        urgency: "medium",
      });
    }
  }

  const noEmail30Count = customers.filter((customer) => {
    const lastEmail = latestEmailDate(emailsByCustomer.get(customer.id) || []);
    const age = daysAgo(lastEmail);

    return age !== null && age >= 30;
  }).length;

  const noEmail60Count = customers.filter((customer) => {
    const lastEmail = latestEmailDate(emailsByCustomer.get(customer.id) || []);
    const age = daysAgo(lastEmail);

    return age !== null && age >= 60;
  }).length;

  const neverEmailedCount = customers.filter((customer) => {
    const lastEmail = latestEmailDate(emailsByCustomer.get(customer.id) || []);
    return !lastEmail;
  }).length;

  const visibleSuggestions = suggestions.slice(0, 10);

  return (
    <div className="bg-white border rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Sales Assistant</h2>
          <p className="text-sm text-gray-500 mt-1">
            Customers, enquiries and follow ups that may need attention.
          </p>
        </div>

        <Link
          href="/sales-followups"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          View Follow Ups
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold">{visibleSuggestions.length}</div>
          <div className="text-sm text-gray-500">Need Attention</div>
        </div>

        <Link
          href="/customers/no-contact?days=30"
          className="block border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-200"
        >
          <div className="text-2xl font-bold">{noEmail30Count}</div>
          <div className="text-sm text-gray-500">No Email 30+ Days</div>
        </Link>

        <Link
          href="/customers/no-contact?days=60"
          className="block border rounded-lg p-4 hover:bg-red-50 hover:border-red-200"
        >
          <div className="text-2xl font-bold">{noEmail60Count}</div>
          <div className="text-sm text-gray-500">No Email 60+ Days</div>
        </Link>

        <Link
          href="/customers/no-contact?type=never"
          className="block border rounded-lg p-4 hover:bg-yellow-50 hover:border-yellow-200"
        >
          <div className="text-2xl font-bold">{neverEmailedCount}</div>
          <div className="text-sm text-gray-500">Never Emailed</div>
        </Link>
      </div>

      {visibleSuggestions.length === 0 ? (
        <div className="text-sm text-gray-500">
          No urgent customer follow-up suggestions right now.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSuggestions.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/customers/${item.customerId}/dashboard`}
                    className="font-semibold hover:text-blue-700 hover:underline"
                  >
                    {item.customerName}
                  </Link>

                  <div className="text-sm text-gray-600 mt-1">
                    {item.reason}
                  </div>
                </div>

                <span
                  className={`px-2 py-1 text-xs rounded-full border capitalize ${urgencyClass(
                    item.urgency
                  )}`}
                >
                  {item.urgency}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {item.followUpId ? (
                  <Link
                    href={`/sales-followups/${item.followUpId}/edit`}
                    className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-sm"
                  >
                    View Follow Up
                  </Link>
                ) : (
                  <Link
                    href={followUpHref(item)}
                    className="px-3 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-sm"
                  >
                    Create Follow Up
                  </Link>
                )}

                <Link
                  href={`/customers/${item.customerId}/email`}
                  className="px-3 py-2 rounded-lg bg-gray-100 border hover:bg-gray-200 text-sm"
                >
                  Generate Email
                </Link>

                <Link
                  href={`/customers/${item.customerId}/dashboard`}
                  className="px-3 py-2 rounded-lg bg-gray-100 border hover:bg-gray-200 text-sm"
                >
                  Customer Dashboard
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}