export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: newOrders, error: ordersError } = await supabaseAdmin
      .from("order_items")
      .select("id, sku, action, status, email_subject, created_at")
      .eq("status", "New")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: ocrEmails, error: ocrError } = await supabaseAdmin
      .from("emails")
      .select("id, subject, from_email, processing_status, received_at")
      .eq("processing_status", "needs_ocr")
      .order("received_at", { ascending: false })
      .limit(5);

    if (ordersError || ocrError) {
      throw new Error(ordersError?.message || ocrError?.message);
    }

    const orderNotifications = (newOrders || []).map((item: any) => ({
      id: `order-${item.id}`,
      type: "order",
      title: item.action || "New Order",
      subtitle: item.sku || "",
      meta: item.email_subject || "",
      href: "/orders",
      createdAt: item.created_at || null,
    }));

    const ocrNotifications = (ocrEmails || []).map((item: any) => ({
      id: `ocr-${item.id}`,
      type: "ocr",
      title: "Needs OCR",
      subtitle: item.subject || "(No subject)",
      meta: item.from_email || "",
      href: `/needs-ocr/${item.id}`,
      createdAt: item.received_at || null,
    }));

    const notifications = [...orderNotifications, ...ocrNotifications]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 8);

    return NextResponse.json({ notifications });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, notifications: [] },
      { status: 500 }
    );
  }
}