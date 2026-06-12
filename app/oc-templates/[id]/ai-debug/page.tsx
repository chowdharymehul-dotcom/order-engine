export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type AIDebugPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    draft?: string;
  }>;
};

function pretty(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value || "");
  }
}

export default async function AITemplateDebugPage({
  params,
  searchParams,
}: AIDebugPageProps) {
  const { id } = await params;
  const { draft: draftId } = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: template } = await supabase
    .from("oc_templates")
    .select("id, company_name, template_name, template_url")
    .eq("id", id)
    .maybeSingle();

  const { data: draft, error } = draftId
    ? await supabase
        .from(
          "oc_template_ai_drafts"
        )
        .select(
          "id, analysis, raw_text, raw_ai_response, analysis_version, debug_notes, status, created_at"
        )
        .eq("id", draftId)
        .eq("template_id", id)
        .maybeSingle()
    : { data: null, error: null };

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Template Debug</h1>

          <p className="text-sm text-gray-500 mt-1">
            Inspect the raw extraction and AI output used to create this draft.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/oc-templates"
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Back to Templates
          </Link>

          <Link
            href={`/oc-templates/${id}/ai-review${
              draftId ? `?draft=${draftId}` : ""
            }`}
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Back to Review
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error.message}
        </div>
      )}

      {!draft && (
        <div className="p-6 rounded-xl border bg-yellow-50 text-yellow-800">
          No AI draft found.
        </div>
      )}

      {draft && (
        <>
          <div className="bg-white border rounded-xl p-6 space-y-2">
            <div className="text-sm text-gray-500">Template</div>

            <div className="text-xl font-semibold">
              {template?.template_name || "Untitled Template"}
            </div>

            <div className="text-sm text-gray-600">
              {template?.company_name || ""}
            </div>

            <div className="text-sm text-gray-600">
              Version: {draft.analysis_version || "unknown"} · Status:{" "}
              {draft.status || ""}
            </div>

            {draft.debug_notes && (
              <div className="text-sm text-gray-500">
                {draft.debug_notes}
              </div>
            )}
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Raw Extracted Text</h2>

            <pre className="whitespace-pre-wrap text-xs bg-gray-950 text-gray-50 rounded-xl p-4 max-h-[500px] overflow-auto">
              {draft.raw_text || "No raw text stored for this draft."}
            </pre>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Raw AI Response</h2>

            <pre className="whitespace-pre-wrap text-xs bg-gray-950 text-gray-50 rounded-xl p-4 max-h-[500px] overflow-auto">
              {pretty(draft.raw_ai_response)}
            </pre>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Final Analysis</h2>

            <pre className="whitespace-pre-wrap text-xs bg-gray-950 text-gray-50 rounded-xl p-4 max-h-[500px] overflow-auto">
              {pretty(draft.analysis)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}