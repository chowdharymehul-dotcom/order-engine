export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const emailId = String(formData.get("email_id") || "");

    if (!emailId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing email_id",
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("id, external_message_id, gmail_message_id")
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        {
          ok: false,
          error: emailError?.message || "Email not found",
        },
        { status: 404 }
      );
    }

    if (email.external_message_id) {
      await supabase
        .from("order_items")
        .delete()
        .eq("external_message_id", email.external_message_id);
    }

    if (email.gmail_message_id) {
      await supabase
        .from("order_items")
        .delete()
        .eq("gmail_message_id", email.gmail_message_id);
    }

    const { error: deleteEmailError } = await supabase
      .from("emails")
      .delete()
      .eq("id", emailId);

    if (deleteEmailError) {
      return NextResponse.json(
        {
          ok: false,
          error: deleteEmailError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/emails", req.url), 303);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Delete failed",
      },
      { status: 500 }
    );
  }
}