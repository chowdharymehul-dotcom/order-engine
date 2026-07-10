export type EnquiryValidationResult = {
  isEnquiry: boolean;
  score: number;
  reasons: string[];
  enquiryType:
    | "PRICE"
    | "AVAILABILITY"
    | "LEAD_TIME"
    | "DELIVERY_STATUS"
    | "SAMPLE"
    | "MOQ"
    | "PRODUCT"
    | "DOCUMENTATION"
    | "FOLLOW_UP"
    | "GENERAL"
    | null;
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

export function validateEnquiryCandidate(params: {
  subject?: string | null;
  text?: string | null;
}): EnquiryValidationResult {
  const text = clean(`${params.subject || ""} ${params.text || ""}`);

  const reasons: string[] = [];
  let score = 0;
  let enquiryType: EnquiryValidationResult["enquiryType"] = null;

  const cancellationSignals = [
    /\bcancel(?:led|lation)?\b/i,
    /\bdo not proceed\b/i,
    /\bdo not ship\b/i,
    /\bstop production\b/i,
    /\bvoid (?:the )?(?:order|po)\b/i,
  ];

  if (hasAny(text, cancellationSignals)) {
    return {
      isEnquiry: false,
      score: 0,
      reasons: ["Explicit cancellation wording found"],
      enquiryType: null,
    };
  }

  const priceSignals = [
    /\bprice\b/i,
    /\bpricing\b/i,
    /\bquote\b/i,
    /\bquotation\b/i,
    /\bcost\b/i,
    /\brate\b/i,
    /\bhow much\b/i,
    /\bbest price\b/i,
  ];

  const availabilitySignals = [
    /\bavailability\b/i,
    /\bavailable\b/i,
    /\bin stock\b/i,
    /\bstock status\b/i,
    /\bcan you supply\b/i,
    /\bcan you provide\b/i,
  ];

  const leadTimeSignals = [
    /\blead time\b/i,
    /\bproduction time\b/i,
    /\bdelivery time\b/i,
    /\bhow soon\b/i,
    /\bwhen can\b/i,
    /\bready date\b/i,
  ];

  const deliverySignals = [
    /\bdelivery status\b/i,
    /\bshipment status\b/i,
    /\bshipping status\b/i,
    /\bdispatch status\b/i,
    /\beta\b/i,
    /\btracking\b/i,
    /\bawb\b/i,
    /\bwhen will (?:it|this|the order) (?:ship|arrive|be delivered)\b/i,
    /\bexpected delivery\b/i,
  ];

  const sampleSignals = [
    /\bsample\b/i,
    /\bsampling\b/i,
    /\bswatch\b/i,
    /\blab dip\b/i,
    /\bstrike[- ]?off\b/i,
    /\bdevelopment yardage\b/i,
  ];

  const moqSignals = [
    /\bmoq\b/i,
    /\bminimum order\b/i,
    /\bminimum quantity\b/i,
    /\bminimum order quantity\b/i,
  ];

  const productSignals = [
    /\bcolour\b/i,
    /\bcolor\b/i,
    /\bshade\b/i,
    /\bquality\b/i,
    /\bcomposition\b/i,
    /\bwidth\b/i,
    /\bsize\b/i,
    /\bspecification\b/i,
    /\btechnical detail\b/i,
  ];

  const documentationSignals = [
    /\bcertificate\b/i,
    /\btest report\b/i,
    /\bpacking list\b/i,
    /\binvoice\b/i,
    /\bshipping document\b/i,
    /\bcompliance\b/i,
    /\bdocumentation\b/i,
  ];

  const followUpSignals = [
    /\bfollow[- ]?up\b/i,
    /\bany update\b/i,
    /\bplease update\b/i,
    /\bstatus update\b/i,
    /\bstill waiting\b/i,
    /\bawaiting your reply\b/i,
    /\bawaiting confirmation\b/i,
    /\breminder\b/i,
  ];

  const questionSignals = [
    /\bplease advise\b/i,
    /\bplease confirm\b/i,
    /\bplease check\b/i,
    /\bcan you\b/i,
    /\bcould you\b/i,
    /\bwould you\b/i,
    /\bmay we\b/i,
    /\bwhat is\b/i,
    /\bwhat are\b/i,
    /\bwhen is\b/i,
    /\bwhen will\b/i,
    /\bis it\b/i,
    /\bare you able\b/i,
    /\bkindly advise\b/i,
    /\?$/,
  ];

  if (hasAny(text, priceSignals)) {
    score += 200;
    reasons.push("Price or quotation request found");
    enquiryType ||= "PRICE";
  }

  if (hasAny(text, availabilitySignals)) {
    score += 200;
    reasons.push("Availability request found");
    enquiryType ||= "AVAILABILITY";
  }

  if (hasAny(text, leadTimeSignals)) {
    score += 200;
    reasons.push("Lead-time request found");
    enquiryType ||= "LEAD_TIME";
  }

  if (hasAny(text, deliverySignals)) {
    score += 200;
    reasons.push("Delivery or shipment status request found");
    enquiryType ||= "DELIVERY_STATUS";
  }

  if (hasAny(text, sampleSignals)) {
    score += 180;
    reasons.push("Sample-related request found");
    enquiryType ||= "SAMPLE";
  }

  if (hasAny(text, moqSignals)) {
    score += 180;
    reasons.push("MOQ request found");
    enquiryType ||= "MOQ";
  }

  if (hasAny(text, productSignals)) {
    score += 100;
    reasons.push("Product-detail request found");
    enquiryType ||= "PRODUCT";
  }

  if (hasAny(text, documentationSignals)) {
    score += 150;
    reasons.push("Documentation request found");
    enquiryType ||= "DOCUMENTATION";
  }

  if (hasAny(text, followUpSignals)) {
    score += 180;
    reasons.push("Follow-up wording found");
    enquiryType ||= "FOLLOW_UP";
  }

  if (hasAny(text, questionSignals)) {
    score += 100;
    reasons.push("Question or confirmation wording found");
    enquiryType ||= "GENERAL";
  }

  const strongOrderSignals = [
    /\bpurchase order\b/i,
    /\bpo\s*(?:number|no|#)\b/i,
    /\bunit price\b/i,
    /\btotal amount\b/i,
    /\bquantity\b/i,
  ];

  const orderSignalCount = strongOrderSignals.filter((pattern) =>
    pattern.test(text)
  ).length;

  if (orderSignalCount >= 3 && !hasAny(text, questionSignals)) {
    score -= 250;
    reasons.push("Strong purchase-order wording without enquiry wording found");
  }

  return {
    isEnquiry: score >= 100,
    score,
    reasons,
    enquiryType,
  };
}