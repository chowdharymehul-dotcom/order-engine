export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: order, error } = await supabaseAdmin
    .from("order_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !order) {
    return notFound();
  }

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Order Detail</h1>
        <div className="flex gap-3">
          <Link href="/orders" className="px-4 py-2 border rounded">
            Back to Orders
          </Link>
        </div>
      </div>

      <div className="border rounded bg-white p-6 space-y-3">
        <div>
          <strong>Action:</strong> {order.action || ""}
        </div>
        <div>
          <strong>Customer:</strong> {order.customer || ""}
        </div>
        <div>
          <strong>PO Number:</strong> {order.po_number || ""}
        </div>
        <div>
          <strong>SKU:</strong> {order.sku || ""}
        </div>
        <div>
          <strong>Quantity:</strong> {order.quantity ?? ""}
        </div>
        <div>
          <strong>Notes:</strong> {order.notes || ""}
        </div>
        <div>
          <strong>Status:</strong> {order.status || ""}
        </div>
        <div>
          <strong>Source Email Subject:</strong> {order.email_subject || ""}
        </div>
        <div>
          <strong>Gmail Message ID:</strong> {order.gmail_message_id || ""}
        </div>
      </div>

      <div className="flex gap-3">
        <form action="/api/orders/approve" method="POST">
          <input type="hidden" name="order_id" value={order.id} />
          <button className="px-4 py-2 bg-green-600 text-white rounded">
            Approve
          </button>
        </form>

        <form action="/api/orders/done" method="POST">
          <input type="hidden" name="order_id" value={order.id} />
          <button className="px-4 py-2 bg-blue-600 text-white rounded">
            Mark Done
          </button>
        </form>

        <Link
          href={`/orders/${order.id}/edit`}
          className="px-4 py-2 bg-gray-800 text-white rounded"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}