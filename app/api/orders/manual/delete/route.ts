import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getIdsFromFormData(formData: FormData) {
  const rawValues = formData.getAll("ids");

  const ids = rawValues
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const ids = getIdsFromFormData(formData);

  if (ids.length === 0) {
    return NextResponse.redirect(new URL("/orders/manual", request.url));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("order_items")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (error) {
    return NextResponse.redirect(
      new URL(`/orders/manual?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL(`/orders/manual?deleted=${encodeURIComponent(ids.join(","))}`, request.url)
  );
}