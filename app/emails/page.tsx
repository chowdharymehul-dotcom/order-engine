export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";

type EmailRow = {
  id: string;
  provider: string | null;
  from_email: string | null;
  subject: string | null;
  received_at: string | null;
  processing_status: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
};

type EmailsPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

export default async function EmailsPage({ searchParams }: EmailsPageProps) {
  const params = await searchParams;
  const selectedFilter = params?.filter || "all";

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabaseAdmin
    .from("emails")
    .select(
      "id, provider, from_email, subject, received_at, processing_status, external_message_id, gmail_message_id"
    )
    .order("received_at", { ascending: false, nullsFirst: false });

  if (selectedFilter === "needs_ocr") {
    query = query.eq("processing_status", "needs_ocr");
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Emails Inbox</h1>
        <p className="text-red-600">Error loading emails: {error.message}</p>
      </div>
    );
  }

  const emails = (data ?? []) as EmailRow[];

  return (
    <div className="p-10 space-y-8">
      <AutoRefresh interval={10000} />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Emails Inbox</h1>

        <div className="flex gap-3">
          <Link
            href="/orders"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Orders
          </Link>

          <Link
            href="/needs-ocr"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Needs OCR
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/emails"
            className={`px-5 py-3 rounded-lg border text-sm font-medium transition ${
              selectedFilter === "all"
                ? "bg-gray-100 border-gray-400 text-black"
                : "bg-white text-black hover:bg-gray-50"
            }`}
          >
            All
          </Link>

          <Link
            href="/emails?filter=needs_ocr"
            className={`px-5 py-3 rounded-lg border text-sm font-medium transition ${
              selectedFilter === "needs_ocr"
                ? "bg-gray-100 border-gray-400 text-black"
                : "bg-white text-black hover:bg-gray-50"
            }`}
          >
            Needs OCR
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">From</th>
              <th className="p-3 border text-left">Subject</th>
              <th className="p-3 border text-left">Received On</th>
              <th className="p-3 border text-left">Status</th>
              <th className="p-3 border text-left">Message ID</th>
            </tr>
          </thead>

          <tbody>
            {emails.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No emails found.
                </td>
              </tr>
            ) : (
              emails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td className="p-3 border">{email.from_email || ""}</td>

                  <td className="p-3 border">
                    <Link
                      href={`/emails/${email.id}`}
                      className="text-blue-600 underline"
                    >
                      {email.subject || "View Email"}
                    </Link>
                  </td>

                  <td className="p-3 border whitespace-nowrap">
                    {email.received_at
                      ? new Date(email.received_at).toLocaleString()
                      : ""}
                  </td>

                  <td className="p-3 border">{email.processing_status || ""}</td>

                  <td className="p-3 border break-all">
                    {email.external_message_id || email.gmail_message_id || ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}