export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type OrderItem = {
  id: string;
  action: string | null;
  customer: string | null;
  customer_id: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  email_subject: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;
  notes: string | null;
};

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
};

type OrderConfirmation = {
  id: string;
  order_item_id: string | null;
  order_item_ids: string[] | null;
  customer_id: string | null;
  seller_profile_id: string | null;
  oc_number: string | null;
  oc_date: string | null;
  po_number: string | null;
  delivery_date: string | null;
  payment_terms: string | null;
  shipment_terms: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  pdf_url: string | null;
  status: string | null;
};

type OCPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function value(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400";

const textareaClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 min-h-24 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400";

export default async function OrderOCPage({ params }: OCPageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: orderData, error: orderError } = await supabase
    .from("order_items")
    .select(
      "id, action, customer, customer_id, po_number, sku, quantity, notes, status, email_subject"
    )
    .eq("id", id)
    .maybeSingle();

  const primaryOrder = (orderData || null) as OrderItem | null;

  if (orderError || !primaryOrder) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Order Confirmation</h1>

        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {orderError?.message || "Order not found"}
        </div>

        <Link href="/orders" className="px-4 py-2 border rounded-lg">
          Back to Orders
        </Link>
      </div>
    );
  }

  const { data: ocData } = await supabase
    .from("order_confirmations")
    .select("*")
    .or(`order_item_id.eq.${id},order_item_ids.cs.{${id}}`)
    .maybeSingle();

  const oc = (ocData || null) as OrderConfirmation | null;

  const orderItemIds =
    oc?.order_item_ids && oc.order_item_ids.length > 0
      ? oc.order_item_ids
      : [primaryOrder.id];

  const { data: orderLinesData } = await supabase
    .from("order_items")
    .select(
      "id, action, customer, customer_id, po_number, sku, quantity, notes, status, email_subject"
    )
    .in("id", orderItemIds);

  const orderLines = ((orderLinesData || []) as OrderItem[]).sort(
    (a, b) => orderItemIds.indexOf(a.id) - orderItemIds.indexOf(b.id)
  );

  const customerId = oc?.customer_id || primaryOrder.customer_id;

  const { data: customerData } = customerId
    ? await supabase
        .from("company_profiles")
        .select(
          "id, company_name, contact_person, email, phone, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number, notes"
        )
        .eq("id", customerId)
        .maybeSingle()
    : { data: null };

  const customer = (customerData || null) as Customer | null;

  const { data: sellersData } = await supabase
    .from("seller_profiles")
    .select("id, profile_name, company_name")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true });

  const sellerProfiles = (sellersData || []) as SellerProfile[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Confirmation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and edit OC draft before PDF generation.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/orders/${primaryOrder.id}`}
            className="px-4 py-2 border rounded-lg text-gray-900 hover:bg-gray-100"
          >
            Order Details
          </Link>

          <Link
            href="/orders"
            className="px-4 py-2 border rounded-lg text-gray-900 hover:bg-gray-100"
          >
            Back to Orders
          </Link>
        </div>
      </div>

      {!oc && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          No OC draft exists for this order yet. Go back to Orders and click
          Generate OC.
        </div>
      )}

      {oc && (
        <form action="/api/orders/save-oc" method="POST" className="space-y-8">
          <input type="hidden" name="order_item_id" value={primaryOrder.id} />
          <input type="hidden" name="oc_id" value={oc.id} />

          {orderItemIds.map((orderItemId) => (
            <input
              key={orderItemId}
              type="hidden"
              name="order_item_ids"
              value={orderItemId}
            />
          ))}

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">OC Status</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Current Status</div>
                <div className="font-semibold">{oc.status || "Draft"}</div>
              </div>

              <div>
                <div className="text-gray-500">OC Number</div>
                <div className="font-semibold">{oc.oc_number || ""}</div>
              </div>

              <div>
                <div className="text-gray-500">PO Number</div>
                <div className="font-semibold">
                  {oc.po_number || primaryOrder.po_number || ""}
                </div>
              </div>

              <div>
                <div className="text-gray-500">PDF</div>
                {oc.pdf_url ? (
                  <a
                    href={oc.pdf_url}
                    target="_blank"
                    className="text-blue-600 underline"
                  >
                    View PDF
                  </a>
                ) : (
                  <span className="text-gray-400">Not generated</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white border rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold">Buyer Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-gray-500 mb-1">Customer</label>
                  <input
                    name="buyer_company_name"
                    defaultValue={value(
                      customer?.company_name || primaryOrder.customer
                    )}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">
                    Contact Person
                  </label>
                  <input
                    name="buyer_contact_person"
                    defaultValue={value(customer?.contact_person)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Email</label>
                  <input
                    name="buyer_email"
                    defaultValue={value(customer?.email)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Phone</label>
                  <input
                    name="buyer_phone"
                    defaultValue={value(customer?.phone)}
                    className={inputClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-500 mb-1">Address</label>
                  <textarea
                    name="buyer_address"
                    defaultValue={[
                      customer?.address_line_1,
                      customer?.address_line_2,
                      customer?.city,
                      customer?.state,
                      customer?.country,
                      customer?.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    className={textareaClass}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-xl p-6 space-y-4">
              <h2 className="text-xl font-semibold">Seller Information</h2>

              <div>
                <label className="block text-gray-500 mb-1 text-sm">
                  Seller Profile
                </label>

                <select
                  name="seller_profile_id"
                  defaultValue={value(oc.seller_profile_id)}
                  className={inputClass}
                >
                  {sellerProfiles.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.profile_name || seller.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-sm text-gray-500">
                Seller company, tax, bank, logo and signature details will be
                pulled from the selected seller profile during PDF generation.
              </p>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">OC Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-gray-500 mb-1">OC Number</label>
                <input
                  name="oc_number"
                  defaultValue={value(oc.oc_number)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">OC Date</label>
                <input
                  name="oc_date"
                  type="date"
                  defaultValue={value(oc.oc_date)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">PO Number</label>
                <input
                  name="po_number"
                  defaultValue={value(oc.po_number || primaryOrder.po_number)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">
                  Delivery Date
                </label>
                <input
                  name="delivery_date"
                  type="date"
                  defaultValue={value(oc.delivery_date)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">
                  Payment Terms
                </label>
                <input
                  name="payment_terms"
                  defaultValue={value(oc.payment_terms)}
                  placeholder="e.g. 50% advance, balance before dispatch"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">
                  Shipment Terms
                </label>
                <input
                  name="shipment_terms"
                  defaultValue={value(oc.shipment_terms)}
                  placeholder="e.g. FOB, CIF, Ex-Works"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Order Lines</h2>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 border text-left">SKU</th>
                    <th className="p-3 border text-left">Quantity</th>
                    <th className="p-3 border text-left">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {orderLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-6 text-center text-gray-500"
                      >
                        No order lines found.
                      </td>
                    </tr>
                  ) : (
                    orderLines.map((line) => (
                      <tr key={line.id}>
                        <td className="p-3 border">{line.sku || ""}</td>
                        <td className="p-3 border">
                          {line.quantity ?? ""}
                        </td>
                        <td className="p-3 border">{line.notes || ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500">
              This OC includes {orderLines.length} SKU row
              {orderLines.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Notes</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <textarea
                name="internal_notes"
                placeholder="Internal notes"
                defaultValue={value(oc.internal_notes)}
                className={textareaClass}
              />

              <textarea
                name="customer_notes"
                placeholder="Customer notes shown on OC"
                defaultValue={value(oc.customer_notes)}
                className={textareaClass}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
              Save Changes
            </button>

            <button
              formAction="/api/orders/generate-oc-pdf"
              className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 border text-sm"
            >
              Generate PDF
            </button>

            {oc.pdf_url && (
              <a
                href={oc.pdf_url}
                target="_blank"
                className="px-6 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 border text-sm"
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