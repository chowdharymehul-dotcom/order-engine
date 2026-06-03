import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getDeletedFrom(action: string) {
  if (action === "Place Order") return "orders";
  if (action === "Reply to Enquiry") return "enquiries";
  if (action === "Cancel Order") return "cancellations";
  return "order_items";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const entryKey = String(formData.get("entry_key") || "").trim();
    const action = String(formData.get("action") || "").trim();
    const redirectTo = String(formData.get("redirect_to") || "/orders").trim();

    if (!entryKey) {
      return NextResponse.json(
        { ok: false, error: "Missing entry_key" },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Missing action" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const deletedAt = new Date().toISOString();

    const updatePayload = {
      deleted_at: deletedAt,
      deleted_from: getDeletedFrom(action),
      deleted_reason: "manual_delete",
    };

    let matched = 0;

    if (isUuid(entryKey)) {
      const { data, error } = await supabase
        .from("order_items")
        .update(updatePayload)
        .eq("action", action)
        .eq("id", entryKey)
        .select("id");

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      matched += data?.length || 0;
    }

    const { data: externalRows, error: externalError } = await supabase
      .from("order_items")
      .update(updatePayload)
      .eq("action", action)
      .eq("external_message_id", entryKey)
      .select("id");

    if (externalError) {
      return NextResponse.json(
        { ok: false, error: externalError.message },
        { status: 500 }
      );
    }

    matched += externalRows?.length || 0;

    const { data: gmailRows, error: gmailError } = await supabase
      .from("order_items")
      .update(updatePayload)
      .eq("action", action)
      .eq("gmail_message_id", entryKey)
      .select("id");

    if (gmailError) {
      return NextResponse.json(
        { ok: false, error: gmailError.message },
        { status: 500 }
      );
    }

    matched += gmailRows?.length || 0;

    const { data: subjectRows, error: subjectError } = await supabase
      .from("order_items")
      .update(updatePayload)
      .eq("action", action)
      .eq("email_subject", entryKey)
      .select("id");

    if (subjectError) {
      return NextResponse.json(
        { ok: false, error: subjectError.message },
        { status: 500 }
      );
    }

    matched += subjectRows?.length || 0;

    if (matched === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No matching entry found to delete",
          entryKey,
          action,
        },
        { status: 404 }
      );
    }

    return NextResponse.redirect(new URL(redirectTo, req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to delete entry",
      },
      { status: 500 }
    );
  }
}