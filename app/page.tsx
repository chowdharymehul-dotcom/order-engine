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

        <div className="bg-white border rounded p-6 space-y-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>

          <div className="flex flex-col gap-3">
            <Link
              href="/emails"
              className="px-4 py-3 border rounded hover:bg-gray-100"
            >
              View Emails
            </Link>

            <Link
              href="/orders"
              className="px-4 py-3 border rounded hover:bg-gray-100"
            >
              View Orders
            </Link>

            <Link
              href="/needs-ocr"
              className="px-4 py-3 border rounded hover:bg-gray-100"
            >
              Needs OCR Queue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}