export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import DashboardCards from "@/components/DashboardCards";

export default function HomePage() {
  return (
    <div className="p-10 space-y-10">
      <h1 className="text-4xl font-bold">AI Order Engine</h1>

      <DashboardCards />

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