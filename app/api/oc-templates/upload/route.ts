import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const sellerProfileId = String(formData.get("seller_profile_id") || "").trim();
    const companyName = String(formData.get("company_name") || "").trim();
    const templateName = String(formData.get("template_name") || "").trim();
    const file = formData.get("template_file") as File | null;

    if (!sellerProfileId) {
      return NextResponse.json(
        { ok: false, error: "Missing seller profile" },
        { status: 400 }
      );
    }

    if (!companyName) {
      return NextResponse.json(
        { ok: false, error: "Missing company name" },
        { status: 400 }
      );
    }

    if (!templateName) {
      return NextResponse.json(
        { ok: false, error: "Missing template name" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Missing template PDF" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "Only PDF templates are allowed" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `templates/${Date.now()}-${safeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("oc-documents")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("oc-documents")
      .getPublicUrl(storagePath);

    await supabase
      .from("oc_templates")
      .update({ is_active: false })
      .eq("seller_profile_id", sellerProfileId)
      .eq("is_active", true);

    const { error: insertError } = await supabase.from("oc_templates").insert({
      seller_profile_id: sellerProfileId,
      company_name: companyName,
      template_name: templateName,
      template_url: publicUrlData.publicUrl,
      storage_path: storagePath,
      is_active: true,
    });

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
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
        error: error?.message || "Failed to upload OC template",
      },
      { status: 500 }
    );
  }
}