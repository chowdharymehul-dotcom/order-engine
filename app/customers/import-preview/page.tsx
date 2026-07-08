export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  searchParams: Promise<{
    draft?: string;
  }>;
};

type ImportedCustomer = {
  company_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  gst_number?: string;
  pan_number?: string;
  iec_number?: string;
  notes?: string;
};

type ImportDraft = {
  id: string;
  file_name: string | null;
  storage_path: string | null;
  file_type: string | null;
  detected_count: number | null;
  customers: ImportedCustomer[] | null;
  status: string | null;
  created_at: string | null;
};

function value(input: any) {
  if (input === null || input === undefined) return "";
  return String(input);
}

function formatDateTime(input: string | null) {
  if (!input) return "";

  const date = new Date(input);

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

function publicImportUrl(storagePath: string | null) {
  if (!storagePath) return "";

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) return "";

  return `${baseUrl}/storage/v1/object/public/oc-documents/${storagePath}`;
}

export default async function CustomerImportPreviewPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const draftId = params.draft || "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: draftData, error } = draftId
    ? await supabase
        .from("customer_import_drafts")
        .select(
          "id, file_name, storage_path, file_type, detected_count, customers, status, created_at"
        )
        .eq("id", draftId)
        .maybeSingle()
    : { data: null, error: null };

  const draft = (draftData || null) as ImportDraft | null;
  const customers = Array.isArray(draft?.customers) ? draft.customers : [];
  const fileUrl = publicImportUrl(draft?.storage_path || "");

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Import Preview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review detected customers before importing them into your customer
            master.
          </p>
        </div>

        <div className="flex gap-3">
          <Link href="/customers" className="px-4 py-2 border rounded-lg">
            Back to Customers
          </Link>

          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              className="px-4 py-2 border rounded-lg"
            >
              View Uploaded File
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error.message}
        </div>
      )}

      {!draft && (
        <div className="p-6 rounded-xl border bg-yellow-50 text-yellow-800">
          Import draft not found.
        </div>
      )}

      {draft && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Detected Records"
              value={String(draft.detected_count || 0)}
            />
            <SummaryCard
              label="Preview Customers"
              value={String(customers.length)}
            />
            <SummaryCard label="Status" value={draft.status || "draft"} />
            <SummaryCard
              label="Uploaded"
              value={formatDateTime(draft.created_at)}
            />
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-2">
            <div className="text-sm text-gray-500">Uploaded File</div>
            <div className="text-lg font-semibold">
              {draft.file_name || "Untitled file"}
            </div>
            <div className="text-sm text-gray-500">
              {draft.file_type || ""}
            </div>
          </div>

          {(draft.detected_count || 0) > customers.length && (
            <div className="p-4 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-200">
              Detected {draft.detected_count || 0} records but only prepared{" "}
              {customers.length} customers. Please review before importing.
            </div>
          )}

          <div className="flex gap-3">
            <form action="/api/customers/import-confirm" method="POST">
              <input type="hidden" name="draft_id" value={draft.id} />

              <button
                disabled={customers.length === 0}
                className="px-5 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Confirm Import Customers
              </button>
            </form>

            <Link
              href="/customers"
              className="px-5 py-3 rounded-lg bg-gray-100 text-gray-900 border hover:bg-gray-200"
            >
              Cancel
            </Link>
          </div>

          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border text-left">#</th>
                  <th className="p-3 border text-left">Company</th>
                  <th className="p-3 border text-left">Contact</th>
                  <th className="p-3 border text-left">Email</th>
                  <th className="p-3 border text-left">Phone</th>
                  <th className="p-3 border text-left">City</th>
                  <th className="p-3 border text-left">Country</th>
                  <th className="p-3 border text-left">Address</th>
                  <th className="p-3 border text-left">Notes</th>
                </tr>
              </thead>

              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-gray-500">
                      No customers detected
                    </td>
                  </tr>
                ) : (
                  customers.map((customer, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3 border">{index + 1}</td>
                      <td className="p-3 border font-medium">
                        {value(customer.company_name)}
                      </td>
                      <td className="p-3 border">
                        {value(customer.contact_person)}
                      </td>
                      <td className="p-3 border">{value(customer.email)}</td>
                      <td className="p-3 border">{value(customer.phone)}</td>
                      <td className="p-3 border">{value(customer.city)}</td>
                      <td className="p-3 border">{value(customer.country)}</td>
                      <td className="p-3 border">
                        {[customer.address_line_1, customer.address_line_2]
                          .map(value)
                          .filter(Boolean)
                          .join(", ")}
                      </td>
                      <td className="p-3 border">{value(customer.notes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}