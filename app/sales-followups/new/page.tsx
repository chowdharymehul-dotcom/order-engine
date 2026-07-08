export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  searchParams: Promise<{
    customer_id?: string;
    title?: string;
    priority?: string;
    notes?: string;
  }>;
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

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function normalizePriority(value: string) {
  const priority = clean(value).toLowerCase();

  if (priority === "low") return "low";
  if (priority === "high") return "high";

  return "medium";
}

export default async function NewSalesFollowUpPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const selectedCustomerId = clean(params.customer_id);
  const defaultTitle = clean(params.title) || "Follow up with customer";
  const defaultPriority = normalizePriority(clean(params.priority));
  const defaultNotes = clean(params.notes);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("company_profiles")
    .select("id, company_name, contact_person, email")
    .eq("is_active", true)
    .order("company_name", { ascending: true });

  const customers = (data || []) as Customer[];
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">New Sales Follow Up</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manually create a customer follow-up reminder.
          </p>
        </div>

        <Link
          href="/sales-followups"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Back to Sales Follow Ups
        </Link>
      </div>

      {selectedCustomer && (
        <div className="p-4 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
          Creating follow up for{" "}
          <span className="font-semibold">
            {selectedCustomer.company_name || "Customer"}
          </span>
          .
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      )}

      <form
        action="/api/customer-followups/create"
        method="POST"
        className="bg-white border rounded-xl p-6 space-y-5"
      >
        <input type="hidden" name="redirect_to" value="/sales-followups" />

        <div>
          <label className="block text-sm font-medium mb-1">Customer</label>
          <select
            name="customer_id"
            required
            defaultValue={selectedCustomerId}
            className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.company_name || "Unnamed Customer"}
                {customer.email ? ` — ${customer.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            name="title"
            required
            defaultValue={defaultTitle}
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Due On</label>
          <input
            name="due_date"
            type="date"
            required
            defaultValue={defaultDueDate()}
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <select
            name="priority"
            defaultValue={defaultPriority}
            className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            name="notes"
            rows={5}
            defaultValue={defaultNotes}
            placeholder="Add context for this follow-up..."
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <button className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm">
          Create Sales Follow Up
        </button>
      </form>
    </div>
  );
}