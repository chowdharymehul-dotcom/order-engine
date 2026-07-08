type SupabaseClientLike = any;

type EmailInput = {
  id: string;
  subject?: string | null;
  from_email?: string | null;
  received_at?: string | null;
  external_thread_id?: string | null;
  external_message_id?: string | null;
  gmail_message_id?: string | null;
};

type ResolveOrderGroupParams = {
  supabase: SupabaseClientLike;
  email: EmailInput;
  customerId?: string | null;
  customerName?: string | null;
  poNumber?: string | null;
  orderReference?: string | null;
  source?: string | null;
};

const INVALID_REFERENCES = new Set([
  "re",
  "fw",
  "fwd",
  "rts",
  "possible",
  "ssible",
  "yes",
  "no",
  "ok",
  "order",
  "new",
  "urgent",
  "important",
]);

function clean(value: any) {
  return String(value || "").trim();
}

function normalise(value: any) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function normaliseIdentifier(value: any) {
  return clean(value)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\-\/. ]/g, "")
    .trim();
}

function isValidBusinessIdentifier(value: any) {
  const text = normaliseIdentifier(value);
  const lower = text.toLowerCase();

  if (!text) return false;
  if (INVALID_REFERENCES.has(lower)) return false;
  if (text.length < 3) return false;

  const hasNumber = /\d/.test(text);
  const hasLetter = /[A-Z]/.test(text);

  if (!hasNumber && text.length < 6) return false;
  if (!hasNumber && !hasLetter) return false;

  return true;
}

function validPo(value: any) {
  const text = normaliseIdentifier(value);
  return isValidBusinessIdentifier(text) ? text : "";
}

function validReference(value: any) {
  const text = normaliseIdentifier(value);
  return isValidBusinessIdentifier(text) ? text : "";
}

function normaliseSubject(value: any) {
  return normalise(value)
    .replace(/^(re|fw|fwd|res)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getActivityAt(email: EmailInput) {
  const receivedAt = clean(email.received_at);
  const date = receivedAt ? new Date(receivedAt) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function makeGroupKey(params: {
  customerId?: string | null;
  customerName?: string | null;
  poNumber?: string | null;
  orderReference?: string | null;
  parentEmailId?: string | null;
  externalThreadId?: string | null;
}) {
  const customer =
    clean(params.customerId) || normalise(params.customerName) || "unknown_customer";

  const poNumber = validPo(params.poNumber);
  const orderReference = validReference(params.orderReference);
  const externalThreadId = clean(params.externalThreadId);
  const parentEmailId = clean(params.parentEmailId);

  if (externalThreadId) return `order::thread:${externalThreadId}`;
  if (poNumber) return `order::customer:${customer}::po:${poNumber}`;
  if (orderReference) return `order::customer:${customer}::ref:${orderReference}`;
  if (parentEmailId) return `order::email:${parentEmailId}`;

  return `order::created:${Date.now()}`;
}

function subjectSimilarity(a: string | null | undefined, b: string | null | undefined) {
  const aTokens = new Set(
    normaliseSubject(a)
      .split(" ")
      .filter((token) => token.length >= 4)
  );

  const bTokens = new Set(
    normaliseSubject(b)
      .split(" ")
      .filter((token) => token.length >= 4)
  );

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let overlap = 0;

  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(aTokens.size, bTokens.size);
}

function scoreCandidate(params: {
  candidate: any;
  email: EmailInput;
  customerId: string | null;
  customerName: string | null;
  poNumber: string;
  orderReference: string;
}) {
  const { candidate, email, customerId, customerName, poNumber, orderReference } =
    params;

  let score = 0;

  const candidatePo = validPo(candidate.po_number);
  const candidateCustomerId = clean(candidate.customer_id);
  const candidateCustomerName = normalise(candidate.customer_name);
  const inputCustomerName = normalise(customerName);

  if (clean(email.external_thread_id) && candidate.external_thread_id === email.external_thread_id) {
    score += 1000;
  }

  if (clean(email.id) && candidate.parent_email_id === email.id) {
    score += 900;
  }

  if (poNumber && candidatePo && poNumber !== candidatePo) {
    score -= 1000;
  }

  if (poNumber && candidatePo && poNumber === candidatePo) {
    score += 700;
  }

  if (customerId && candidateCustomerId && customerId === candidateCustomerId) {
    score += 400;
  }

  if (
    inputCustomerName &&
    candidateCustomerName &&
    (inputCustomerName.includes(candidateCustomerName) ||
      candidateCustomerName.includes(inputCustomerName))
  ) {
    score += 150;
  }

  if (
    orderReference &&
    candidate.group_key &&
    String(candidate.group_key).toUpperCase().includes(orderReference)
  ) {
    score += 250;
  }

  const similarity = subjectSimilarity(email.subject, candidate.subject);

  if (similarity >= 0.6) score += 120;
  else if (similarity >= 0.35) score += 60;

  return score;
}

async function updateGroupActivity(params: {
  supabase: SupabaseClientLike;
  group: any;
  email: EmailInput;
  customerId: string | null;
  customerName: string | null;
  poNumber: string;
}) {
  const { supabase, group, email, customerId, customerName, poNumber } = params;
  const activityAt = getActivityAt(email);

  const { data, error } = await supabase
    .from("order_groups")
    .update({
      latest_email_id: email.id || group.latest_email_id || null,
      last_activity_email_id: email.id || group.last_activity_email_id || null,
      last_activity_at: activityAt,
      has_new_activity: true,
      new_activity_count: Number(group.new_activity_count || 0) + 1,
      external_thread_id: clean(email.external_thread_id) || group.external_thread_id || null,
      customer_id: customerId || group.customer_id || null,
      customer_name: clean(customerName) || group.customer_name || null,
      po_number: poNumber || group.po_number || null,
      subject: clean(email.subject) || group.subject || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", group.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update order group: ${error.message}`);
  }

  return data;
}

export async function resolveOrderGroup(params: ResolveOrderGroupParams) {
  const {
    supabase,
    email,
    customerId = null,
    customerName = null,
    poNumber = null,
    orderReference = null,
    source = "email",
  } = params;

  const parentEmailId = clean(email.id);
  const externalThreadId = clean(email.external_thread_id);
  const safePoNumber = validPo(poNumber);
  const safeOrderReference = validReference(orderReference);
  const activityAt = getActivityAt(email);

  const groupKey = makeGroupKey({
    customerId,
    customerName,
    poNumber: safePoNumber,
    orderReference: safeOrderReference,
    parentEmailId,
    externalThreadId,
  });

  if (externalThreadId) {
    const { data } = await supabase
      .from("order_groups")
      .select("*")
      .eq("external_thread_id", externalThreadId)
      .maybeSingle();

    if (data) {
      return updateGroupActivity({
        supabase,
        group: data,
        email,
        customerId,
        customerName,
        poNumber: safePoNumber,
      });
    }
  }

  if (safePoNumber && customerId) {
    const { data } = await supabase
      .from("order_groups")
      .select("*")
      .eq("po_number", safePoNumber)
      .eq("customer_id", customerId)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return updateGroupActivity({
        supabase,
        group: data,
        email,
        customerId,
        customerName,
        poNumber: safePoNumber,
      });
    }
  }

  if (safePoNumber && !customerId && customerName) {
    const { data } = await supabase
      .from("order_groups")
      .select("*")
      .eq("po_number", safePoNumber)
      .ilike("customer_name", `%${clean(customerName)}%`)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return updateGroupActivity({
        supabase,
        group: data,
        email,
        customerId,
        customerName,
        poNumber: safePoNumber,
      });
    }
  }

  const { data: exactGroup } = await supabase
    .from("order_groups")
    .select("*")
    .eq("group_key", groupKey)
    .maybeSingle();

  if (exactGroup) {
    return updateGroupActivity({
      supabase,
      group: exactGroup,
      email,
      customerId,
      customerName,
      poNumber: safePoNumber,
    });
  }

  const { data: candidates } = await supabase
    .from("order_groups")
    .select("*")
    .order("last_activity_at", { ascending: false })
    .limit(250);

  let bestCandidate: any = null;
  let bestScore = 0;

  for (const candidate of candidates || []) {
    const score = scoreCandidate({
      candidate,
      email,
      customerId,
      customerName,
      poNumber: safePoNumber,
      orderReference: safeOrderReference,
    });

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate && bestScore >= 650) {
    return updateGroupActivity({
      supabase,
      group: bestCandidate,
      email,
      customerId,
      customerName,
      poNumber: safePoNumber,
    });
  }

  const { data: created, error } = await supabase
    .from("order_groups")
    .insert({
      parent_email_id: parentEmailId || null,
      latest_email_id: parentEmailId || null,
      last_activity_email_id: parentEmailId || null,
      external_thread_id: externalThreadId || null,
      customer_id: customerId || null,
      customer_name: clean(customerName) || null,
      po_number: safePoNumber || null,
      group_key: groupKey,
      subject: clean(email.subject) || null,
      status: "New",
      oc_status: "Not Generated",
      source: source || "email",
      last_activity_at: activityAt,
      has_new_activity: true,
      new_activity_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create order group: ${error.message}`);
  }

  return created;
}