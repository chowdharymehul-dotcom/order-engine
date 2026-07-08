import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const id = text(formData, "id");
    const storagePath = text(formData, "storage_path");

    if (!id) {
      return NextResponse.redirect(
        new URL("/customers?error=Missing import file ID", req.url),
        { status: 303 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (storagePath) {
      await supabase.storage.from("oc-documents").remove([storagePath]);
    }

    const { error } = await supabase
      .from("customer_imports")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.redirect(
        new URL(`/customers?error=${encodeURIComponent(error.message)}`, req.url),
        { status: 303 }
      );
    }

    return NextResponse.redirect(new URL("/customers", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(
        `/customers?error=${encodeURIComponent(
          error?.message || "Failed to delete import file"
        )}`,
        req.url
      ),
      { status: 303 }
    );
  }
}
