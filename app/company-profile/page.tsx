export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type ClientProfile = {
  id: string;
  company_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;
  notes: string | null;
  is_active: boolean | null;
};

function value(profile: ClientProfile | null, key: keyof ClientProfile) {
  return profile?.[key] ? String(profile[key]) : "";
}

export default async function ClientDirectoryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      "id, company_name, address_line_1, address_line_2, city, state, country, postal_code, contact_person, email, phone, website, gst_number, pan_number, iec_number, notes, is_active"
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const profile = (data || null) as ClientProfile | null;

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Client Directory</h1>

        <div className="flex gap-3">
          <Link href="/orders" className="px-4 py-2 border rounded-lg">
            Orders
          </Link>

          <Link href="/oc-templates" className="px-4 py-2 border rounded-lg">
            OC Templates
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

      <form
        action="/api/company-profile/save"
        method="POST"
        className="space-y-8"
      >
        <input type="hidden" name="id" value={profile?.id || ""} />

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Customer Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Customer Company Name
              </label>
              <input
                name="company_name"
                defaultValue={value(profile, "company_name")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Buyer Contact Person
              </label>
              <input
                name="contact_person"
                defaultValue={value(profile, "contact_person")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Buyer Email
              </label>
              <input
                name="email"
                type="email"
                defaultValue={value(profile, "email")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Buyer Phone
              </label>
              <input
                name="phone"
                defaultValue={value(profile, "phone")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Customer Website
              </label>
              <input
                name="website"
                defaultValue={value(profile, "website")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Buyer Address</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Address Line 1
              </label>
              <input
                name="address_line_1"
                defaultValue={value(profile, "address_line_1")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Address Line 2
              </label>
              <input
                name="address_line_2"
                defaultValue={value(profile, "address_line_2")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                name="city"
                defaultValue={value(profile, "city")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input
                name="state"
                defaultValue={value(profile, "state")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input
                name="country"
                defaultValue={value(profile, "country")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Postal Code
              </label>
              <input
                name="postal_code"
                defaultValue={value(profile, "postal_code")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Tax / Import Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                GST / VAT / Tax Number
              </label>
              <input
                name="gst_number"
                defaultValue={value(profile, "gst_number")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                PAN / Company Tax ID
              </label>
              <input
                name="pan_number"
                defaultValue={value(profile, "pan_number")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                IEC / Importer Code
              </label>
              <input
                name="iec_number"
                defaultValue={value(profile, "iec_number")}
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Notes</h2>

          <div>
            <label className="block text-sm font-medium mb-1">
              Miscellaneous Information
            </label>
            <textarea
              name="notes"
              defaultValue={value(profile, "notes")}
              placeholder="Add buyer preferences, special instructions, shipping preferences, internal notes, documentation requirements, etc."
              className="w-full border rounded-lg px-4 py-3 text-sm min-h-32"
            />
          </div>
        </div>

        <button className="px-6 py-3 rounded-lg bg-gray-900 text-white text-sm">
          Save Client
        </button>
      </form>
    </div>
  );
}