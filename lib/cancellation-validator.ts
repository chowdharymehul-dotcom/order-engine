export function validateCancellationCandidate(params: {
  subject?: string | null;
  text?: string | null;
}) {
  const text = `${params.subject || ""} ${params.text || ""}`.toLowerCase();

  const signals = [
    "cancel order",
    "cancel po",
    "cancel this order",
    "please cancel",
    "do not proceed",
    "stop order",
    "do not ship",
    "cancel shipment",
  ];

  const matched = signals.filter((signal) => text.includes(signal));

  return {
    isCancellation: matched.length > 0,
    score: matched.length * 150,
    reasons: matched,
  };
}