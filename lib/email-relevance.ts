export type RelevanceResult = {
  relevant: boolean;
  reason: string;
  confidence: "high" | "medium" | "low";
};

function clean(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, patterns: string[]) {
  return patterns.filter((pattern) => text.includes(pattern));
}

function hasInlineOrderPattern(text: string) {
  return (
    /\bpo\s*#?\s*:?\s*[a-z0-9\-\/]+/i.test(text) ||
    /\bp\.?o\.?\s*#?\s*:?\s*[a-z0-9\-\/]+/i.test(text) ||
    /\b[a-z]{1,4}\d{3,}[a-z0-9\-\/]*\s*[-–]\s*\d+\s*(pc|pcs|piece|pieces|qty|yards|yds)?/i.test(
      text
    ) ||
    /\b[a-z0-9\-\/]{3,}\s*[-–]\s*\d+\s*(pc|pcs|piece|pieces|qty|yards|yds)?\s*@\s*\$?\d+/i.test(
      text
    )
  );
}

export function isRelevantBusinessEmail(params: {
  subject?: string | null;
  fromEmail?: string | null;
  bodyText?: string | null;
  attachmentName?: string | null;
  hasAttachment?: boolean;
}): RelevanceResult {
  const subject = clean(params.subject);
  const fromEmail = clean(params.fromEmail);
  const bodyText = clean(params.bodyText);
  const attachmentName = clean(params.attachmentName);

  const subjectAndSender = `${subject} ${fromEmail}`;
  const fullContent = `${subject} ${fromEmail} ${bodyText} ${attachmentName}`;

  const hardRejectSubjectSenderPatterns = [
    "unsubscribe",
    "newsletter",
    "promotion",
    "promotional",
    "limited time offer",
    "sale is live",
    "discount",
    "coupon",
    "register now",
    "finish your registration",
    "webinar",
    "event reminder",
    "calendar invitation",
    "meeting invitation",
    "otp",
    "one time password",
    "verification code",
    "password reset",
    "security alert",
    "login alert",
    "bank statement",
    "account statement",
    "credit card",
    "debit card",
    "available balance",
    "low balance",
    "portfolio",
    "mutual fund",
    "dividend",
    "tds",
    "tax deductible",
    "postpaid bill",
    "pass code",
    "bill payment",
    "autopay",
    "e-points",
    "redeem now",
    "policy no",
    "bonus declaration",
    "hdfc",
    "kotak",
    "icici",
    "axis bank",
    "moneycontrol",
    "vodafoneidea",
    "jio financial",
    "marriott",
    "gartex",
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
  ];

  const hardRejectMatches = hasAny(
    subjectAndSender,
    hardRejectSubjectSenderPatterns
  );

  if (hardRejectMatches.length > 0) {
    return {
      relevant: false,
      reason: `Hard reject matched in subject/sender: ${hardRejectMatches.join(
        ", "
      )}`,
      confidence: "high",
    };
  }

  if (hasInlineOrderPattern(fullContent)) {
    return {
      relevant: true,
      reason: "Inline order pattern matched: PO/SKU/quantity/price",
      confidence: "high",
    };
  }

  const strongBusinessSignals = [
    "purchase order",
    "po #",
    "po:",
    "p.o.",
    "new order",
    "place order",
    "below order",
    "confirm order",
    "please confirm",
    "cancel order",
    "cancel po",
    "cancel shipment",
    "do not proceed",
    "sku",
    "style no",
    "style:",
    "style #",
    "article no",
    "art.",
    "quantity",
    "qty",
    "pcs",
    "pc",
    "yards",
    "yds",
    "trim",
    "fabric",
    "lace",
    "sample",
    "swatch",
    "bulk",
    "shipment",
    "ship date",
    "delivery date",
    "confirm delivery",
    "enquiry",
    "inquiry",
    "quote",
    "quotation",
    "price confirmation",
    "availability",
    "proforma",
    "proforma invoice",
    "invoice",
    "pedido proveedor",
    "shipping bill",
    "sb status",
    "closure status",
  ];

  const matchedSignals = hasAny(fullContent, strongBusinessSignals);

  if (matchedSignals.length > 0) {
    return {
      relevant: true,
      reason: `Business signal matched: ${matchedSignals.join(", ")}`,
      confidence: "high",
    };
  }

  const businessAttachmentSignals = [
    "po",
    "purchase",
    "order",
    "invoice",
    "proforma",
    "trim",
    "fabric",
    "style",
    "sample",
    "swatch",
    "pedido",
    "shipping",
    "sb",
  ];

  const fileLooksBusinessRelevant = businessAttachmentSignals.some((signal) =>
    attachmentName.includes(signal)
  );

  const fileIsReadableBusinessFormat =
    attachmentName.endsWith(".pdf") ||
    attachmentName.endsWith(".xls") ||
    attachmentName.endsWith(".xlsx") ||
    attachmentName.endsWith(".doc") ||
    attachmentName.endsWith(".docx") ||
    attachmentName.endsWith(".txt") ||
    attachmentName.endsWith(".csv");

  if (
    params.hasAttachment &&
    fileIsReadableBusinessFormat &&
    fileLooksBusinessRelevant
  ) {
    return {
      relevant: true,
      reason: "Relevant-looking business attachment",
      confidence: "medium",
    };
  }

  return {
    relevant: false,
    reason: "No business/order/enquiry/cancellation signal found",
    confidence: "medium",
  };
}