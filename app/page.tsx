export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

export default function Home() {
  return (
    <div className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">Order Engine Dashboard</h1>

      <div className="flex gap-4">
        <Link href="/orders" className="px-4 py-2 border rounded">
          Orders
        </Link>

        <Link href="/emails" className="px-4 py-2 border rounded">
          Emails
        </Link>

        <Link href="/needs-ocr" className="px-4 py-2 border rounded">
          Needs OCR
        </Link>
      </div>
    </div>
  );
}