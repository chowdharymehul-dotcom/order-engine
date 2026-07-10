export type CancellationValidationResult = {
  isCancellation: boolean;
  score: number;
  reasons: string[];
  scope: "FULL_ORDER" | "PARTIAL_ORDER" | "SHIPMENT" | "UNKNOWN";
};

function clean(value: string | null | undefined) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function validateCancellationCandidate(params: {
  subject?: string | null;
  text?: string | null;
}): CancellationValidationResult {
  const text = clean(`${params.subject || ""} ${params.text || ""}`);

  const reasons: string[] = [];
  let score = 0;
  let scope: CancellationValidationResult["scope"] = "UNKNOWN";

  const explicitCancellationSignals = [
    /\bplease cancel\b/i,
    /\bcancel (?:the |this )?(?:order|po|purchase order)\b/i,
    /\bcancel po\b/i,
    /\bcancel order\b/i,
    /\border cancellation\b/i,
    /\bpo cancellation\b/i,
    /\bdo not proceed\b/i,
    /\bdo not process\b/i,
    /\bdo not produce\b/i,
    /\bstop production\b/i,
    /\bstop processing\b/i,
    /\bvoid (?:the |this )?(?:order|po)\b/i,
    /\bwithdraw (?:the |this )?(?:order|po)\b/i,
    /\bno longer required\b/i,
    /\bno longer needed\b/i,
  ];

  const shipmentCancellationSignals = [
    /\bdo not ship\b/i,
    /\bstop shipment\b/i,
    /\bcancel shipment\b/i,
    /\bhold shipment\b/i,
    /\bdo not dispatch\b/i,
    /\bstop dispatch\b/i,
  ];

  const partialCancellationSignals = [
    /\bcancel (?:item|article|style|sku|line)\b/i,
    /\bcancel only\b/i,
    /\bremove (?:item|article|style|sku|line)\b/i,
    /\bdelete (?:item|article|style|sku|line)\b/i,
    /\bexclude (?:item|article|style|sku|line)\b/i,
    /\bdo not proceed with\b/i,
    /\bcancel quantity\b/i,
    /\breduce quantity to zero\b/i,
  ];

  if (hasAny(text, explicitCancellationSignals)) {
    score += 300;
    reasons.push("Explicit order-cancellation wording found");
    scope = "FULL_ORDER";
  }

  if (hasAny(text, shipmentCancellationSignals)) {
    score += 250;
    reasons.push("Shipment-cancellation wording found");
    scope = "SHIPMENT";
  }

  if (hasAny(text, partialCancellationSignals)) {
    score += 300;
    reasons.push("Partial item cancellation wording found");
    scope = "PARTIAL_ORDER";
  }

  const negativeFalsePositiveSignals = [
    /\bcancellation date\b/i,
    /\bcancel date\b/i,
    /\bcancellation policy\b/i,
    /\bnon[- ]?cancellable\b/i,
    /\bnot cancellable\b/i,
    /\bcancellation charge\b/i,
    /\bcancellation fee\b/i,
    /\blast date to cancel\b/i,
  ];

  if (hasAny(text, negativeFalsePositiveSignals)) {
    score -= 350;
    reasons.push("Cancellation term appears as policy/date, not an instruction");
  }

  const confirmationOnlySignals = [
    /\bcan this be cancelled\b/i,
    /\bis cancellation possible\b/i,
    /\bwhat is the cancellation policy\b/i,
    /\bplease advise if we can cancel\b/i,
  ];

  if (hasAny(text, confirmationOnlySignals)) {
    score -= 150;
    reasons.push("Cancellation appears to be an enquiry rather than instruction");
  }

  return {
    isCancellation: score >= 200,
    score,
    reasons,
    scope,
  };
}