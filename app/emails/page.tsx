export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type EmailRecord = {
  id: string;
  subject: string | null;
  from_email: string | null;
  received_at: string | null;
  processing_status: string | null;
  gmail_message_id: string | null;
};

export default async function EmailsInboxPage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .from("emails")
    .select("id, subject, from_email, received_at, processing_status, gmail_message_id")
    .order("received_at", { ascending: false });

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Emails Inbox</h1>
        <p className="text-red-600">Error loading emails: {error.message}</p>
      </div>
    );
  }

  const emails = (data ?? []) as EmailRecord[];

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Emails Inbox</h1>
        <div className="flex gap-3">
          <Link href="/needs-ocr" className="px-4 py-2 border rounded">
            Needs OCR
          </Link>
          <Link href="/" className="px-4 py-2 border rounded">
            Dashboard
          </Link>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="border rounded p-6 bg-white">
          <p>No emails found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300 border-collapse text-sm bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Subject</th>
                <th className="p-3 border text-left">From</th>
                <th className="p-3 border text-left">Received</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Message ID</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td className="p-3 border">
                    <a
                      href={`/emails/${email.id}`}
                      className="text-blue-600 underline"
                    >
                      {email.subject || "(No subject)"}
                    </a>
                  </td>
                  <td className="p-3 border">{email.from_email || ""}</td>
                  <td className="p-3 border">
                    {email.received_at
                      ? new Date(email.received_at).toLocaleString()
                      : ""}
                  </td>
                  <td className="p-3 border">{email.processing_status || ""}</td>
                  <td className="p-3 border">{email.gmail_message_id || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}