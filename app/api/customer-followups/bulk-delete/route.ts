import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function clean(value: any) {
  return String(value || "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const ids = formData
      .getAll("followup_ids")
      .map((id) => clean(id))
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No follow-ups selected" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("customer_followups")
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL(`/sales-followups?deleted=${ids.length}`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete follow-ups" },
      { status: 500 }
    );
  }
}