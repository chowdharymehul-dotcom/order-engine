export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type SellerProfile = {
  id: string;
  profile_name: string | null;
  company_name: string | null;

  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;

  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;

  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  swift_code: string | null;
  ifsc_code: string | null;

  email: string | null;
  phone: string | null;
  website: string | null;

  logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;

  notes: string | null;
  is_default: boolean | null;
};

type EditSellerProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function value(profile: SellerProfile | null, key: keyof SellerProfile) {
  return profile?.[key] ? String(profile[key]) : "";
}

export default async function EditSellerProfilePage({
  params,
}: EditSellerProfilePageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("seller_profiles")
    .select(
      "id, profile_name, company_name, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number, bank_name, account_name, account_number, swift_code, ifsc_code, email, phone, website, logo_url, signature_url, stamp_url, notes, is_default"
    )
    .eq("id", id)
    .maybeSingle();

  const profile = (data || null) as SellerProfile | null;

  if (error || !profile) {
    return (
      <div className="p-10 space-y-6">
        <h1 className="text-3xl font-bold">Edit Seller Profile</h1>

        <div className="p-4 rounded-lg bg-red-50 text-red-700">
          {error?.message || "Seller profile not found"}
        </div>

        <Link href="/seller-profiles" className="px-4 py-2 border rounded-lg">
          Back to Seller Profiles
        </Link>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Seller Profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            Update seller entity details used for Order Confirmations.
          </p>
        </div>

        <Link href="/seller-profiles" className="px-4 py-2 border rounded-lg">
          Back to Seller Profiles
        </Link>
      </div>

      <form action="/api/seller-profiles/save" method="POST" className="space-y-8">
        <input type="hidden" name="id" value={profile.id} />

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Profile Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              name="profile_name"
              placeholder="Profile Name e.g. Pinx India"
              defaultValue={value(profile, "profile_name")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="company_name"
              placeholder="Company Name"
              required
              defaultValue={value(profile, "company_name")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="email"
              type="email"
              placeholder="Email"
              defaultValue={value(profile, "email")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="phone"
              placeholder="Phone"
              defaultValue={value(profile, "phone")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="website"
              placeholder="Website"
              defaultValue={value(profile, "website")}
              className="border rounded-lg px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Address</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              name="address_line_1"
              placeholder="Address Line 1"
              defaultValue={value(profile, "address_line_1")}
              className="border rounded-lg px-4 py-3 text-sm md:col-span-2"
            />

            <input
              name="address_line_2"
              placeholder="Address Line 2"
              defaultValue={value(profile, "address_line_2")}
              className="border rounded-lg px-4 py-3 text-sm md:col-span-2"
            />

            <input
              name="city"
              placeholder="City"
              defaultValue={value(profile, "city")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="state"
              placeholder="State"
              defaultValue={value(profile, "state")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="country"
              placeholder="Country"
              defaultValue={value(profile, "country")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="postal_code"
              placeholder="Postal Code"
              defaultValue={value(profile, "postal_code")}
              className="border rounded-lg px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Tax Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              name="gst_number"
              placeholder="GST / VAT"
              defaultValue={value(profile, "gst_number")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="pan_number"
              placeholder="PAN / Tax ID"
              defaultValue={value(profile, "pan_number")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="iec_number"
              placeholder="IEC"
              defaultValue={value(profile, "iec_number")}
              className="border rounded-lg px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Bank Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              name="bank_name"
              placeholder="Bank Name"
              defaultValue={value(profile, "bank_name")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="account_name"
              placeholder="Account Name"
              defaultValue={value(profile, "account_name")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="account_number"
              placeholder="Account Number"
              defaultValue={value(profile, "account_number")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="swift_code"
              placeholder="SWIFT"
              defaultValue={value(profile, "swift_code")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="ifsc_code"
              placeholder="IFSC"
              defaultValue={value(profile, "ifsc_code")}
              className="border rounded-lg px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Branding</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              name="logo_url"
              placeholder="Logo URL"
              defaultValue={value(profile, "logo_url")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="signature_url"
              placeholder="Signature URL"
              defaultValue={value(profile, "signature_url")}
              className="border rounded-lg px-4 py-3 text-sm"
            />

            <input
              name="stamp_url"
              placeholder="Stamp URL"
              defaultValue={value(profile, "stamp_url")}
              className="border rounded-lg px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Settings</h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_default"
              value="true"
              defaultChecked={profile.is_default === true}
            />
            Set as default seller profile
          </label>

          <textarea
            name="notes"
            placeholder="Notes"
            defaultValue={value(profile, "notes")}
            className="w-full border rounded-lg px-4 py-3 text-sm min-h-28"
          />
        </div>

        <button className="px-6 py-3 rounded-lg bg-gray-900 text-white text-sm">
          Save Seller Profile
        </button>
      </form>
    </div>
  );
}