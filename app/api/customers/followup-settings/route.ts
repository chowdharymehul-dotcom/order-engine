import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function clean(value: any) {
  return String(value || "").trim();
}

function normalizePriority(value: string) {
  const priority = clean(value).toLowerCase();

  if (priority === "low") return "low";
  if (priority === "high") return "high";

  return "medium";
}

function dateOrNull(value: string) {
  const text = clean(value);

  if (!text) return null;

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return null;

  return text;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const customerId = clean(formData.get("customer_id"));
    const autoFollowupEnabled =
      clean(formData.get("auto_followup_enabled")) === "on";
    const nextAutoFollowupDate = dateOrNull(
      clean(formData.get("next_auto_followup_date"))
    );
    const defaultFollowupPriority = normalizePriority(
      clean(formData.get("default_followup_priority"))
    );
    const autoFollowupNotes = clean(formData.get("auto_followup_notes"));

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Missing customer id" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("company_profiles")
      .update({
        auto_followup_enabled: autoFollowupEnabled,
        next_auto_followup_date: nextAutoFollowupDate,
        default_followup_priority: defaultFollowupPriority,
        auto_followup_notes: autoFollowupNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL(`/customers/${customerId}/dashboard?followupSettingsSaved=1`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save follow-up settings",
      },
      { status: 500 }
    );
  }
}