export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EmailRow = {
  id: string;
  provider: string | null;
  subject: string | null;
  from_email: string | null;
  body_text: string | null;
  attachment_text: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_type: string | null;
  processing_status: string | null;
  received_at: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
};

type ExtractedItem = {
  sku?: string;
  qty?: number;
  quantity?: number;
  notes?: string;
};

type ExtractedData = {
  customer?: string;
  po_number?: string;
  items?: ExtractedItem[];
  notes?: string;
  priority?: string;
  follow_up_date?: string;
};

function cleanText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function shouldSkipEmail(email: EmailRow, force: boolean) {
  if (force) return false;

  const status = email.processing_status || "";

  return status === "processed" || status === "ignored";
}

function hasUsefulAttachmentText(email: EmailRow) {
  return !!cleanText(email.attachment_text);
}

function hasAttachmentWithoutText(email: EmailRow) {
  return !!email.attachment_url && !hasUsefulAttachmentText(email);
}

function getExternalMessageId(email: EmailRow) {
  return email.external_message_id || email.gmail_message_id || email.id;
}

function getGmailMessageId(email: EmailRow) {
  return email.gmail_message_id || null;
}

function normalizeQuantity(item: ExtractedItem) {
  const raw = item.qty ?? item.quantity ?? 0;
  const num = Number(raw);

  if (Number.isNaN(num)) return 0;

  return num;
}

function normalizeItems(items: ExtractedItem[] | undefined) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    sku: cleanText(item.sku || ""),
    quantity: normalizeQuantity(item),
    notes: cleanText(item.notes || ""),
  }));
}

function fallbackSkuFromSubject(subject: string | null) {
  const text = cleanText(subject || "");

  if (!text) return "ORDER ITEM";

  return text;
}

function extractPoFallback(content: string) {
  const poMatch =
    content.match(/PO\s*#?\s*:?\s*([A-Z0-9\-]+)/i) ||
    content.match(/P\.?O\.?\s*#?\s*:?\s*([A-Z0-9\-]+)/i) ||
    content.match(/purchase order\s*#?\s*:?\s*([A-Z0-9\-]+)/i);

  return poMatch?.[1] || "";
}

async function classifyEmail(content: string) {
  const prompt = `
You are a strict business email classifier.

Classify this email into EXACTLY ONE category.

CATEGORIES:

ORDER
Use ORDER only if the email clearly contains:
- purchase order
- order placement
- instruction to make / produce / ship goods
- SKU/product with quantity
- PO document text showing order lines

ENQUIRY
Use ENQUIRY only if the email contains:
- question
- follow up
- checking status
- asking for confirmation
- confirm delivery
- shipment confirmation
- delivery update
- payment clarification
- availability check
- sample/query discussion

CANCELLATION
Use CANCELLATION only if the email clearly asks to:
- cancel order
- stop order
- cancel shipment
- remove/cancel items
- not proceed with order

IGNORE
Use IGNORE for everything else:
- marketing
- newsletters
- spam
- OTP
- ads
- notifications
- signatures only
- irrelevant personal mail
- calendar invites
- recruitment emails
- empty/unclear emails
- bank promotions
- automated alerts not related to orders/enquiries/cancellations

STRICT RULES:
- "confirm delivery" = ENQUIRY
- "delivery confirmation" = ENQUIRY
- Promotions = IGNORE
- Unclear = IGNORE
- Do not guess

RETURN ONLY ONE WORD:
ORDER
ENQUIRY
CANCELLATION
IGNORE

EMAIL:
${content}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const value =
    res.choices[0]?.message?.content?.trim().toUpperCase() || "IGNORE";

  if (
    value !== "ORDER" &&
    value !== "ENQUIRY" &&
    value !== "CANCELLATION" &&
    value !== "IGNORE"
  ) {
    return "IGNORE";
  }

  return value;
}

async function extractStructured(content: string): Promise<ExtractedData> {
  const prompt = `
Extract structured business data from this email / PDF text.

Return STRICT JSON only in this exact shape:

{
  "customer": "",
  "po_number": "",
  "items": [
    {
      "sku": "",
      "qty": 0,
      "notes": ""
    }
  ],
  "notes": "",
  "priority": "low",
  "follow_up_date": ""
}

IMPORTANT EXTRACTION RULES:
- For purchase orders, extract PO number from fields like "PO #", "PO:", "Purchase Order".
- For product/style/article, use the best visible style/article/item code as sku.
- If the subject contains product/style/article and PDF does not clearly expose SKU, use subject as sku.
- If quantity is unclear, use 0.
- If there are multiple visible item/order lines, return multiple items.
- Do not hallucinate fake values.
- Notes should be a short useful summary.
- follow_up_date must be YYYY-MM-DD if clearly available, otherwise blank.
- priority must be low, medium, or high.

EMAIL / PDF TEXT:
${content}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  try {
    return JSON.parse(res.choices[0]?.message?.content || "{}");
  } catch {
    return {
      customer: "",
      po_number: "",
      items: [],
      notes: "",
      priority: "low",
      follow_up_date: "",
    };
  }
}

async function markEmail(params: {
  emailId: string;
  status: string;
  intent?: string | null;
  error?: string | null;
}) {
  const { emailId, status, intent = null, error = null } = params;

  const payload: Record<string, any> = {
    processing_status: status,
    last_processing_error: error,
  };

  if (intent !== null) {
    payload.intent = intent;
  }

  await supabase.from("emails").update(payload).eq("id", emailId);
}

async function deleteExistingItemsForEmail(email: EmailRow) {
  if (email.external_message_id) {
    await supabase
      .from("order_items")
      .delete()
      .eq("external_message_id", email.external_message_id);
  }

  if (email.gmail_message_id) {
    await supabase
      .from("order_items")
      .delete()
      .eq("gmail_message_id", email.gmail_message_id);
  }
}

async function hasExistingItems(email: EmailRow) {
  if (email.external_message_id) {
    const { data } = await supabase
      .from("order_items")
      .select("id")
      .eq("external_message_id", email.external_message_id)
      .limit(1);

    if (data && data.length > 0) return true;
  }

  if (email.gmail_message_id) {
    const { data } = await supabase
      .from("order_items")
      .select("id")
      .eq("gmail_message_id", email.gmail_message_id)
      .limit(1);

    if (data && data.length > 0) return true;
  }

  return false;
}

async function insertOrderItems(params: {
  email: EmailRow;
  intent: "ORDER" | "ENQUIRY" | "CANCELLATION";
  structured: ExtractedData;
  combinedText: string;
}) {
  const { email, intent, structured, combinedText } = params;

  const externalMessageId = getExternalMessageId(email);
  const gmailMessageId = getGmailMessageId(email);
  const normalizedItems = normalizeItems(structured.items);

  const customer = cleanText(structured.customer || "");
  const poNumber =
    cleanText(structured.po_number || "") || extractPoFallback(combinedText);

  const baseNotes =
    cleanText(structured.notes || "") ||
    cleanText(email.subject || "") ||
    "Extracted from email / attachment";

  if (intent === "ORDER") {
    let validItems = normalizedItems.filter((item) => item.sku);

    if (validItems.length === 0) {
      validItems = [
        {
          sku: fallbackSkuFromSubject(email.subject),
          quantity: 0,
          notes: baseNotes,
        },
      ];
    }

    for (const item of validItems) {
      await supabase.from("order_items").insert({
        action: "Place Order",
        customer,
        po_number: poNumber,
        sku: item.sku || fallbackSkuFromSubject(email.subject),
        quantity: item.quantity || null,
        notes: item.notes || baseNotes,
        status: "New",
        source_email: email.from_email || "",
        external_message_id: externalMessageId,
        gmail_message_id: gmailMessageId,
        email_subject: email.subject || "",
      });
    }

    return validItems.length;
  }

  if (intent === "ENQUIRY") {
    await supabase.from("order_items").insert({
      action: "Reply to Enquiry",
      customer,
      po_number: poNumber,
      sku:
        normalizedItems
          .map((item) => item.sku)
          .filter(Boolean)
          .join(", ") || "",
      quantity:
        normalizedItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ) || null,
      notes: baseNotes,
      status: "Pending",
      source_email: email.from_email || "",
      external_message_id: externalMessageId,
      gmail_message_id: gmailMessageId,
      email_subject: email.subject || "",
      follow_up_due_at: structured.follow_up_date || null,
    });

    return 1;
  }

  if (intent === "CANCELLATION") {
    await supabase.from("order_items").insert({
      action: "Cancel Order",
      customer,
      po_number: poNumber,
      sku:
        normalizedItems
          .map((item) => item.sku)
          .filter(Boolean)
          .join(", ") || "",
      quantity:
        normalizedItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ) || null,
      notes: baseNotes,
      status: "Pending",
      source_email: email.from_email || "",
      external_message_id: externalMessageId,
      gmail_message_id: gmailMessageId,
      email_subject: email.subject || "",
    });

    return 1;
  }

  return 0;
}

async function processEmail(email: EmailRow, force: boolean) {
  if (shouldSkipEmail(email, force)) {
    return {
      id: email.id,
      skipped: true,
      reason: "already_processed_or_ignored",
    };
  }

  const bodyText = cleanText(email.body_text || "");
  const attachmentText = cleanText(email.attachment_text || "");
  const combinedText = cleanText(`${bodyText}\n\n${attachmentText}`);

  if (hasAttachmentWithoutText(email) && !force) {
    await markEmail({
      emailId: email.id,
      status: "needs_ocr",
      error: null,
    });

    return {
      id: email.id,
      skipped: true,
      reason: "needs_ocr",
      attachment_url: email.attachment_url,
    };
  }

  if (!combinedText || combinedText.length < 10) {
    await markEmail({
      emailId: email.id,
      status: "ignored",
      intent: "ignored",
      error: "No useful email body or attachment text",
    });

    return {
      id: email.id,
      ignored: true,
      reason: "empty_or_too_short",
    };
  }

  const intent = await classifyEmail(combinedText);

  if (intent === "IGNORE") {
    await markEmail({
      emailId: email.id,
      status: "ignored",
      intent: "ignored",
      error: null,
    });

    await deleteExistingItemsForEmail(email);

    return {
      id: email.id,
      ignored: true,
      intent,
    };
  }

  const structured = await extractStructured(combinedText);

  if (force) {
    await deleteExistingItemsForEmail(email);
  }

  const existing = force ? false : await hasExistingItems(email);

  let insertedItems = 0;

  if (!existing) {
    insertedItems = await insertOrderItems({
      email,
      intent: intent as "ORDER" | "ENQUIRY" | "CANCELLATION",
      structured,
      combinedText,
    });
  }

  if (insertedItems === 0 && !existing) {
    await markEmail({
      emailId: email.id,
      status: "failed",
      intent: intent.toLowerCase(),
      error: `Intent ${intent} found but no order_items inserted`,
    });

    return {
      id: email.id,
      ok: false,
      intent,
      insertedItems,
      error: "No order_items inserted",
    };
  }

  await markEmail({
    emailId: email.id,
    status: "processed",
    intent: intent.toLowerCase(),
    error: null,
  });

  return {
    id: email.id,
    processed: true,
    intent,
    insertedItems,
    existingItems: existing,
  };
}

export async function GET(req: NextRequest) {
  try {
    const emailId = req.nextUrl.searchParams.get("emailId");
    const force = req.nextUrl.searchParams.get("force") === "true";

    let query = supabase
      .from("emails")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(emailId ? 1 : 50);

    if (emailId) {
      query = query.eq("id", emailId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: "load_emails",
          error: error.message,
        },
        { status: 500 }
      );
    }

    const emails = ((data || []) as EmailRow[]).filter(
      (email) => !shouldSkipEmail(email, force)
    );

    const results = [];

    for (const email of emails) {
      try {
        const result = await processEmail(email, force);
        results.push(result);
      } catch (emailError: any) {
        await markEmail({
          emailId: email.id,
          status: "failed",
          error: emailError?.message || String(emailError),
        });

        results.push({
          id: email.id,
          ok: false,
          error: emailError?.message || String(emailError),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      checked: data?.length || 0,
      processed: results.length,
      force,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "process_emails_catch",
        error: error?.message || "Unknown process-emails error",
      },
      { status: 500 }
    );
  }
}