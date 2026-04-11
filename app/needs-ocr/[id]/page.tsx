export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

export default async function OCRDetail({ params }: any) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: email } = await supabase
    .from("emails")
    .select("*")
    .eq("id", params.id)
    .single();

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">OCR Required</h1>

      <div>{email.subject}</div>

      <form method="POST" action="/api/reprocess-email">
        <input type="hidden" name="email_id" value={email.id} />

        <textarea
          name="ocr_text"
          className="w-full border p-2 h-40"
          placeholder="Paste OCR text"
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Reprocess
        </button>
      </form>
    </div>
  );
}