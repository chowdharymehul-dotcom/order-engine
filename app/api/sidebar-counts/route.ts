export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { count: orders } = await supabaseAdmin
      .from("order_items")
      .select("*", { count: "exact", head: true });

    const { count: emails } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true });

    const { count: needsOcr } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "needs_ocr");

    return NextResponse.json({
      orders: orders || 0,
      emails: emails || 0,
      needsOcr: needsOcr || 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}