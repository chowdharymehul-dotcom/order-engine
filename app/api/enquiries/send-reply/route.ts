import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { sendViaGmail, sendViaOutlook } from "@/lib/send-email";

export const dynamic = "force-dynamic";

function getFollowUpDueAt(days = 3) {
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due.toISOString();
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function extractEmailAddress(value: string | null | undefined) {
  const text = clean(value);

  const angleMatch = text.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch?.[0]) return emailMatch[0].trim();

  return text;
}

function inferProviderFromMessageId(value: string | null | undefined) {
  const id = clean(value);

  if (!id) return "";

  if (id.startsWith("AAMk") || id.startsWith("AQMk")) {
    return "outlook";
  }

  if (/^[a-f0-9]{12,32}$/i.test(id)) {
    return "gmail";
  }

  return "";
}

async function getConnectionForProvider(supabaseAdmin: any, provider: string) {
  const { data, error } = await supabaseAdmin
    .from("inbox_connections")
    .select("*")
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ${provider} connection: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No ${provider} inbox connection found`);
  }

  return data;
}

async function polishReply(params: {
  customer: string | null;
  sku: string | null;
  quantity: number | null;
  query: string | null;
  draft: string;
}) {
  if (!process.env.OPENAI_API_KEY) return params.draft;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const ai = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `Rewrite the reply as a polished business email.
Preserve meaning. Do not invent facts, prices, or deadlines.
Return only the final email body text.`,
        },
        {
          role: "user",
          content: `Customer: ${params.customer || ""}
SKU: ${params.sku || ""}
Quantity: ${params.quantity ?? ""}
Original query: ${params.query || ""}

Draft:
${params.draft}`,
        },
      ],
    });

    return ai.choices[0]?.message?.content?.trim() || params.draft;
  } catch {
    return params.draft;
  }
}

async function findLinkedEmail(params: {
  supabase: any;
  externalMessageId: string;
  gmailMessageId: string;
  emailSubject: string;
}) {
  const { supabase, externalMessageId, gmailMessageId, emailSubject } = params;

  if (externalMessageId) {
    const { data } = await supabase
      .from("emails")
      .select("id, provider, from_email, subject, external_message_id, gmail_message_id")
      .eq("external_message_id", externalMessageId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  if (gmailMessageId) {
    const { data } = await supabase
      .from("emails")
      .select("id, provider, from_email, subject, external_message_id, gmail_message_id")
      .eq("gmail_message_id", gmailMessageId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  if (emailSubject) {
    const { data } = await supabase
      .from("emails")
      .select("id, provider, from_email, subject, external_message_id, gmail_message_id")
      .eq("subject", emailSubject)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const enquiryId = clean(formData.get("enquiry_id"));
    const to = extractEmailAddress(clean(formData.get("to")));
    const subject = clean(formData.get("subject"));
    const message = clean(formData.get("message"));

    if (!enquiryId) {
      return NextResponse.json(
        { ok: false, error: "Missing enquiry id" },
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
        { ok: false, error: "Missing reply subject" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Reply message cannot be empty" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: enquiry, error: enquiryError } = await supabase
      .from("order_items")
      .select(
        "id, provider, customer, sku, quantity, notes, status, email_subject, source_email, action, external_message_id, gmail_message_id"
      )
      .eq("id", enquiryId)
      .maybeSingle();

    if (enquiryError) {
      return NextResponse.json(
        { ok: false, error: enquiryError.message },
        { status: 500 }
      );
    }

    if (!enquiry) {
      return NextResponse.json(
        { ok: false, error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const email = await findLinkedEmail({
      supabase,
      externalMessageId: clean(enquiry.external_message_id),
      gmailMessageId: clean(enquiry.gmail_message_id),
      emailSubject: clean(enquiry.email_subject),
    });

    const providerFromEmail = clean(email?.provider).toLowerCase();
    const providerFromItem = clean(enquiry.provider).toLowerCase();
    const providerFromExternalId = inferProviderFromMessageId(
      enquiry.external_message_id
    );
    const providerFromGmailId = inferProviderFromMessageId(
      enquiry.gmail_message_id
    );

    const provider =
      providerFromEmail ||
      providerFromItem ||
      providerFromExternalId ||
      providerFromGmailId;

    if (!provider) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not determine email provider for this enquiry",
          enquiryId,
          external_message_id: enquiry.external_message_id,
          gmail_message_id: enquiry.gmail_message_id,
          email_subject: enquiry.email_subject,
          linkedEmailFound: !!email,
        },
        { status: 400 }
      );
    }

    const finalMessage = await polishReply({
      customer: enquiry.customer,
      sku: enquiry.sku,
      quantity: enquiry.quantity,
      query: enquiry.notes || enquiry.email_subject || "",
      draft: message,
    });

    if (provider === "gmail") {
      const connection = await getConnectionForProvider(supabase, "gmail");

      await sendViaGmail({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        to,
        subject,
        body: finalMessage,
      });
    } else if (provider === "outlook") {
      await sendViaOutlook({
        to,
        subject,
        body: finalMessage,
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported provider for reply: ${provider}`,
        },
        { status: 400 }
      );
    }

    const auditNote = [
      `Reply sent`,
      `Provider: ${provider}`,
      `Linked email found: ${email ? "yes" : "no"}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message: ${finalMessage}`,
    ].join("\n");

    const existingNotes = clean(enquiry.notes);
    const mergedNotes = existingNotes
      ? `${existingNotes}\n\n---\n${auditNote}`
      : auditNote;

    const { error: updateError } = await supabase
      .from("order_items")
      .update({
        status: "Replied",
        notes: mergedNotes,
        follow_up_due_at: getFollowUpDueAt(3),
      })
      .eq("id", enquiryId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/enquiries-follow-up", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to send enquiry reply",
      },
      { status: 500 }
    );
  }
}