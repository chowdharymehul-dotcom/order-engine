import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function parseIds(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const idsValue = String(formData.get("ids") || "").trim();
    const status = String(formData.get("status") || "").trim();

    if (!idsValue) {
      return NextResponse.json(
        { ok: false, error: "Missing order item ids" },
        { status: 400 }
      );
    }

    if (!["New", "Approved", "Done"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: "Invalid order status" },
        { status: 400 }
      );
    }

    const ids = parseIds(idsValue);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("order_items")
      .update({ status })
      .in("id", ids);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/orders", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update order status",
      },
      { status: 500 }
    );
  }
}