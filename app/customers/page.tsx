export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import CustomersTableClient from "@/components/customers-table-client";

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  updated_at: string | null;
  is_active: boolean | null;
};

type CustomerImport = {
  id: string;
  file_name: string | null;
  storage_path: string | null;
  file_type: string | null;
  imported_count: number | null;
  updated_count: number | null;
  skipped_count: number | null;
  created_at: string | null;
};

type PageProps = {
  searchParams: Promise<{
    imported?: string;
    updated?: string;
    skipped?: string;
    deleted?: string;
    restored?: string;
    normalized?: string;
    merged?: string;
    duplicates?: string;
    error?: string;
  }>;
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

function publicImportUrl(storagePath: string | null) {
  if (!storagePath) return "";

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) return "";

  return `${baseUrl}/storage/v1/object/public/oc-documents/${storagePath}`;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      "id, company_name, contact_person, email, phone, city, country, notes, updated_at, is_active"
    )
    .order("company_name", { ascending: true });

  const { data: importsData, error: importsError } = await supabase
    .from("customer_imports")
    .select(
      "id, file_name, storage_path, file_type, imported_count, updated_count, skipped_count, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const customers = (data || []) as Customer[];
  const imports = (importsData || []) as CustomerImport[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage customers manually or upload an existing customer list and let
            Order Engine structure it automatically.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/customers/new"
            className="px-4 py-2 rounded-lg border bg-white text-gray-900 hover:bg-gray-100"
          >
            + Add Customer
          </Link>

          <form action="/api/customers/merge-duplicates" method="POST">
            <button className="px-4 py-2 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100">
              Merge Duplicates
            </button>
          </form>
<form action="/api/customers/normalize-data" method="POST">
  <button className="px-4 py-2 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100">
    Normalize Customer Data
  </button>
</form>

          <Link href="/orders" className="px-4 py-2 border rounded-lg">
            Orders
          </Link>

          <Link href="/oc-templates" className="px-4 py-2 border rounded-lg">
            OC Templates
          </Link>
        </div>
      </div>

      {params.error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {decodeURIComponent(params.error)}
        </div>
      )}

      {(params.imported || params.updated || params.skipped) && (
        <div className="p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
          Import complete. Imported: {params.imported || "0"} · Updated:{" "}
          {params.updated || "0"} · Skipped: {params.skipped || "0"}
        </div>
      )}

      {params.deleted && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-200">
          Deleted {params.deleted} customer(s). Use Undo Delete below if needed.
        </div>
      )}

      {params.restored && (
        <div className="p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
          Restored {params.restored} customer(s).
        </div>
      )}
{params.normalized && (
  <div className="p-4 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
    Normalized {params.normalized} customer record(s).
  </div>
)}

      {params.merged && (
        <div className="p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
          Merged {params.merged} duplicate group(s). Removed{" "}
          {params.duplicates || "0"} duplicate customer record(s).
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error.message}
        </div>
      )}

      {importsError && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {importsError.message}
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Upload Customer List</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload Excel, CSV, PDF, Word, Pages or text files. The system will
            detect customers first, show a preview, and import only after you
            confirm.
          </p>
        </div>

        <form
          action="/api/customers/import"
          method="POST"
          encType="multipart/form-data"
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Customer List File
            </label>

            <input
              name="customer_file"
              type="file"
              required
              accept=".csv,.txt,.pdf,.doc,.docx,.pages,.xlsx,.xls,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white"
            />

            <p className="text-xs text-gray-500 mt-2">
              Best format is Excel or CSV. PDF, Word and Pages files will be
              converted to text first and shown for review before import.
            </p>
          </div>

          <button className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
            Upload & Preview Customers
          </button>
        </form>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Recent Customer Imports</h2>
          <p className="text-sm text-gray-500 mt-1">
            View uploaded customer files and import results.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Uploaded File</th>
                <th className="p-3 border text-left">Type</th>
                <th className="p-3 border text-left">Imported</th>
                <th className="p-3 border text-left">Updated</th>
                <th className="p-3 border text-left">Skipped</th>
                <th className="p-3 border text-left">Uploaded On</th>
                <th className="p-3 border text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {imports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    No customer import files uploaded yet
                  </td>
                </tr>
              ) : (
                imports.map((item) => {
                  const fileUrl = publicImportUrl(item.storage_path);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3 border font-medium">
                        {item.file_name || "Untitled file"}
                      </td>

                      <td className="p-3 border">{item.file_type || ""}</td>

                      <td className="p-3 border">
                        {item.imported_count || 0}
                      </td>

                      <td className="p-3 border">
                        {item.updated_count || 0}
                      </td>

                      <td className="p-3 border">
                        {item.skipped_count || 0}
                      </td>

                      <td className="p-3 border whitespace-nowrap">
                        {formatDateTime(item.created_at)}
                      </td>

                      <td className="p-3 border">
                        <div className="flex gap-2 flex-wrap">
                          {fileUrl ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 border hover:bg-gray-200"
                            >
                              View File
                            </a>
                          ) : (
                            <span className="px-4 py-2 rounded-lg bg-gray-50 text-gray-400 border">
                              No File
                            </span>
                          )}

                          <form
                            action="/api/customers/import-files/delete"
                            method="POST"
                          >
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="hidden"
                              name="storage_path"
                              value={item.storage_path || ""}
                            />

                            <button className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomersTableClient customers={customers} />
    </div>
  );
}