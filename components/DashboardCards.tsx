export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default async function DashboardCards() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();

  const { data } = await supabase
    .from("order_items")
    .select("id, follow_up_due_at, status")
    .eq("status", "Follow Up with Customer");

  const items = data || [];

  let dueToday = 0;
  let overdue = 0;
  let critical = 0;

  for (const item of items) {
    if (!item.follow_up_due_at) continue;

    const due = new Date(item.follow_up_due_at);
    const diffDays =
      (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays < 0.5) {
      dueToday++;
    } else if (diffDays < 3) {
      overdue++;
    } else {
      critical++;
    }
  }

  const totalFollowUps = dueToday + overdue + critical;

  const { count: pendingReplies } = await supabase
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "Pending")
    .in("action", ["Reply to Enquiry", "Follow Up"]);

  const { count: newOrders } = await supabase
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("action", "Place Order")
    .eq("status", "New");

  const { count: needsOcr } = await supabase
    .from("emails")
    .select("*", { count: "exact", head: true })
    .eq("processing_status", "needs_ocr");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

      {/* FOLLOW UPS PRIORITY */}
      <Link href="/enquiries-follow-up?filter=followup">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 hover:bg-orange-100 transition space-y-2">
          <div className="text-sm text-orange-700 font-medium">
            Follow Ups
          </div>

          <div className="text-3xl font-bold text-orange-900">
            {totalFollowUps}
          </div>

          <div className="text-xs space-y-1">
            <div className="text-yellow-600">Due Today: {dueToday}</div>
            <div className="text-orange-600">Overdue: {overdue}</div>
            <div className="text-red-600">Critical: {critical}</div>
          </div>
        </div>
      </Link>

      {/* PENDING */}
      <Link href="/enquiries-follow-up?filter=pending">
        <div className="bg-gray-50 border rounded-xl p-6 hover:bg-gray-100">
          <div className="text-sm text-gray-600">Pending Replies</div>
          <div className="text-3xl font-bold mt-2">
            {pendingReplies || 0}
          </div>
        </div>
      </Link>

      {/* ORDERS */}
      <Link href="/orders?filter=new">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 hover:bg-blue-100">
          <div className="text-sm text-blue-700">New Orders</div>
          <div className="text-3xl font-bold mt-2 text-blue-900">
            {newOrders || 0}
          </div>
        </div>
      </Link>

      {/* OCR */}
      <Link href="/needs-ocr">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 hover:bg-red-100">
          <div className="text-sm text-red-700">Needs OCR</div>
          <div className="text-3xl font-bold mt-2 text-red-900">
            {needsOcr || 0}
          </div>
        </div>
      </Link>
    </div>
  );
}