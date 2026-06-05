import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const templateId = value(formData, "template_id");
    const columnId = value(formData, "column_id");

    if (!templateId || !columnId) {
      return NextResponse.json(
        { ok: false, error: "Missing template ID or column ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("oc_template_columns")
      .delete()
      .eq("id", columnId);

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
        error: error?.message || "Failed to delete template column",
      },
      { status: 500 }
    );
  }
}