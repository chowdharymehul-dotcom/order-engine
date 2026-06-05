export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Template = {
  id: string;
  company_name: string | null;
  template_name: string | null;
  template_url: string | null;
  storage_path: string | null;
  is_active: boolean | null;
};

type Mapping = {
  id: string;
  field_name: string | null;
  page_number: number | null;
  x_position: number | null;
  y_position: number | null;
  font_size: number | null;
};

type DesignerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const fields = [
  "company_name",
  "customer_name",
  "customer_email",
  "oc_number",
  "oc_date",
  "po_number",
  "delivery_date",
  "payment_terms",
  "shipment_terms",
  "customer_notes",
  "sku_table",
];

function mappingFor(mappings: Mapping[], fieldName: string) {
  return mappings.find((mapping) => mapping.field_name === fieldName) || null;
}

export default async function OCTemplateDesignerPage({
  params,
}: DesignerPageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: templateData, error: templateError } = await supabase
    .from("oc_templates")
    .select("id, company_name, template_name, template_url, storage_path, is_active")
    .eq("id", id)
    .maybeSingle();

  const template = (templateData || null) as Template | null;

  const { data: mappingsData } = await supabase
    .from("oc_template_mappings")
    .select("id, field_name, page_number, x_position, y_position, font_size")
    .eq("template_id", id)
    .order("field_name", { ascending: true });

  const mappings = (mappingsData || []) as Mapping[];

  if (templateError || !template) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Template Designer</h1>

        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {templateError?.message || "Template not found"}
        </div>

        <Link href="/oc-templates" className="px-4 py-2 border rounded-lg">
          Back to OC Templates
        </Link>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Designer</h1>
          <p className="text-sm text-gray-500 mt-1">
            Map OC fields to positions on the uploaded template.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/oc-templates"
            className="px-4 py-2 border rounded-lg text-gray-900 hover:bg-gray-100"
          >
            Back to Templates
          </Link>

          {template.template_url && (
            <a
              href={template.template_url}
              target="_blank"
              className="px-4 py-2 border rounded-lg text-gray-900 hover:bg-gray-100"
            >
              Open PDF
            </a>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-2">
        <div className="text-sm text-gray-500">Template</div>
        <div className="text-xl font-semibold">
          {template.template_name || "Untitled Template"}
        </div>
        <div className="text-sm text-gray-600">
          {template.company_name || ""}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Template Preview</h2>

          {template.template_url ? (
            <iframe
              src={template.template_url}
              className="w-full h-[900px] border rounded-lg"
            />
          ) : (
            <div className="p-6 text-gray-500 border rounded-lg">
              No template PDF available.
            </div>
          )}

          <div className="text-xs text-gray-500">
            Tip: PDF coordinate origin is bottom-left. Start with rough values,
            generate a test OC, then adjust x/y positions.
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Field Mappings</h2>

          <div className="space-y-4">
            {fields.map((field) => {
              const existing = mappingFor(mappings, field);

              return (
                <form
                  key={field}
                  action="/api/oc-templates/save-mapping"
                  method="POST"
                  className="border rounded-xl p-4 space-y-3"
                >
                  <input type="hidden" name="template_id" value={template.id} />
                  <input type="hidden" name="field_name" value={field} />

                  <div className="font-semibold text-sm">{field}</div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Page
                      </label>
                      <input
                        name="page_number"
                        type="number"
                        defaultValue={existing?.page_number || 1}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        X
                      </label>
                      <input
                        name="x_position"
                        type="number"
                        step="0.1"
                        defaultValue={existing?.x_position ?? 50}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Y
                      </label>
                      <input
                        name="y_position"
                        type="number"
                        step="0.1"
                        defaultValue={existing?.y_position ?? 750}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Font
                      </label>
                      <input
                        name="font_size"
                        type="number"
                        defaultValue={existing?.font_size || 10}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                      />
                    </div>
                  </div>

                  <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
                    Save Mapping
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}