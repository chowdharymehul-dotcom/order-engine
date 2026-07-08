export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    followupSettingsSaved?: string;
  }>;
};

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  updated_at: string | null;
  auto_followup_enabled: boolean | null;
  next_auto_followup_date: string | null;
  default_followup_priority: string | null;
  auto_followup_notes: string | null;
};

type EmailLog = {
  id: string;
  subject: string | null;
  recipient_email: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type FollowUp = {
  id: string;
  title: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
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

function latestDate(values: (string | null | undefined)[]) {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return dates[0]?.toISOString() || null;
}

function priorityClass(priority: string | null) {
  if (priority === "high") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "low") return "bg-green-50 text-green-700 border-green-200";
  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function autoFollowupStatusClass(enabled: boolean) {
  if (enabled) return "bg-green-50 text-green-700 border-green-200";

  return "bg-red-50 text-red-700 border-red-200";
}

export default async function CustomerDashboardPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customerData, error: customerError } = await supabase
    .from("company_profiles")
    .select(
      "id, company_name, contact_person, email, phone, city, country, website, notes, updated_at, auto_followup_enabled, next_auto_followup_date, default_followup_priority, auto_followup_notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (customerError) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Customer Dashboard</h1>
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {customerError.message}
        </div>
      </div>
    );
  }

  if (!customerData) {
    notFound();
  }

  const customer = customerData as Customer;
  const customerName = clean(customer.company_name);
  const autoFollowupActive = customer.auto_followup_enabled !== false;

  const { data: emailLogsData } = await supabase
    .from("customer_email_logs")
    .select("id, subject, recipient_email, status, sent_at, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: followUpsData } = await supabase
    .from("customer_followups")
    .select("id, title, due_date, priority, status")
    .eq("customer_id", customer.id)
    .eq("is_active", true)
    .order("due_date", { ascending: true })
    .limit(20);

  const { data: orderItemsData } = await supabase
    .from("order_items")
    .select("id, action, customer, sku, quantity, status, created_at")
    .ilike("customer", customerName || "")
    .order("created_at", { ascending: false })
    .limit(20);

  const emails = (emailLogsData || []) as EmailLog[];
  const followUps = (followUpsData || []) as FollowUp[];
  const orderItems = (orderItemsData || []) as OrderItem[];

  const openFollowUps = followUps.filter((item) => item.status === "pending");
  const openOrders = orderItems.filter((item) => {
    const action = clean(item.action).toLowerCase();
    const status = clean(item.status).toLowerCase();

    return (
      !action.includes("enquiry") &&
      !action.includes("follow") &&
      status !== "done" &&
      status !== "cancelled"
    );
  });

  const openEnquiries = orderItems.filter((item) => {
    const action = clean(item.action).toLowerCase();
    const status = clean(item.status).toLowerCase();

    return (
      (action.includes("enquiry") || action.includes("follow")) &&
      status !== "done" &&
      status !== "closed" &&
      status !== "replied"
    );
  });

  const lastEmailDate = latestDate(
    emails.map((item) => item.sent_at || item.created_at)
  );

  const lastOrderDate = latestDate(orderItems.map((item) => item.created_at));

  const lastContactDate = latestDate([
    lastEmailDate,
    lastOrderDate,
    customer.updated_at,
  ]);

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customer summary, activity, follow-ups and quick actions.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/customers/${customer.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit Customer
          </Link>

          <Link
            href="/customers"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Back to Customers
          </Link>
        </div>
      </div>

      {query.followupSettingsSaved && (
        <div className="p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
          Follow-up settings saved.
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-2xl font-semibold">
              {customer.company_name || "Customer"}
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              {[customer.city, customer.country].filter(Boolean).join(", ")}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/customers/${customer.id}/email`}
              className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            >
              Send Email
            </Link>

            <Link
              href="/sales-followups/new"
              className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            >
              New Follow Up
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Contact</span>
            <div className="font-medium">{customer.contact_person || ""}</div>
          </div>

          <div>
            <span className="text-gray-500">Email</span>
            <div className="font-medium">{customer.email || ""}</div>
          </div>

          <div>
            <span className="text-gray-500">Phone</span>
            <div className="font-medium">{customer.phone || ""}</div>
          </div>

          <div>
            <span className="text-gray-500">Website</span>
            <div className="font-medium">{customer.website || ""}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold">Auto Follow-Up Settings</h2>
            <p className="text-sm text-gray-500 mt-1">
              Auto follow-up is active by default. Deactivate only for customers
              who should not be reminded.
            </p>
          </div>

          <Link
            href={`/customers/${customer.id}/followup-settings`}
            className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
          >
            Edit Settings
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Status</span>
            <div className="mt-1">
              <span
                className={`inline-flex px-3 py-1 rounded-full border text-xs ${autoFollowupStatusClass(
                  autoFollowupActive
                )}`}
              >
                {autoFollowupActive ? "Active" : "Deactivated"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-gray-500">Next Follow-Up Date</span>
            <div className="font-medium mt-1">
              {formatDate(customer.next_auto_followup_date) || "Not set"}
            </div>
          </div>

          <div>
            <span className="text-gray-500">Default Priority</span>
            <div className="mt-1">
              <span
                className={`inline-flex px-3 py-1 rounded-full border text-xs capitalize ${priorityClass(
                  customer.default_followup_priority || "medium"
                )}`}
              >
                {customer.default_followup_priority || "medium"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-gray-500">Notes</span>
            <div className="font-medium mt-1 line-clamp-2">
              {customer.auto_followup_notes || "No notes"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href={`/customers/${customer.id}/timeline`}
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          <div className="text-2xl font-bold">{openOrders.length}</div>
          <div className="text-sm text-gray-500">Open Orders</div>
        </Link>

        <Link
          href="/enquiries-follow-up"
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          <div className="text-2xl font-bold">{openEnquiries.length}</div>
          <div className="text-sm text-gray-500">Open Enquiries</div>
        </Link>

        <Link
          href="/sales-followups?status=pending"
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          <div className="text-2xl font-bold">{openFollowUps.length}</div>
          <div className="text-sm text-gray-500">Open Follow Ups</div>
        </Link>

        <Link
          href="/sent-emails"
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          <div className="text-2xl font-bold">{emails.length}</div>
          <div className="text-sm text-gray-500">Emails Sent</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-500">Last Email Sent</div>
          <div className="font-medium mt-1">{formatDateTime(lastEmailDate)}</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-500">Last Order Date</div>
          <div className="font-medium mt-1">{formatDateTime(lastOrderDate)}</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-sm text-gray-500">Last Contact Date</div>
          <div className="font-medium mt-1">
            {formatDateTime(lastContactDate)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Open Follow Ups</h2>

            <Link
              href="/sales-followups?status=pending"
              className="text-sm text-blue-600 hover:underline"
            >
              View All
            </Link>
          </div>

          {openFollowUps.length === 0 ? (
            <div className="text-sm text-gray-500">No open follow ups.</div>
          ) : (
            <div className="space-y-3">
              {openFollowUps.slice(0, 5).map((item) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/sales-followups/${item.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {item.title || "Sales Follow Up"}
                      </Link>

                      <div className="text-xs text-gray-500 mt-1">
                        Due On: {formatDateTime(item.due_date)}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-1 text-xs rounded-full border capitalize ${priorityClass(
                        item.priority
                      )}`}
                    >
                      {item.priority || "medium"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Emails</h2>

            <Link
              href="/sent-emails"
              className="text-sm text-blue-600 hover:underline"
            >
              View All
            </Link>
          </div>

          {emails.length === 0 ? (
            <div className="text-sm text-gray-500">No emails sent yet.</div>
          ) : (
            <div className="space-y-3">
              {emails.slice(0, 5).map((item) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <Link
                    href={`/sent-emails/${item.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.subject || "Sent Email"}
                  </Link>

                  <div className="text-xs text-gray-500 mt-1">
                    {formatDateTime(item.sent_at || item.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {customer.notes && (
        <div className="bg-white border rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold">Customer Notes</h2>
          <div className="whitespace-pre-wrap text-sm text-gray-700">
            {customer.notes}
          </div>
        </div>
      )}
    </div>
  );
}