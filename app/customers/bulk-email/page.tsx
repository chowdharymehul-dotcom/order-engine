export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import BulkCustomerEmailClient from "@/components/bulk-customer-email-client";

type PageProps = {
  searchParams: Promise<{
    customer_ids?: string | string[];
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

function idsFromParam(value: string | string[] | undefined) {
  if (!value) return [];

  const values = Array.isArray(value) ? value : [value];

  return Array.from(
    new Set(values.map((item) => clean(item)).filter(Boolean))
  );
}

export default async function BulkCustomerEmailPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const customerIds = idsFromParam(params.customer_ids);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customersData, error: customersError } =
    customerIds.length > 0
      ? await supabase
          .from("company_profiles")
          .select("id, company_name, contact_person, email, city, country")
          .in("id", customerIds)
          .eq("is_active", true)
          .order("company_name", { ascending: true })
      : { data: [], error: null };

  const { data: connectionsData, error: connectionsError } = await supabase
    .from("inbox_connections")
    .select("*")
    .eq("connection_status", "active")
    .order("created_at", { ascending: false });

  const customers = (customersData || []) as Customer[];

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
          <h1 className="text-3xl font-bold">Bulk Customer Email</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review selected customers, remove any recipients you do not want,
            and send one email to each recipient.
          </p>
        </div>

        <Link
          href="/customers"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Back to Customers
        </Link>
      </div>

      {customersError && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {customersError.message}
        </div>
      )}

      {connectionsError && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {connectionsError.message}
        </div>
      )}

      {customerIds.length === 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-200">
          No customers selected. Go back to Customers, filter/select customers,
          then click Email Selected.
        </div>
      )}

      {connections.length === 0 && (
        <div className="p-4 rounded-lg bg-yellow-50 text-yellow-900 border border-yellow-200">
          No active Gmail or Outlook connection found. Connect an inbox before
          sending customer emails.
        </div>
      )}

      <BulkCustomerEmailClient
        customers={customers}
        connections={connections}
      />
    </div>
  );
}