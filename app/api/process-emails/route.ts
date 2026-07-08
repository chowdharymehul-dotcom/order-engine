export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateCustomer } from "@/lib/customerAutoLink";
import { resolveOrderGroup } from "@/lib/order-group";
import { validateOrderCandidate } from "@/lib/order-validator";
import { validateEnquiryCandidate } from "@/lib/enquiry-validator";
import { validateCancellationCandidate } from "@/lib/cancellation-validator";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EmailRow = {
  id: string;
  subject: string | null;
  from_email: string | null;
  body_text: string | null;
  attachment_text: string | null;
  attachment_url: string | null;
  processing_status: string | null;
  direction: string | null;
  received_at: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
  external_thread_id: string | null;
};

type ParsedLine = {
  sku: string;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  currency: string;
  notes: string;
  custom_fields: Record<string, string>;
};

type ExtractedItem = {
  sku?: string;
  article?: string;
  style?: string;
  item_code?: string;
  product_code?: string;
  quantity?: number | string | null;
  qty?: number | string | null;
  unit_price?: number | string | null;
  price?: number | string | null;
  line_total?: number | string | null;
  total_amount?: number | string | null;
  currency?: string | null;
  notes?: string | null;
};

type ExtractedData = {
  customer?: string;
  po_number?: string;
  items?: ExtractedItem[];
  notes?: string;
  follow_up_date?: string;
};

function clean(value: any) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function keepLines(value: any) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function num(value: any) {
  const text = String(value ?? "").replace(/[$,]/g, "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function currency(value: any) {
  const text = clean(value).toUpperCase();
  if (!text || text === "$" || text === "US$") return "USD";
  if (text === "€") return "EUR";
  if (text === "£") return "GBP";
  if (text === "₹") return "INR";
  return text;
}

function shouldSkipEmail(email: EmailRow, force: boolean) {
  if (force) return false;
  return (
    email.processing_status === "processed" ||
    email.processing_status === "ignored"
  );
}

function hasAttachmentWithoutText(email: EmailRow) {
  return !!email.attachment_url && !clean(email.attachment_text);
}

function externalId(email: EmailRow) {
  return email.external_message_id || email.gmail_message_id || email.id;
}

function poFromText(text: string) {
  return (
    clean(text).match(/\bPO\s*#\s*:?\s*([A-Z0-9\-\/]+)/i)?.[1] ||
    clean(text).match(/\bP\.?O\.?\s*#?\s*:?\s*([A-Z0-9\-\/]+)/i)?.[1] ||
    clean(text).match(/\bPurchase\s+Order\s*#?\s*:?\s*([A-Z0-9\-\/]+)/i)?.[1] ||
    ""
  );
}

function customerFromPO(text: string) {
  const lines = keepLines(text)
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);

  const poIndex = lines.findIndex((line) => /^purchase order$/i.test(line));

  if (poIndex >= 0) {
    for (let i = poIndex + 1; i < Math.min(lines.length, poIndex + 8); i += 1) {
      const line = lines[i];

      if (
        line &&
        !/^date\b/i.test(line) &&
        !/^po\b/i.test(line) &&
        !/^\d/.test(line) &&
        !line.includes("@") &&
        !line.toLowerCase().startsWith("http")
      ) {
        return line;
      }
    }
  }

  return "";
}

function labelValue(block: string, labels: string[]) {
  for (const label of labels) {
    const match = block.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i"));
    if (match?.[1]) return clean(match[1]);
  }

  return "";
}

function moneyValues(block: string) {
  return Array.from(
    block.matchAll(/(?:US\$|\$|USD\s*)\s*(\d+(?:\.\d{1,2})?)/gi)
  )
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function numberLines(block: string) {
  return block
    .split("\n")
    .map((line) => clean(line))
    .filter((line) => /^\d+(?:\.\d+)?$/.test(line))
    .map((line) => Number(line))
    .filter((value) => Number.isFinite(value));
}

function itemBlocks(text: string) {
  const preserved = keepLines(text);
  const regex =
    /\b(?:ARTICLE|SKU|STYLE|ITEM\s*#?|ITEM\s*NO|PRODUCT\s*CODE|PART\s*NO|MODEL|MATERIAL\s*CODE)\s*:\s*([A-Z0-9][A-Z0-9\-\/._]*)/gi;

  const matches = Array.from(preserved.matchAll(regex));

  return matches.map((match, index) => {
    const start = match.index || 0;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index || preserved.length
        : preserved.length;

    return {
      sku: clean(match[1]),
      block: preserved.slice(start, end),
    };
  });
}

function parseStructuredPO(text: string): ParsedLine[] {
  return itemBlocks(text)
    .map(({ sku, block }) => {
      const description = labelValue(block, ["DESCRIPTION", "PRODUCT"]);
      const color = labelValue(block, ["COLOR", "COLOUR"]);
      const size = labelValue(block, ["SIZE"]);
      const notesChanges = labelValue(block, [
        "NOTES/CHANGES",
        "NOTES",
        "CHANGES",
        "REMARKS",
        "SPECIFICATION",
      ]);

      const prices = moneyValues(block);
      const qtyNumbers = numberLines(block);
      const quantity =
        qtyNumbers.find((value) => value > 0 && Number.isInteger(value)) ??
        null;
      const unitPrice = prices[0] ?? null;
      const totalAmount =
        prices[1] ??
        (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);

      const custom_fields: Record<string, string> = {};
      if (description) custom_fields.description = description;
      if (color) custom_fields.color = color;
      if (size) custom_fields.size = size;
      if (notesChanges) custom_fields.notes_changes = notesChanges;
      if (totalAmount !== null) custom_fields.line_total = String(totalAmount);

      const notes = [
        description,
        color ? `Color: ${color}` : "",
        size ? `Size: ${size}` : "",
        notesChanges ? `Notes/Changes: ${notesChanges}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        sku,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        currency: "USD",
        notes,
        custom_fields,
      };
    })
    .filter((line) => line.sku);
}

function hasOrderSignals(text: string) {
  const value = clean(text).toLowerCase();

  return (
    value.includes("purchase order") ||
    value.includes("po #") ||
    value.includes("article") ||
    value.includes("unit price") ||
    value.includes("qty")
  );
}

async function markEmail(
  emailId: string,
  status: string,
  _intent?: string,
  error?: string | null
) {
  await supabase
    .from("emails")
    .update({
      processing_status: status,
      last_processing_error: error || null,
      processed_at:
        status === "processed" || status === "ignored"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", emailId);
}

async function deleteExistingItems(email: EmailRow) {
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

  await supabase.from("order_items").delete().eq("email_subject", email.subject || "");
}


async function saveOrderItem(params: {
  email: EmailRow;
  orderGroupId: string | null;
  customer: string;
  customerMatch: any;
  poNumber: string;
  action: string;
  sku: string;
  quantity: number | null;
  unitPrice: number | null;
  totalAmount: number | null;
  currency: string;
  notes: string;
  customFields?: Record<string, any>;
  followUpDate?: string | null;
}) {
  const {
    email,
    orderGroupId,
    customer,
    customerMatch,
    poNumber,
    action,
    sku,
    quantity,
    unitPrice,
    totalAmount,
    currency,
    notes,
    customFields,
    followUpDate,
  } = params;

  let existingQuery = supabase
    .from("order_items")
    .select("*")
    .eq("action", action)
    .eq("sku", sku)
    .is("deleted_at", null);

  if (orderGroupId) {
    existingQuery = existingQuery.eq("order_group_id", orderGroupId);
  } else {
    existingQuery = existingQuery
      .eq("customer", customer)
      .eq("po_number", poNumber);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    await supabase
      .from("order_items")
      .update({
        order_group_id: orderGroupId || existing.order_group_id || null,
customer,
customer_id: customerMatch.customer_id || existing.customer_id || null,
customer_match_method:
  customerMatch.customer_match_method || existing.customer_match_method || null,
customer_match_confidence:
  customerMatch.customer_match_confidence ||
  existing.customer_match_confidence ||
  null,
        quantity: quantity ?? existing.quantity,
        unit_price: unitPrice ?? existing.unit_price,
        total_amount: totalAmount ?? existing.total_amount,
        currency: currency || existing.currency,
        notes: notes || existing.notes,
        custom_fields:
          customFields && Object.keys(customFields).length
            ? customFields
            : existing.custom_fields,
        email_subject: email.subject,
        source_email: email.from_email,
        parent_email_id: existing.parent_email_id || email.id,
        external_message_id: externalId(email),
        gmail_message_id: email.gmail_message_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    return;
  }

  await supabase.from("order_items").insert({
    order_group_id: orderGroupId,
    action,
    customer,
    customer_id: customerMatch.customer_id,
    customer_match_method: customerMatch.customer_match_method,
    customer_match_confidence: customerMatch.customer_match_confidence,
    po_number: poNumber,
    sku,
    quantity,
    unit_price: unitPrice,
    total_amount: totalAmount,
    currency,
    notes,
    custom_fields: customFields || {},
    status: action === "Place Order" ? "New" : "Pending",
    source_email: email.from_email || "",
    parent_email_id: email.id,
    external_message_id: externalId(email),
    gmail_message_id: email.gmail_message_id,
    email_subject: email.subject || "",
    follow_up_due_at: followUpDate || null,
    created_at: new Date().toISOString(),
  });
}

async function insertStructuredOrder(
  email: EmailRow,
  text: string,
  lines: ParsedLine[]
) {
  const poNumber = poFromText(text);
  const extractedCustomer = customerFromPO(text);

  const customerMatch = await getOrCreateCustomer({
    supabase,
    fromEmail: email.from_email,
    extractedCustomerName: extractedCustomer,
});

  const customer =
    customerMatch.customer_name || extractedCustomer || clean(email.from_email);

  const group = await resolveOrderGroup({
    supabase,
    email,
    customerId: customerMatch.customer_id,
    customerName: customer,
    poNumber,
    orderReference: lines[0]?.sku || null,
    source: "email",
  });

  for (const line of lines) {
    await saveOrderItem({
      email,
      orderGroupId: group.id,
      customer,
      customerMatch,
      poNumber,
      action: "Place Order",
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unit_price,
      totalAmount: line.total_amount,
      currency: line.currency,
      notes: line.notes || "Extracted from structured purchase order.",
      customFields: line.custom_fields,
    });
  }

  return lines.length;
}

async function classifyEmail(text: string) {
  const prompt = `
Classify this business email/document into exactly ONE category.

Return only one word:
ORDER
ENQUIRY
CANCELLATION
IGNORE

ORDER: real order, purchase order, PO attachment, item rows, quantity, price.
ENQUIRY: question/status/confirmation/payment/delivery follow-up without new order.
CANCELLATION: explicit cancel/stop/remove/do not proceed/do not ship.
IGNORE: spam/marketing/OTP/irrelevant/unclear.

Rules:
- A purchase order PDF with item rows is ORDER.
- "cancel date" inside a PO is not cancellation.

INPUT:
${text}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const value = clean(res.choices[0]?.message?.content).toUpperCase();
  if (value === "ORDER") return "ORDER";
  if (value === "ENQUIRY") return "ENQUIRY";
  if (value === "CANCELLATION") return "CANCELLATION";
  return "IGNORE";
}

async function extractStructured(text: string): Promise<ExtractedData> {
  const prompt = `
Extract business data from this email/PDF text.

Return JSON only:
{
  "customer": "",
  "po_number": "",
  "items": [
    {
      "sku": "",
      "quantity": null,
      "unit_price": null,
      "currency": "USD",
      "line_total": null,
      "notes": ""
    }
  ],
  "notes": "",
  "follow_up_date": ""
}

Rules:
- Extract every visible order line.
- Do not invent quantity or sku.
- Do not use subject as fake sku.

TEXT:
${text}
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
      follow_up_date: "",
    };
  }
}

function normalizeAiItem(item: ExtractedItem) {
  const quantity = num(item.quantity ?? item.qty);
  const unitPrice = num(item.unit_price ?? item.price);
  const totalAmount =
    num(item.line_total ?? item.total_amount) ??
    (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);

  return {
    sku: clean(
      item.sku || item.article || item.style || item.item_code || item.product_code
    ),
    quantity,
    unit_price: unitPrice,
    total_amount: totalAmount,
    currency: currency(item.currency),
    notes: clean(item.notes),
  };
}

async function insertAiRows(
  email: EmailRow,
  intent: string,
  structured: ExtractedData,
  text: string
) {
  const poNumber = clean(structured.po_number) || poFromText(text);
  const extractedCustomer = clean(structured.customer) || customerFromPO(text);

  const customerMatch = await getOrCreateCustomer({
    supabase,
    fromEmail: email.from_email,
    extractedCustomerName: extractedCustomer,
});

  const customer =
    customerMatch.customer_name || extractedCustomer || clean(email.from_email);

  if (intent === "ORDER") {
    const items = (structured.items || [])
      .map(normalizeAiItem)
      .filter((item) => item.sku);

    const group = await resolveOrderGroup({
      supabase,
      email,
      customerId: customerMatch.customer_id,
      customerName: customer,
      poNumber,
      orderReference: items[0]?.sku || null,
      source: "email",
    });

    for (const item of items) {
      await saveOrderItem({
        email,
        orderGroupId: group.id,
        customer,
        customerMatch,
        poNumber,
        action: "Place Order",
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalAmount: item.total_amount,
        currency: item.currency,
        notes: item.notes || clean(structured.notes),
      });
    }

    return items.length;
  }

  await supabase.from("order_items").insert({
    action: intent === "CANCELLATION" ? "Cancel Order" : "Reply to Enquiry",
    customer,
    customer_id: customerMatch.customer_id,
    customer_match_method: customerMatch.customer_match_method,
    customer_match_confidence: customerMatch.customer_match_confidence,
    po_number: poNumber,
    sku: "",
    quantity: null,
    notes: clean(structured.notes) || clean(email.subject),
    status: "Pending",
    source_email: email.from_email || "",
    parent_email_id: email.id,
    external_message_id: externalId(email),
    gmail_message_id: email.gmail_message_id,
    email_subject: email.subject || "",
    follow_up_due_at: structured.follow_up_date || null,
    created_at: new Date().toISOString(),
  });

  return 1;
}

async function processEmail(email: EmailRow, force: boolean) {
  if (email.direction === "OUTBOUND") {
    await markEmail(
      email.id,
      "ignored",
      "ignored",
      "Outbound email permanently ignored"
    );

    return {
      id: email.id,
      ignored: true,
      reason: "outbound_email",
    };
  }

  if (shouldSkipEmail(email, force)) {
    return {
      id: email.id,
      skipped: true,
      reason: "already_processed_or_ignored",
    };
  }

  const text = keepLines(`${email.body_text || ""}\n\n${email.attachment_text || ""}`);

  if (hasAttachmentWithoutText(email) && !force) {
    await markEmail(email.id, "needs_ocr");
    return { id: email.id, skipped: true, reason: "needs_ocr" };
  }

  if (!clean(text) || clean(text).length < 10) {
    await markEmail(
      email.id,
      "ignored",
      "ignored",
      "No useful email body or attachment text"
    );
    return { id: email.id, ignored: true };
  }

  if (force) {
    await deleteExistingItems(email);
  }

  const deterministicLines = parseStructuredPO(text);
  const poNumber = poFromText(text);

  if (deterministicLines.length > 0 && poNumber && hasOrderSignals(text)) {
    const insertedItems = await insertStructuredOrder(
      email,
      text,
      deterministicLines
    );

    await markEmail(email.id, "processed", "order");

    return {
      id: email.id,
      processed: true,
      intent: "ORDER",
      insertedItems,
      extraction: "deterministic_po_parser",
    };
  }

  const intent = await classifyEmail(text);

  if (intent === "IGNORE") {
    await deleteExistingItems(email);
    await markEmail(email.id, "ignored", "ignored");
    return { id: email.id, ignored: true, intent };
  }

const structured = await extractStructured(text);

const normalizedItems = (structured.items || []).map(normalizeAiItem);

const validation = validateOrderCandidate({
  subject: email.subject,
  text,
  poNumber: structured.po_number,
  items: normalizedItems,
});

const enquiryValidation = validateEnquiryCandidate({
  subject: email.subject,
  text,
});

const cancellationValidation = validateCancellationCandidate({
  subject: email.subject,
  text,
});

let finalIntent = intent;

if (cancellationValidation.isCancellation) {
  finalIntent = "CANCELLATION";
}

if (intent === "ORDER" && !validation.isOrder) {
  finalIntent = enquiryValidation.isEnquiry ? "ENQUIRY" : "IGNORE";
}

const insertedItems = await insertAiRows(
  email,
  finalIntent,
  structured,
  text
);

  if (insertedItems === 0) {
    await markEmail(
      email.id,
      "failed",
      intent.toLowerCase(),
      `Intent ${intent} found but no rows inserted`
    );

    return { id: email.id, ok: false, intent, insertedItems };
  }

await markEmail(
  email.id,
  "processed",
  finalIntent.toLowerCase()
);

return {
  id: email.id,
  processed: true,
  intent: finalIntent,
  validator: validation,
  insertedItems,
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
        results.push(await processEmail(email, force));
      } catch (error: any) {
        await markEmail(
          email.id,
          "failed",
          undefined,
          error?.message || String(error)
        );

        results.push({
          id: email.id,
          ok: false,
          error: error?.message || String(error),
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

export async function POST(req: NextRequest) {
  return GET(req);
}