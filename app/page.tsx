export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default async function HomePage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count: emailCount } = await supabaseAdmin
    .from("emails")
    .select("*", { count: "exact", head: true });

  const { count: totalOrders } = await supabaseAdmin
    .from("order_items")
    .select("*", { count: "exact", head: true });

  const { count: newOrders } = await supabaseAdmin
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "New");

  const { count: approvedOrders } = await supabaseAdmin
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "Approved");

  const { count: doneOrders } = await supabaseAdmin
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "Done");

  const { count: needsOcr } = await supabaseAdmin
    .from("emails")
    .select("*", { count: "exact", head: true })
    .eq("processing_status", "needs_ocr");

  return (
    <div className="p-10 space-y-10">
      <h1 className="text-4xl font-bold">AI Order Engine</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <Card title="Emails" value={emailCount} link="/emails" />
        <Card title="Total Orders" value={totalOrders} link="/orders" />
        <Card title="New" value={newOrders} link="/orders?status=New" />
        <Card title="Approved" value={approvedOrders} link="/orders?status=Approved" />
        <Card title="Done" value={doneOrders} link="/orders?status=Done" />
        <Card title="Needs OCR" value={needsOcr} link="/needs-ocr" />
      </div>

      <div className="bg-white border rounded p-6 space-y-4">
        <h2 className="text-xl font-semibold">Quick Actions</h2>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/emails"
            className="px-6 py-3 border rounded hover:bg-gray-100"
          >
            View Emails
          </Link>

          <Link
            href="/orders"
            className="px-6 py-3 border rounded hover:bg-gray-100"
          >
            View Orders
          </Link>

          <Link
            href="/needs-ocr"
            className="px-6 py-3 border rounded hover:bg-gray-100"
          >
            Needs OCR Queue
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  link,
}: {
  title: string;
  value: number | null;
  link: string;
}) {
  return (
    <Link
      href={link}
      className="bg-white border rounded p-5 hover:shadow-md transition"
    >
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold mt-2">{value ?? 0}</div>
    </Link>
  );
}