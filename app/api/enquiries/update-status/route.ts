import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = [
  "Replied",
  "Pending",
  "Follow Up with Customer",
  "Close Enquiry",
] as const;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const rawId = formData.get("id") ?? formData.get("enquiry_id");
    const rawStatus = formData.get("status");

    const enquiryId =
      typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
    const status =
      typeof rawStatus === "string"
        ? rawStatus.trim()
        : String(rawStatus ?? "").trim();

    if (!enquiryId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing enquiry id",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid enquiry status",
          allowed: ALLOWED_STATUSES,
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("order_items")
      .update({
        status,
      })
      .eq("id", enquiryId);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL("/enquiries-follow-up", req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update enquiry status",
      },
      { status: 500 }
    );
  }
}