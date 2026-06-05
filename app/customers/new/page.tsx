export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

export default function NewCustomerPage() {
  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Add Customer</h1>

        <Link href="/customers" className="px-4 py-2 border rounded-lg">
          Back to Customers
        </Link>
      </div>

      <form action="/api/customers/save" method="POST" className="space-y-8">
        <input type="hidden" name="id" value="" />

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Customer Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Customer Company Name
              </label>
              <input
                name="company_name"
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
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Buyer Phone
              </label>
              <input
                name="phone"
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Customer Website
              </label>
              <input
                name="website"
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
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Address Line 2
              </label>
              <input
                name="address_line_2"
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                name="city"
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input
                name="state"
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input
                name="country"
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Postal Code
              </label>
              <input
                name="postal_code"
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
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                PAN / Company Tax ID
              </label>
              <input
                name="pan_number"
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                IEC / Importer Code
              </label>
              <input
                name="iec_number"
                className="w-full border rounded-lg px-4 py-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Notes</h2>

          <textarea
            name="notes"
            placeholder="Add buyer preferences, special instructions, shipping preferences, documentation requirements, etc."
            className="w-full border rounded-lg px-4 py-3 text-sm min-h-32"
          />
        </div>

        <button className="px-6 py-3 rounded-lg bg-gray-900 text-white text-sm">
          Save Customer
        </button>
      </form>
    </div>
  );
}