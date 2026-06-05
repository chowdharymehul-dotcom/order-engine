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
    const displayLabel = value(formData, "display_label");
    const sourceField = value(formData, "source_field");
    const columnOrder = numberValue(formData, "column_order", 1);

    if (!templateId || !displayLabel || !sourceField) {
      return NextResponse.json(
        { ok: false, error: "Missing template, label, or source field" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from("oc_template_columns").insert({
      template_id: templateId,
      display_label: displayLabel,
      source_field: sourceField,
      column_order: columnOrder,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL(`/oc-templates/${templateId}/designer`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save template column",
      },
      { status: 500 }
    );
  }
}