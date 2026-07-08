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

function normalizeStatus(value: string) {
  const status = clean(value).toLowerCase();

  if (status === "done") return "done";
  if (status === "cancelled") return "cancelled";

  return "pending";
}

function dueDateFromCustomDate(value: string) {
  const text = clean(value);

  if (!text) return "";

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const id = clean(formData.get("id"));
    const title = clean(formData.get("title")) || "Follow up with customer";
    const notes = clean(formData.get("notes"));
    const dueDate = dueDateFromCustomDate(clean(formData.get("due_date")));
    const priority = normalizePriority(clean(formData.get("priority")));
    const status = normalizeStatus(clean(formData.get("status")));

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing follow-up id" },
        { status: 400 }
      );
    }

    if (!dueDate) {
      return NextResponse.json(
        { ok: false, error: "Missing valid due date" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("customer_followups")
      .update({
        title,
        notes,
        due_date: dueDate,
        priority,
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/sales-followups", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update follow-up",
      },
      { status: 500 }
    );
  }
}