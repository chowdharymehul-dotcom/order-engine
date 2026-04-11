export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

export default async function OrderDetail({ params }: any) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: order } = await supabase
    .from("order_items")
    .select("*")
    .eq("id", params.id)
    .single();

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Order Detail</h1>

      <div>SKU: {order.sku}</div>
      <div>Action: {order.action}</div>
      <div>Status: {order.status}</div>
    </div>
  );
}