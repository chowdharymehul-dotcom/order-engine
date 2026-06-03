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
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    const { count: emails } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    const { count: deletedEmails } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true })
      .not("deleted_at", "is", null);

    const { count: deletedOrderItems } = await supabaseAdmin
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .not("deleted_at", "is", null);

    const { count: needsOcr } = await supabaseAdmin
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "needs_ocr")
      .is("deleted_at", null);

    return NextResponse.json({
      orders: orders || 0,
      emails: emails || 0,
      needsOcr: needsOcr || 0,
      deletedItems:
        (deletedEmails || 0) +
        (deletedOrderItems || 0),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}