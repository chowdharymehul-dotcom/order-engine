import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function parseIds(values: FormDataEntryValue[]) {
  return values
    .flatMap((value) =>
      String(value || "")
        .split(",")
        .map((id) => id.trim())
    )
    .filter(Boolean);
}

function deletedFromForAction(action: string) {
  if (action === "Place Order") return "orders";
  if (action === "Reply to Enquiry") return "enquiries";
  if (action === "Cancel Order") return "cancellations";
  return "order_items";
}

function movePayload(operation: string) {
  if (operation === "move_to_orders") {
    return {
      action: "Place Order",
      status: "New",
      deleted_at: null,
      deleted_from: null,
      deleted_reason: null,
    };
  }

  if (operation === "move_to_enquiries") {
    return {
      action: "Reply to Enquiry",
      status: "Pending",
      deleted_at: null,
      deleted_from: null,
      deleted_reason: null,
    };
  }

  if (operation === "move_to_cancellations") {
    return {
      action: "Cancel Order",
      status: "Pending",
      deleted_at: null,
      deleted_from: null,
      deleted_reason: null,
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const type = String(formData.get("type") || "").trim();
    const operation = String(formData.get("operation") || "").trim();
    const redirectTo = String(formData.get("redirect_to") || "/").trim();
    const source = String(formData.get("source") || "").trim();
    const ids = parseIds(formData.getAll("ids"));

    if (!type) {
      return NextResponse.json(
        { ok: false, error: "Missing bulk type" },
        { status: 400 }
      );
    }

    if (!operation) {
      return NextResponse.json(
        { ok: false, error: "Missing bulk operation" },
        { status: 400 }
      );
    }

    if (ids.length === 0) {
      return NextResponse.redirect(new URL(redirectTo, req.url), {
        status: 303,
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (type === "emails") {
      if (operation === "delete") {
        const { error } = await supabase
          .from("emails")
          .update({
            deleted_at: new Date().toISOString(),
            deleted_from: "emails",
            deleted_reason: "bulk_delete",
          })
          .in("id", ids);

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }

      if (operation === "restore") {
        const { error } = await supabase
          .from("emails")
          .update({
            deleted_at: null,
            deleted_from: null,
            deleted_reason: null,
          })
          .in("id", ids);

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }

      if (operation === "permanent_delete") {
        const { error } = await supabase.from("emails").delete().in("id", ids);

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }

      return NextResponse.redirect(new URL(redirectTo, req.url), {
        status: 303,
      });
    }

    if (type === "order_items") {
      if (operation === "delete") {
        const { data: rows } = await supabase
          .from("order_items")
          .select("id, action")
          .in("id", ids);

        const action = rows?.[0]?.action || source;

        const { error } = await supabase
          .from("order_items")
          .update({
            deleted_at: new Date().toISOString(),
            deleted_from: deletedFromForAction(action),
            deleted_reason: "bulk_delete",
          })
          .in("id", ids);

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }

      if (operation === "restore") {
        const { error } = await supabase
          .from("order_items")
          .update({
            deleted_at: null,
            deleted_from: null,
            deleted_reason: null,
          })
          .in("id", ids);

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }

      if (operation === "permanent_delete") {
        const { error } = await supabase
          .from("order_items")
          .delete()
          .in("id", ids);

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }

      const payload = movePayload(operation);

      if (payload) {
        const { error } = await supabase
          .from("order_items")
          .update(payload)
          .in("id", ids);

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }

      return NextResponse.redirect(new URL(redirectTo, req.url), {
        status: 303,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid bulk type" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Bulk action failed",
      },
      { status: 500 }
    );
  }
}