"use client";

import { useState } from "react";

type SellerProfile = {
  id: string;
  label: string;
};

type Props = {
  ids: string;
  sellers: SellerProfile[];
  buttonClassName?: string;
};

export default function GenerateOCButton({
  ids,
  sellers,
  buttonClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sellerProfileId, setSellerProfileId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateOC() {
    try {
      setError("");

      if (!sellerProfileId) {
        setError("Please select a seller profile.");
        return;
      }

      setLoading(true);

      const formData = new FormData();
      formData.append("ids", ids);
      formData.append("seller_profile_id", sellerProfileId);

      const response = await fetch("/api/orders/generate-oc", {
        method: "POST",
        body: formData,
        redirect: "follow",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate OC");
      }

      window.location.href = response.url || "/orders";
    } catch (err: any) {
      setError(err?.message || "Failed to generate OC");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={sellers.length === 0}
        className={
          buttonClassName ||
          "px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
        }
      >
        Generate OC
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Select Seller Profile</h2>
              <p className="text-sm text-gray-500 mt-1">
                This seller profile’s approved OC template will be used.
              </p>
            </div>

            <div className="space-y-4">
              <select
                required
                value={sellerProfileId}
                onChange={(event) => setSellerProfileId(event.target.value)}
                className="w-full border rounded-lg px-4 py-3 bg-white"
              >
                <option value="">Select Seller Profile</option>

                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.label}
                  </option>
                ))}
              </select>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError("");
                  }}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={generateOC}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate OC"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}