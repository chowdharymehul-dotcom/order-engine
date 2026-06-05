import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const id = text(formData, "id");

    const payload = {
      company_name: text(formData, "company_name"),
      address_line_1: text(formData, "address_line_1"),
      address_line_2: text(formData, "address_line_2"),
      city: text(formData, "city"),
      state: text(formData, "state"),
      country: text(formData, "country"),
      postal_code: text(formData, "postal_code"),

      contact_person: text(formData, "contact_person"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      website: text(formData, "website"),

      gst_number: text(formData, "gst_number"),
      pan_number: text(formData, "pan_number"),
      iec_number: text(formData, "iec_number"),

      bank_name: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_swift_code: "",
      bank_ifsc_code: "",
      bank_branch: "",
      bank_address: "",

      notes: text(formData, "notes"),

      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (!payload.company_name) {
      return NextResponse.json(
        { ok: false, error: "Customer company name is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (id) {
      const { error } = await supabase
        .from("company_profiles")
        .update(payload)
        .eq("id", id);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase.from("company_profiles").insert(payload);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.redirect(new URL("/customers", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save customer",
      },
      { status: 500 }
    );
  }
}