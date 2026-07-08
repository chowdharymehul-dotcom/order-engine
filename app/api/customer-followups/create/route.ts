import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function clean(value: any) {
  return String(value || "").trim();
}

function dueDateFromDays(daysText: string) {
  const days = Number(daysText || 7);
  const due = new Date();

  due.setDate(due.getDate() + (Number.isFinite(days) ? days : 7));

  return due.toISOString();
}

function dueDateFromCustomDate(value: string) {
  const text = clean(value);

  if (!text) return "";

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}

function normalizePriority(value: string) {
  const priority = clean(value).toLowerCase();

  if (priority === "low") return "low";
  if (priority === "high") return "high";

  return "medium";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const customerId = clean(formData.get("customer_id"));
    const emailLogId = clean(formData.get("email_log_id"));
    const title = clean(formData.get("title")) || "Follow up with customer";
    const notes = clean(formData.get("notes"));
    const dueDate = clean(formData.get("due_date"));
    const dueInDays = clean(formData.get("due_in_days")) || "7";
    const priority = normalizePriority(clean(formData.get("priority")));
    const redirectTo =
      clean(formData.get("redirect_to")) || "/sales-followups";

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Missing customer id" },
        { status: 400 }
      );
    }

    const finalDueDate =
      dueDateFromCustomDate(dueDate) || dueDateFromDays(dueInDays);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from("customer_followups").insert({
      customer_id: customerId,
      email_log_id: emailLogId || null,
      title,
      notes,
      priority,
      due_date: finalDueDate,
      status: "pending",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL(redirectTo, req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create follow-up",
      },
      { status: 500 }
    );
  }
}