export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  searchParams: Promise<{
    days?: string;
    type?: string;
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
  updated_at: string | null;
};

type EmailLog = {
  customer_id: string | null;
  sent_at: string | null;
  created_at: string | null;
};

function clean(value: any) {
  return String(value || "").trim();
}

function daysAgo(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diff = Date.now() - date.getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

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

function latestEmailDate(logs: EmailLog[]) {
  const sorted = logs
    .map((item) => item.sent_at || item.created_at)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return sorted[0]?.toISOString() || null;
}

export default async function NoContactCustomersPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const days = Number(clean(params.days) || "30");
  const type = clean(params.type);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customersData, error: customersError } = await supabase
    .from("company_profiles")
    .select(
      "id, company_name, contact_person, email, phone, city, country, updated_at"
    )
    .eq("is_active", true)
    .order("company_name", { ascending: true });

  const { data: emailLogsData, error: emailsError } = await supabase
    .from("customer_email_logs")
    .select("customer_id, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const customers = (customersData || []) as Customer[];
  const emailLogs = (emailLogsData || []) as EmailLog[];

  const emailsByCustomer = new Map<string, EmailLog[]>();

  for (const log of emailLogs) {
    const customerId = clean(log.customer_id);
    if (!customerId) continue;

    const list = emailsByCustomer.get(customerId) || [];
    list.push(log);
    emailsByCustomer.set(customerId, list);
  }

  const rows = customers
    .map((customer) => {
      const lastEmail = latestEmailDate(emailsByCustomer.get(customer.id) || []);
      const age = daysAgo(lastEmail);

      return {
        customer,
        lastEmail,
        age,
      };
    })
    .filter((row) => {
      if (type === "never") return !row.lastEmail;

      return row.age !== null && row.age >= days;
    })
    .sort((a, b) => {
      const ageA = a.age ?? 99999;
      const ageB = b.age ?? 99999;

      return ageB - ageA;
    });

  const title =
    type === "never"
      ? "Customers Never Emailed"
      : `Customers Not Emailed In ${days}+ Days`;

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customers who may need outreach based on email history.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Dashboard
          </Link>

          <Link
            href="/customers"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Customers
          </Link>
        </div>
      </div>

      {(customersError || emailsError) && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {customersError?.message || emailsError?.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/customers/no-contact?days=30"
          className="bg-white border rounded-xl p-4 hover:bg-blue-50 hover:border-blue-200"
        >
          <div className="text-2xl font-bold">30+</div>
          <div className="text-sm text-gray-500">No Email 30+ Days</div>
        </Link>

        <Link
          href="/customers/no-contact?days=60"
          className="bg-white border rounded-xl p-4 hover:bg-red-50 hover:border-red-200"
        >
          <div className="text-2xl font-bold">60+</div>
          <div className="text-sm text-gray-500">No Email 60+ Days</div>
        </Link>

        <Link
          href="/customers/no-contact?type=never"
          className="bg-white border rounded-xl p-4 hover:bg-yellow-50 hover:border-yellow-200"
        >
          <div className="text-2xl font-bold">Never</div>
          <div className="text-sm text-gray-500">Never Emailed</div>
        </Link>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            {rows.length} Customer(s) Found
          </h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">Contact</th>
              <th className="p-3 border text-left">Email</th>
              <th className="p-3 border text-left">Location</th>
              <th className="p-3 border text-left">Last Email Sent</th>
              <th className="p-3 border text-left">Days Since Email</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No customers found for this filter.
                </td>
              </tr>
            ) : (
              rows.map(({ customer, lastEmail, age }) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="p-3 border font-medium">
                    {customer.company_name || "Customer"}
                  </td>

                  <td className="p-3 border">
                    {customer.contact_person || ""}
                  </td>

                  <td className="p-3 border">{customer.email || ""}</td>

                  <td className="p-3 border">
                    {[customer.city, customer.country]
                      .filter(Boolean)
                      .join(", ")}
                  </td>

                  <td className="p-3 border whitespace-nowrap">
                    {formatDateTime(lastEmail)}
                  </td>

                  <td className="p-3 border">
                    {age === null ? "Never" : age}
                  </td>

                  <td className="p-3 border">
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        href={`/customers/${customer.id}/dashboard`}
                        className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                      >
                        Dashboard
                      </Link>

                      <Link
                        href={`/customers/${customer.id}/email`}
                        className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      >
                        Generate Email
                      </Link>

                      <Link
                        href="/sales-followups/new"
                        className="px-4 py-2 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100"
                      >
                        Create Follow Up
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}