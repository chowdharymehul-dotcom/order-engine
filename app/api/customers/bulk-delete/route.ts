import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const ids = formData
      .getAll("customer_ids")
      .map((id) => String(id || "").trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.redirect(
        new URL("/customers?error=No customers selected", req.url),
        { status: 303 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("company_profiles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) {
      return NextResponse.redirect(
        new URL(`/customers?error=${encodeURIComponent(error.message)}`, req.url),
        { status: 303 }
      );
    }

    return NextResponse.redirect(
      new URL(`/customers?deleted=${ids.length}`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(
        `/customers?error=${encodeURIComponent(
          error?.message || "Failed to delete selected customers"
        )}`,
        req.url
      ),
      { status: 303 }
    );
  }
}