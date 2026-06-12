export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type AIReviewPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    draft?: string;
  }>;
};

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function count(value: any) {
  return asArray(value).length;
}

function valueAt(row: any, key: string) {
  return String(row?.[key] ?? "");
}

function deletedItemLabel(entry: any) {
  const item = entry?.item || {};

  return (
    item.display_label ||
    item.field_name ||
    item.region_name ||
    item.source_field ||
    item.total_key ||
    item.block_key ||
    "Deleted Item"
  );
}

export default async function AITemplateReviewPage({
  params,
  searchParams,
}: AIReviewPageProps) {
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
        .from("oc_template_ai_drafts")
        .select("id, analysis, deleted_items, status, created_at")
        .eq("id", draftId)
        .eq("template_id", id)
        .maybeSingle()
    : { data: null, error: null };

  const analysis = draft?.analysis || {};
  const deletedItems = asArray(draft?.deleted_items);

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Template Review</h1>

          <p className="text-sm text-gray-500 mt-1">
            Review, edit, add, delete, restore and reorder AI-detected template
            items before applying them.
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
            href={`/oc-templates/${id}/designer`}
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Open Designer
          </Link>

          {draft && (
            <Link
              href={`/oc-templates/${id}/ai-debug?draft=${draft.id}`}
              className="px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Open Debug
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error.message}
        </div>
      )}

      {!draft && (
        <div className="p-6 rounded-xl border bg-yellow-50 text-yellow-800">
          No AI draft found for this template.
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

            <div className="text-sm text-gray-500">
              Draft Status: {draft.status || "draft"}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <SummaryCard label="Regions" value={count(analysis.regions)} />
            <SummaryCard label="Fields" value={count(analysis.fields)} />
            <SummaryCard label="Columns" value={count(analysis.columns)} />
            <SummaryCard label="Totals" value={count(analysis.totals)} />
            <SummaryCard
              label="Static Blocks"
              value={count(analysis.static_blocks)}
            />
            <SummaryCard label="Deleted" value={deletedItems.length} />
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold">Add Missing Items</h2>

            <div className="flex gap-2 flex-wrap">
              <AddButton
                label="+ Region"
                section="regions"
                templateId={id}
                draftId={draft.id}
              />

              <AddButton
                label="+ Field"
                section="fields"
                templateId={id}
                draftId={draft.id}
              />

              <AddButton
                label="+ Column"
                section="columns"
                templateId={id}
                draftId={draft.id}
              />

              <AddButton
                label="+ Total"
                section="totals"
                templateId={id}
                draftId={draft.id}
              />

              <AddButton
                label="+ Static Block"
                section="static_blocks"
                templateId={id}
                draftId={draft.id}
              />
            </div>
          </div>

         <div className="flex gap-3">
  <form action="/api/oc-templates/apply-ai-draft" method="POST">
    <input type="hidden" name="template_id" value={id} />
    <input type="hidden" name="draft_id" value={draft.id} />

    <button className="px-5 py-3 rounded-lg bg-gray-800 text-white hover:bg-gray-900">
      Apply AI Template Structure
    </button>
  </form>

  <Link
    href={`/oc-templates/${id}/preview?draft=${draft.id}`}
    className="px-5 py-3 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
  >
    Preview Draft
  </Link>

  <Link
    href={`/oc-templates/${id}/ai-debug?draft=${draft.id}`}
    className="px-5 py-3 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
  >
    Open Debug
  </Link>
</div>

          <ReviewSection
            title="Detected Regions"
            section="regions"
            templateId={id}
            draftId={draft.id}
            rows={asArray(analysis.regions)}
            keys={[
              "display_label",
              "region_name",
              "region_type",
              "x_position",
              "y_position",
              "width",
              "height",
            ]}
          />

          <ReviewSection
            title="Detected Fields"
            section="fields"
            templateId={id}
            draftId={draft.id}
            rows={asArray(analysis.fields)}
            keys={[
              "display_label",
              "field_name",
              "field_type",
              "region_name",
              "x_position",
              "y_position",
            ]}
          />

          <ReviewSection
            title="Detected Table Columns"
            section="columns"
            templateId={id}
            draftId={draft.id}
            rows={asArray(analysis.columns)}
            keys={[
              "display_label",
              "source_field",
              "region_name",
              "column_order",
            ]}
          />

          <ReviewSection
            title="Detected Totals"
            section="totals"
            templateId={id}
            draftId={draft.id}
            rows={asArray(analysis.totals)}
            keys={[
              "display_label",
              "total_key",
              "formula_type",
              "region_name",
              "total_order",
            ]}
          />

          <ReviewSection
            title="Detected Static Blocks"
            section="static_blocks"
            templateId={id}
            draftId={draft.id}
            rows={asArray(analysis.static_blocks)}
            keys={["display_label", "block_key", "region_name", "content"]}
          />

          <DeletedItemsSection
            templateId={id}
            draftId={draft.id}
            deletedItems={deletedItems}
          />
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function AddButton({
  label,
  section,
  templateId,
  draftId,
}: {
  label: string;
  section: string;
  templateId: string;
  draftId: string;
}) {
  return (
    <form action="/api/oc-templates/update-ai-draft" method="POST">
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="draft_id" value={draftId} />
      <input type="hidden" name="action" value="add" />
      <input type="hidden" name="section" value={section} />

      <button className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 text-sm">
        {label}
      </button>
    </form>
  );
}

function MoveButton({
  label,
  action,
  section,
  templateId,
  draftId,
  index,
}: {
  label: string;
  action: "move_up" | "move_down";
  section: string;
  templateId: string;
  draftId: string;
  index: number;
}) {
  return (
    <form action="/api/oc-templates/update-ai-draft" method="POST">
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="draft_id" value={draftId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="index" value={String(index)} />

      <button className="px-3 py-2 rounded-lg bg-gray-50 text-gray-700 border hover:bg-gray-100 text-xs">
        {label}
      </button>
    </form>
  );
}

function ReviewSection({
  title,
  section,
  templateId,
  draftId,
  rows,
  keys,
}: {
  title: string;
  section: string;
  templateId: string;
  draftId: string;
  rows: any[];
  keys: string[];
}) {
  return (
    <div className="bg-white border rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>

      {rows.length === 0 ? (
        <div className="p-4 rounded-lg bg-gray-50 text-sm text-gray-500">
          Nothing detected.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div key={index} className="border rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center gap-3">
                <div className="text-sm font-semibold text-gray-700">
                  #{index + 1} {valueAt(row, "display_label")}
                </div>

                <div className="flex gap-2">
                  <MoveButton
                    label="↑"
                    action="move_up"
                    section={section}
                    templateId={templateId}
                    draftId={draftId}
                    index={index}
                  />

                  <MoveButton
                    label="↓"
                    action="move_down"
                    section={section}
                    templateId={templateId}
                    draftId={draftId}
                    index={index}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {keys.map((key) => (
                  <label key={key} className="text-xs text-gray-500">
                    {key}
                    <input
                      form={`${section}-${index}-edit-form`}
                      name={key}
                      defaultValue={valueAt(row, key)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <form
                  id={`${section}-${index}-edit-form`}
                  action="/api/oc-templates/update-ai-draft"
                  method="POST"
                >
                  <input type="hidden" name="template_id" value={templateId} />
                  <input type="hidden" name="draft_id" value={draftId} />
                  <input type="hidden" name="action" value="edit" />
                  <input type="hidden" name="section" value={section} />
                  <input type="hidden" name="index" value={String(index)} />

                  <button className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900 text-sm">
                    Save Edit
                  </button>
                </form>

                <form action="/api/oc-templates/update-ai-draft" method="POST">
                  <input type="hidden" name="template_id" value={templateId} />
                  <input type="hidden" name="draft_id" value={draftId} />
                  <input type="hidden" name="action" value="delete" />
                  <input type="hidden" name="section" value={section} />
                  <input type="hidden" name="index" value={String(index)} />

                  <button className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-sm">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeletedItemsSection({
  templateId,
  draftId,
  deletedItems,
}: {
  templateId: string;
  draftId: string;
  deletedItems: any[];
}) {
  return (
    <div className="bg-white border rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-semibold">Deleted Items</h2>

      {deletedItems.length === 0 ? (
        <div className="p-4 rounded-lg bg-gray-50 text-sm text-gray-500">
          No deleted items.
        </div>
      ) : (
        <div className="space-y-3">
          {deletedItems.map((entry, index) => (
            <div
              key={index}
              className="border rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div>
                <div className="font-semibold text-sm">
                  {deletedItemLabel(entry)}
                </div>

                <div className="text-xs text-gray-500">
                  Section: {entry.section} · Deleted:{" "}
                  {entry.deleted_at || ""}
                </div>
              </div>

              <form action="/api/oc-templates/update-ai-draft" method="POST">
                <input type="hidden" name="template_id" value={templateId} />
                <input type="hidden" name="draft_id" value={draftId} />
                <input type="hidden" name="action" value="restore" />
                <input type="hidden" name="section" value="deleted_items" />
                <input type="hidden" name="index" value={String(index)} />

                <button className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 text-sm">
                  Restore
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}