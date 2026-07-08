export function validateEnquiryCandidate(params: {
  subject?: string | null;
  text?: string | null;
}) {
  const text = `${params.subject || ""} ${params.text || ""}`.toLowerCase();

  const signals = [
    "lead time",
    "sample time",
    "availability",
    "available",
    "price",
    "quote",
    "quotation",
    "can you",
    "please confirm",
    "what is",
    "inquiry",
    "enquiry",
    "follow up",
    "status",
  ];

  const matched = signals.filter((signal) => text.includes(signal));

  return {
    isEnquiry: matched.length > 0,
    score: matched.length * 100,
    reasons: matched,
  };
}