export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import CustomerEmailClient from "@/components/customer-email-client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
};

type InboxConnection = {
  id: string;
  provider: string | null;
  account_email?: string | null;
  access_token: string | null;
  refresh_token: string | null;
  created_at: string | null;
  connection_status: string | null;
  last_error: string | null;
  expires_at: string | null;
};

function clean(value: any) {
  return String(value || "").trim();
}

function decodeJwtPayload(token: string | null) {
  try {
    const value = clean(token);
    const payload = value.split(".")[1];

    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function connectionEmail(connection: InboxConnection) {
  const savedEmail = clean(connection.account_email).toLowerCase();

  if (savedEmail) return savedEmail;

  const decoded = decodeJwtPayload(connection.access_token);

  return (
    clean(decoded?.upn).toLowerCase() ||
    clean(decoded?.unique_name).toLowerCase() ||
    clean(decoded?.email).toLowerCase() ||
    ""
  );
}

function newestActiveConnectionPerProvider(connections: InboxConnection[]) {
  const map = new Map<string, InboxConnection>();

  for (const connection of connections) {
    const provider = clean(connection.provider).toLowerCase();

    if (!provider) continue;
    if (connection.connection_status !== "active") continue;

    const existing = map.get(provider);

    if (!existing) {
      map.set(provider, connection);
      continue;
    }

    const existingTime = new Date(existing.created_at || 0).getTime();
    const currentTime = new Date(connection.created_at || 0).getTime();

    if (currentTime > existingTime) {
      map.set(provider, connection);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    clean(a.provider).localeCompare(clean(b.provider))
  );
}

function senderLabel(connection: InboxConnection) {
  const provider = clean(connection.provider).toUpperCase();
  const email = connectionEmail(connection);

  if (provider && email) return `${provider} — ${email}`;
  if (provider) return `${provider} — connected account`;

  return "Connected email account";
}

export default async function CustomerEmailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customerData, error: customerError } = await supabase
    .from("company_profiles")
    .select("id, company_name, contact_person, email, city, country")
    .eq("id", id)
    .maybeSingle();

  if (customerError) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Send Customer Email</h1>
        <p className="text-red-600">
          Error loading customer: {customerError.message}
        </p>
      </div>
    );
  }

  if (!customerData) {
    notFound();
  }

  const customer = customerData as Customer;

  const { data: connectionsData, error: connectionsError } = await supabase
    .from("inbox_connections")
    .select("*")
    .eq("connection_status", "active")
    .order("created_at", { ascending: false });

  const connections = newestActiveConnectionPerProvider(
    (connectionsData || []) as InboxConnection[]
  ).map((connection) => ({
    id: connection.id,
    label: senderLabel(connection),
  }));

  return (
    <div className="p-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Send Customer Email</h1>
          <p className="text-sm text-gray-500 mt-1">
            Send an email directly to this customer from a connected inbox.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/customers/${customer.id}/dashboard`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Customer Dashboard
          </Link>

          <Link
            href="/customers"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Back to Customers
          </Link>
        </div>
      </div>

      {connectionsError && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {connectionsError.message}
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <span className="text-sm text-gray-500">Customer</span>
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
          <span className="text-sm text-gray-500">Location</span>
          <div className="font-medium">
            {[customer.city, customer.country].filter(Boolean).join(", ")}
          </div>
        </div>
      </div>

      {!customer.email && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-200">
          This customer does not have an email address saved. Add an email before
          sending.
        </div>
      )}

      {connections.length === 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-200">
          No active Gmail or Outlook connection found. Connect an inbox before
          sending customer emails.
        </div>
      )}

      <CustomerEmailClient customer={customer} connections={connections} />
    </div>
  );
}