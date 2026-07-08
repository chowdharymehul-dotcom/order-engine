export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SendResendOCButton from "@/components/order-confirmations/SendResendOCButton";

type OrderConfirmation = {
  id: string;
  order_item_id: string | null;
  order_item_ids: string[] | null;
  customer_id: string | null;
  oc_number: string | null;
  oc_date: string | null;
  po_number: string | null;
  delivery_date: string | null;
  final_oc_pdf_url: string | null;
  status: string | null;
  sent_at: string | null;
  recipient_email: string | null;
  created_at: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
  email: string | null;
};

type PageProps = {
  searchParams?: Promise<{
    sent?: string;
    status?: string;
    q?: string;
  }>;
};

function clean(value: any) {
  return String(value || "").trim();
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

function itemCount(oc: OrderConfirmation) {
  if (Array.isArray(oc.order_item_ids) && oc.order_item_ids.length > 0) {
    return oc.order_item_ids.length;
  }

  return oc.order_item_id ? 1 : 0;
}

function primaryOrderItemId(oc: OrderConfirmation) {
  if (oc.order_item_id) return oc.order_item_id;

  if (Array.isArray(oc.order_item_ids) && oc.order_item_ids.length > 0) {
    return oc.order_item_ids[0];
  }

  return "";
}

function finalStatus(oc: OrderConfirmation) {
  return clean(oc.status).toLowerCase() === "sent" ? "Sent" : "Ready to Send";
}

function statusClass(status: string) {
  if (status === "Sent") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function tabClass(active: boolean) {
  return `px-5 py-3 rounded-lg border text-sm font-medium transition ${
    active
      ? "bg-gray-100 border-gray-400 text-black"
      : "bg-white text-black hover:bg-gray-50"
  }`;
}

function matchesSearch(params: {
  oc: OrderConfirmation;
  customer: Customer | null;
  query: string;
}) {
  const { oc, customer, query } = params;

  if (!query) return true;

  const q = query.toLowerCase();

  const haystack = [
    oc.oc_number,
    oc.po_number,
    oc.recipient_email,
    customer?.company_name,
    customer?.email,
  ]
    .map(clean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export default async function OrderConfirmationsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const activeStatus = params?.status || "all";
  const searchQuery = clean(params?.q);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("order_confirmations")
    .select(
      "id, order_item_id, order_item_ids, customer_id, oc_number, oc_date, po_number, delivery_date, final_oc_pdf_url, status, sent_at, recipient_email, created_at"
    )
    .not("final_oc_pdf_url", "is", null)
    .order("created_at", { ascending: false });

  const confirmations = (data || []) as OrderConfirmation[];

  const customerIds = Array.from(
    new Set(confirmations.map((oc) => oc.customer_id).filter(Boolean))
  ) as string[];

  const { data: customersData } =
    customerIds.length > 0
      ? await supabase
          .from("company_profiles")
          .select("id, company_name, email")
          .in("id", customerIds)
      : { data: [] };

  const customers = (customersData || []) as Customer[];
  const customerById = new Map(
    customers.map((customer) => [customer.id, customer])
  );

  const filteredConfirmations = confirmations.filter((oc) => {
    const status = finalStatus(oc).toLowerCase();

    if (activeStatus === "ready" && status !== "ready to send") {
      return false;
    }

    if (activeStatus === "sent" && status !== "sent") {
      return false;
    }

    return matchesSearch({
      oc,
      customer: oc.customer_id ? customerById.get(oc.customer_id) || null : null,
      query: searchQuery,
    });
  });

  const sentCount = confirmations.filter(
    (oc) => finalStatus(oc) === "Sent"
  ).length;

  const readyCount = confirmations.filter(
    (oc) => finalStatus(oc) === "Ready to Send"
  ).length;

  const today = new Date().toISOString().slice(0, 10);

  const todayCount = confirmations.filter((oc) =>
    clean(oc.created_at).startsWith(today)
  ).length;

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Final Order Confirmations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Final generated OCs only. Drafts, reviewed records and partial edits
            are hidden.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/orders/new"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            + New Manual Order / OC
          </Link>

          <Link
            href="/orders"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Orders Dashboard
          </Link>

          <Link
            href="/oc-templates"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            OC Templates
          </Link>
        </div>
      </div>

      {params?.sent === "1" && (
        <div className="p-4 rounded-lg bg-green-50 text-green-700 border border-green-200">
          Final OC sent successfully.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{confirmations.length}</div>
          <div className="text-sm text-gray-500">Final OCs</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{readyCount}</div>
          <div className="text-sm text-gray-500">Ready to Send</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{sentCount}</div>
          <div className="text-sm text-gray-500">Sent</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{todayCount}</div>
          <div className="text-sm text-gray-500">Today&apos;s OCs</div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <form className="flex gap-3" action="/order-confirmations" method="GET">
          <input type="hidden" name="status" value={activeStatus} />

          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by OC number, customer, PO number or email..."
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />

          <button className="px-5 py-3 rounded-lg bg-gray-900 text-white text-sm">
            Search
          </button>

          <Link
            href="/order-confirmations"
            className="px-5 py-3 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            Clear
          </Link>
        </form>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/order-confirmations?q=${encodeURIComponent(searchQuery)}`}
            className={tabClass(activeStatus === "all")}
          >
            All
          </Link>

          <Link
            href={`/order-confirmations?status=ready&q=${encodeURIComponent(
              searchQuery
            )}`}
            className={tabClass(activeStatus === "ready")}
          >
            Ready to Send
          </Link>

          <Link
            href={`/order-confirmations?status=sent&q=${encodeURIComponent(
              searchQuery
            )}`}
            className={tabClass(activeStatus === "sent")}
          >
            Sent
          </Link>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Showing {filteredConfirmations.length} final OCs.
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">OC No</th>
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">PO</th>
              <th className="p-3 border text-left">Delivery</th>
              <th className="p-3 border text-left">Items</th>
              <th className="p-3 border text-left">Status</th>
              <th className="p-3 border text-left">Sent To</th>
              <th className="p-3 border text-left">Sent On</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredConfirmations.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No final generated OCs found.
                </td>
              </tr>
            ) : (
              filteredConfirmations.map((oc) => {
                const orderItemId = primaryOrderItemId(oc);
                const customer = oc.customer_id
                  ? customerById.get(oc.customer_id) || null
                  : null;
                const status = finalStatus(oc);

                return (
                  <tr key={oc.id} className="hover:bg-gray-50">
                    <td className="p-3 border font-medium">
                      {oc.oc_number || "OC"}
                    </td>

                    <td className="p-3 border">
                      <div className="font-medium">
                        {customer?.company_name || "Customer"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {customer?.email || ""}
                      </div>
                    </td>

                    <td className="p-3 border">{oc.po_number || ""}</td>

                    <td className="p-3 border whitespace-nowrap">
                      {formatDate(oc.delivery_date)}
                    </td>

                    <td className="p-3 border">{itemCount(oc)}</td>

                    <td className="p-3 border">
                      <span
                        className={`px-3 py-1 rounded-full border text-xs ${statusClass(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </td>

                    <td className="p-3 border">{oc.recipient_email || ""}</td>

                    <td className="p-3 border whitespace-nowrap">
                      {formatDate(oc.sent_at)}
                    </td>

                    <td className="p-3 border">
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={oc.final_oc_pdf_url || ""}
                          target="_blank"
                          className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        >
                          View Final PDF
                        </a>

                        <a
                          href={oc.final_oc_pdf_url || ""}
                          download
                          className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        >
                          Download PDF
                        </a>

                        {orderItemId && (
                          <Link
                            href={`/orders/${orderItemId}/oc/final-editor`}
                            className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                          >
                            Final Editor
                          </Link>
                        )}

                        
                         {orderItemId && (
  <SendResendOCButton
    href={`/orders/${orderItemId}/oc/send`}
    isSent={status === "Sent"}
  />
)}

                        <Link
                          href={`/order-confirmations/${oc.id}/email-history`}
                          className="px-4 py-2 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                        >
                          Email History
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}