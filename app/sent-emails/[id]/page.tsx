export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EmailLog = {
  id: string;
  customer_id: string | null;
  provider: string | null;
  sender_account: string | null;
  recipient_email: string | null;
  subject: string | null;
  message: string | null;
  send_type: string | null;
  status: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
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

function statusClass(status: string | null) {
  if (status === "sent") return "bg-green-50 text-green-700 border-green-200";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-200";
  if (status === "skipped")
    return "bg-yellow-50 text-yellow-700 border-yellow-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

export default async function SentEmailDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: logData, error: logError } = await supabase
    .from("customer_email_logs")
    .select(
      "id, customer_id, provider, sender_account, recipient_email, subject, message, send_type, status, error_message, sent_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (logError) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Sent Email Details</h1>
        <p className="text-red-600">Error loading email: {logError.message}</p>
      </div>
    );
  }

  if (!logData) {
    notFound();
  }

  const log = logData as EmailLog;

  let customer: Customer | null = null;

  if (log.customer_id) {
    const { data: customerData } = await supabase
      .from("company_profiles")
      .select("id, company_name, contact_person, email, phone, city, country")
      .eq("id", log.customer_id)
      .maybeSingle();

    customer = (customerData || null) as Customer | null;
  }

  return (
    <div className="p-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sent Email Details</h1>
          <p className="text-sm text-gray-500 mt-1">
            View the full message, sender, recipient and delivery status.
          </p>
        </div>

        <Link
          href="/sent-emails"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Back to Sent Emails
        </Link>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm text-gray-500">Status</span>
            <div className="mt-1">
              <span
                className={`px-3 py-1 rounded-full border text-xs capitalize ${statusClass(
                  log.status
                )}`}
              >
                {log.status || "unknown"}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm text-gray-500">Date</span>
            <div className="font-medium">
              {formatDateTime(log.sent_at || log.created_at)}
            </div>
          </div>
        </div>

        {log.error_message && (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            {log.error_message}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Email Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <span className="text-sm text-gray-500">To</span>
            <div className="font-medium">{log.recipient_email || ""}</div>
          </div>

          <div>
            <span className="text-sm text-gray-500">Sender Account</span>
            <div className="font-medium">{log.sender_account || ""}</div>
          </div>

          <div>
            <span className="text-sm text-gray-500">Provider</span>
            <div className="font-medium uppercase">{log.provider || ""}</div>
          </div>

          <div>
            <span className="text-sm text-gray-500">Type</span>
            <div className="font-medium capitalize">{log.send_type || ""}</div>
          </div>

          <div className="md:col-span-2">
            <span className="text-sm text-gray-500">Subject</span>
            <div className="font-medium">{log.subject || ""}</div>
          </div>
        </div>
      </div>

      {customer && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Customer</h2>

            <Link
              href={`/customers/${customer.id}/edit`}
              className="px-4 py-2 rounded-lg bg-gray-100 border hover:bg-gray-200"
            >
              View Customer
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <span className="text-sm text-gray-500">Company</span>
              <div className="font-medium">{customer.company_name || ""}</div>
            </div>

            <div>
              <span className="text-sm text-gray-500">Contact Person</span>
              <div className="font-medium">{customer.contact_person || ""}</div>
            </div>

            <div>
              <span className="text-sm text-gray-500">Email</span>
              <div className="font-medium">{customer.email || ""}</div>
            </div>

            <div>
              <span className="text-sm text-gray-500">Phone</span>
              <div className="font-medium">{customer.phone || ""}</div>
            </div>

            <div>
              <span className="text-sm text-gray-500">Location</span>
              <div className="font-medium">
                {[customer.city, customer.country].filter(Boolean).join(", ")}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Message</h2>

        <div className="whitespace-pre-wrap rounded-lg bg-gray-50 border p-5 text-sm leading-6">
          {log.message || ""}
        </div>
      </div>
    </div>
  );
}