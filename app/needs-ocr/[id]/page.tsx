export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmailDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: email } = await supabaseAdmin
    .from("emails")
    .select("*")
    .eq("id", id)
    .single();

  if (!email) return notFound();

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">Email Detail</h1>

      <div className="mb-4">
        <strong>Subject:</strong> {email.subject}
      </div>

      <div className="mb-4">
        <strong>From:</strong> {email.from_email}
      </div>

      <div className="mb-6">
        <strong>Body:</strong>
        <div className="bg-gray-50 p-3 mt-2 whitespace-pre-wrap">
          {email.body_text}
        </div>
      </div>

      <form action="/api/reprocess-email" method="POST">
        <input type="hidden" name="email_id" value={email.id} />

        <div className="mb-4">
          <strong>Paste OCR Text:</strong>
          <textarea
            name="ocr_text"
            className="w-full border p-3 mt-2 h-40"
            placeholder="Paste OCR text from PDF here..."
          />
        </div>

        <button className="px-4 py-2 bg-black text-white rounded">
          Reprocess Email
        </button>
      </form>
    </div>
  );
}