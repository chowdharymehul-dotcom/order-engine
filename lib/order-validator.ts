type OrderCandidateItem = {
  sku?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_amount?: number | null;
};

type ValidateOrderCandidateParams = {
  subject?: string | null;
  text?: string | null;
  poNumber?: string | null;
  items?: OrderCandidateItem[];
};

const INVALID_PO_VALUES = new Set([
  "re",
  "fw",
  "fwd",
  "rts",
  "possible",
  "ssible",
  "int",
  "hnt",
  "yes",
  "no",
  "ok",
]);

function clean(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalise(value: any) {
  return clean(value).toLowerCase();
}

function hasValidIdentifier(value: any) {
  const text = clean(value);
  const lower = text.toLowerCase();

  if (!text) return false;
  if (INVALID_PO_VALUES.has(lower)) return false;
  if (text.length < 3) return false;

  return /[a-zA-Z]/.test(text) || /\d/.test(text);
}

function hasValidSku(value: any) {
  const text = clean(value);
  const lower = text.toLowerCase();

  if (!text) return false;
  if (INVALID_PO_VALUES.has(lower)) return false;
  if (text.length < 3) return false;

  return /[a-zA-Z]/.test(text) && /\d/.test(text);
}

function negativeSignalScore(text: string) {
  const value = normalise(text);
  let score = 0;

  if (value.includes("lead time")) score -= 500;
  if (value.includes("sample time")) score -= 500;
  if (value.includes("development lead time")) score -= 500;
  if (value.includes("payment order")) score -= 600;
  if (value.includes("transferencia")) score -= 600;
  if (value.includes("payment received")) score -= 500;
  if (value.includes("invoice payment")) score -= 500;
  if (value.includes("bank transfer")) score -= 500;
  if (value.includes("tracking")) score -= 350;
  if (value.includes("shipment")) score -= 300;
  if (value.includes("delivered")) score -= 300;

  return score;
}

export function validateOrderCandidate(params: ValidateOrderCandidateParams) {
  const subject = clean(params.subject);
  const text = clean(params.text);
  const combined = `${subject}\n${text}`;
  const poNumber = clean(params.poNumber);
  const items = params.items || [];

  let score = 0;
  const reasons: string[] = [];

  if (hasValidIdentifier(poNumber)) {
    score += 300;
    reasons.push("Valid PO/order reference found");
  }

  const validItems = items.filter((item) => {
    const validSku = hasValidSku(item.sku);
    const validQty =
      item.quantity !== null &&
      item.quantity !== undefined &&
      Number(item.quantity) > 0;

    return validSku && validQty;
  });

  if (validItems.length > 0) {
    score += 500;
    reasons.push("Valid SKU and quantity found");
  }

  if (validItems.length >= 2) {
    score += 150;
    reasons.push("Multiple valid order lines found");
  }

  if (items.some((item) => item.unit_price !== null && item.unit_price !== undefined)) {
    score += 100;
    reasons.push("Unit price found");
  }

  if (items.some((item) => item.total_amount !== null && item.total_amount !== undefined)) {
    score += 100;
    reasons.push("Line total found");
  }

  if (/purchase order/i.test(combined)) {
    score += 250;
    reasons.push("Purchase order wording found");
  }

  if (/\bpo\s*#/i.test(combined)) {
    score += 200;
    reasons.push("PO number wording found");
  }

  const negativeScore = negativeSignalScore(combined);

  if (negativeScore < 0) {
    score += negativeScore;
    reasons.push("Negative enquiry/follow-up/payment signals found");
  }

  return {
    isOrder: score >= 700,
    score,
    validItems,
    reasons,
  };
}