import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Customer = {
  id: string;
  company_name: string | null;
  auto_followup_enabled: boolean | null;
  next_auto_followup_date: string | null;
  default_followup_priority: string | null;
  auto_followup_notes: string | null;
  last_auto_followup_created_at: string | null;
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalizePriority(value: string | null) {
  const priority = clean(value).toLowerCase();

  if (priority === "low") return "low";
  if (priority === "high") return "high";

  return "medium";
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function isSameDate(dateA: string | null, dateB: string | null) {
  if (!dateA || !dateB) return false;

  return new Date(dateA).toISOString().slice(0, 10) ===
    new Date(dateB).toISOString().slice(0, 10);
}

function nextDatePlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = todayDateOnly();

    const { data: customersData, error: customersError } = await supabase
      .from("company_profiles")
      .select(
        "id, company_name, auto_followup_enabled, next_auto_followup_date, default_followup_priority, auto_followup_notes, last_auto_followup_created_at"
      )
      .eq("is_active", true)
      .neq("auto_followup_enabled", false)
      .not("next_auto_followup_date", "is", null)
      .lte("next_auto_followup_date", today)
      .limit(100);

    if (customersError) {
      return NextResponse.json(
        { ok: false, error: customersError.message },
        { status: 500 }
      );
    }

    const customers = (customersData || []) as Customer[];

    let created = 0;
    let skipped = 0;
    const createdItems: any[] = [];

    for (const customer of customers) {
      if (
        customer.last_auto_followup_created_at &&
        isSameDate(customer.last_auto_followup_created_at, new Date().toISOString())
      ) {
        skipped += 1;
        continue;
      }

      const { data: existingFollowUp } = await supabase
        .from("customer_followups")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("status", "pending")
        .eq("is_active", true)
        .ilike("title", "Auto follow up:%")
        .maybeSingle();

      if (existingFollowUp) {
        skipped += 1;
        continue;
      }

      const title = `Auto follow up: ${customer.company_name || "Customer"}`;

      const notes =
        clean(customer.auto_followup_notes) ||
        "Auto-created based on this customer's next follow-up date.";

      const priority = normalizePriority(customer.default_followup_priority);

      const { data: inserted, error: insertError } = await supabase
        .from("customer_followups")
        .insert({
          customer_id: customer.id,
          email_log_id: null,
          title,
          notes,
          due_date: new Date().toISOString(),
          priority,
          status: "pending",
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        skipped += 1;
        continue;
      }

      await supabase
        .from("company_profiles")
        .update({
          last_auto_followup_created_at: new Date().toISOString(),
          next_auto_followup_date: nextDatePlusDays(30),
          updated_at: new Date().toISOString(),
        })
        .eq("id", customer.id);

      created += 1;
      createdItems.push({
        customer_id: customer.id,
        followup_id: inserted?.id,
        customer_name: customer.company_name,
      });
    }

    return NextResponse.json({
      ok: true,
      date: today,
      checked: customers.length,
      created,
      skipped,
      createdItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to run auto follow-ups",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}