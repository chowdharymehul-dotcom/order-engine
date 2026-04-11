export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { count: emailCount } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true });

    const { count: totalOrders } = await supabaseAdmin
      .from("order_items")
      .select("*", { count: "exact", head: true });

    const { count: newOrders } = await supabaseAdmin
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "New");

    const { count: approvedOrders } = await supabaseAdmin
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "Approved");

    const { count: doneOrders } = await supabaseAdmin
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "Done");

    const { count: needsOcr } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "needs_ocr");

    return NextResponse.json({
      emailCount: emailCount || 0,
      totalOrders: totalOrders || 0,
      newOrders: newOrders || 0,
      approvedOrders: approvedOrders || 0,
      doneOrders: doneOrders || 0,
      needsOcr: needsOcr || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}