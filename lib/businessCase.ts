export type BusinessCaseType = "order" | "enquiry";

type SupabaseClient = any;

type BusinessCaseParams = {
  supabase: SupabaseClient;
  caseType: BusinessCaseType;
  customerId?: string | null;
  customerName?: string | null;
  poNumber?: string | null;
  subject?: string | null;
  provider?: string | null;
  externalThreadId?: string | null;
  latestEmailId?: string | null;
  latestReceivedAt?: string | null;
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value)
    .toLowerCase()
    .replace(/^(re|fw|fwd|res)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePoNumber(value: any) {
  const text = clean(value);

  const invalid = [
    "re",
    "fw",
    "fwd",
    "res",
    "ok",
    "yes",
    "no",
    "int",
    "rcd",
    "ssible",
    "possible",
    "thanks",
    "thank you",
  ];

  if (!text) return "";
  if (invalid.includes(text.toLowerCase())) return "";
  if (text.length < 3) return "";

  return text;
}

export function normalizeSubjectForBusinessCase(subject: string | null) {
  return normalize(subject);
}

export function normalizePoForBusinessCase(poNumber: string | null) {
  return normalizePoNumber(poNumber);
}

export async function findOrCreateBusinessCase(params: BusinessCaseParams) {
  const {
    supabase,
    caseType,
    customerId = null,
    customerName = null,
    poNumber = null,
    subject = null,
    provider = null,
    externalThreadId = null,
    latestEmailId = null,
    latestReceivedAt = null,
  } = params;

  const cleanCustomerName = clean(customerName);
  const cleanPoNumber = normalizePoNumber(poNumber);
  const cleanSubject = clean(subject);
  const normalizedSubject = normalize(cleanSubject);
  const cleanProvider = clean(provider);
  const cleanThreadId = clean(externalThreadId);

  let existing: any = null;

  if (caseType === "order" && cleanPoNumber) {
    let query = supabase
      .from("business_cases")
      .select("*")
      .eq("case_type", "order")
      .eq("po_number", cleanPoNumber)
      .limit(1);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    } else if (cleanCustomerName) {
      query = query.ilike("customer_name", cleanCustomerName);
    }

    const { data } = await query.maybeSingle();
    existing = data || null;
  }

  if (!existing && cleanThreadId) {
    const { data } = await supabase
      .from("business_cases")
      .select("*")
      .eq("case_type", caseType)
      .eq("provider", cleanProvider)
      .eq("external_thread_id", cleanThreadId)
      .limit(1)
      .maybeSingle();

    existing = data || null;
  }

  if (!existing && normalizedSubject) {
    let query = supabase
      .from("business_cases")
      .select("*")
      .eq("case_type", caseType)
      .eq("normalized_subject", normalizedSubject)
      .limit(1);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    } else if (cleanCustomerName) {
      query = query.ilike("customer_name", cleanCustomerName);
    }

    const { data } = await query.maybeSingle();
    existing = data || null;
  }

  const payload = {
    case_type: caseType,
    customer_id: customerId || null,
    customer_name: cleanCustomerName || null,
    po_number: cleanPoNumber || null,
    subject: cleanSubject || null,
    normalized_subject: normalizedSubject || null,
    provider: cleanProvider || null,
    external_thread_id: cleanThreadId || null,
    latest_email_id: latestEmailId || null,
    latest_received_at: latestReceivedAt || new Date().toISOString(),
    unread_count: 1,
    needs_attention: true,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("business_cases")
      .update({
        ...payload,
        status: existing.status || "new",
        unread_count: Number(existing.unread_count || 0) + 1,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;

    return data;
  }

  const { data, error } = await supabase
    .from("business_cases")
    .insert({
      ...payload,
      status: "new",
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}