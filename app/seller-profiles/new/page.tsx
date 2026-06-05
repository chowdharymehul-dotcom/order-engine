export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

const inputClass =
  "border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400";

const textareaClass =
  "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 min-h-28 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400";

export default function NewSellerProfilePage() {
  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Add Seller Profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add a seller entity for Order Confirmations.
          </p>
        </div>

        <Link href="/seller-profiles" className="px-4 py-2 border rounded-lg">
          Back to Seller Profiles
        </Link>
      </div>

      <form action="/api/seller-profiles/save" method="POST" className="space-y-8">
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Profile Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="profile_name" placeholder="Profile Name e.g. Pinx India" className={inputClass} />
            <input name="company_name" placeholder="Company Name" required className={inputClass} />
            <input name="email" type="email" placeholder="Email" className={inputClass} />
            <input name="phone" placeholder="Phone" className={inputClass} />
            <input name="website" placeholder="Website" className={inputClass} />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Address</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="address_line_1" placeholder="Address Line 1" className={`${inputClass} md:col-span-2`} />
            <input name="address_line_2" placeholder="Address Line 2" className={`${inputClass} md:col-span-2`} />
            <input name="city" placeholder="City" className={inputClass} />
            <input name="state" placeholder="State" className={inputClass} />
            <input name="country" placeholder="Country" className={inputClass} />
            <input name="postal_code" placeholder="Postal Code" className={inputClass} />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Tax Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input name="gst_number" placeholder="GST / VAT" className={inputClass} />
            <input name="pan_number" placeholder="PAN / Tax ID" className={inputClass} />
            <input name="iec_number" placeholder="IEC" className={inputClass} />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Bank Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="bank_name" placeholder="Bank Name" className={inputClass} />
            <input name="account_name" placeholder="Account Name" className={inputClass} />
            <input name="account_number" placeholder="Account Number" className={inputClass} />
            <input name="swift_code" placeholder="SWIFT" className={inputClass} />
            <input name="ifsc_code" placeholder="IFSC" className={inputClass} />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Branding</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input name="logo_url" placeholder="Logo URL" className={inputClass} />
            <input name="signature_url" placeholder="Signature URL" className={inputClass} />
            <input name="stamp_url" placeholder="Stamp URL" className={inputClass} />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Settings</h2>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="is_default" value="true" className="accent-gray-600" />
            Set as default seller profile
          </label>

          <textarea name="notes" placeholder="Notes" className={textareaClass} />
        </div>

        <button className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
          Save Seller Profile
        </button>
      </form>
    </div>
  );
}