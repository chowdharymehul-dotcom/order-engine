export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default async function NeedsOCRPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: emails } = await supabase
    .from("emails")
    .select("*")
    .eq("processing_status", "needs_ocr");

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">Needs OCR</h1>

      <div className="space-y-4">
        {emails?.map((email) => (
          <Link
            key={email.id}
            href={`/needs-ocr/${email.id}`}
            className="block border p-4 rounded"
          >
            <div><b>Subject:</b> {email.subject}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}