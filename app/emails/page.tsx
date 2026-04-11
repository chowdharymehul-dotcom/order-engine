export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default async function EmailsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: emails } = await supabase
    .from("emails")
    .select("*")
    .order("received_at", { ascending: false });

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">Emails</h1>

      <div className="space-y-4">
        {emails?.map((email) => (
          <Link
            key={email.id}
            href={`/emails/${email.id}`}
            className="block border p-4 rounded"
          >
            <div><b>Subject:</b> {email.subject}</div>
            <div><b>Status:</b> {email.processing_status}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}