import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("customer_followups")
      .update({
        is_active: true,
        deleted_at: null,
      })
      .eq("is_active", false);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/sales-followups?restored=1", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to undo delete" },
      { status: 500 }
    );
  }
}