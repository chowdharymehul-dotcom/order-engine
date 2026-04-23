export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";

type EnquiryItem = {
  id: string;
  customer: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  email_subject: string | null;
  action: string | null;
  follow_up_due_at: string | null;
};

type EnquiriesPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

function tabClass(active: boolean) {
  return `px-4 py-2 rounded-lg border text-sm transition ${
    active
      ? "bg-gray-200 border-gray-400 text-black"
      : "bg-white text-black hover:bg-gray-100"
  }`;
}

function getPriorityMeta(item: EnquiryItem) {
  if (
    item.status !== "Follow Up with Customer" ||
    !item.follow_up_due_at
  ) {
    return {
      score: 99,
      label: null as string | null,
      style: "",
    };
  }

  const due = new Date(item.follow_up_due_at);
  const now = new Date();
  const diffDays =
    (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays >= 3) {
    return {
      score: 0,
      label: "Critical",
      style: "bg-red-100 text-red-700",
    };
  }

  if (diffDays >= 0.5) {
    return {
      score: 1,
      label: "Overdue",
      style: "bg-orange-100 text-orange-700",
    };
  }

  return {
    score: 2,
    label: "Due Today",
    style: "bg-yellow-100 text-yellow-700",
  };
}

export default async function EnquiriesPage({
  searchParams,
}: EnquiriesPageProps) {
  const params = await searchParams;
  const activeFilter = params?.filter || "all";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const nowIso = new Date().toISOString();

  await supabase
    .from("order_items")
    .update({
      status: "Follow Up with Customer",
    })
    .eq("status", "Replied")
    .not("follow_up_due_at", "is", null)
    .lt("follow_up_due_at", nowIso);

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, customer, sku, quantity, notes, status, email_subject, action, follow_up_due_at"
    )
    .in("action", ["Reply to Enquiry", "Follow Up"])
    .order("id", { ascending: false });

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Enquiries and Follow Up</h1>
        <p className="text-red-600">
          Error loading enquiries: {error.message}
        </p>
      </div>
    );
  }

  const enquiries = (data ?? []) as EnquiryItem[];

  const counts = {
    all: enquiries.length,
    pending: enquiries.filter((i) => i.status === "Pending").length,
    replied: enquiries.filter((i) => i.status === "Replied").length,
    followup: enquiries.filter(
      (i) => i.status === "Follow Up with Customer"
    ).length,
    closed: enquiries.filter((i) => i.status === "Close Enquiry").length,
  };

  const filtered = enquiries.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "pending") return item.status === "Pending";
    if (activeFilter === "replied") return item.status === "Replied";
    if (activeFilter === "followup") {
      return item.status === "Follow Up with Customer";
    }
    if (activeFilter === "closed") {
      return item.status === "Close Enquiry";
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aPriority = getPriorityMeta(a);
    const bPriority = getPriorityMeta(b);

    if (aPriority.score !== bPriority.score) {
      return aPriority.score - bPriority.score;
    }

    const aDue = a.follow_up_due_at
      ? new Date(a.follow_up_due_at).getTime()
      : Number.MAX_SAFE_INTEGER;
    const bDue = b.follow_up_due_at
      ? new Date(b.follow_up_due_at).getTime()
      : Number.MAX_SAFE_INTEGER;

    if (aDue !== bDue) {
      return aDue - bDue;
    }

    return Number(b.id) - Number(a.id);
  });

  return (
    <div className="p-10 space-y-8">
      <AutoRefresh interval={10000} />

      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Enquiries and Follow Up</h1>

          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2 rounded-full bg-orange-100 text-orange-800 text-sm font-medium">
              {counts.followup} follow up{counts.followup !== 1 ? "s" : ""} due
            </div>

            <div className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
              {counts.pending} pending
            </div>

            <div className="px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-medium">
              {counts.replied} replied
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/emails"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Emails
          </Link>

          <Link
            href="/orders"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Orders
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/enquiries-follow-up?filter=all"
          className={tabClass(activeFilter === "all")}
        >
          All ({counts.all})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=pending"
          className={tabClass(activeFilter === "pending")}
        >
          Pending ({counts.pending})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=replied"
          className={tabClass(activeFilter === "replied")}
        >
          Replied ({counts.replied})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=followup"
          className={tabClass(activeFilter === "followup")}
        >
          Follow Up ({counts.followup})
        </Link>

        <Link
          href="/enquiries-follow-up?filter=closed"
          className={tabClass(activeFilter === "closed")}
        >
          Closed ({counts.closed})
        </Link>
      </div>

      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">SKU</th>
              <th className="p-3 border text-left">Quantity</th>
              <th className="p-3 border text-left">Query</th>
              <th className="p-3 border text-left">Action</th>
              <th className="p-3 border text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No items found
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const isFollowUp =
                  item.status === "Follow Up with Customer";
                const priority = getPriorityMeta(item);

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 border">{item.customer || ""}</td>
                    <td className="p-3 border">{item.sku || ""}</td>
                    <td className="p-3 border">{item.quantity ?? ""}</td>

                    <td className="p-3 border">
                      <div className="space-y-2">
                        <div>{item.notes || item.email_subject || ""}</div>

                        <div className="flex gap-2 flex-wrap">
                          {isFollowUp && (
                            <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">
                              Follow Up Due
                            </span>
                          )}

                          {priority.label ? (
                            <span
                              className={`px-2 py-1 text-xs rounded ${priority.style}`}
                            >
                              {priority.label}
                            </span>
                          ) : null}

                          {item.follow_up_due_at && (
                            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                              {new Date(
                                item.follow_up_due_at
                              ).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-3 border">
                      <Link
                        href={`/enquiries-follow-up/${item.id}/reply`}
                        className={`px-4 py-2 rounded-lg text-sm ${
                          isFollowUp
                            ? "bg-orange-100 text-orange-800 hover:bg-orange-200"
                            : "bg-gray-200 text-black hover:bg-gray-300"
                        }`}
                      >
                        {isFollowUp ? "Follow Up" : "Reply"}
                      </Link>
                    </td>

                    <td className="p-3 border">
                      <form action="/api/enquiries/update-status" method="POST">
                        <input type="hidden" name="id" value={item.id} />

                        <select
                          name="status"
                          defaultValue={item.status || "Pending"}
                          className="border rounded px-2 py-1 bg-white"
                        >
                          <option value="Replied">Replied</option>
                          <option value="Pending">Pending</option>
                          <option value="Follow Up with Customer">
                            Follow Up with Customer
                          </option>
                          <option value="Close Enquiry">Close Enquiry</option>
                        </select>

                        <button className="ml-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
                          Save
                        </button>
                      </form>
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