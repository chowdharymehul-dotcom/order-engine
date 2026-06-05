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
    const fieldName = value(formData, "field_name");

    if (!templateId || !fieldName) {
      return NextResponse.json(
        { ok: false, error: "Missing template ID or field name" },
        { status: 400 }
      );
    }

    const payload = {
      template_id: templateId,
      field_name: fieldName,
      page_number: numberValue(formData, "page_number", 1),
      x_position: numberValue(formData, "x_position", 50),
      y_position: numberValue(formData, "y_position", 750),
      font_size: numberValue(formData, "font_size", 10),
    };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("oc_template_mappings")
      .delete()
      .eq("template_id", templateId)
      .eq("field_name", fieldName);

    const { error } = await supabase.from("oc_template_mappings").insert(payload);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(
      new URL(`/oc-templates/${templateId}/designer`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save mapping" },
      { status: 500 }
    );
  }
}