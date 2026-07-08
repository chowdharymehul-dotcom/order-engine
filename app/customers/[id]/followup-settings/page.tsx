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
  auto_followup_enabled: boolean | null;
  next_auto_followup_date: string | null;
  default_followup_priority: string | null;
  auto_followup_notes: string | null;
};

function dateInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

export default async function CustomerFollowUpSettingsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      "id, company_name, contact_person, email, auto_followup_enabled, next_auto_followup_date, default_followup_priority, auto_followup_notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Follow-Up Settings</h1>

        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const customer = data as Customer;
  const isActive = customer.auto_followup_enabled !== false;

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Follow-Up Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto follow-up is active by default. Deactivate only when this
            customer should not be reminded.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/customers/${customer.id}/dashboard`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Customer Dashboard
          </Link>

          <Link
            href="/customers"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Back to Customers
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-2">
        <div className="text-sm text-gray-500">Customer</div>
        <div className="text-2xl font-semibold">
          {customer.company_name || "Customer"}
        </div>
        <div className="text-sm text-gray-500">
          {[customer.contact_person, customer.email].filter(Boolean).join(" · ")}
        </div>
      </div>

      <form
        action="/api/customers/followup-settings"
        method="POST"
        className="bg-white border rounded-xl p-6 space-y-5"
      >
        <input type="hidden" name="customer_id" value={customer.id} />

        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="auto_followup_enabled"
              defaultChecked={isActive}
              className="mt-1"
            />

            <span>
              <span className="block font-medium text-blue-900">
                Auto follow-up active
              </span>
              <span className="block text-sm text-blue-700 mt-1">
                Keep this enabled unless you do not want Order Engine to create
                reminders for this customer.
              </span>
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Next Follow-Up Date
          </label>
          <input
            name="next_auto_followup_date"
            type="date"
            defaultValue={dateInputValue(customer.next_auto_followup_date)}
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            Use the calendar to choose the exact date for this customer.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Default Priority
          </label>
          <select
            name="default_followup_priority"
            defaultValue={customer.default_followup_priority || "medium"}
            className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Follow-Up Notes
          </label>
          <textarea
            name="auto_followup_notes"
            rows={5}
            defaultValue={customer.auto_followup_notes || ""}
            placeholder="Example: Follow up before seasonal buying period, call buyer directly, ask for sample feedback..."
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <button className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm">
          Save Follow-Up Settings
        </button>
      </form>
    </div>
  );
}