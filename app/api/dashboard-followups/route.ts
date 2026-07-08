import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("customer_followups")
      .select("*")
      .eq("status", "pending");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      followUps: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to load dashboard follow ups",
      },
      { status: 500 }
    );
  }
}