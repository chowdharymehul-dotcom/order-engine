"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

const KNOWN_COUNTRIES = [
  "AUSTRALIA",
  "BRAZIL",
  "CANADA",
  "CHINA",
  "COLOMBIA",
  "FRANCE",
  "GERMANY",
  "HONG KONG",
  "INDIA",
  "ITALY",
  "JAPAN",
  "KOREA",
  "MEXICO",
  "NEW ZEALAND",
  "PORTUGAL",
  "PUERTO RICO",
  "SPAIN",
  "TAIWAN",
  "UAE",
  "UK",
  "USA",
];

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

function clean(value: string | null) {
  return String(value || "").trim();
}

function lower(value: string | null) {
  return clean(value).toLowerCase();
}

function hasNumbers(value: string) {
  return /\d/.test(value);
}

function looksLikeStreetOrAddress(value: string) {
  const text = value.toUpperCase();

  return (
    hasNumbers(text) ||
    /\b(ST|STREET|AVE|AVENUE|ROAD|RD|BLVD|BOULEVARD|DR|DRIVE|PLACE|PL|SUITE|STE|FLOOR|FL|APT|UNIT|#)\b/.test(
      text
    )
  );
}

function isValidCountry(value: string) {
  const text = clean(value).toUpperCase();

  if (!text) return false;

  return KNOWN_COUNTRIES.includes(text);
}

function isValidCity(value: string) {
  const text = clean(value);

  if (!text) return false;
  if (text.length < 2) return false;
  if (text.length > 40) return false;
  if (looksLikeStreetOrAddress(text)) return false;

  return true;
}

function uniqueSorted(values: string[]) {
  return Array.from(
    new Set(values.map((value) => clean(value)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export default function CustomersTableClient({
  customers,
}: {
  customers: Customer[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const activeCustomers = useMemo(
    () => customers.filter((customer) => customer.is_active !== false),
    [customers]
  );

  const deletedCustomers = useMemo(
    () => customers.filter((customer) => customer.is_active === false),
    [customers]
  );

  const countries = useMemo(() => {
    return uniqueSorted(
      activeCustomers
        .map((customer) => clean(customer.country).toUpperCase())
        .filter(isValidCountry)
    );
  }, [activeCustomers]);

  const cities = useMemo(() => {
    const source = countryFilter
      ? activeCustomers.filter(
          (customer) => lower(customer.country) === lower(countryFilter)
        )
      : activeCustomers;

    return uniqueSorted(
      source.map((customer) => customer.city || "").filter(isValidCity)
    );
  }, [activeCustomers, countryFilter]);

  const filteredCustomers = useMemo(() => {
    const query = lower(searchText);

    return activeCustomers.filter((customer) => {
      const matchesCountry =
        !countryFilter || lower(customer.country) === lower(countryFilter);

      const matchesCity =
        !cityFilter || lower(customer.city) === lower(cityFilter);

      const haystack = [
        customer.company_name,
        customer.contact_person,
        customer.email,
        customer.phone,
        customer.city,
        customer.country,
        customer.notes,
      ]
        .map((item) => lower(item))
        .join(" ");

      const matchesSearch = !query || haystack.includes(query);

      return matchesCountry && matchesCity && matchesSearch;
    });
  }, [activeCustomers, searchText, countryFilter, cityFilter]);

  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((customer) => selectedIds.includes(customer.id));

  function toggleCustomer(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !filteredCustomers.some((customer) => customer.id === id)
        )
      );
    } else {
      setSelectedIds((current) =>
        Array.from(
          new Set([
            ...current,
            ...filteredCustomers.map((customer) => customer.id),
          ])
        )
      );
    }
  }

  function clearFilters() {
    setSearchText("");
    setCountryFilter("");
    setCityFilter("");
    setSelectedIds([]);
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="p-4 space-y-4 border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Customer List</h2>
            <p className="text-sm text-gray-500">
              {filteredCustomers.length} shown · {activeCustomers.length} active
              customers · {selectedIds.length} selected
            </p>
          </div>

          <div className="flex gap-2">
            <form action="/api/customers/bulk-delete" method="POST">
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="customer_ids" value={id} />
              ))}

              <button
                disabled={selectedIds.length === 0}
                className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
              >
                Delete Selected
              </button>
            </form>

            <form action="/customers/bulk-email" method="GET">
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="customer_ids" value={id} />
              ))}

              <button
                disabled={selectedIds.length === 0}
                className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
              >
                Email Selected
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Search Customer
            </label>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Name, email, contact, phone..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Filter by Country
            </label>
            <select
              value={countryFilter}
              onChange={(event) => {
                setCountryFilter(event.target.value);
                setCityFilter("");
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All Countries</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Filter by City
            </label>
            <select
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full px-4 py-2 rounded-lg border bg-gray-50 text-gray-900 hover:bg-gray-100 text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border text-left">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">Contact</th>
              <th className="p-3 border text-left">Email</th>
              <th className="p-3 border text-left">Phone</th>
              <th className="p-3 border text-left">City</th>
              <th className="p-3 border text-left">Country</th>
              <th className="p-3 border text-left">Updated</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No customers match the current filters
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="p-3 border">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(customer.id)}
                      onChange={() => toggleCustomer(customer.id)}
                    />
                  </td>

                  <td className="p-3 border font-medium">
                    {customer.company_name || ""}
                  </td>

                  <td className="p-3 border">
                    {customer.contact_person || ""}
                  </td>

                  <td className="p-3 border">{customer.email || ""}</td>

                  <td className="p-3 border">{customer.phone || ""}</td>

                  <td className="p-3 border">{customer.city || ""}</td>

                  <td className="p-3 border">{customer.country || ""}</td>

                  <td className="p-3 border whitespace-nowrap">
                    {formatDateTime(customer.updated_at)}
                  </td>

                  <td className="p-3 border">
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        href={`/customers/${customer.id}/dashboard`}
                        className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                      >
                        Dashboard
                      </Link>

                      <Link
                        href={`/customers/${customer.id}/email`}
                        className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      >
                        Email
                      </Link>

                      <Link
                        href="/sales-followups/new"
                        className="px-4 py-2 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100"
                      >
                        Follow Up
                      </Link>

                      <Link
                        href={`/customers/${customer.id}/timeline`}
                        className="px-4 py-2 rounded-lg bg-gray-100 border hover:bg-gray-200"
                      >
                        Timeline
                      </Link>

                      <Link
                        href={`/customers/${customer.id}/edit`}
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                      >
                        Edit
                      </Link>

                      <form action="/api/customers/delete" method="POST">
                        <input type="hidden" name="id" value={customer.id} />

                        <button className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
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

      {deletedCustomers.length > 0 && (
        <div className="border-t p-4 space-y-3 bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold">Recently Deleted Customers</h3>
            <p className="text-sm text-gray-500">
              Restore customers that were deleted by mistake.
            </p>
          </div>

          <form action="/api/customers/undo-delete" method="POST">
            {deletedCustomers.map((customer) => (
              <input
                key={customer.id}
                type="hidden"
                name="customer_ids"
                value={customer.id}
              />
            ))}

            <button className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100">
              Undo Delete All ({deletedCustomers.length})
            </button>
          </form>
        </div>
      )}
    </div>
  );
}