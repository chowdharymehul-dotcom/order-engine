import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const type = String(formData.get("type") || "").trim();
    const id = String(formData.get("id") || "").trim();

    if (!type || !id) {
      return NextResponse.json(
        { ok: false, error: "Missing type or id" },
        { status: 400 }
      );
    }

    const table =
      type === "email"
        ? "emails"
        : type === "order_item"
        ? "order_items"
        : "";

    if (!table) {
      return NextResponse.json(
        { ok: false, error: "Invalid delete type" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/deleted", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to permanently delete item",
      },
      { status: 500 }
    );
  }
}