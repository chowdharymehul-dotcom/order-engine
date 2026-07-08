"use client";

import { useMemo, useState } from "react";

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
};

export default function BulkCustomerEmailClient({
  customers,
  connections,
}: {
  customers: Customer[];
  connections: {
    id: string;
    label: string;
  }[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeCustomers, setActiveCustomers] =
    useState<Customer[]>(customers);

  const [aiPrompt, setAiPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const customersWithEmail = useMemo(
    () =>
      activeCustomers.filter(
        (customer) => customer.email && customer.email.trim()
      ),
    [activeCustomers]
  );

  const customersWithoutEmail = useMemo(
    () =>
      activeCustomers.filter(
        (customer) => !customer.email || !customer.email.trim()
      ),
    [activeCustomers]
  );

  function toggleCustomer(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function removeCustomer(id: string) {
    setActiveCustomers((current) =>
      current.filter((customer) => customer.id !== id)
    );

    setSelectedIds((current) => current.filter((item) => item !== id));
  }

  function removeSelected() {
    setActiveCustomers((current) =>
      current.filter((customer) => !selectedIds.includes(customer.id))
    );

    setSelectedIds([]);
  }

  function removeMissingEmails() {
    setActiveCustomers((current) =>
      current.filter((customer) => customer.email && customer.email.trim())
    );

    setSelectedIds([]);
  }

  async function generateWithAI() {
    setAiError("");

    if (!aiPrompt.trim()) {
      setAiError("Please describe what email you want AI to write.");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/customers/generate-email-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: aiPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate email draft");
      }

      setSubject(data.subject || "");
      setMessage(data.message || "");
    } catch (error: any) {
      setAiError(error?.message || "Failed to generate email draft");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{activeCustomers.length}</div>
          <div className="text-sm text-gray-500">Selected Customers</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{customersWithEmail.length}</div>
          <div className="text-sm text-gray-500">Ready To Email</div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">
            {customersWithoutEmail.length}
          </div>
          <div className="text-sm text-gray-500">Missing Email</div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">AI Email Writer</h2>
          <p className="text-sm text-gray-500 mt-1">
            Describe the email you want to send. AI will create a subject and
            message that you can edit before sending.
          </p>
        </div>

        {aiError && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
            {aiError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            What should this email say?
          </label>

          <textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            rows={4}
            placeholder="Example: Write a warm email to New York buyers introducing our new summer collection and asking if they would like to see samples."
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={generateWithAI}
          disabled={isGenerating}
          className="px-5 py-3 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Generate with AI"}
        </button>
      </div>

      <form
        action="/api/customers/send-bulk-email"
        method="POST"
        className="bg-white border rounded-xl p-6 space-y-5"
      >
        {customersWithEmail.map((customer) => (
          <input
            key={customer.id}
            type="hidden"
            name="customer_ids"
            value={customer.id}
          />
        ))}

        <div>
          <label className="block text-sm font-medium mb-1">Send From</label>

          <select
            name="connection_id"
            required
            className="w-full border rounded-lg px-4 py-3"
          >
            <option value="">Select connected email account</option>

            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>

          <input
            name="subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message</label>

          <textarea
            name="message"
            required
            rows={12}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full border rounded-lg px-4 py-3"
          />
        </div>

        <button
          disabled={customersWithEmail.length === 0}
          className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          Send To {customersWithEmail.length} Customer(s)
        </button>
      </form>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3">
          <button
            type="button"
            onClick={removeSelected}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border disabled:opacity-50"
          >
            Remove Selected ({selectedIds.length})
          </button>

          <button
            type="button"
            onClick={removeMissingEmails}
            disabled={customersWithoutEmail.length === 0}
            className="px-4 py-2 rounded-lg bg-yellow-50 text-yellow-700 border disabled:opacity-50"
          >
            Remove Missing Emails
          </button>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border"></th>
              <th className="p-3 border text-left">Customer</th>
              <th className="p-3 border text-left">Contact</th>
              <th className="p-3 border text-left">Email</th>
              <th className="p-3 border text-left">City</th>
              <th className="p-3 border text-left">Country</th>
              <th className="p-3 border text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {activeCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No recipients remaining.
                </td>
              </tr>
            ) : (
              activeCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="p-3 border">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(customer.id)}
                      onChange={() => toggleCustomer(customer.id)}
                    />
                  </td>

                  <td className="p-3 border">{customer.company_name}</td>

                  <td className="p-3 border">{customer.contact_person}</td>

                  <td className="p-3 border">{customer.email}</td>

                  <td className="p-3 border">{customer.city}</td>

                  <td className="p-3 border">{customer.country}</td>

                  <td className="p-3 border">
                    <button
                      type="button"
                      onClick={() => removeCustomer(customer.id)}
                      className="px-3 py-1 rounded bg-red-100 text-red-700"
                    >
                      Remove
                    </button>
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