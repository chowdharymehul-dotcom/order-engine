import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberValue(value: any, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function textValue(value: any, fallback = "") {
  return String(value || fallback).trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const templateId = value(formData, "template_id");
    const draftId = value(formData, "draft_id");

    if (!templateId || !draftId) {
      return NextResponse.json(
        { ok: false, error: "Missing template ID or draft ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: draft, error: draftError } = await supabase
      .from("oc_template_ai_drafts")
      .select("id, template_id, analysis")
      .eq("id", draftId)
      .eq("template_id", templateId)
      .maybeSingle();

    if (draftError) {
      return NextResponse.json(
        { ok: false, error: draftError.message },
        { status: 500 }
      );
    }

    if (!draft) {
      return NextResponse.json(
        { ok: false, error: "AI draft not found" },
        { status: 404 }
      );
    }

    const analysis = draft.analysis || {};

    await supabase.from("oc_template_regions").delete().eq("template_id", templateId);
    await supabase.from("oc_template_mappings").delete().eq("template_id", templateId);
    await supabase.from("oc_template_columns").delete().eq("template_id", templateId);
    await supabase.from("oc_template_totals").delete().eq("template_id", templateId);
    await supabase
      .from("oc_template_static_blocks")
      .delete()
      .eq("template_id", templateId);

    const regions = Array.isArray(analysis.regions) ? analysis.regions : [];

    const insertedRegionMap = new Map<string, string>();

    for (const region of regions) {
      const regionName = textValue(region.region_name);
      if (!regionName) continue;

      const { data: insertedRegion, error: regionError } = await supabase
        .from("oc_template_regions")
        .insert({
          template_id: templateId,
          region_name: regionName,
          display_label: textValue(region.display_label, regionName),
          region_type: textValue(region.region_type, "custom"),
          page_number: numberValue(region.page_number, 1),
          x_position: numberValue(region.x_position, 50),
          y_position: numberValue(region.y_position, 500),
          width: numberValue(region.width, 300),
          height: numberValue(region.height, 100),
          row_height: region.row_height ? numberValue(region.row_height, 18) : null,
          column_gap: region.column_gap ? numberValue(region.column_gap, 10) : null,
          updated_at: new Date().toISOString(),
        })
        .select("id, region_name")
        .single();

      if (regionError) {
        return NextResponse.json(
          { ok: false, error: regionError.message },
          { status: 500 }
        );
      }

      insertedRegionMap.set(regionName, insertedRegion.id);
    }

    const fields = Array.isArray(analysis.fields) ? analysis.fields : [];

    for (const field of fields) {
      const fieldName = textValue(field.field_name);
      if (!fieldName) continue;

      const regionName = textValue(field.region_name);
      const regionId = insertedRegionMap.get(regionName) || null;

      const { error } = await supabase.from("oc_template_mappings").insert({
        template_id: templateId,
        region_id: regionId,
        field_name: fieldName,
        display_label: textValue(field.display_label, fieldName),
        field_type: textValue(field.field_type, "system"),
        page_number: numberValue(field.page_number, 1),
        x_position: numberValue(field.x_position, 50),
        y_position: numberValue(field.y_position, 750),
        font_size: numberValue(field.font_size, 10),
      });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    const columns = Array.isArray(analysis.columns) ? analysis.columns : [];

    for (const column of columns) {
      const displayLabel = textValue(column.display_label);
      const sourceField = textValue(column.source_field);

      if (!displayLabel || !sourceField) continue;

      const regionName = textValue(column.region_name, "table_region");
      const regionId = insertedRegionMap.get(regionName) || null;

      const { error } = await supabase.from("oc_template_columns").insert({
        template_id: templateId,
        region_id: regionId,
        display_label: displayLabel,
        source_field: sourceField,
        column_order: numberValue(column.column_order, 1),
      });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    const totals = Array.isArray(analysis.totals) ? analysis.totals : [];

    for (const total of totals) {
      const displayLabel = textValue(total.display_label);
      const totalKey = textValue(total.total_key);

      if (!displayLabel || !totalKey) continue;

      const regionName = textValue(total.region_name, "totals_region");
      const regionId = insertedRegionMap.get(regionName) || null;

      const { error } = await supabase.from("oc_template_totals").insert({
        template_id: templateId,
        region_id: regionId,
        display_label: displayLabel,
        total_key: totalKey,
        formula_type: textValue(total.formula_type, "manual"),
        total_order: numberValue(total.total_order, 1),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    const staticBlocks = Array.isArray(analysis.static_blocks)
      ? analysis.static_blocks
      : [];

    for (const block of staticBlocks) {
      const displayLabel = textValue(block.display_label);
      const blockKey = textValue(block.block_key);

      if (!displayLabel || !blockKey) continue;

      const regionName = textValue(block.region_name);
      const regionId = insertedRegionMap.get(regionName) || null;

      const { error } = await supabase.from("oc_template_static_blocks").insert({
        template_id: templateId,
        region_id: regionId,
        display_label: displayLabel,
        block_key: blockKey,
        content: textValue(block.content),
        x_position: block.x_position ? numberValue(block.x_position, 50) : null,
        y_position: block.y_position ? numberValue(block.y_position, 500) : null,
        font_size: numberValue(block.font_size, 10),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    await supabase
      .from("oc_template_ai_drafts")
      .update({
        status: "applied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    return NextResponse.redirect(
      new URL(`/oc-templates/${templateId}/designer`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to apply AI draft",
      },
      { status: 500 }
    );
  }
}