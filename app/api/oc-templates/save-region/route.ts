import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberValue(formData: FormData, key: string, fallback: number | null) {
  const raw = value(formData, key);

  if (!raw) return fallback;

  const num = Number(raw);

  return Number.isFinite(num) ? num : fallback;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const templateId = value(formData, "template_id");
    const regionId = value(formData, "region_id");

    const regionName = value(formData, "region_name");
    const displayLabel = value(formData, "display_label") || regionName;
    const regionType = value(formData, "region_type") || "custom";

    if (!templateId || !regionName) {
      return NextResponse.json(
        { ok: false, error: "Missing template ID or region name" },
        { status: 400 }
      );
    }

    const payload = {
      template_id: templateId,
      region_name: regionName,
      display_label: displayLabel,
      region_type: regionType,
      page_number: numberValue(formData, "page_number", 1),
      x_position: numberValue(formData, "x_position", 50),
      y_position: numberValue(formData, "y_position", 500),
      width: numberValue(formData, "width", null),
      height: numberValue(formData, "height", null),
      row_height: numberValue(formData, "row_height", null),
      column_gap: numberValue(formData, "column_gap", null),
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (regionId) {
      const { error } = await supabase
        .from("oc_template_regions")
        .update(payload)
        .eq("id", regionId);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    } else {
      await supabase
        .from("oc_template_regions")
        .delete()
        .eq("template_id", templateId)
        .eq("region_name", regionName);

      const { error } = await supabase
        .from("oc_template_regions")
        .insert(payload);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.redirect(
      new URL(`/oc-templates/${templateId}/designer`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save template region",
      },
      { status: 500 }
    );
  }
}