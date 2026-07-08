import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendViaGmail,
  sendViaOutlook,
  refreshGmailAccessToken,
  type EmailAttachment,
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

function safeFileName(name: string) {
  const cleaned = clean(name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);

  return cleaned || "order-confirmation.pdf";
}

function pdfFileName(ocNumber: string) {
  const base = safeFileName(ocNumber || "order-confirmation");

  if (base.toLowerCase().endsWith(".pdf")) return base;

  return `${base}.pdf`;
}

async function downloadFileBuffer(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to download final OC PDF: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
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

function getOrderItemIds(oc: any, fallbackOrderItemId: string) {
  if (Array.isArray(oc.order_item_ids) && oc.order_item_ids.length > 0) {
    return oc.order_item_ids;
  }

  if (oc.order_item_id) return [oc.order_item_id];

  return fallbackOrderItemId ? [fallbackOrderItemId] : [];
}

function cleanEmailBody(message: string) {
  return clean(message)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/PDF Link:\s*/gi, "")
    .replace(/Final OC PDF:\s*/gi, "")
    .replace(/Open PDF:\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function logCustomerEmail(params: {
  supabase: any;
  customerId: string | null;
  provider: string;
  senderAccount: string;
  recipientEmail: string;
  subject: string;
  message: string;
  status: string;
  orderConfirmationId: string;
  pdfUrl: string;
  attachmentName: string;
  errorMessage?: string;
}) {
  if (!params.customerId) return;

  await params.supabase.from("customer_email_logs").insert({
    customer_id: params.customerId,
    provider: params.provider,
    sender_account: params.senderAccount,
    recipient_email: params.recipientEmail,
    subject: params.subject,
    message: params.message,
    send_type: "order_confirmation",
    status: params.status,
    error_message: params.errorMessage || null,
    order_confirmation_id: params.orderConfirmationId || null,
    pdf_url: params.pdfUrl || null,
    attachment_name: params.attachmentName || null,
    sent_at: params.status === "sent" ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  let supabase: any = null;
  let ocId = "";
  let orderItemId = "";
  let customerId = "";
  let to = "";
  let subject = "";
  let message = "";
  let pdfUrl = "";
  let provider = "";
  let senderAccount = "";
  let connectionId = "";
  let attachmentName = "";

  try {
    const formData = await req.formData();

    ocId = clean(formData.get("oc_id"));
    orderItemId = clean(formData.get("order_item_id"));
    customerId = clean(formData.get("customer_id"));
    connectionId = clean(formData.get("connection_id"));
    to = extractEmailAddress(clean(formData.get("to")));
    subject = clean(formData.get("subject"));
    message = clean(formData.get("message"));
    pdfUrl = clean(formData.get("pdf_url"));

    if (!ocId || !orderItemId) {
      return NextResponse.json(
        { ok: false, error: "Missing OC ID or order item ID" },
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

    const { data: oc, error: ocError } = await supabase
      .from("order_confirmations")
      .select("*")
      .eq("id", ocId)
      .maybeSingle();

    if (ocError || !oc) {
      return NextResponse.json(
        { ok: false, error: ocError?.message || "OC not found" },
        { status: 404 }
      );
    }

    const finalPdfUrl = clean(oc.final_oc_pdf_url || pdfUrl);

    if (!finalPdfUrl) {
      return NextResponse.json(
        { ok: false, error: "Final OC PDF is missing" },
        { status: 400 }
      );
    }

    const { data: connection, error: connectionError } = await supabase
      .from("inbox_connections")
      .select("*")
      .eq("id", connectionId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json(
        {
          ok: false,
          error: connectionError?.message || "Selected email account not found",
        },
        { status: 404 }
      );
    }

    provider = clean(connection.provider).toLowerCase();
    senderAccount =
      clean(connection.account_email) ||
      clean(connection.provider) ||
      clean(connection.id);

    const pdfBuffer = await downloadFileBuffer(finalPdfUrl);
    attachmentName = pdfFileName(clean(oc.oc_number));

    const attachment: EmailAttachment = {
      filename: attachmentName,
      contentType: "application/pdf",
      content: pdfBuffer,
    };

    const finalMessage = cleanEmailBody(message);

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
        body: finalMessage,
        attachments: [attachment],
      });
    } else if (provider === "outlook") {
      await sendViaOutlook({
        to,
        subject,
        body: finalMessage,
        attachments: [attachment],
      });
    } else {
      return NextResponse.json(
        { ok: false, error: `Unsupported email provider: ${provider}` },
        { status: 400 }
      );
    }

    const sentAt = new Date().toISOString();
    const orderItemIds = getOrderItemIds(oc, orderItemId);

    const { error: updateOCError } = await supabase
      .from("order_confirmations")
      .update({
        status: "Sent",
        sent_at: sentAt,
        recipient_email: to,
        sender_connection_id: connectionId,
        email_subject: subject,
        email_message: finalMessage,
        updated_at: sentAt,
      })
      .eq("id", ocId);

    if (updateOCError) {
      return NextResponse.json(
        { ok: false, error: updateOCError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("order_items")
      .update({
        oc_status: "Sent",
        oc_pdf_url: finalPdfUrl,
        oc_document_id: ocId,
      })
      .in("id", orderItemIds);

    await logCustomerEmail({
      supabase,
      customerId: clean(oc.customer_id || customerId) || null,
      provider,
      senderAccount,
      recipientEmail: to,
      subject,
      message: finalMessage,
      status: "sent",
      orderConfirmationId: ocId,
      pdfUrl: finalPdfUrl,
      attachmentName,
    });

    return NextResponse.redirect(
      new URL(`/order-confirmations?sent=1`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    if (supabase && to) {
      await logCustomerEmail({
        supabase,
        customerId: customerId || null,
        provider: provider || "unknown",
        senderAccount: senderAccount || "unknown",
        recipientEmail: to,
        subject,
        message: cleanEmailBody(message),
        status: "failed",
        orderConfirmationId: ocId,
        pdfUrl,
        attachmentName,
        errorMessage: error?.message || "Failed to send OC",
      });
    }

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to send OC" },
      { status: 500 }
    );
  }
}