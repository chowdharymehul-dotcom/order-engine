import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const raw = Number(value(formData, key));
  return Number.isFinite(raw) ? raw : fallback;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const templateId = value(formData, "template_id");
    const totalId = value(formData, "total_id");
    const regionId = value(formData, "region_id") || null;
    const displayLabel = value(formData, "display_label");
    const totalKey = value(formData, "total_key");
    const formulaType = value(formData, "formula_type") || "manual";
    const totalOrder = numberValue(formData, "total_order", 1);

    if (!templateId || !displayLabel || !totalKey) {
      return NextResponse.json(
        { ok: false, error: "Missing template, display label, or total key" },
        { status: 400 }
      );
    }

    const payload = {
      template_id: templateId,
      region_id: regionId,
      display_label: displayLabel,
      total_key: totalKey,
      formula_type: formulaType,
      total_order: totalOrder,
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (totalId) {
      const { error } = await supabase
        .from("oc_template_totals")
        .update(payload)
        .eq("id", totalId);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("oc_template_totals").insert(payload);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.redirect(
      new URL(`/oc-templates/${templateId}/designer`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save total" },
      { status: 500 }
    );
  }
}