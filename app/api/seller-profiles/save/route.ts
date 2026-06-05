import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function POST(req: Request) {
  const formData = await req.formData();

  const id = value(formData, "id");
  const isDefault = formData.get("is_default") === "true";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (isDefault) {
    await supabase
      .from("seller_profiles")
      .update({ is_default: false })
      .eq("is_default", true);
  }

  const payload = {
    profile_name: value(formData, "profile_name"),
    company_name: value(formData, "company_name"),
    address_line_1: value(formData, "address_line_1"),
    address_line_2: value(formData, "address_line_2"),
    city: value(formData, "city"),
    state: value(formData, "state"),
    country: value(formData, "country"),
    postal_code: value(formData, "postal_code"),
    gst_number: value(formData, "gst_number"),
    pan_number: value(formData, "pan_number"),
    iec_number: value(formData, "iec_number"),
    bank_name: value(formData, "bank_name"),
    account_name: value(formData, "account_name"),
    account_number: value(formData, "account_number"),
    swift_code: value(formData, "swift_code"),
    ifsc_code: value(formData, "ifsc_code"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    website: value(formData, "website"),
    logo_url: value(formData, "logo_url"),
    signature_url: value(formData, "signature_url"),
    stamp_url: value(formData, "stamp_url"),
    notes: value(formData, "notes"),
    is_default: isDefault,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase
      .from("seller_profiles")
      .update(payload)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("seller_profiles").insert(payload);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.redirect(new URL("/seller-profiles", req.url));
}