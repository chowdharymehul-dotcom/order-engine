import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COUNTRY_MAP: Record<string, string> = {
  USA: "USA",
  "UNITED STATES": "USA",
  "UNITED STATES OF AMERICA": "USA",

  CANADA: "CANADA",

  BRAZIL: "BRAZIL",

  COLOMBIA: "COLOMBIA",

  INDIA: "INDIA",

  CHINA: "CHINA",

  HONGKONG: "HONG KONG",
  "HONG KONG": "HONG KONG",

  TAIWAN: "TAIWAN",

  JAPAN: "JAPAN",

  KOREA: "KOREA",

  FRANCE: "FRANCE",

  ITALY: "ITALY",

  SPAIN: "SPAIN",

  GERMANY: "GERMANY",

  PORTUGAL: "PORTUGAL",

  AUSTRALIA: "AUSTRALIA",

  "NEW ZEALAND": "NEW ZEALAND",

  UAE: "UAE",
  "UNITED ARAB EMIRATES": "UAE",

  UK: "UK",
  "UNITED KINGDOM": "UK",

  "PUERTO RICO": "PUERTO RICO",
};

function clean(value: any) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim();
}

function normalizeCountry(value: string) {
  const text = clean(value).toUpperCase();

  if (!text) return "";

  for (const [source, target] of Object.entries(COUNTRY_MAP)) {
    if (text.includes(source)) {
      return target;
    }
  }

  return clean(value);
}

function looksLikeAddress(value: string) {
  const text = value.toUpperCase();

  return (
    /\d/.test(text) ||
    /\b(ST|STREET|AVE|AVENUE|ROAD|RD|DRIVE|DR|BLVD|BOULEVARD|SUITE|STE|FLOOR|FL|UNIT|APT|#)\b/.test(
      text
    )
  );
}

function normalizeCity(value: string) {
  const text = clean(value);

  if (!text) return "";

  if (looksLikeAddress(text)) {
    return "";
  }

  const city = text
    .replace(/,?\s*USA$/i, "")
    .replace(/,?\s*CANADA$/i, "")
    .replace(/,?\s*BRAZIL$/i, "")
    .replace(/,?\s*COLOMBIA$/i, "")
    .trim();

  if (city.length < 2) return "";
  if (city.length > 40) return "";

  return city;
}

function normalizePhone(value: string) {
  const original = clean(value);

  if (!original) return "";

  const parts = original
    .split(/[\/,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized = parts.flatMap((phone) => {
    const hasLeadingPlus = phone.startsWith("+");
    const digits = phone.replace(/\D/g, "");

    if (!digits) {
      return [];
    }

    // Handle obvious merged numbers:
    // Example:
    // 64635017922014016427
    // -> 6463501792, 2014016427
    if (
      !hasLeadingPlus &&
      digits.length === 20
    ) {
      return [
        digits.slice(0, 10),
        digits.slice(10, 20),
      ];
    }

    // Handle 22 digits (2 x 11 digit numbers)
    if (
      !hasLeadingPlus &&
      digits.length === 22
    ) {
      return [
        digits.slice(0, 11),
        digits.slice(11, 22),
      ];
    }

    return [hasLeadingPlus ? `+${digits}` : digits];
  });

  return Array.from(new Set(normalized)).join(", ");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("company_profiles")
      .select("id, city, country, phone");

    if (error) {
      throw error;
    }

    let updated = 0;

    for (const customer of data || []) {
      const newCountry = normalizeCountry(customer.country || "");
      const newCity = normalizeCity(customer.city || "");
      const newPhone = normalizePhone(customer.phone || "");

      const cityChanged = newCity !== (customer.city || "");
      const countryChanged = newCountry !== (customer.country || "");
      const phoneChanged = newPhone !== (customer.phone || "");

      if (!cityChanged && !countryChanged && !phoneChanged) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("company_profiles")
        .update({
          city: newCity,
          country: newCountry,
          phone: newPhone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customer.id);

      if (!updateError) {
        updated += 1;
      }
    }

    return NextResponse.redirect(
      new URL(`/customers?normalized=${updated}`, req.url),
      {
        status: 303,
      }
    );
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(
        `/customers?error=${encodeURIComponent(
          error?.message || "Normalization failed"
        )}`,
        req.url
      ),
      {
        status: 303,
      }
    );
  }
}