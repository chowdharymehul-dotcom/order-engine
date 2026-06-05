export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  updated_at: string | null;
};

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

export default async function CustomersPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      "id, company_name, contact_person, email, phone, city, country, notes, updated_at"
    )
    .eq("is_active", true)
    .order("company_name", { ascending: true });

  const customers = (data || []) as Customer[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Customers</h1>

        <div className="flex gap-3">
          <Link
            href="/customers/new"
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
          >
            + Add Customer
          </Link>

          <Link href="/orders" className="px-4 py-2 border rounded-lg">
            Orders
          </Link>

          <Link href="/oc-templates" className="px-4 py-2 border rounded-lg">
            OC Templates
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error.message}
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">Contact</th>
              <th className="p-3 border text-left">Email</th>
              <th className="p-3 border text-left">Phone</th>
              <th className="p-3 border text-left">City</th>
              <th className="p-3 border text-left">Country</th>
              <th className="p-3 border text-left">Updated</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No customers found
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="p-3 border font-medium">
                    {customer.company_name || ""}
                  </td>

                  <td className="p-3 border">
                    {customer.contact_person || ""}
                  </td>

                  <td className="p-3 border">{customer.email || ""}</td>

                  <td className="p-3 border">{customer.phone || ""}</td>

                  <td className="p-3 border">{customer.city || ""}</td>

                  <td className="p-3 border">{customer.country || ""}</td>

                  <td className="p-3 border whitespace-nowrap">
                    {formatDateTime(customer.updated_at)}
                  </td>

                  <td className="p-3 border">
                    <div className="flex gap-2">
                      <Link
                        href={`/customers/${customer.id}/edit`}
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                      >
                        Edit
                      </Link>

                      <form action="/api/customers/delete" method="POST">
                        <input
                          type="hidden"
                          name="id"
                          value={customer.id}
                        />

                        <button className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
                          Delete
                        </button>
                      </form>
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