export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EmailRow = {
  id: string;
  subject: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
  received_at: string | null;
};

type OrderItem = {
  id: string;
  action: string | null;
  email_subject: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
};

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalise(value: string | null | undefined) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: enquiryItems, error: itemError } = await supabase
      .from("order_items")
      .select(
        "id, action, email_subject, external_message_id, gmail_message_id"
      )
      .in("action", [
        "Reply to Enquiry",
        "Follow Up",
        "Confirm Delivery",
      ]);

    if (itemError) {
      return NextResponse.json(
        {
          ok: false,
          step: "load_enquiry_items",
          error: itemError.message,
        },
        { status: 500 }
      );
    }

    const { data: emails, error: emailError } = await supabase
      .from("emails")
      .select(
        "id, subject, external_message_id, gmail_message_id, received_at"
      )
      .order("received_at", { ascending: false })
      .limit(10000);

    if (emailError) {
      return NextResponse.json(
        {
          ok: false,
          step: "load_emails",
          error: emailError.message,
        },
        { status: 500 }
      );
    }

    const emailRows = (emails ?? []) as EmailRow[];
    const items = (enquiryItems ?? []) as OrderItem[];

    const emailByMessageId = new Map<string, EmailRow>();
    const emailsBySubject = new Map<string, EmailRow[]>();

    for (const email of emailRows) {
      if (email.external_message_id) {
        emailByMessageId.set(email.external_message_id, email);
      }

      if (email.gmail_message_id) {
        emailByMessageId.set(email.gmail_message_id, email);
      }

      const subjectKey = normalise(email.subject);

      if (subjectKey) {
        if (!emailsBySubject.has(subjectKey)) {
          emailsBySubject.set(subjectKey, []);
        }

        emailsBySubject.get(subjectKey)!.push(email);
      }
    }

    let checked = 0;
    let alreadyLinked = 0;
    let repaired = 0;
    let missingSubject = 0;
    let noMatch = 0;
    let ambiguousSubject = 0;
    const details: any[] = [];

    for (const item of items) {
      checked += 1;

      const existingExternal = clean(item.external_message_id);
      const existingGmail = clean(item.gmail_message_id);

      if (
        (existingExternal && emailByMessageId.has(existingExternal)) ||
        (existingGmail && emailByMessageId.has(existingGmail))
      ) {
        alreadyLinked += 1;
        continue;
      }

      const subjectKey = normalise(item.email_subject);

      if (!subjectKey) {
        missingSubject += 1;
        details.push({
          itemId: item.id,
          status: "missing_subject",
        });
        continue;
      }

      const matches = emailsBySubject.get(subjectKey) || [];

      if (matches.length === 0) {
        noMatch += 1;
        details.push({
          itemId: item.id,
          subject: item.email_subject,
          status: "no_matching_email_subject",
        });
        continue;
      }

      if (matches.length > 1) {
        ambiguousSubject += 1;
        details.push({
          itemId: item.id,
          subject: item.email_subject,
          status: "ambiguous_subject",
          matches: matches.map((email) => ({
            emailId: email.id,
            received_at: email.received_at,
            external_message_id: email.external_message_id,
            gmail_message_id: email.gmail_message_id,
          })),
        });
        continue;
      }

      const match = matches[0];

      const { error: updateError } = await supabase
        .from("order_items")
        .update({
          external_message_id:
            match.external_message_id || match.gmail_message_id || null,
          gmail_message_id:
            match.gmail_message_id || match.external_message_id || null,
        })
        .eq("id", item.id);

      if (updateError) {
        details.push({
          itemId: item.id,
          subject: item.email_subject,
          status: "update_failed",
          error: updateError.message,
        });
        continue;
      }

      repaired += 1;

      details.push({
        itemId: item.id,
        subject: item.email_subject,
        status: "repaired",
        emailId: match.id,
        received_at: match.received_at,
        external_message_id: match.external_message_id,
        gmail_message_id: match.gmail_message_id,
      });
    }

    return NextResponse.json({
      ok: true,
      checked,
      alreadyLinked,
      repaired,
      missingSubject,
      noMatch,
      ambiguousSubject,
      details: details.slice(0, 100),
      note:
        "Rows with no matching email subject cannot be repaired because the original email record is missing or not identifiable.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "backfill_enquiry_email_links_catch",
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}