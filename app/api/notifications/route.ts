export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { count: newOrders } = await supabaseAdmin
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "New");

    const { count: needsOcr } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "needs_ocr");

    return NextResponse.json({
      newOrders: newOrders || 0,
      needsOcr: needsOcr || 0,
      total: (newOrders || 0) + (needsOcr || 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}