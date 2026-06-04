export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type OCTemplate = {
  id: string;
  company_name: string | null;
  template_name: string | null;
  template_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function OCTemplatesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("oc_templates")
    .select("id, company_name, template_name, template_url, is_active, created_at")
    .order("created_at", { ascending: false });

  const templates = (data || []) as OCTemplate[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">OC Templates</h1>

        <div className="flex gap-3">
          <Link href="/orders" className="px-4 py-2 border rounded-lg">
            Orders
          </Link>

          <Link href="/" className="px-4 py-2 border rounded-lg">
            Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error.message}
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Upload Company OC Format</h2>

        <p className="text-sm text-gray-600">
          Upload the company’s existing Order Confirmation PDF as a reference.
          The generated OC will use your company details and extracted order
          data. Later we can map the exact visual layout field-by-field.
        </p>

        <form
          action="/api/oc-templates/upload"
          method="POST"
          encType="multipart/form-data"
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Company Name
            </label>
            <input
              name="company_name"
              required
              placeholder="Pinx International"
              className="w-full border rounded-lg px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Template Name
            </label>
            <input
              name="template_name"
              required
              placeholder="Default OC Format"
              className="w-full border rounded-lg px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Upload PDF
            </label>
            <input
              name="template_file"
              type="file"
              accept="application/pdf"
              required
              className="w-full border rounded-lg px-4 py-3 text-sm"
            />
          </div>

          <button className="px-5 py-3 rounded-lg bg-gray-900 text-white text-sm">
            Upload Template
          </button>
        </form>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Uploaded Templates</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Created</th>
                <th className="p-3 border text-left">Company</th>
                <th className="p-3 border text-left">Template</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">File</th>
              </tr>
            </thead>

            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No OC templates uploaded yet
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="p-3 border whitespace-nowrap">
                      {formatDateTime(template.created_at)}
                    </td>

                    <td className="p-3 border">
                      {template.company_name || ""}
                    </td>

                    <td className="p-3 border">
                      {template.template_name || ""}
                    </td>

                    <td className="p-3 border">
                      {template.is_active ? "Active" : "Inactive"}
                    </td>

                    <td className="p-3 border">
                      {template.template_url ? (
                        <a
                          href={template.template_url}
                          target="_blank"
                          className="text-blue-700 hover:underline"
                        >
                          View PDF
                        </a>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}