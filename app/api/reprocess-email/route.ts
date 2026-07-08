import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { findCustomerForEmail } from "@/lib/customerAutoLink";

export const dynamic = "force-dynamic";

type ExtractedItem = {
  action?: string;
  sku?: string;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  currency?: string | null;
  line_total?: number | string | null;
  description?: string | null;
  notes?: string | null;
  custom_fields?: Record<string, any> | null;
};

type ParsedPoLine = {
  sku: string;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  currency: string;
  description: string;
  notes: string;
  custom_fields: Record<string, string>;
};

function clean(value: any) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compact(value: any) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrNull(value: any) {
  if (value === null || value === undefined) return null;

  const text = String(value).replace(/[$,]/g, "").trim();
  if (!text) return null;

  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function normalizeCurrency(value: any) {
  const text = compact(value).toUpperCase();

  if (!text) return "USD";
  if (text === "$" || text === "US$") return "USD";
  if (text === "€") return "EUR";
  if (text === "£") return "GBP";
  if (text === "₹") return "INR";

  return text;
}

function normalizeAction(value: any) {
  const text = compact(value).toLowerCase();

  if (text === "place order" || text === "order") return "Place Order";
  if (text === "reply to enquiry" || text === "enquiry") {
    return "Reply to Enquiry";
  }
  if (text === "cancel order" || text === "cancellation") return "Cancel Order";
  if (text === "follow up" || text === "follow-up") return "Follow Up";
  if (text === "confirm delivery") return "Confirm Delivery";

  return "";
}

function normalizeCustomFields(value: any) {
  const output: Record<string, string> = {};

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return output;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    const cleanKey = compact(key);
    const cleanValue = compact(fieldValue);

    if (!cleanKey || !cleanValue) continue;

    output[cleanKey] = cleanValue;
  }

  return output;
}

function extractPoFallback(content: string) {
  const text = clean(content);

  const poMatch =
    text.match(/\bPO\s*#\s*:?\s*([A-Z0-9\-\/]+)/i) ||
    text.match(/\bP\.?O\.?\s*#?\s*:?\s*([A-Z0-9\-\/]+)/i) ||
    text.match(/\bPurchase\s+Order\s*#?\s*:?\s*([A-Z0-9\-\/]+)/i);

  return poMatch?.[1] || "";
}

function extractCustomerFallback(content: string) {
  const text = clean(content);
  const lines = text
    .split("\n")
    .map((line) => compact(line))
    .filter(Boolean);

  const purchaseOrderIndex = lines.findIndex((line) =>
    /^purchase order$/i.test(line)
  );

  if (purchaseOrderIndex >= 0) {
    for (
      let index = purchaseOrderIndex + 1;
      index < Math.min(lines.length, purchaseOrderIndex + 6);
      index += 1
    ) {
      const line = lines[index];

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

function getLineValue(block: string, label: string) {
  const pattern = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i");
  const match = block.match(pattern);

  return compact(match?.[1] || "");
}

function getMoneyValues(block: string) {
  return Array.from(block.matchAll(/(?:US\$|\$|USD\s*)\s*(\d+(?:\.\d{1,2})?)/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function getStandaloneNumberLines(block: string) {
  return block
    .split("\n")
    .map((line) => compact(line))
    .filter((line) => /^\d+(?:\.\d+)?$/.test(line))
    .map((line) => Number(line))
    .filter((value) => Number.isFinite(value));
}

function extractArticleBlocks(content: string) {
  const text = clean(content);
  const articleRegex = /ARTICLE\s*:\s*([A-Z0-9\-\/]+)/gi;
  const matches = Array.from(text.matchAll(articleRegex));

  return matches.map((match, index) => {
    const start = match.index || 0;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index || text.length
        : text.length;

    return {
      sku: compact(match[1]),
      block: text.slice(start, end),
    };
  });
}

function parsePoLinesFromText(content: string): ParsedPoLine[] {
  const blocks = extractArticleBlocks(content);

  return blocks
    .map(({ sku, block }) => {
      const description = getLineValue(block, "DESCRIPTION");
      const color = getLineValue(block, "COLOR");
      const notesChanges = getLineValue(block, "NOTES/CHANGES");

      const moneyValues = getMoneyValues(block);
      const numberLines = getStandaloneNumberLines(block);

      const quantity =
        numberLines.find((value) => value > 0 && Number.isInteger(value)) ??
        null;

      const unitPrice = moneyValues.length >= 1 ? moneyValues[0] : null;
      const totalAmount =
        moneyValues.length >= 2
          ? moneyValues[1]
          : quantity !== null && unitPrice !== null
          ? quantity * unitPrice
          : null;

      const notes = [
        description ? description : "",
        color ? `Color: ${color}` : "",
        notesChanges ? `Notes/Changes: ${notesChanges}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const customFields: Record<string, string> = {};

      if (description) customFields.description = description;
      if (color) customFields.color = color;
      if (notesChanges) customFields.notes_changes = notesChanges;
      if (totalAmount !== null) customFields.line_total = String(totalAmount);

      return {
        sku,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        currency: "USD",
        description,
        notes,
        custom_fields: customFields,
      };
    })
    .filter((line) => line.sku);
}

function normalizeItem(
  item: ExtractedItem,
  deterministicLine: ParsedPoLine | null
) {
  const quantity =
    deterministicLine?.quantity ?? numberOrNull(item.quantity);
  const unitPrice =
    deterministicLine?.unit_price ?? numberOrNull(item.unit_price);
  const totalAmount =
    deterministicLine?.total_amount ??
    numberOrNull(item.line_total) ??
    (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);

  const sku = compact(item.sku || deterministicLine?.sku || "");
  const description = compact(
    item.description || deterministicLine?.description || ""
  );
  const notes = compact(item.notes || deterministicLine?.notes || "");

  const customFields = {
    ...normalizeCustomFields(item.custom_fields),
    ...(deterministicLine?.custom_fields || {}),
  };

  if (description) customFields.description = description;
  if (totalAmount !== null) customFields.line_total = String(totalAmount);

  return {
    action: normalizeAction(item.action),
    sku,
    quantity,
    unit_price: unitPrice,
    currency: normalizeCurrency(item.currency || deterministicLine?.currency),
    total_amount: totalAmount,
    notes,
    custom_fields: customFields,
  };
}

function mergeAiAndDeterministicLines(params: {
  aiItems: ExtractedItem[];
  deterministicLines: ParsedPoLine[];
  intent: string;
}) {
  const { aiItems, deterministicLines, intent } = params;

  if (intent !== "ORDER") {
    return aiItems.map((item) => normalizeItem(item, null));
  }

  const deterministicBySku = new Map(
    deterministicLines.map((line) => [line.sku.toLowerCase(), line])
  );

  const normalized = aiItems
    .map((item) => {
      const sku = compact(item.sku);
      const deterministicLine = sku
        ? deterministicBySku.get(sku.toLowerCase()) || null
        : null;

      return normalizeItem(item, deterministicLine);
    })
    .filter((item) => item.sku);

  const existingSkus = new Set(normalized.map((item) => item.sku.toLowerCase()));

  for (const line of deterministicLines) {
    if (existingSkus.has(line.sku.toLowerCase())) continue;

    normalized.push(
      normalizeItem(
        {
          action: "Place Order",
          sku: line.sku,
          quantity: line.quantity,
          unit_price: line.unit_price,
          currency: line.currency,
          line_total: line.total_amount,
          description: line.description,
          notes: line.notes,
          custom_fields: line.custom_fields,
        },
        line
      )
    );
  }

  return normalized;
}

export async function POST(req: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const formData = await req.formData();

  const emailId = compact(formData.get("email_id"));
  const ocrText = clean(formData.get("ocr_text"));

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: email, error: emailError } = await supabaseAdmin
    .from("emails")
    .select("*")
    .eq("id", emailId)
    .single();

  if (emailError || !email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const attachmentText = ocrText || clean(email.attachment_text);

  const combinedInput = `
SUBJECT:
${compact(email.subject)}

FROM:
${compact(email.from_email)}

EMAIL BODY:
${clean(email.body_text)}

ATTACHMENT / OCR TEXT:
${attachmentText}
`;

  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are a strict universal business email and document extraction engine.

Return JSON only in this exact shape:

{
  "intent": "ORDER",
  "customer": "",
  "po_number": "",
  "delivery_date": "",
  "notes": "",
  "items": [
    {
      "action": "Place Order",
      "sku": "",
      "quantity": null,
      "unit_price": null,
      "currency": "USD",
      "line_total": null,
      "description": "",
      "notes": "",
      "custom_fields": {}
    }
  ]
}

VALID intent values:
ORDER
ENQUIRY
CANCELLATION
IGNORE

VALID action values:
Place Order
Reply to Enquiry
Cancel Order
Follow Up
Confirm Delivery

CLASSIFICATION RULES:
- Classify into one intent only.
- ORDER means the customer is placing/sending/attaching a real order or purchase order.
- ENQUIRY means the customer is asking a question, asking price, availability, status, delivery update, payment clarification, shipment status, or confirmation without placing a new order.
- CANCELLATION means the customer explicitly says cancel, stop, remove, do not proceed, or do not ship.
- IGNORE means spam, marketing, newsletters, OTP, irrelevant, signatures only, or unclear.

CRITICAL RULES:
- A purchase order PDF with item rows is ORDER.
- "cancel date" inside a PO is NOT cancellation.
- "delivery confirmation" is ENQUIRY unless a new order is clearly placed.
- Never create order rows from enquiries.
- Never create enquiry rows from orders.
- Never create fake SKU from the subject.
- Never invent quantity.
- Never default quantity to 1.
- Never ignore visible unit price.
- Never merge separate item rows.

ORDER EXTRACTION RULES:
- If intent is ORDER, every visible item row/block must become one item.
- Use sku for the best visible item identifier: SKU, item #, article, style, model, product code, part no, material code.
- Extract quantity from the same item row/block.
- Extract unit_price from the same item row/block.
- Unit price may appear as "$44.00", "44.00", "USD 44", "UNIT PRICE 44", or in a table under the column "UNIT PRICE".
- If an item row/block has columns like QTY UNIT PRICE TOTAL, read all three values.
- Do not confuse line_total with unit_price.
- Example: if row shows QTY 3, UNIT PRICE $44.00, TOTAL $132.00 then quantity=3, unit_price=44, line_total=132.
- If unit price is visible anywhere in the row/block, unit_price must not be null.
- Extract line_total if visible; otherwise calculate quantity × unit_price only when both are visible.
- Extract currency from visible symbol/code. "$" means USD.
- Put extra row fields into custom_fields: color, size, width, material, grade, finish, notes_changes, specification, delivery, etc.
- description should hold the visible product description.
- notes should hold row-specific notes/changes.
- If a PO has six visible item rows, return six items.

ENQUIRY EXTRACTION RULES:
- If intent is ENQUIRY, return one item with action Reply to Enquiry only if useful.
- Do not create Place Order action for enquiry.

CANCELLATION EXTRACTION RULES:
- If intent is CANCELLATION, return one item with action Cancel Order.

IGNORE RULES:
- If intent is IGNORE, return items: [].

GENERAL RULES:
- If value is missing or unclear, use null or "".
- Do not hallucinate.
- Use both email body and attachment/OCR text.
`,
      },
      {
        role: "user",
        content: combinedInput,
      },
    ],
  });

  const raw = aiResponse.choices[0].message.content || "{}";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      intent: "IGNORE",
      customer: "",
      po_number: "",
      delivery_date: "",
      notes: "",
      items: [],
    };
  }

  const intent = compact(parsed.intent).toUpperCase();
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const deterministicLines = parsePoLinesFromText(combinedInput);

  const customerFallback = extractCustomerFallback(combinedInput);
  const customerMatch = await findCustomerForEmail({
    supabase: supabaseAdmin,
    fromEmail: email.from_email,
    extractedCustomerName: compact(parsed.customer) || customerFallback,
  });

  const customer =
    customerMatch.customer_name ||
    compact(parsed.customer) ||
    customerFallback ||
    compact(email.from_email);

  const poNumber = compact(parsed.po_number) || extractPoFallback(combinedInput);
  const deliveryDate = compact(parsed.delivery_date) || null;
  const baseNotes = compact(parsed.notes);

  if (poNumber) {
    await supabaseAdmin
      .from("order_items")
      .delete()
      .eq("po_number", poNumber)
      .eq("email_subject", email.subject || "");
  }

  const normalizedItems = mergeAiAndDeterministicLines({
    aiItems: items,
    deterministicLines,
    intent,
  }).filter((item: ReturnType<typeof normalizeItem>) => {
    if (intent === "ORDER") {
      return item.action === "Place Order" && !!item.sku;
    }

    if (intent === "ENQUIRY") {
      return item.action === "Reply to Enquiry";
    }

    if (intent === "CANCELLATION") {
      return item.action === "Cancel Order";
    }

    return false;
  });

  await supabaseAdmin
    .from("emails")
    .update({
      attachment_text: attachmentText,
      intent: intent.toLowerCase(),
    })
    .eq("id", emailId);

  if (intent === "IGNORE") {
    await supabaseAdmin
      .from("emails")
      .update({
        processing_status: "ignored",
        processed_at: new Date().toISOString(),
      })
      .eq("id", emailId);

    return NextResponse.redirect(new URL("/emails", req.url));
  }

  for (const item of normalizedItems) {
    await supabaseAdmin.from("order_items").insert({
      action: item.action,
      customer,
      customer_id: customerMatch.customer_id,
      customer_match_method: customerMatch.customer_match_method,
      customer_match_confidence: customerMatch.customer_match_confidence,
      po_number: poNumber,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.total_amount,
      currency: item.currency,
      notes: item.notes || baseNotes,
      custom_fields: item.custom_fields,
      delivery_date: deliveryDate,
      status: intent === "ORDER" ? "New" : "Pending",
      source_email: email.from_email,
      external_message_id: email.external_message_id,
      gmail_message_id: email.gmail_message_id,
      email_subject: email.subject,
      created_at: new Date().toISOString(),
    });
  }

  await supabaseAdmin
    .from("emails")
    .update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  return NextResponse.redirect(new URL("/emails", req.url));
}