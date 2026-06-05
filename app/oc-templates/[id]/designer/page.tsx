export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import OCTemplateClickDesigner from "@/components/OCTemplateClickDesigner";

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
  display_label: string | null;
  field_type: string | null;
  page_number: number | null;
  x_position: number | null;
  y_position: number | null;
  font_size: number | null;
};

type TemplateColumn = {
  id: string;
  display_label: string | null;
  source_field: string | null;
  column_order: number | null;
};

type DesignerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
    .select(
      "id, company_name, template_name, template_url, storage_path, is_active"
    )
    .eq("id", id)
    .maybeSingle();

  const template = (templateData || null) as Template | null;

  const { data: mappingsData } = await supabase
    .from("oc_template_mappings")
    .select(
      "id, field_name, display_label, field_type, page_number, x_position, y_position, font_size"
    )
    .eq("template_id", id)
    .order("field_name", { ascending: true });

  const mappings = (mappingsData || []) as Mapping[];

  const { data: columnsData } = await supabase
    .from("oc_template_columns")
    .select("id, display_label, source_field, column_order")
    .eq("template_id", id)
    .order("column_order", { ascending: true });

  const columns = (columnsData || []) as TemplateColumn[];

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
            Map header fields and define table columns for this OC template.
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

      <OCTemplateClickDesigner
        template={template}
        mappings={mappings}
        columns={columns}
      />
    </div>
  );
}