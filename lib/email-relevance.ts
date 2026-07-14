export type RelevanceResult = {
  relevant: boolean;
  reason: string;
  confidence: "high" | "medium" | "low";
  score: number;
  positiveSignals: string[];
  negativeSignals: string[];
};

function clean(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\u0000/g, "")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function matchingLabels(
  text: string,
  rules: Array<{ label: string; pattern: RegExp }>
) {
  return rules
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.label);
}

function hasInlineOrderPattern(text: string) {
  return (
    /\bpo\s*(?:#|no|number|ref|reference)?\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}/i.test(
      text
    ) ||
    /\bp\.?o\.?\s*(?:#|no|number)?\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}/i.test(
      text
    ) ||
    /\bsku\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}/i.test(text) ||
    /\bstyle\s*(?:no|number|#)?\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}/i.test(
      text
    ) ||
    /\barticle\s*(?:no|number|#)?\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}/i.test(
      text
    ) ||
    /\b[a-z]{1,5}\d{3,}[a-z0-9\-/.]*\s*[-–—:]\s*\d+(?:[.,]\d+)?\s*(?:pc|pcs|piece|pieces|qty|yards|yds|metres|meters|mtrs|units)?/i.test(
      text
    ) ||
    /\b[a-z0-9\-/.]{3,}\s*[-–—:]\s*\d+(?:[.,]\d+)?\s*(?:pc|pcs|piece|pieces|qty|yards|yds|metres|meters|mtrs|units)?\s*(?:@|at)\s*(?:usd|eur|gbp|inr|\$|€|£|₹)?\s*\d+(?:[.,]\d+)?/i.test(
      text
    )
  );
}

function looksLikeOwnMailboxMessage(
  fromEmail: string,
  connectedMailbox?: string | null
) {
  const connected = clean(connectedMailbox);

  if (!connected) return false;

  return fromEmail.includes(connected);
}

export function isRelevantBusinessEmail(params: {
  subject?: string | null;
  fromEmail?: string | null;
  bodyText?: string | null;
  attachmentName?: string | null;
  hasAttachment?: boolean;
  connectedMailbox?: string | null;
}): RelevanceResult {
  const subject = clean(params.subject);
  const fromEmail = clean(params.fromEmail);
  const bodyText = clean(params.bodyText);
  const attachmentName = clean(params.attachmentName);

  const subjectAndSender = `${subject} ${fromEmail}`;
  const fullContent =
    `${subject} ${fromEmail} ${bodyText} ${attachmentName}`.trim();

  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];

  let score = 0;

  /*
   * Absolute exclusions.
   */
  if (looksLikeOwnMailboxMessage(fromEmail, params.connectedMailbox)) {
    return {
      relevant: false,
      reason: "Message originated from the connected mailbox",
      confidence: "high",
      score: -1000,
      positiveSignals,
      negativeSignals: ["own mailbox message"],
    };
  }

  const automaticRules = [
    { label: "automatic reply", pattern: /\bautomatic reply\b/i },
    { label: "auto reply", pattern: /\bauto[- ]?reply\b/i },
    { label: "out of office", pattern: /\bout of office\b/i },
    {
      label: "sender currently on leave",
      pattern: /\bi am currently on leave\b/i,
    },
    {
      label: "limited email access",
      pattern: /\blimited access to (?:email|emails|mail|mails|calls)\b/i,
    },
    {
      label: "delayed response notice",
      pattern: /\bplease expect (?:a )?delay in response\b/i,
    },
    { label: "do not reply", pattern: /\bdo not reply\b/i },
    { label: "no reply sender", pattern: /\bno[- ]?reply\b/i },
    { label: "automated message", pattern: /\bautomated message\b/i },
    {
      label: "system generated",
      pattern: /\bautomatically generated\b/i,
    },
    { label: "mailer daemon", pattern: /\bmailer[- ]daemon\b/i },
    {
      label: "delivery status notification",
      pattern: /\bdelivery status notification\b/i,
    },
  ];

  const automaticMatches = matchingLabels(fullContent, automaticRules);

  if (automaticMatches.length > 0) {
    score -= 1000;
    negativeSignals.push(...automaticMatches);
  }

  const promotionalRules = [
    { label: "unsubscribe", pattern: /\bunsubscribe\b/i },
    { label: "mailing list", pattern: /\bmailing list\b/i },
    { label: "newsletter", pattern: /\bnewsletter\b/i },
    { label: "webinar", pattern: /\bwebinar\b/i },
    { label: "seminar", pattern: /\bseminar\b/i },
    { label: "conference", pattern: /\bconference\b/i },
    { label: "trade show", pattern: /\btrade show\b/i },
    { label: "event invitation", pattern: /\bevent invitation\b/i },
    {
      label: "visitor registration",
      pattern: /\bvisitor registration\b/i,
    },
    {
      label: "register for event",
      pattern: /\bregister (?:now|here|today|for)\b/i,
    },
    {
      label: "book event seat",
      pattern: /\bbook your (?:seat|ticket)\b/i,
    },
    {
      label: "promotional offer",
      pattern: /\bpromotional offer\b/i,
    },
    { label: "limited time offer", pattern: /\blimited time offer\b/i },
    { label: "discount", pattern: /\bdiscount\b/i },
    { label: "coupon", pattern: /\bcoupon\b/i },
    { label: "view in browser", pattern: /\bview in browser\b/i },
    {
      label: "marketing copyright footer",
      pattern: /\bcopyright.{0,100}all rights reserved\b/i,
    },
  ];

  const promotionalMatches = matchingLabels(fullContent, promotionalRules);

  if (promotionalMatches.length > 0) {
    score -= 700;
    negativeSignals.push(...promotionalMatches);
  }

  const unrelatedRules = [
    { label: "examination paper", pattern: /\bexamination paper\b/i },
    {
      label: "multiple choice questions",
      pattern: /\bmultiple choice questions\b/i,
    },
    { label: "fill in the blanks", pattern: /\bfill in the blanks\b/i },
    { label: "school class content", pattern: /\bclass\s+\d+\b/i },
    { label: "school assignment", pattern: /\bschool assignment\b/i },
    { label: "homework", pattern: /\bhomework\b/i },
    { label: "job alert", pattern: /\bjob alert\b/i },
    { label: "candidate matches", pattern: /\bcandidate matches\b/i },
    { label: "bank statement", pattern: /\bbank statement\b/i },
    { label: "account statement", pattern: /\baccount statement\b/i },
    {
      label: "securities balance",
      pattern: /\bsecurities balance\b/i,
    },
    { label: "portfolio update", pattern: /\bportfolio update\b/i },
    { label: "mutual fund", pattern: /\bmutual fund\b/i },
    { label: "reward points", pattern: /\breward points\b/i },
    { label: "reward night", pattern: /\breward night\b/i },
    { label: "otp", pattern: /\bone time password\b|\botp\b/i },
    {
      label: "verification code",
      pattern: /\bverification code\b/i,
    },
    { label: "security alert", pattern: /\bsecurity alert\b/i },
    { label: "login alert", pattern: /\blogin alert\b/i },
  ];

  const unrelatedMatches = matchingLabels(fullContent, unrelatedRules);

  if (unrelatedMatches.length > 0) {
    score -= 800;
    negativeSignals.push(...unrelatedMatches);
  }

  /*
   * Logistics-only correspondence.
   * These messages are not part of the order-management workflow.
   */
  const logisticsRules = [
    { label: "freight forwarder", pattern: /\bfreight forwarder\b/i },
    { label: "freight forwarding", pattern: /\bfreight forwarding\b/i },
    {
      label: "operations department",
      pattern: /\boperations department\b/i,
    },
    { label: "customs clearance", pattern: /\bcustoms clearance\b/i },
    { label: "clearance query", pattern: /\bclearance query\b/i },
    { label: "bill of entry", pattern: /\bbill of entry\b/i },
    { label: "shipping bill", pattern: /\bshipping bill\b/i },
    { label: "air waybill", pattern: /\bair waybill\b/i },
    { label: "awb", pattern: /\bawb\b/i },
    { label: "shipment tracking", pattern: /\bshipment tracking\b/i },
    { label: "tracking update", pattern: /\btracking update\b/i },
    { label: "cargo readiness", pattern: /\bcargo readiness\b/i },
    {
      label: "airline booking",
      pattern: /\bbooking with the airline\b/i,
    },
    {
      label: "nomination shipment",
      pattern: /\bnomination shipment\b/i,
    },
    { label: "customs duty", pattern: /\bcustoms duty\b/i },
    { label: "certificate of origin", pattern: /\bcertificate of origin\b/i },
    {
      label: "shipment booking",
      pattern: /\bshipment booking\b/i,
    },
    {
      label: "customs documentation",
      pattern: /\b(?:iec|ad code|shipping bill|bill of entry|customs system)\b/i,
    },
  ];

  const logisticsMatches = matchingLabels(fullContent, logisticsRules);

  if (logisticsMatches.length > 0) {
    score -= 500;
    negativeSignals.push(...logisticsMatches);
  }

  /*
   * Strong commercial evidence.
   */
  if (hasInlineOrderPattern(fullContent)) {
    score += 700;
    positiveSignals.push("structured PO, SKU or item pattern");
  }

  const orderRules = [
    { label: "purchase order", pattern: /\bpurchase order\b/i },
    {
      label: "PO number",
      pattern: /\bpo\s*(?:#|no|number|reference)\s*:?\s*[a-z0-9]/i,
    },
    {
      label: "order number",
      pattern: /\border\s*(?:#|no|number)\s*:?\s*[a-z0-9]/i,
    },
    {
      label: "SKU reference",
      pattern: /\bsku\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}/i,
    },
    {
      label: "style reference",
      pattern: /\bstyle\s*(?:#|no|number)?\s*:?\s*[a-z0-9]/i,
    },
    {
      label: "article reference",
      pattern: /\barticle\s*(?:#|no|number)?\s*:?\s*[a-z0-9]/i,
    },
    { label: "unit price", pattern: /\bunit price\b/i },
    { label: "order quantity", pattern: /\border quantity\b/i },
    { label: "new order", pattern: /\bnew order\b/i },
    { label: "place order", pattern: /\bplace order\b/i },
  ];

  const orderMatches = matchingLabels(fullContent, orderRules);

  if (orderMatches.length > 0) {
    score += 450;
    positiveSignals.push(...orderMatches);
  }

  const cancellationRules = [
    {
      label: "cancel order",
      pattern: /\bcancel (?:the |this )?(?:order|po)\b/i,
    },
    {
      label: "cancel item",
      pattern: /\bcancel (?:item|sku|style|article|line)\b/i,
    },
    { label: "please cancel", pattern: /\bplease cancel\b/i },
    { label: "do not proceed", pattern: /\bdo not proceed\b/i },
    { label: "stop production", pattern: /\bstop production\b/i },
  ];

  const cancellationMatches = matchingLabels(
    fullContent,
    cancellationRules
  );

  if (cancellationMatches.length > 0) {
    score += 500;
    positiveSignals.push(...cancellationMatches);
  }

  const enquiryRules = [
    { label: "price request", pattern: /\bprice\b|\bpricing\b/i },
    { label: "quotation request", pattern: /\bquote\b|\bquotation\b/i },
    { label: "MOQ request", pattern: /\bmoq\b|\bminimum order\b/i },
    { label: "lead time request", pattern: /\blead time\b/i },
    { label: "availability request", pattern: /\bavailability\b/i },
    {
      label: "sample request",
      pattern: /\bsample\b|\bswatch\b|\blab dip\b|\bstrike[- ]?off\b/i,
    },
    {
      label: "product development",
      pattern: /\bdevelopment\b/i,
    },
    {
      label: "product material",
      pattern:
        /\bfabric\b|\btrim\b|\blace\b|\bembroidery\b|\bgarment\b/i,
    },
    {
      label: "colour or shade",
      pattern: /\bcolour\b|\bcolor\b|\bshade\b/i,
    },
    {
      label: "composition or specification",
      pattern: /\bcomposition\b|\bspecification\b|\bwidth\b/i,
    },
  ];

  const enquiryMatches = matchingLabels(fullContent, enquiryRules);

  if (enquiryMatches.length > 0) {
    score += 220;
    positiveSignals.push(...enquiryMatches);
  }

  const directRequestRules = [
    { label: "please advise", pattern: /\bplease advise\b/i },
    { label: "please quote", pattern: /\bplease quote\b/i },
    {
      label: "commercial confirmation request",
      pattern:
        /\bplease confirm (?:the |our |your )?(?:price|moq|lead time|availability|sample|order|quantity|delivery date|ship date)\b/i,
    },
    {
      label: "can you commercial request",
      pattern:
        /\bcan you (?:quote|provide|supply|make|confirm|send).{0,50}(?:price|sample|fabric|trim|lace|sku|style|quantity|lead time|availability)\b/i,
    },
    {
      label: "could you commercial request",
      pattern:
        /\bcould you (?:quote|provide|supply|make|confirm|send).{0,50}(?:price|sample|fabric|trim|lace|sku|style|quantity|lead time|availability)\b/i,
    },
    {
      label: "what is commercial request",
      pattern:
        /\bwhat is (?:the )?(?:price|moq|lead time|availability)\b/i,
    },
  ];

  const directRequestMatches = matchingLabels(
    fullContent,
    directRequestRules
  );

  if (directRequestMatches.length > 0) {
    score += 250;
    positiveSignals.push(...directRequestMatches);
  }

  /*
   * Business attachments only help when the filename itself is meaningful.
   */
  const businessAttachmentPattern =
    /\b(?:po|purchase|order|sku|style|article|sample|swatch|fabric|trim|lace|quotation|quote|proforma)\b/i;

  const readableBusinessFormat =
    /\.(?:pdf|xls|xlsx|doc|docx|txt|csv)$/i.test(attachmentName);

  if (
    params.hasAttachment &&
    readableBusinessFormat &&
    businessAttachmentPattern.test(attachmentName)
  ) {
    score += 300;
    positiveSignals.push("relevant business attachment");
  }

  /*
   * Generic acknowledgements do not qualify by themselves.
   */
  const acknowledgementOnly =
    matchesAny(fullContent, [
      /\bbelow mail (?:is )?well noted\b/i,
      /\bwe shall check and get back\b/i,
      /\bthank you for your email\b/i,
      /\bnoted with thanks\b/i,
      /\bwell received\b/i,
    ]) &&
    positiveSignals.length === 0;

  if (acknowledgementOnly) {
    score -= 300;
    negativeSignals.push("acknowledgement-only message");
  }

  /*
   * Automatic, promotional and unrelated content remain rejected
   * even when quoted threads contain isolated business keywords.
   */
  const hardNegative =
    automaticMatches.length > 0 ||
    promotionalMatches.length > 0 ||
    unrelatedMatches.length > 0;

  const hasStrongCommercialEvidence =
    hasInlineOrderPattern(fullContent) ||
    orderMatches.length > 0 ||
    cancellationMatches.length > 0 ||
    directRequestMatches.length > 0;

  const relevant =
    !hardNegative &&
    score >= 150 &&
    (hasStrongCommercialEvidence || enquiryMatches.length > 0);

  const confidence: RelevanceResult["confidence"] =
    Math.abs(score) >= 500
      ? "high"
      : Math.abs(score) >= 250
        ? "medium"
        : "low";

  return {
    relevant,
    reason: relevant
      ? `Relevant commercial communication. Score ${score}. Positive: ${
          positiveSignals.join(", ") || "none"
        }`
      : `Irrelevant or unsupported communication. Score ${score}. Negative: ${
          negativeSignals.join(", ") || "no qualifying commercial evidence"
        }`,
    confidence,
    score,
    positiveSignals,
    negativeSignals,
  };
}