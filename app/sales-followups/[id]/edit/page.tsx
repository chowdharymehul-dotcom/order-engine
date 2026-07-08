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

type FollowUp = {
  id: string;
  customer_id: string;
  title: string | null;
  notes: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
  email: string | null;
};

function dateInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

export default async function EditSalesFollowUpPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: followUpData, error } = await supabase
    .from("customer_followups")
    .select("id, customer_id, title, notes, due_date, priority, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Edit Sales Follow Up</h1>
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      </div>
    );
  }

  if (!followUpData) {
    notFound();
  }

  const followUp = followUpData as FollowUp;

  const { data: customerData } = await supabase
    .from("company_profiles")
    .select("id, company_name, email")
    .eq("id", followUp.customer_id)
    .maybeSingle();

  const customer = (customerData || null) as Customer | null;

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Sales Follow Up</h1>
          <p className="text-sm text-gray-500 mt-1">
            Update due date, priority, notes and status.
          </p>
        </div>

        <Link
          href="/sales-followups"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Back to Sales Follow Ups
        </Link>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-2">
        <div className="text-sm text-gray-500">Customer</div>
        <div className="text-xl font-semibold">
          {customer?.company_name || "Customer"}
        </div>
        <div className="text-sm text-gray-500">{customer?.email || ""}</div>
      </div>

      <form
        action="/api/customer-followups/update"
        method="POST"
        className="bg-white border rounded-xl p-6 space-y-5"
      >
        <input type="hidden" name="id" value={followUp.id} />

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            name="title"
            required
            defaultValue={followUp.title || "Follow up with customer"}
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Due On</label>
          <input
            name="due_date"
            type="date"
            required
            defaultValue={dateInputValue(followUp.due_date)}
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <select
            name="priority"
            defaultValue={followUp.priority || "medium"}
            className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            name="status"
            defaultValue={followUp.status || "pending"}
            className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
          >
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            name="notes"
            rows={5}
            defaultValue={followUp.notes || ""}
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <button className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm">
          Save Changes
        </button>
      </form>
    </div>
  );
}