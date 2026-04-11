export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("order_items")
      .select("id, sku, action, status, email_subject, created_at")
      .order("created_at", { ascending: false })
      .limit(6);

    const { data: ocrEmails, error: ocrError } = await supabaseAdmin
      .from("emails")
      .select("id, subject, from_email, processing_status, received_at")
      .eq("processing_status", "needs_ocr")
      .order("received_at", { ascending: false })
      .limit(6);

    if (ordersError || ocrError) {
      throw new Error(ordersError?.message || ocrError?.message);
    }

    const orderActivity = (orders || []).map((item: any) => ({
      id: `order-${item.id}`,
      type: "order",
      title: item.action || "Order Activity",
      subtitle: item.sku || "",
      meta: item.email_subject || "",
      href: "/orders",
      time: item.created_at || null,
    }));

    const ocrActivity = (ocrEmails || []).map((item: any) => ({
      id: `ocr-${item.id}`,
      type: "ocr",
      title: "Needs OCR",
      subtitle: item.subject || "(No subject)",
      meta: item.from_email || "",
      href: `/needs-ocr/${item.id}`,
      time: item.received_at || null,
    }));

    const activity = [...orderActivity, ...ocrActivity]
      .sort((a, b) => {
        const aTime = a.time ? new Date(a.time).getTime() : 0;
        const bTime = b.time ? new Date(b.time).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 8);

    return NextResponse.json({ activity });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, activity: [] },
      { status: 500 }
    );
  }
}