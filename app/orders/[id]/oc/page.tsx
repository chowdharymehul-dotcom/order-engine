export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateCustomer } from "@/lib/customerAutoLink";
import ReviewOcItemsEditor from "./ReviewOcItemsEditor";

type Customer = {
  id: string;
  company_name: string | null;
  email: string | null;
};

type OrderItem = {
  id: string;
  customer: string | null;
  customer_id: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  unit_price: number | null;
  currency: string | null;
  custom_fields: Record<string, string> | null;
  delivery_date: string | null;
  external_message_id: string | null;
};

type OrderConfirmation = {
  id: string;
  order_item_id: string | null;
  order_item_ids: string[] | null;
  po_number: string | null;
  delivery_date: string | null;
  pdf_url: string | null;
};

type OCPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    saved?: string;
    generated?: string;
    error?: string;
  }>;
};

function value(input: string | number | null | undefined) {
  if (input === null || input === undefined) return "";
  return String(input);
}

function defaultDeliveryDate(existingDate?: string | null) {
  if (existingDate) return existingDate;

  const date = new Date();
  date.setDate(date.getDate() + 30);

  return date.toISOString().slice(0, 10);
}

export default async function OrderOCPage({ params, searchParams }: OCPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: primaryData, error: primaryError } = await supabase
    .from("order_items")
    .select(
      "id, customer, customer_id, po_number, sku, quantity, notes, unit_price, currency, custom_fields, delivery_date, external_message_id"
    )
    .eq("id", id)
    .maybeSingle();

  const primaryOrder = (primaryData || null) as OrderItem | null;

  if (primaryError || !primaryOrder) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Create Manual Order / OC</h1>

        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {primaryError?.message || "Order not found"}
        </div>

        <Link href="/orders" className="px-4 py-2 border rounded-lg">
          Back to Orders
        </Link>
      </div>
    );
  }

  const { data: ocData } = await supabase
    .from("order_confirmations")
    .select("id, order_item_id, order_item_ids, po_number, delivery_date, pdf_url")
    .or(`order_item_id.eq.${id},order_item_ids.cs.{${id}}`)
    .maybeSingle();

  const oc = (ocData || null) as OrderConfirmation | null;

  const orderItemIds =
    oc?.order_item_ids && oc.order_item_ids.length > 0
      ? oc.order_item_ids
      : [primaryOrder.id];

  const { data: linesData } = await supabase
    .from("order_items")
    .select(
      "id, customer, customer_id, po_number, sku, quantity, notes, unit_price, currency, custom_fields, delivery_date, external_message_id"
    )
    .in("id", orderItemIds)
    .is("deleted_at", null);

  const orderLines = ((linesData || []) as OrderItem[]).sort(
    (a, b) => orderItemIds.indexOf(a.id) - orderItemIds.indexOf(b.id)
  );

  const { data: customersData } = await supabase
    .from("company_profiles")
    .select("id, company_name, email")
    .eq("is_active", true)
    .order("company_name", { ascending: true });

  let customers = (customersData || []) as Customer[];

const matchedCustomer = customers.find(
  (customer) =>
    value(customer.company_name).toLowerCase() ===
    value(primaryOrder.customer).toLowerCase()
);

let selectedCustomerId =
  primaryOrder.customer_id || matchedCustomer?.id || "";

if (!selectedCustomerId && primaryOrder.customer) {
  const { data: email } = await supabase
  .from("emails")
  .select("from_email")
  .eq("external_message_id", primaryOrder.external_message_id)
  .maybeSingle();

const customer = await getOrCreateCustomer({
  supabase,
  fromEmail: email?.from_email || null,
  extractedCustomerName: primaryOrder.customer,
});

  selectedCustomerId = customer.customer_id || "";

if (
  customer.customer_id &&
  !customers.some((existingCustomer) => existingCustomer.id === customer.customer_id)
) {
  customers = [
    ...customers,
    {
      id: customer.customer_id,
      company_name: customer.customer_name,
      email: null,
    },
  ];
}
}

  const initialItems = orderLines.map((line) => ({
    id: line.id,
    sku: line.sku || "",
    quantity: line.quantity ?? 1,
    unitPrice: line.unit_price ?? "",
    currency: line.currency || "USD",
    customFields: Object.entries(line.custom_fields || {}).map(
      ([name, fieldValue]) => ({
        name,
        value: fieldValue,
      })
    ),
  }));

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

      {query?.saved === "1" && (
        <div className="p-4 rounded-lg bg-green-50 text-green-700 border border-green-200">
          Order saved successfully.
        </div>
      )}

      {query?.generated === "1" && (
        <div className="p-4 rounded-lg bg-green-50 text-green-700 border border-green-200">
          PDF generated successfully.
        </div>
      )}

      {query?.error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {decodeURIComponent(query.error)}
        </div>
      )}

      {!oc && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          No OC draft exists. Go back and click Generate OC.
        </div>
      )}

      {oc && (
        <form
          id="manual-order-form"
          action="/api/orders/save-oc"
          method="POST"
          className="space-y-6"
        >
          <input type="hidden" name="oc_id" value={oc.id} />
          <input type="hidden" name="order_item_id" value={primaryOrder.id} />

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Customer Information</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Customer</label>

              <select
                name="customer_id"
                required
                defaultValue={selectedCustomerId}
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
            <h2 className="text-xl font-semibold">Order Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  PO Number
                </label>

                <input
                  name="po_number"
                  defaultValue={value(oc.po_number || primaryOrder.po_number)}
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
                  defaultValue={defaultDeliveryDate(
                    oc.delivery_date || primaryOrder.delivery_date
                  )}
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
                defaultValue={value(primaryOrder.notes)}
                placeholder="Overall order notes..."
                className="w-full border rounded-lg px-4 py-3"
              />
            </div>
          </div>

          <ReviewOcItemsEditor initialItems={initialItems} />

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

            {oc.pdf_url && (
              <a
                href={oc.pdf_url}
                target="_blank"
                className="px-6 py-3 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
              >
                View PDF
              </a>
            )}
          </div>
        </form>
      )}
    </div>
  );
}