export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  params: Promise<{
    id: string;
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
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  meta: string;
  date: string | null;
  href?: string;
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

function badgeClass(type: string) {
  if (type === "email") return "bg-blue-50 text-blue-700 border-blue-200";
  if (type === "order") return "bg-green-50 text-green-700 border-green-200";
  if (type === "enquiry")
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (type === "sales-follow-up")
    return "bg-purple-50 text-purple-700 border-purple-200";
  if (type === "customer")
    return "bg-gray-50 text-gray-700 border-gray-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

function tomorrowDateInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 7);

  return date.toISOString().slice(0, 10);
}

export default async function CustomerTimelinePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customerData, error: customerError } = await supabase
    .from("company_profiles")
    .select(
      "id, company_name, contact_person, email, phone, city, country, notes, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (customerError) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Customer Timeline</h1>
        <p className="text-red-600">
          Error loading customer: {customerError.message}
        </p>
      </div>
    );
  }

  if (!customerData) {
    notFound();
  }

  const customer = customerData as Customer;
  const customerName = clean(customer.company_name);

  const { data: emailLogsData } = await supabase
    .from("customer_email_logs")
    .select(
      "id, subject, recipient_email, provider, send_type, status, created_at, sent_at"
    )
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: orderItemsData } = await supabase
    .from("order_items")
    .select(
      "id, action, customer, sku, quantity, notes, status, email_subject, created_at, updated_at"
    )
    .ilike("customer", customerName || "")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: followUpsData } = await supabase
    .from("customer_followups")
    .select(
      "id, title, notes, due_date, status, priority, created_at, completed_at"
    )
    .eq("customer_id", id)
    .order("due_date", { ascending: true })
    .limit(100);

  const timeline: TimelineItem[] = [];

  for (const email of emailLogsData || []) {
    timeline.push({
      id: `email-${email.id}`,
      type: "email",
      title: `Email ${email.status || ""}`,
      description: email.subject || "Customer email",
      meta: [
        email.recipient_email ? `To: ${email.recipient_email}` : "",
        email.provider ? `Provider: ${email.provider}` : "",
        email.send_type ? `Type: ${email.send_type}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      date: email.sent_at || email.created_at,
      href: `/sent-emails/${email.id}`,
    });
  }

  for (const item of orderItemsData || []) {
    const action = clean(item.action).toLowerCase();

    timeline.push({
      id: `order-${item.id}`,
      type:
        action.includes("enquiry") || action.includes("follow")
          ? "enquiry"
          : "order",
      title: item.action || "Order Activity",
      description: [
        item.sku ? `SKU: ${item.sku}` : "",
        item.quantity ? `Qty: ${item.quantity}` : "",
        item.notes ? item.notes : "",
      ]
        .filter(Boolean)
        .join(" · "),
      meta: [
        item.status ? `Status: ${item.status}` : "",
        item.email_subject ? `Subject: ${item.email_subject}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      date: item.updated_at || item.created_at,
      href: `/orders/${item.id}`,
    });
  }

  for (const followUp of followUpsData || []) {
    timeline.push({
      id: `sales-follow-up-${followUp.id}`,
      type: "sales-follow-up",
      title: followUp.title || "Sales Follow Up",
      description: followUp.notes || "Sales follow-up reminder",
      meta: [
        followUp.status ? `Status: ${followUp.status}` : "",
        followUp.priority ? `Priority: ${followUp.priority}` : "",
        followUp.completed_at
          ? `Completed: ${formatDateTime(followUp.completed_at)}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      date: followUp.due_date || followUp.created_at,
      href: "/sales-followups",
    });
  }

  if (customer.updated_at) {
    timeline.push({
      id: `customer-updated-${customer.id}`,
      type: "customer",
      title: "Customer Profile Updated",
      description: customer.notes || "Customer information was updated.",
      meta: "",
      date: customer.updated_at,
      href: `/customers/${customer.id}/edit`,
    });
  }

  timeline.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;

    return dateB - dateA;
  });

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            All customer emails, orders, enquiries, sales follow-ups and profile
            activity in one place.
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

          <Link
            href={`/customers/${customer.id}/email`}
            className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
          >
            Send Email
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Create Sales Follow Up</h2>
          <p className="text-sm text-gray-500 mt-1">
            Set a custom follow-up date and priority based on this customer's
            relationship and response pattern.
          </p>
        </div>

        <form
          action="/api/customer-followups/create"
          method="POST"
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <input type="hidden" name="customer_id" value={customer.id} />
          <input
            type="hidden"
            name="redirect_to"
            value={`/customers/${customer.id}/timeline`}
          />

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              name="title"
              defaultValue="Follow up with customer"
              className="w-full border rounded-lg px-4 py-3 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <input
              name="due_date"
              type="date"
              defaultValue={tomorrowDateInputValue()}
              className="w-full border rounded-lg px-4 py-3 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              name="priority"
              defaultValue="medium"
              className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Example: Follow up after quotation, ask if buyer reviewed samples, check if they need updated pricing..."
              className="w-full border rounded-lg px-4 py-3 text-sm"
            />
          </div>

          <div className="md:col-span-4">
            <button className="px-5 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm">
              Create Sales Follow Up
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-5">
        <h2 className="text-xl font-semibold">Timeline</h2>

        {timeline.length === 0 ? (
          <div className="p-6 text-center text-gray-500 border rounded-lg">
            No timeline activity found for this customer.
          </div>
        ) : (
          <div className="space-y-4">
            {timeline.map((item) => (
              <div key={item.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-5">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full border text-xs capitalize ${badgeClass(
                        item.type
                      )}`}
                    >
                      {item.type.replaceAll("-", " ")}
                    </span>

                    <div className="font-semibold">{item.title}</div>

                    {item.description && (
                      <div className="text-sm text-gray-700">
                        {item.description}
                      </div>
                    )}

                    {item.meta && (
                      <div className="text-xs text-gray-500">{item.meta}</div>
                    )}
                  </div>

                  <div className="text-right space-y-2">
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                      {formatDateTime(item.date)}
                    </div>

                    {item.href && (
                      <Link
                        href={item.href}
                        className="inline-flex px-3 py-1 rounded-lg bg-gray-100 border text-xs hover:bg-gray-200"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}