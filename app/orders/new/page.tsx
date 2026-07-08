export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import NewManualOrderItemsEditor from "./NewManualOrderItemsEditor";

type Customer = {
  id: string;
  company_name: string | null;
  email: string | null;
};

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
  is_default: boolean | null;
};

type PageProps = {
  searchParams?: Promise<{
    sellerProfileMissing?: string;
  }>;
};

function defaultDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);

  return date.toISOString().slice(0, 10);
}

export default async function NewManualOrderPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customersData } = await supabase
    .from("company_profiles")
    .select("id, company_name, email")
    .eq("is_active", true)
    .order("company_name", { ascending: true });

  const { data: sellersData } = await supabase
    .from("seller_profiles")
    .select("id, profile_name, company_name, is_default")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true });

  const customers = (customersData || []) as Customer[];
  const sellers = (sellersData || []) as SellerProfile[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Manual Order / OC</h1>

          <p className="text-sm text-gray-500 mt-1">
            Create multi-line manual orders received by phone, WhatsApp,
            meetings or manually.
          </p>
        </div>

        <Link
          href="/orders"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Back to Orders
        </Link>
      </div>

{params?.sellerProfileMissing === "1" && (
  <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
    Please select a Seller Profile before clicking Save + Generate OC.
  </div>
)}
      <form
        id="manual-order-form"
        action="/api/orders/create-manual"
        method="POST"
        className="space-y-6"
      >
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Customer Information</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Customer</label>

            <select
              name="customer_id"
              required
              className="w-full border rounded-lg px-4 py-3 bg-white"
            >
              <option value="">Select Customer</option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name || "Unnamed Customer"}
                  {customer.email ? ` — ${customer.email}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Seller Profile</h2>

          <p className="text-sm text-gray-500">
            Select the company profile whose approved OC template should be used
            when generating this manual order confirmation.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">
              Seller Profile
            </label>

            <select
              name="seller_profile_id"
              className="w-full border rounded-lg px-4 py-3 bg-white"
            >
              <option value="">Select Seller Profile for OC generation</option>

              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.profile_name || seller.company_name || "Seller Profile"}
                  {seller.company_name &&
                  seller.profile_name &&
                  seller.profile_name !== seller.company_name
                    ? ` — ${seller.company_name}`
                    : ""}
                  {seller.is_default ? " — Default" : ""}
                </option>
              ))}
            </select>

            <p className="text-xs text-gray-500 mt-2">
              Required when clicking Save + Generate OC.
            </p>
          </div>

          {sellers.length === 0 && (
            <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
              No active seller profiles found. Please create a seller profile
              before generating an OC.
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Order Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                PO Number
              </label>

              <input
                name="po_number"
                placeholder="Enter PO Number"
                className="w-full border rounded-lg px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Delivery Date
              </label>

              <input
                type="date"
                name="delivery_date"
                defaultValue={defaultDeliveryDate()}
                className="w-full border rounded-lg px-4 py-3"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Order Notes
            </label>

            <textarea
              name="notes"
              rows={4}
              placeholder="Overall order notes..."
              className="w-full border rounded-lg px-4 py-3"
            />
          </div>
        </div>

        <NewManualOrderItemsEditor />

        <div className="flex gap-3">
          <button
            type="submit"
            name="action_type"
            value="save"
            className="px-6 py-3 rounded-lg bg-gray-900 text-white"
          >
            Save Order
          </button>

          <button
            type="submit"
            name="action_type"
            value="generate_oc"
            className="px-6 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            Save + Generate OC
          </button>
        </div>
      </form>
    </div>
  );
}