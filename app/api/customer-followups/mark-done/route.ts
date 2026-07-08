import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function clean(value: any) {
  return String(value || "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const id = clean(formData.get("id"));

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing follow-up id" },
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
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/sales-followups", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to mark follow-up done",
      },
      { status: 500 }
    );
  }
}