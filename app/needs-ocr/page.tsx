export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type EmailRecord = {
  id: string;
  gmail_message_id: string | null;
  subject: string | null;
  from_email: string | null;
  attachment_text: string | null;
  received_at: string | null;
  processing_status: string | null;
};

export default async function NeedsOcrPage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .from("emails")
    .select(
      "id, gmail_message_id, subject, from_email, attachment_text, received_at, processing_status"
    )
    .eq("processing_status", "needs_ocr")
    .order("received_at", { ascending: false });

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Needs OCR</h1>
        <p className="text-red-600">Error loading emails: {error.message}</p>
      </div>
    );
  }

  const emails = (data ?? []) as EmailRecord[];

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Needs OCR</h1>
        <Link href="/" className="px-4 py-2 border rounded">
          Back to Dashboard
        </Link>
      </div>

      {emails.length === 0 ? (
        <div className="border rounded p-6 bg-white">
          <p>No emails currently need OCR.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {emails.map((email) => (
            <a key={email.id} href={`/needs-ocr/${email.id}`}>
              <div className="border rounded p-5 bg-white hover:bg-gray-50 cursor-pointer">
                <div className="text-lg font-semibold mb-2">
                  {email.subject || "(No subject)"}
                </div>

                <div className="text-sm text-gray-700 mb-1">
                  <strong>From:</strong> {email.from_email || ""}
                </div>

                <div className="text-sm text-gray-700 mb-1">
                  <strong>Received:</strong>{" "}
                  {email.received_at
                    ? new Date(email.received_at).toLocaleString()
                    : ""}
                </div>

                <div className="text-sm text-gray-700 mb-3">
                  <strong>Status:</strong> {email.processing_status || ""}
                </div>

                <div className="text-sm text-gray-700">
                  <strong>Attachment Text Preview:</strong>
                </div>

                <div className="mt-2 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                  {email.attachment_text
                    ? email.attachment_text.slice(0, 500)
                    : "(No readable attachment text extracted)"}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}