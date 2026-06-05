export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
  updated_at: string | null;
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

export default async function SellerProfilesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("seller_profiles")
    .select(
      "id, profile_name, company_name, email, phone, city, country, is_default, is_active, updated_at"
    )
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true });

  const sellerProfiles = (data || []) as SellerProfile[];

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage seller entities used for Order Confirmations.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/seller-profiles/new"
            className="px-5 py-3 rounded-lg bg-gray-200 text-gray-900 border border-gray-300 hover:bg-gray-300 font-medium"
          >
            + Add Seller Profile
          </Link>

          <Link
            href="/orders"
            className="px-5 py-3 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-100 font-medium"
          >
            Orders
          </Link>

          <Link
            href="/oc-templates"
            className="px-5 py-3 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-100 font-medium"
          >
            OC Templates
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error.message}
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">Profile</th>
              <th className="p-3 border text-left">Company</th>
              <th className="p-3 border text-left">Email</th>
              <th className="p-3 border text-left">Phone</th>
              <th className="p-3 border text-left">City</th>
              <th className="p-3 border text-left">Country</th>
              <th className="p-3 border text-left">Default</th>
              <th className="p-3 border text-left">Updated</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {sellerProfiles.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No seller profiles found.
                </td>
              </tr>
            ) : (
              sellerProfiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50">
                  <td className="p-3 border font-medium">
                    {profile.profile_name || ""}
                  </td>

                  <td className="p-3 border">
                    {profile.company_name || ""}
                  </td>

                  <td className="p-3 border">{profile.email || ""}</td>

                  <td className="p-3 border">{profile.phone || ""}</td>

                  <td className="p-3 border">{profile.city || ""}</td>

                  <td className="p-3 border">{profile.country || ""}</td>

                  <td className="p-3 border">
                    {profile.is_default ? (
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs border">
                        Default
                      </span>
                    ) : (
                      ""
                    )}
                  </td>

                  <td className="p-3 border whitespace-nowrap">
                    {formatDateTime(profile.updated_at)}
                  </td>

                  <td className="p-3 border">
                    <div className="flex gap-2">
                      <Link
                        href={`/seller-profiles/${profile.id}/edit`}
                        className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border hover:bg-gray-200"
                      >
                        Edit
                      </Link>

                      <form action="/api/seller-profiles/delete" method="POST">
                        <input type="hidden" name="id" value={profile.id} />

                        <button className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}