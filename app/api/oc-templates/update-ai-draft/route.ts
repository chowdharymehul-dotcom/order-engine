import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function removeAtIndex(items: any[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function numberOrOriginal(value: string, original: any) {
  if (value === "") return original;
  const num = Number(value);
  return Number.isFinite(num) ? num : original;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const templateId = value(formData, "template_id");
    const draftId = value(formData, "draft_id");
    const action = value(formData, "action");
    const section = value(formData, "section");
    const index = Number(value(formData, "index"));

    if (!templateId || !draftId || !action) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: draft, error: draftError } = await supabase
      .from("oc_template_ai_drafts")
      .select("id, template_id, analysis, deleted_items")
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
    const deletedItems = asArray(draft.deleted_items);

    if (action === "save_all") {
      const rawAnalysis = value(formData, "analysis");

      if (!rawAnalysis) {
        return NextResponse.json(
          { ok: false, error: "Missing analysis payload" },
          { status: 400 }
        );
      }

      let parsedAnalysis: any;

      try {
        parsedAnalysis = JSON.parse(rawAnalysis);
      } catch {
        return NextResponse.json(
          { ok: false, error: "Invalid analysis JSON" },
          { status: 400 }
        );
      }

      const normalizedAnalysis = {
        logos: asArray(parsedAnalysis.logos),
        regions: asArray(parsedAnalysis.regions),
        fields: asArray(parsedAnalysis.fields),
        columns: asArray(parsedAnalysis.columns),
        totals: asArray(parsedAnalysis.totals),
        static_blocks: asArray(parsedAnalysis.static_blocks),
        lines: asArray(parsedAnalysis.lines),
        rectangles: asArray(parsedAnalysis.rectangles),
        table_borders: asArray(parsedAnalysis.table_borders),
      };

      const { error: updateError } = await supabase
        .from("oc_template_ai_drafts")
        .update({
          analysis: normalizedAnalysis,
          raw_ai_response: normalizedAnalysis,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .eq("template_id", templateId);

      if (updateError) {
        return NextResponse.json(
          { ok: false, error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (!section) {
      return NextResponse.json(
        { ok: false, error: "Missing section" },
        { status: 400 }
      );
    }

    const validSections = [
      "logos",
      "regions",
      "fields",
      "columns",
      "totals",
      "static_blocks",
      "lines",
      "rectangles",
      "table_borders",
      "deleted_items",
    ];

    if (!validSections.includes(section)) {
      return NextResponse.json(
        { ok: false, error: "Invalid draft section" },
        { status: 400 }
      );
    }

    if (["delete", "restore", "edit"].includes(action) && !Number.isFinite(index)) {
      return NextResponse.json(
        { ok: false, error: "Invalid item index" },
        { status: 400 }
      );
    }

    let nextAnalysis = { ...analysis };
    let nextDeletedItems = [...deletedItems];

    if (action === "delete") {
      const currentItems = asArray(analysis[section]);
      const itemToDelete = currentItems[index];

      if (!itemToDelete) {
        return NextResponse.json(
          { ok: false, error: "Item not found" },
          { status: 404 }
        );
      }

      nextAnalysis = {
        ...analysis,
        [section]: removeAtIndex(currentItems, index),
      };

      nextDeletedItems = [
        { section, item: itemToDelete, deleted_at: new Date().toISOString() },
        ...deletedItems,
      ];
    } else if (action === "restore") {
      if (section !== "deleted_items") {
        return NextResponse.json(
          { ok: false, error: "Restore only works from deleted items" },
          { status: 400 }
        );
      }

      const deletedEntry = deletedItems[index];

      if (!deletedEntry?.section || !deletedEntry?.item) {
        return NextResponse.json(
          { ok: false, error: "Deleted item not found" },
          { status: 404 }
        );
      }

      const restoreSection = deletedEntry.section;
      const currentRestoreItems = asArray(analysis[restoreSection]);

      nextAnalysis = {
        ...analysis,
        [restoreSection]: [...currentRestoreItems, deletedEntry.item],
      };

      nextDeletedItems = removeAtIndex(deletedItems, index);
    } else if (action === "edit") {
      const currentItems = asArray(analysis[section]);

      nextAnalysis = {
        ...analysis,
        [section]: currentItems.map((item, itemIndex) => {
          if (itemIndex !== index) return item;

          const nextItem = { ...item };

          for (const [key, formValue] of formData.entries()) {
            if (["template_id", "draft_id", "action", "section", "index"].includes(key)) {
              continue;
            }

            const rawValue = String(formValue || "").trim();

            if (
              [
                "x_position",
                "y_position",
                "width",
                "height",
                "page_number",
                "font_size",
                "column_order",
                "total_order",
                "row_height",
                "column_gap",
                "confidence",
                "x1",
                "y1",
                "x2",
                "y2",
                "thickness",
                "border_thickness",
                "row_count",
                "column_count",
              ].includes(key)
            ) {
              nextItem[key] = numberOrOriginal(rawValue, nextItem[key]);
            } else {
              nextItem[key] = rawValue;
            }
          }

          return nextItem;
        }),
      };
    } else {
      return NextResponse.json(
        { ok: false, error: "Unsupported action" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("oc_template_ai_drafts")
      .update({
        analysis: nextAnalysis,
        raw_ai_response: nextAnalysis,
        deleted_items: nextDeletedItems,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .eq("template_id", templateId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update AI draft" },
      { status: 500 }
    );
  }
}