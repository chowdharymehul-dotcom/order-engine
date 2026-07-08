"use client";

import { useState } from "react";

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
};

type ConnectionOption = {
  id: string;
  label: string;
};

function clean(value: any) {
  return String(value || "").trim();
}

function defaultMessage(customer: Customer) {
  const name =
    clean(customer.contact_person) || clean(customer.company_name) || "there";

  return `Dear ${name},

I hope you are doing well.

Best regards`;
}

export default function CustomerEmailClient({
  customer,
  connections,
}: {
  customer: Customer;
  connections: ConnectionOption[];
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(defaultMessage(customer));
  const [emailType, setEmailType] = useState("sales_follow_up");
  const [tone, setTone] = useState("professional");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  async function generateAiEmail() {
    try {
      setIsGenerating(true);
      setAiError("");

      const res = await fetch("/api/customers/ai-email-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
          email_type: emailType,
          tone,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate AI email");
      }

      setSubject(data.subject || "");
      setMessage(data.message || "");
    } catch (error: any) {
      setAiError(error?.message || "Failed to generate AI email");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Generate Email With AI</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Type</label>
            <select
              value={emailType}
              onChange={(event) => setEmailType(event.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
            >
              <option value="sales_follow_up">Sales Follow Up</option>
              <option value="quotation_follow_up">Quotation Follow Up</option>
              <option value="order_follow_up">Order Follow Up</option>
              <option value="re_engagement">Re-engagement Email</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tone</label>
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="luxury">Luxury</option>
              <option value="short_direct">Short & Direct</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={generateAiEmail}
              disabled={isGenerating}
              className="w-full px-5 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate With AI"}
            </button>
          </div>
        </div>

        {aiError && (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            {aiError}
          </div>
        )}
      </div>

      <form
        action="/api/customers/send-email"
        method="POST"
        className="bg-white border rounded-xl p-6 space-y-5"
      >
        <input type="hidden" name="customer_id" value={customer.id} />
        <input type="hidden" name="to" value={customer.email || ""} />

        <div>
          <label className="block text-sm font-medium mb-1">Send From</label>
          <select
            name="connection_id"
            required
            className="w-full border rounded-lg px-4 py-3 text-sm bg-white"
            disabled={connections.length === 0}
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
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            value={customer.email || ""}
            readOnly
            className="w-full border rounded-lg px-4 py-3 text-sm bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            name="subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Enter subject"
            className="w-full border rounded-lg px-4 py-3 text-sm"
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
            className="w-full border rounded-lg px-4 py-3 text-sm"
          />
        </div>

        <button
          disabled={!customer.email || connections.length === 0}
          className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
        >
          Send Email
        </button>
      </form>
    </div>
  );
}