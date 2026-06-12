import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const templateId = value(formData, "template_id");

    if (!templateId) {
      return NextResponse.json(
        { ok: false, error: "Missing template ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: template } = await supabase
      .from("oc_templates")
      .select("id, storage_path")
      .eq("id", templateId)
      .maybeSingle();

    if (template?.storage_path) {
      await supabase.storage
        .from("oc-documents")
        .remove([template.storage_path]);
    }

    const { error } = await supabase
      .from("oc_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/oc-templates", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to delete template",
      },
      { status: 500 }
    );
  }
}