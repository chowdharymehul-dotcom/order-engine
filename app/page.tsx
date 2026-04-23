export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import DashboardCards from "@/components/DashboardCards";
import RecentActivity from "@/components/RecentActivity";

export default function HomePage() {
  return (
    <div className="p-10 space-y-10">
      <h1 className="text-4xl font-bold">AI Order Engine</h1>

      <DashboardCards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          <RecentActivity />
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-5 h-fit">
          <h2 className="text-2xl font-bold text-black">Quick Actions</h2>

          <div className="flex flex-col gap-4">
            <Link
              href="/emails"
              className="px-5 py-4 border rounded-xl text-lg font-medium text-black hover:bg-gray-50 transition"
            >
              View Emails
            </Link>

            <Link
              href="/orders"
              className="px-5 py-4 border rounded-xl text-lg font-medium text-black hover:bg-gray-50 transition"
            >
              View Orders
            </Link>

            <Link
              href="/enquiries-follow-up"
              className="px-5 py-4 border rounded-xl text-lg font-medium text-black hover:bg-gray-50 transition"
            >
              View Enquiries
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}