import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const nowIso = new Date().toISOString();

    const { data: rowsToUpdate, error: selectError } = await supabase
      .from("order_items")
      .select("id, customer, sku, status, follow_up_due_at")
      .eq("status", "Replied")
      .not("follow_up_due_at", "is", null)
      .lt("follow_up_due_at", nowIso);

    if (selectError) {
      return NextResponse.json(
        {
          ok: false,
          step: "select_overdue_followups",
          error: selectError.message,
        },
        { status: 500 }
      );
    }

    const overdueItems = rowsToUpdate || [];

    if (overdueItems.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        items: [],
      });
    }

    const ids = overdueItems.map((item) => item.id);

    const { error: updateError } = await supabase
      .from("order_items")
      .update({
        status: "Follow Up with Customer",
      })
      .in("id", ids);

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          step: "update_overdue_followups",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated: ids.length,
      items: overdueItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        step: "catch",
        error: error?.message || "Failed to auto-update follow ups",
      },
      { status: 500 }
    );
  }
}