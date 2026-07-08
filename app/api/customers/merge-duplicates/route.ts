import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Customer = {
  id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;
  notes: string | null;
  updated_at: string | null;
};

function clean(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeCompanyName(value: string | null) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(inc|inc\.|llc|ltd|ltd\.|limited|corp|corp\.|corporation|co|co\.|company)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function choosePrimary(items: Customer[]) {
  return [...items].sort((a, b) => {
    const aScore =
      (clean(a.email) ? 5 : 0) +
      (clean(a.phone) ? 4 : 0) +
      (clean(a.contact_person) ? 3 : 0) +
      (clean(a.address_line_1) ? 2 : 0) +
      (clean(a.city) ? 1 : 0);

    const bScore =
      (clean(b.email) ? 5 : 0) +
      (clean(b.phone) ? 4 : 0) +
      (clean(b.contact_person) ? 3 : 0) +
      (clean(b.address_line_1) ? 2 : 0) +
      (clean(b.city) ? 1 : 0);

    if (bScore !== aScore) return bScore - aScore;

    return (
      new Date(b.updated_at || 0).getTime() -
      new Date(a.updated_at || 0).getTime()
    );
  })[0];
}

function mergeField(primaryValue: any, duplicateValue: any) {
  return clean(primaryValue) || clean(duplicateValue);
}

function mergeCustomers(primary: Customer, duplicates: Customer[]) {
  const all = [primary, ...duplicates];

  const notes = all
    .map((item) => clean(item.notes))
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .join(" | ");

  const merged = { ...primary };

  for (const item of duplicates) {
    merged.company_name = mergeField(merged.company_name, item.company_name);
    merged.contact_person = mergeField(
      merged.contact_person,
      item.contact_person
    );
    merged.email = mergeField(merged.email, item.email).toLowerCase();
    merged.phone = mergeField(merged.phone, item.phone);
    merged.website = mergeField(merged.website, item.website);
    merged.address_line_1 = mergeField(
      merged.address_line_1,
      item.address_line_1
    );
    merged.address_line_2 = mergeField(
      merged.address_line_2,
      item.address_line_2
    );
    merged.city = mergeField(merged.city, item.city);
    merged.state = mergeField(merged.state, item.state);
    merged.country = mergeField(merged.country, item.country);
    merged.postal_code = mergeField(merged.postal_code, item.postal_code);
    merged.gst_number = mergeField(merged.gst_number, item.gst_number);
    merged.pan_number = mergeField(merged.pan_number, item.pan_number);
    merged.iec_number = mergeField(merged.iec_number, item.iec_number);
  }

  merged.notes = notes;
  merged.updated_at = new Date().toISOString();

  return merged;
}

function groupCustomers(customers: Customer[]) {
  const groups = new Map<string, Customer[]>();

  for (const customer of customers) {
    const email = clean(customer.email).toLowerCase();
    const companyKey = normalizeCompanyName(customer.company_name);
    const countryKey = clean(customer.country).toLowerCase();

    const key = email
      ? `email:${email}`
      : `company:${companyKey}|country:${countryKey}`;

    if (!companyKey && !email) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(customer);
  }

  return Array.from(groups.values()).filter((group) => group.length > 1);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("company_profiles")
      .select(
        "id, company_name, contact_person, email, phone, website, address_line_1, address_line_2, city, state, country, postal_code, gst_number, pan_number, iec_number, notes, updated_at"
      )
      .eq("is_active", true);

    if (error) {
      return NextResponse.redirect(
        new URL(`/customers?error=${encodeURIComponent(error.message)}`, req.url),
        { status: 303 }
      );
    }

    const customers = (data || []) as Customer[];
    const groups = groupCustomers(customers);

    let mergedGroups = 0;
    let deletedDuplicates = 0;

    for (const group of groups) {
      const primary = choosePrimary(group);
      const duplicates = group.filter((customer) => customer.id !== primary.id);

      if (duplicates.length === 0) continue;

      const merged = mergeCustomers(primary, duplicates);

      const { error: updateError } = await supabase
        .from("company_profiles")
        .update({
          company_name: merged.company_name,
          contact_person: merged.contact_person,
          email: merged.email,
          phone: merged.phone,
          website: merged.website,
          address_line_1: merged.address_line_1,
          address_line_2: merged.address_line_2,
          city: merged.city,
          state: merged.state,
          country: merged.country,
          postal_code: merged.postal_code,
          gst_number: merged.gst_number,
          pan_number: merged.pan_number,
          iec_number: merged.iec_number,
          notes: merged.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", primary.id);

      if (updateError) continue;

      const duplicateIds = duplicates.map((customer) => customer.id);

      const { error: deleteError } = await supabase
        .from("company_profiles")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in("id", duplicateIds);

      if (deleteError) continue;

      mergedGroups += 1;
      deletedDuplicates += duplicateIds.length;
    }

    return NextResponse.redirect(
      new URL(
        `/customers?merged=${mergedGroups}&duplicates=${deletedDuplicates}`,
        req.url
      ),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(
        `/customers?error=${encodeURIComponent(
          error?.message || "Failed to merge duplicate customers"
        )}`,
        req.url
      ),
      { status: 303 }
    );
  }
}