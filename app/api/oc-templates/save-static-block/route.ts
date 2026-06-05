import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function nullableNumber(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;

  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const templateId = value(formData, "template_id");
    const blockId = value(formData, "block_id");
    const regionId = value(formData, "region_id") || null;
    const displayLabel = value(formData, "display_label");
    const blockKey = value(formData, "block_key");
    const content = value(formData, "content");

    if (!templateId || !displayLabel || !blockKey) {
      return NextResponse.json(
        { ok: false, error: "Missing template, display label, or block key" },
        { status: 400 }
      );
    }

    const payload = {
      template_id: templateId,
      region_id: regionId,
      display_label: displayLabel,
      block_key: blockKey,
      content,
      x_position: nullableNumber(formData, "x_position"),
      y_position: nullableNumber(formData, "y_position"),
      font_size: nullableNumber(formData, "font_size") || 10,
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (blockId) {
      const { error } = await supabase
        .from("oc_template_static_blocks")
        .update(payload)
        .eq("id", blockId);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("oc_template_static_blocks")
        .insert(payload);

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
      { ok: false, error: error?.message || "Failed to save static block" },
      { status: 500 }
    );
  }
}