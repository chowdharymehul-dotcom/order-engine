import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendViaGmail,
  sendViaOutlook,
  refreshGmailAccessToken,
} from "@/lib/send-email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function clean(value: any) {
  return String(value || "").trim();
}

function extractEmailAddress(value: string | null | undefined) {
  const text = clean(value);

  const angleMatch = text.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch?.[0]) return emailMatch[0].trim();

  return text;
}

async function refreshGmailConnectionIfNeeded(params: {
  supabase: any;
  connection: any;
}) {
  const { supabase, connection } = params;
  const refreshToken = clean(connection.refresh_token);

  if (!refreshToken) {
    throw new Error(
      "Gmail refresh token is missing. Please reconnect this Gmail account."
    );
  }

  const expiresAt = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : 0;

  const expiresSoon = !expiresAt || expiresAt < Date.now() + 5 * 60 * 1000;

  if (!expiresSoon && clean(connection.access_token)) {
    return { accessToken: clean(connection.access_token) };
  }

  const refreshed = await refreshGmailAccessToken(refreshToken);

  const { error } = await supabase
    .from("inbox_connections")
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
      connection_status: "active",
      last_error: null,
    })
    .eq("id", connection.id);

  if (error) throw new Error(error.message);

  return { accessToken: refreshed.accessToken };
}

async function logCustomerEmail(params: {
  supabase: any;
  customerId: string;
  provider: string;
  senderAccount: string;
  recipientEmail: string;
  subject: string;
  message: string;
  sendType: string;
  status: string;
  errorMessage?: string;
}) {
  await params.supabase.from("customer_email_logs").insert({
    customer_id: params.customerId,
    provider: params.provider,
    sender_account: params.senderAccount,
    recipient_email: params.recipientEmail,
    subject: params.subject,
    message: params.message,
    send_type: params.sendType,
    status: params.status,
    error_message: params.errorMessage || null,
    sent_at: params.status === "sent" ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const customerIds = formData
      .getAll("customer_ids")
      .map((id) => clean(id))
      .filter(Boolean);

    const connectionId = clean(formData.get("connection_id"));
    const subject = clean(formData.get("subject"));
    const message = clean(formData.get("message"));

    if (customerIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No customers selected" },
        { status: 400 }
      );
    }

    if (!connectionId) {
      return NextResponse.json(
        { ok: false, error: "Please select an email account to send from" },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { ok: false, error: "Missing email subject" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Email message cannot be empty" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: connection, error: connectionError } = await supabase
      .from("inbox_connections")
      .select("*")
      .eq("id", connectionId)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json(
        { ok: false, error: connectionError.message },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { ok: false, error: "Selected email account was not found" },
        { status: 404 }
      );
    }

    const provider = clean(connection.provider).toLowerCase();

    const senderAccount =
      clean(connection.account_email) ||
      clean(connection.provider) ||
      clean(connection.id);

    const { data: customersData, error: customersError } = await supabase
      .from("company_profiles")
      .select("id, company_name, email, notes")
      .in("id", customerIds)
      .eq("is_active", true);

    if (customersError) {
      return NextResponse.json(
        { ok: false, error: customersError.message },
        { status: 500 }
      );
    }

    const customers = customersData || [];

    let gmailAccessToken = "";

    if (provider === "gmail") {
      const refreshedConnection = await refreshGmailConnectionIfNeeded({
        supabase,
        connection,
      });

      gmailAccessToken = refreshedConnection.accessToken;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const customer of customers) {
      const to = extractEmailAddress(customer.email);

      if (!to) {
        skipped += 1;

        await logCustomerEmail({
          supabase,
          customerId: customer.id,
          provider,
          senderAccount,
          recipientEmail: "",
          subject,
          message,
          sendType: "bulk",
          status: "skipped",
          errorMessage: "Missing recipient email",
        });

        continue;
      }

      try {
        if (provider === "gmail") {
          await sendViaGmail({
            accessToken: gmailAccessToken,
            refreshToken: connection.refresh_token,
            to,
            subject,
            body: message,
          });
        } else if (provider === "outlook") {
          await sendViaOutlook({
            to,
            subject,
            body: message,
          });
        } else {
          throw new Error(`Unsupported email provider: ${provider}`);
        }

        await logCustomerEmail({
          supabase,
          customerId: customer.id,
          provider,
          senderAccount,
          recipientEmail: to,
          subject,
          message,
          sendType: "bulk",
          status: "sent",
        });

        const auditNote = [
          `Bulk customer email sent`,
          `Provider: ${provider}`,
          `From connection: ${senderAccount}`,
          `To: ${to}`,
          `Subject: ${subject}`,
          `Message: ${message}`,
        ].join("\n");

        const existingNotes = clean(customer.notes);
        const mergedNotes = existingNotes
          ? `${existingNotes}\n\n---\n${auditNote}`
          : auditNote;

        await supabase
          .from("company_profiles")
          .update({
            notes: mergedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", customer.id);

        sent += 1;
      } catch (error: any) {
        failed += 1;

        await logCustomerEmail({
          supabase,
          customerId: customer.id,
          provider,
          senderAccount,
          recipientEmail: to,
          subject,
          message,
          sendType: "bulk",
          status: "failed",
          errorMessage: error?.message || "Failed to send email",
        });
      }
    }

    return NextResponse.redirect(
      new URL(
        `/customers?bulkSent=${sent}&bulkSkipped=${skipped}&bulkFailed=${failed}`,
        req.url
      ),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to send bulk customer email",
      },
      { status: 500 }
    );
  }
}