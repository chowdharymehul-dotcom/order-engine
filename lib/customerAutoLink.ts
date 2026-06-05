import { SupabaseClient } from "@supabase/supabase-js";

export type CustomerMatchResult = {
  customer_id: string | null;
  customer_name: string;
  customer_match_method: string | null;
  customer_match_confidence: number | null;
};

type CompanyProfile = {
  id: string;
  company_name: string | null;
  email: string | null;
  website: string | null;
  contact_person: string | null;
  is_active: boolean | null;
};

function cleanText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function normalize(value: string | null | undefined) {
  return cleanText(value).toLowerCase();
}

function extractEmailAddress(value: string | null | undefined) {
  const text = normalize(value);

  const angleMatch = text.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  const emailMatch = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch?.[0]) return emailMatch[0].trim();

  return text.includes("@") ? text : "";
}

function getEmailDomain(value: string | null | undefined) {
  const email = extractEmailAddress(value);
  const parts = email.split("@");

  if (parts.length !== 2) return "";

  return parts[1].replace(/^www\./, "").trim();
}

function getWebsiteDomain(website: string | null | undefined) {
  const value = normalize(website);

  if (!value) return "";

  return value
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

function cleanCompanyName(value: string | null | undefined) {
  return normalize(value)
    .replace(
      /\b(llc|ltd|limited|inc|corp|corporation|pvt|private|co|company|llp|design|designs|new york)\b/g,
      ""
    )
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findCustomerForEmail(params: {
  supabase: SupabaseClient;
  fromEmail: string | null;
  extractedCustomerName?: string | null;
}) {
  const { supabase, fromEmail, extractedCustomerName } = params;

  const senderEmail = extractEmailAddress(fromEmail);
  const senderDomain = getEmailDomain(fromEmail);
  const extractedName = cleanCompanyName(extractedCustomerName || "");

  const fallback: CustomerMatchResult = {
    customer_id: null,
    customer_name: cleanText(extractedCustomerName || ""),
    customer_match_method: null,
    customer_match_confidence: null,
  };

  const { data, error } = await supabase
    .from("company_profiles")
    .select("id, company_name, email, website, contact_person, is_active");

  if (error || !data) {
    return fallback;
  }

  const customers = (data as CompanyProfile[]).filter(
    (customer) => customer.is_active !== false
  );

  if (senderEmail) {
    const exactEmailMatch = customers.find(
      (customer) => extractEmailAddress(customer.email) === senderEmail
    );

    if (exactEmailMatch) {
      return {
        customer_id: exactEmailMatch.id,
        customer_name: cleanText(exactEmailMatch.company_name || ""),
        customer_match_method: "exact_email",
        customer_match_confidence: 100,
      };
    }
  }

  if (senderDomain) {
    const domainMatch = customers.find((customer) => {
      const customerEmailDomain = getEmailDomain(customer.email);
      const customerWebsiteDomain = getWebsiteDomain(customer.website);

      return (
        customerEmailDomain === senderDomain ||
        customerWebsiteDomain === senderDomain
      );
    });

    if (domainMatch) {
      return {
        customer_id: domainMatch.id,
        customer_name: cleanText(domainMatch.company_name || ""),
        customer_match_method: "domain",
        customer_match_confidence: 90,
      };
    }
  }

  if (extractedName) {
    const companyNameMatch = customers.find((customer) => {
      const customerName = cleanCompanyName(customer.company_name);

      if (!customerName) return false;

      return (
        customerName.includes(extractedName) ||
        extractedName.includes(customerName)
      );
    });

    if (companyNameMatch) {
      return {
        customer_id: companyNameMatch.id,
        customer_name: cleanText(companyNameMatch.company_name || ""),
        customer_match_method: "company_name",
        customer_match_confidence: 70,
      };
    }
  }

  return fallback;
}