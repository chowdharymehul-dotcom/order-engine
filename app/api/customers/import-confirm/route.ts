import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ImportedCustomer = {
  company_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  gst_number?: string;
  pan_number?: string;
  iec_number?: string;
  notes?: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function clean(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u0000/g, "").trim();
}

function normalizeCustomer(row: ImportedCustomer) {
  return {
    company_name: clean(row.company_name),
    address_line_1: clean(row.address_line_1),
    address_line_2: clean(row.address_line_2),
    city: clean(row.city),
    state: clean(row.state),
    country: clean(row.country),
    postal_code: clean(row.postal_code),

    contact_person: clean(row.contact_person),
    email: clean(row.email).toLowerCase(),
    phone: clean(row.phone),
    website: clean(row.website),

    gst_number: clean(row.gst_number),
    pan_number: clean(row.pan_number),
    iec_number: clean(row.iec_number),

    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_swift_code: "",
    bank_ifsc_code: "",
    bank_branch: "",
    bank_address: "",

    notes: clean(row.notes),

    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

async function findExistingCustomer(params: {
  supabase: any;
  companyName: string;
  email: string;
}) {
  const { supabase, companyName, email } = params;

  if (email) {
    const { data } = await supabase
      .from("company_profiles")
      .select("id")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (data?.id) return data;
  }

  if (companyName) {
    const { data } = await supabase
      .from("company_profiles")
      .select("id")
      .ilike("company_name", companyName)
      .eq("is_active", true)
      .maybeSingle();

    if (data?.id) return data;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const draftId = text(formData, "draft_id");

    if (!draftId) {
      return NextResponse.redirect(
        new URL("/customers?error=Missing import draft ID", req.url),
        { status: 303 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: draft, error: draftError } = await supabase
      .from("customer_import_drafts")
      .select(
        "id, file_name, storage_path, file_type, detected_count, customers, status"
      )
      .eq("id", draftId)
      .maybeSingle();

    if (draftError || !draft) {
      return NextResponse.redirect(
        new URL(
          `/customers?error=${encodeURIComponent(
            draftError?.message || "Import draft not found"
          )}`,
          req.url
        ),
        { status: 303 }
      );
    }

    const customers = Array.isArray(draft.customers) ? draft.customers : [];

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of customers) {
      const payload = normalizeCustomer(row);

      if (!payload.company_name) {
        skipped += 1;
        continue;
      }

      const existing = await findExistingCustomer({
        supabase,
        companyName: payload.company_name,
        email: payload.email,
      });

      if (existing?.id) {
        const { error } = await supabase
          .from("company_profiles")
          .update(payload)
          .eq("id", existing.id);

        if (error) {
          skipped += 1;
        } else {
          updated += 1;
        }
      } else {
        const { error } = await supabase
          .from("company_profiles")
          .insert(payload);

        if (error) {
          skipped += 1;
        } else {
          imported += 1;
        }
      }
    }

    await supabase.from("customer_imports").insert({
      file_name: draft.file_name,
      storage_path: draft.storage_path,
      file_type: draft.file_type,
      imported_count: imported,
      updated_count: updated,
      skipped_count: skipped,
      created_at: new Date().toISOString(),
    });

    await supabase
      .from("customer_import_drafts")
      .update({
        status: "imported",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    return NextResponse.redirect(
      new URL(
        `/customers?imported=${imported}&updated=${updated}&skipped=${skipped}`,
        req.url
      ),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(
        `/customers?error=${encodeURIComponent(
          error?.message || "Failed to confirm customer import"
        )}`,
        req.url
      ),
      { status: 303 }
    );
  }
}