import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendViaGmail,
  sendViaOutlook,
  refreshGmailAccessToken,
} from "@/lib/send-email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  let supabase: any = null;
  let customerId = "";
  let to = "";
  let subject = "";
  let message = "";
  let provider = "";
  let senderAccount = "";

  try {
    const formData = await req.formData();

    customerId = clean(formData.get("customer_id"));
    const connectionId = clean(formData.get("connection_id"));
    to = extractEmailAddress(clean(formData.get("to")));
    subject = clean(formData.get("subject"));
    message = clean(formData.get("message"));

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Missing customer id" },
        { status: 400 }
      );
    }

    if (!connectionId) {
      return NextResponse.json(
        { ok: false, error: "Please select an email account to send from" },
        { status: 400 }
      );
    }

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Missing recipient email" },
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

    supabase = createClient(
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

    provider = clean(connection.provider).toLowerCase();
    senderAccount =
      clean(connection.account_email) ||
      clean(connection.provider) ||
      clean(connection.id);

    if (provider === "gmail") {
      const refreshedConnection = await refreshGmailConnectionIfNeeded({
        supabase,
        connection,
      });

      await sendViaGmail({
        accessToken: refreshedConnection.accessToken,
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
      return NextResponse.json(
        { ok: false, error: `Unsupported email provider: ${provider}` },
        { status: 400 }
      );
    }

    await logCustomerEmail({
      supabase,
      customerId,
      provider,
      senderAccount,
      recipientEmail: to,
      subject,
      message,
      sendType: "individual",
      status: "sent",
    });

    const auditNote = [
      `Customer email sent`,
      `Provider: ${provider}`,
      `From connection: ${senderAccount}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message: ${message}`,
    ].join("\n");

    const { data: customer } = await supabase
      .from("company_profiles")
      .select("notes")
      .eq("id", customerId)
      .maybeSingle();

    const existingNotes = clean(customer?.notes);
    const mergedNotes = existingNotes
      ? `${existingNotes}\n\n---\n${auditNote}`
      : auditNote;

    await supabase
      .from("company_profiles")
      .update({
        notes: mergedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    return NextResponse.redirect(new URL("/customers?emailSent=1", req.url), {
      status: 303,
    });
  } catch (error: any) {
    if (supabase && customerId && to) {
      await logCustomerEmail({
        supabase,
        customerId,
        provider: provider || "unknown",
        senderAccount: senderAccount || "unknown",
        recipientEmail: to,
        subject,
        message,
        sendType: "individual",
        status: "failed",
        errorMessage: error?.message || "Failed to send customer email",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to send customer email",
      },
      { status: 500 }
    );
  }
}