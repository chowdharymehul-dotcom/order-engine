export type EmailRelevanceResult = {
  isRelevant: boolean;
  score: number;
  reasons: string[];
};

function clean(value: string | null | undefined) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function validateEmailRelevance(params: {
  subject?: string | null;
  text?: string | null;
  fromEmail?: string | null;
}): EmailRelevanceResult {
  const subject = clean(params.subject);
  const body = clean(params.text);
  const sender = clean(params.fromEmail);
  const combined = `${subject} ${body} ${sender}`;

  const reasons: string[] = [];
  let score = 0;

  const strongCommercialSignals = [
    /\bpurchase order\b/i,
    /\bpo\s*(?:number|no|#|reference)\b/i,
    /\border\s*(?:number|no|#)\b/i,
    /\bsku\s*[:#-]?\s*[a-z0-9/_-]+\b/i,
    /\bstyle\s*[:#-]?\s*[a-z0-9/_-]+\b/i,
    /\barticle\s*[:#-]?\s*[a-z0-9/_-]+\b/i,
    /\bitem\s*(?:code|number|no)\b/i,
    /\bunit price\b/i,
    /\border quantity\b/i,
    /\bcancel (?:the |this )?(?:order|po|item|sku|style)\b/i,
    /\bplease cancel\b/i,
  ];

  const enquiryCommercialSignals = [
    /\bprice\b/i,
    /\bpricing\b/i,
    /\bquotation\b/i,
    /\bquote\b/i,
    /\bmoq\b/i,
    /\bminimum order\b/i,
    /\blead time\b/i,
    /\bavailability\b/i,
    /\bavailable\b/i,
    /\bsample\b/i,
    /\bswatch\b/i,
    /\blab dip\b/i,
    /\bstrike[- ]?off\b/i,
    /\bcolour\b/i,
    /\bcolor\b/i,
    /\bshade\b/i,
    /\bcomposition\b/i,
    /\bfabric\b/i,
    /\bembroidery\b/i,
    /\btrim\b/i,
    /\blace\b/i,
    /\bdevelopment\b/i,
    /\bbulk production\b/i,
  ];

  const directRequestSignals = [
    /\bplease advise\b/i,
    /\bplease confirm\b/i,
    /\bplease quote\b/i,
    /\bcan you (?:confirm|provide|quote|supply|make|send)\b/i,
    /\bcould you (?:confirm|provide|quote|supply|make|send)\b/i,
    /\bkindly (?:advise|confirm|quote|check)\b/i,
    /\bwhat is the (?:price|lead time|moq|availability)\b/i,
  ];

  if (matchesAny(combined, strongCommercialSignals)) {
    score += 500;
    reasons.push("Strong order, PO, SKU or cancellation signal found");
  }

  if (matchesAny(combined, enquiryCommercialSignals)) {
    score += 220;
    reasons.push("Commercial product or enquiry signal found");
  }

  if (matchesAny(combined, directRequestSignals)) {
    score += 180;
    reasons.push("Direct commercial request wording found");
  }

  const autoReplySignals = [
    /\bautomatic reply\b/i,
    /\bauto[- ]?reply\b/i,
    /\bout of office\b/i,
    /\bi am currently on leave\b/i,
    /\blimited access to (?:calls|mails|email)\b/i,
    /\bplease expect delay in response\b/i,
    /\bdo not reply\b/i,
    /\bthis is an automated message\b/i,
    /\bautomatically generated\b/i,
    /\bmailer[- ]daemon\b/i,
    /\bdelivery status notification\b/i,
  ];

  if (matchesAny(combined, autoReplySignals)) {
    score -= 700;
    reasons.push("Automatic reply or system-generated message found");
  }

  const promotionalSignals = [
    /\bunsubscribe\b/i,
    /\bmailing list\b/i,
    /\bregister (?:now|here|today)\b/i,
    /\bvisitor registration\b/i,
    /\bseminar programme\b/i,
    /\bconference\b/i,
    /\bwebinar\b/i,
    /\btrade show\b/i,
    /\bevent invitation\b/i,
    /\bbook your (?:seat|ticket)\b/i,
    /\bnewsletter\b/i,
    /\bmarketing communication\b/i,
    /\bpromotional offer\b/i,
    /\bclick here\b/i,
    /\bview in browser\b/i,
    /\bcopyright .{0,80} all rights reserved\b/i,
  ];

  if (matchesAny(combined, promotionalSignals)) {
    score -= 600;
    reasons.push("Newsletter, event or promotional content found");
  }

  const logisticsOperationalSignals = [
    /\bfreight forwarder\b/i,
    /\bfreight forwarding\b/i,
    /\bcustoms clearance\b/i,
    /\bclearance query\b/i,
    /\bbill of entry\b/i,
    /\bshipping bill\b/i,
    /\bawb\b/i,
    /\bair waybill\b/i,
    /\bshipment tracking\b/i,
    /\btracking update\b/i,
    /\bcargo readiness\b/i,
    /\bbooking with the airline\b/i,
    /\bnomination shipment\b/i,
    /\bpacking list\b/i,
    /\bcoo\b/i,
    /\bcertificate of origin\b/i,
    /\bcustoms duty\b/i,
    /\boperations department\b/i,
  ];

  if (matchesAny(combined, logisticsOperationalSignals)) {
    score -= 350;
    reasons.push("Freight, customs or logistics-operation content found");
  }

  const unrelatedSignals = [
    /\bexamination paper\b/i,
    /\bmultiple choice questions\b/i,
    /\bfill in the blanks\b/i,
    /\bclass \d+\b/i,
    /\bhomework\b/i,
    /\bschool assignment\b/i,
    /\bjob alert\b/i,
    /\bcandidate matches\b/i,
    /\baccount statement\b/i,
    /\bsecurities balance\b/i,
    /\bcredit card statement\b/i,
    /\breward points\b/i,
    /\breward night\b/i,
  ];

  if (matchesAny(combined, unrelatedSignals)) {
    score -= 700;
    reasons.push(
      "Unrelated educational, financial, job or personal content found"
    );
  }

  const acknowledgementOnlySignals = [
    /\bbelow mail (?:is )?well noted\b/i,
    /\bwe shall check and get back\b/i,
    /\bthank you for your email\b/i,
    /\bnoted with thanks\b/i,
    /\bwell received\b/i,
  ];

  if (
    matchesAny(combined, acknowledgementOnlySignals) &&
    !matchesAny(combined, strongCommercialSignals) &&
    !matchesAny(combined, enquiryCommercialSignals)
  ) {
    score -= 250;
    reasons.push(
      "Acknowledgement-only message without commercial request found"
    );
  }

  return {
    isRelevant: score >= 100,
    score,
    reasons,
  };
}