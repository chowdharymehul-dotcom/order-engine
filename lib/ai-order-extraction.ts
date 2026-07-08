import OpenAI from "openai";

export type BusinessIntent = "ORDER" | "ENQUIRY" | "CANCELLATION" | "IGNORE";

export type UniversalExtractedItem = {
  sku: string;
  quantity: number | null;
  unit_price: number | null;
  currency: string;
  line_total: number | null;
  description: string;
  custom_fields: Record<string, string>;
  notes: string;
  source_evidence: string;
  confidence: number;
};

export type UniversalExtractionResult = {
  intent: BusinessIntent;
  customer: string;
  po_number: string;
  delivery_date: string;
  notes: string;
  priority: "low" | "medium" | "high";
  follow_up_date: string;
  items: UniversalExtractedItem[];
  confidence: number;
  reason: string;
};

function clean(value: any) {
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
  const text = clean(value).toUpperCase();

  if (!text) return "USD";

  if (text === "$" || text === "US$") return "USD";
  if (text === "€") return "EUR";
  if (text === "£") return "GBP";
  if (text === "₹") return "INR";

  return text;
}

function clampConfidence(value: any) {
  const num = Number(value);

  if (!Number.isFinite(num)) return 0;

  return Math.max(0, Math.min(1, num));
}

function normalizeIntent(value: any): BusinessIntent {
  const text = clean(value).toUpperCase();

  if (text === "ORDER") return "ORDER";
  if (text === "ENQUIRY") return "ENQUIRY";
  if (text === "CANCELLATION") return "CANCELLATION";

  return "IGNORE";
}

function normalizeDate(value: any) {
  const text = clean(value);

  if (!text) return "";

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return text;

  return date.toISOString().slice(0, 10);
}

function normalizeCustomFields(value: any) {
  const output: Record<string, string> = {};

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return output;
  }

  for (const [key, fieldValue] of Object.entries(value)) {
    const cleanKey = clean(key);
    const cleanValue = clean(fieldValue);

    if (!cleanKey || !cleanValue) continue;

    output[cleanKey] = cleanValue;
  }

  return output;
}

function normalizeItems(value: any): UniversalExtractedItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const quantity = numberOrNull(item.quantity ?? item.qty);
      const unitPrice = numberOrNull(item.unit_price ?? item.price);
      const lineTotal =
        numberOrNull(item.line_total ?? item.total_amount ?? item.amount) ??
        (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);

      return {
        sku: clean(item.sku || item.item_code || item.product_code || ""),
        quantity,
        unit_price: unitPrice,
        currency: normalizeCurrency(item.currency),
        line_total: lineTotal,
        description: clean(item.description || ""),
        custom_fields: normalizeCustomFields(item.custom_fields),
        notes: clean(item.notes || ""),
        source_evidence: clean(item.source_evidence || ""),
        confidence: clampConfidence(item.confidence),
      };
    })
    .filter((item) => item.sku);
}

export function buildExtractionInput(params: {
  subject?: string | null;
  fromEmail?: string | null;
  bodyText?: string | null;
  attachmentText?: string | null;
  ocrText?: string | null;
}) {
  return `
SUBJECT:
${clean(params.subject)}

FROM:
${clean(params.fromEmail)}

EMAIL BODY:
${clean(params.bodyText)}

ATTACHMENT TEXT:
${clean(params.attachmentText)}

OCR TEXT:
${clean(params.ocrText)}
`.trim();
}

export async function extractUniversalBusinessIntent(params: {
  openai: OpenAI;
  input: string;
}) {
  const response = await params.openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are a universal business document extraction engine.

Your job:
1. Classify the input into exactly one intent.
2. Extract structured business data if applicable.
3. Never invent missing values.
4. Preserve source evidence.

Return STRICT JSON only in this exact shape:

{
  "intent": "ORDER",
  "customer": "",
  "po_number": "",
  "delivery_date": "",
  "notes": "",
  "priority": "low",
  "follow_up_date": "",
  "confidence": 0.0,
  "reason": "",
  "items": [
    {
      "sku": "",
      "quantity": null,
      "unit_price": null,
      "currency": "USD",
      "line_total": null,
      "description": "",
      "custom_fields": {},
      "notes": "",
      "source_evidence": "",
      "confidence": 0.0
    }
  ]
}

INTENTS:

ORDER:
Use only when the customer is placing or sending a real order / PO / purchase order / order document.
ORDER normally contains one or more item/product/style/article/SKU codes with quantity.
A PDF purchase order is ORDER even if it contains terms like "cancel date", "start/cancel", or "cancellation date".

ENQUIRY:
Use when the customer asks a question, asks for availability, asks for status, asks for confirmation, asks about delivery, asks for samples, asks for prices, asks for clarification, or discusses possible future orders without placing a confirmed order.

CANCELLATION:
Use only when the customer clearly instructs to cancel / stop / not proceed / remove an existing order, PO, shipment, or item.
Do not classify cancellation only because a document contains "cancel date" or "cancellation date".

IGNORE:
Use for spam, newsletters, irrelevant messages, empty messages, signatures only, OTPs, ads, marketing, notifications, or unclear content.

UNIVERSAL ORDER EXTRACTION RULES:
- Do not hardcode any business type or product category.
- Extract the customer's fields as they appear.
- For SKU, use the best item identifier visible: SKU, item #, item no, article, style, product code, part no, model, material code.
- For quantity, extract the quantity from the same item line/block. Do not default to 1.
- For unit_price, extract unit price from the same item line/block. Do not leave blank if visible.
- For line_total, extract visible total. If visible total is missing but quantity and unit_price are present, calculate quantity × unit_price.
- For currency, infer only from visible symbols/codes like $, USD, INR, EUR. If only $ is visible, use USD.
- Put extra line-level fields into custom_fields, for example color, size, width, description, notes/changes, delivery, specification, voltage, material, grade, finish, pack size, etc.
- Every item must include source_evidence: the exact short text fragment that supports that row.
- Never create an item with blank SKU.
- Never create fake SKUs from subject lines.
- Never create ORDER rows from enquiries.
- If intent is ORDER but no real line items are visible, return items: [] and low confidence.
- If the document has a table, preserve every row as a separate item.
- If multiple products are visible, return multiple items.
- If an order has six item lines, return six items.
- If price/quantity appears in a separate nearby line but belongs to the item block, attach it to that item.

ENQUIRY EXTRACTION RULES:
- For ENQUIRY, items may be empty or may contain referenced SKUs only if clearly mentioned.
- Do not convert enquiry SKUs into order lines.

CANCELLATION EXTRACTION RULES:
- For CANCELLATION, include referenced SKU/PO if visible.
- Do not classify routine PO fields like cancel date as cancellation.

DATE RULES:
- delivery_date and follow_up_date must be YYYY-MM-DD when clearly available.
- If unclear, return blank.

CONFIDENCE:
- confidence must be 0 to 1.
- Use lower confidence if text is noisy, OCR is poor, or values are ambiguous.
`,
      },
      {
        role: "user",
        content: params.input,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "{}";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const intent = normalizeIntent(parsed.intent);

  return {
    intent,
    customer: clean(parsed.customer),
    po_number: clean(parsed.po_number),
    delivery_date: normalizeDate(parsed.delivery_date),
    notes: clean(parsed.notes),
    priority:
      parsed.priority === "high" || parsed.priority === "medium"
        ? parsed.priority
        : "low",
    follow_up_date: normalizeDate(parsed.follow_up_date),
    confidence: clampConfidence(parsed.confidence),
    reason: clean(parsed.reason),
    items: normalizeItems(parsed.items),
  } satisfies UniversalExtractionResult;
}

export function shouldInsertAsOrder(result: UniversalExtractionResult) {
  return result.intent === "ORDER" && result.items.length > 0;
}

export function shouldInsertAsEnquiry(result: UniversalExtractionResult) {
  return result.intent === "ENQUIRY";
}

export function shouldInsertAsCancellation(result: UniversalExtractionResult) {
  return result.intent === "CANCELLATION";
}