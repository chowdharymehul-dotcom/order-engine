import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  async function approveOrder() {
    "use server";

    await supabase
      .from("order_items")
      .update({ status: "Approved" })
      .eq("id", id);

    revalidatePath("/");
    revalidatePath(`/orders/${id}`);
  }

  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold">Order Not Found</h1>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-3xl font-bold">Order Detail</h1>

      <div><strong>Action:</strong> {data.action}</div>
      <div><strong>Customer:</strong> {data.customer}</div>
      <div><strong>PO Number:</strong> {data.po_number || ""}</div>
      <div><strong>SKU:</strong> {data.sku}</div>
      <div><strong>Quantity:</strong> {data.quantity ?? ""}</div>
      <div><strong>Deadline:</strong> {data.deadline || ""}</div>
      <div><strong>Notes:</strong> {data.notes || ""}</div>
      <div><strong>Source Email:</strong> {data.source_email || ""}</div>
      <div><strong>Status:</strong> {data.status}</div>

      {/* APPROVE BUTTON */}
      <form action={approveOrder}>
        <button className="mt-6 px-4 py-2 bg-green-600 text-white rounded">
          Approve Order
        </button>
      </form>

      {/* EDIT BUTTON */}
      <a
        href={`/orders/${data.id}/edit`}
        className="inline-block mt-4 px-4 py-2 bg-gray-800 text-white rounded"
      >
        Edit Order
      </a>
    </div>
  );
}