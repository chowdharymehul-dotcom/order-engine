export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type OCTemplate = {
  id: string;
  seller_profile_id: string | null;
  company_name: string | null;
  template_name: string | null;
  template_type: string | null;
  template_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
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

function sellerNameFor(template: OCTemplate, sellers: SellerProfile[]) {
  const seller = sellers.find((item) => item.id === template.seller_profile_id);
  return seller?.profile_name || seller?.company_name || "";
}

function templateTypeLabel(type: string | null) {
  if (type === "sample") return "Sample Completed OC";
  return "Blank Template";
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400";

export default async function OCTemplatesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: templatesData, error } = await supabase
    .from("oc_templates")
    .select(
      "id, seller_profile_id, company_name, template_name, template_type, template_url, is_active, created_at"
    )
    .order("created_at", { ascending: false });

  const { data: sellersData } = await supabase
    .from("seller_profiles")
    .select("id, profile_name, company_name")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true });

  const templates = (templatesData || []) as OCTemplate[];
  const sellers = (sellersData || []) as SellerProfile[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OC Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload blank formats or sample completed OCs, then map fields for
            template-based PDF generation.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/orders"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-100"
          >
            Orders
          </Link>

          <Link
            href="/seller-profiles"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-100"
          >
            Seller Profiles
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error.message}
        </div>
      )}

      {sellers.length === 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          Please create at least one Seller Profile before uploading an OC
          template.
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Upload Seller OC Format</h2>

        <p className="text-sm text-gray-600">
          Upload either a blank OC format or a sample completed OC. Blank
          templates are ideal. Sample completed OCs can also be used, and mapped
          fields can later cover old sample values with white boxes.
        </p>

        <form
          action="/api/oc-templates/upload"
          method="POST"
          encType="multipart/form-data"
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Seller Profile
            </label>

            <select
              name="seller_profile_id"
              required
              className={inputClass}
              disabled={sellers.length === 0}
            >
              <option value="">Select seller profile</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.profile_name || seller.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Template Type
            </label>

            <select name="template_type" required className={inputClass}>
              <option value="blank">Blank Template</option>
              <option value="sample">Sample Completed OC</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Company Name
            </label>
            <input
              name="company_name"
              required
              placeholder="Pinx International"
              className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
              disabled={sellers.length === 0}
            />
          </div>

          <button
            className="px-5 py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-50"
            disabled={sellers.length === 0}
          >
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
                <th className="p-3 border text-left">Seller Profile</th>
                <th className="p-3 border text-left">Company</th>
                <th className="p-3 border text-left">Template</th>
                <th className="p-3 border text-left">Type</th>
                <th className="p-3 border text-left">Status</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
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
                      {sellerNameFor(template, sellers) || "Unassigned"}
                    </td>

                    <td className="p-3 border">
                      {template.company_name || ""}
                    </td>

                    <td className="p-3 border">
                      {template.template_name || ""}
                    </td>

                    <td className="p-3 border">
                      {templateTypeLabel(template.template_type)}
                    </td>

                    <td className="p-3 border">
                      {template.is_active ? (
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs border">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-gray-50 text-gray-500 text-xs border">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="p-3 border">
                      <div className="flex gap-2 flex-wrap">
                        {template.template_url && (
                          <a
                            href={template.template_url}
                            target="_blank"
                            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 border hover:bg-gray-200"
                          >
                            View PDF
                          </a>
                        )}

                        <Link
                          href={`/oc-templates/${template.id}/designer`}
                          className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 border border-gray-300 hover:bg-gray-300"
                        >
                          Design Template
                        </Link>
                      </div>
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