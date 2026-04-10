import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditOrderPage({ params }: PageProps) {
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
    <div className="min-h-screen bg-black/40 p-10">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit Order</h1>
          <Link href="/orders" className="px-4 py-2 border rounded">
            Close
          </Link>
        </div>

        <form action="/api/orders/edit" method="POST" className="space-y-5">
          <input type="hidden" name="order_id" value={order.id} />

          <div>
            <label className="block text-sm font-medium mb-2">Action</label>
            <input
              name="action"
              defaultValue={order.action || ""}
              className="w-full border rounded p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Customer</label>
            <input
              name="customer"
              defaultValue={order.customer || ""}
              className="w-full border rounded p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">PO Number</label>
            <input
              name="po_number"
              defaultValue={order.po_number || ""}
              className="w-full border rounded p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">SKU</label>
            <input
              name="sku"
              defaultValue={order.sku || ""}
              className="w-full border rounded p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Quantity</label>
            <input
              name="quantity"
              defaultValue={order.quantity ?? ""}
              className="w-full border rounded p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              name="notes"
              defaultValue={order.notes || ""}
              className="w-full border rounded p-3 h-32"
            />
          </div>

          <div className="flex gap-3">
            <button className="px-5 py-3 bg-black text-white rounded">
              Save Changes
            </button>
            <Link href="/orders" className="px-5 py-3 border rounded">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}