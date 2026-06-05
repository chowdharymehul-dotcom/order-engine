import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateOCPdfBuffer } from "@/lib/oc-pdf";

export const dynamic = "force-dynamic";

type OrderConfirmation = {
  id: string;
  order_item_id: string | null;
  order_item_ids: string[] | null;
  customer_id: string | null;
  seller_profile_id: string | null;
  oc_number: string | null;
  oc_date: string | null;
  po_number: string | null;
  delivery_date: string | null;
  payment_terms: string | null;
  shipment_terms: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  pdf_url: string | null;
  status: string | null;
};

type OrderItem = {
  id: string;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
};

type Customer = {
  company_name: string | null;
  email: string | null;
};

type SellerProfile = {
  company_name: string | null;
};

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function formatDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const ocId = value(formData, "oc_id");
    const orderItemId = value(formData, "order_item_id");

    if (!ocId || !orderItemId) {
      return NextResponse.json(
        { ok: false, error: "Missing OC ID or order item ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: ocData, error: ocError } = await supabase
      .from("order_confirmations")
      .select("*")
      .eq("id", ocId)
      .maybeSingle();

    if (ocError) {
      return NextResponse.json(
        { ok: false, error: ocError.message },
        { status: 500 }
      );
    }

    if (!ocData) {
      return NextResponse.json(
        { ok: false, error: "OC draft not found" },
        { status: 404 }
      );
    }

    const oc = ocData as OrderConfirmation;

    const orderItemIds =
      oc.order_item_ids && oc.order_item_ids.length > 0
        ? oc.order_item_ids
        : oc.order_item_id
        ? [oc.order_item_id]
        : [orderItemId];

    const { data: orderRows, error: orderError } = await supabase
      .from("order_items")
      .select("id, sku, quantity, notes")
      .in("id", orderItemIds);

    if (orderError) {
      return NextResponse.json(
        { ok: false, error: orderError.message },
        { status: 500 }
      );
    }

    const orderItems = ((orderRows || []) as OrderItem[]).sort(
      (a, b) => orderItemIds.indexOf(a.id) - orderItemIds.indexOf(b.id)
    );

    const { data: customerData } = oc.customer_id
      ? await supabase
          .from("company_profiles")
          .select("company_name, email")
          .eq("id", oc.customer_id)
          .maybeSingle()
      : { data: null };

    const customer = (customerData || null) as Customer | null;

    const { data: sellerData } = oc.seller_profile_id
      ? await supabase
          .from("seller_profiles")
          .select("company_name")
          .eq("id", oc.seller_profile_id)
          .maybeSingle()
      : { data: null };

    const seller = (sellerData || null) as SellerProfile | null;

    const pdfBuffer = await generateOCPdfBuffer({
      companyName: seller?.company_name || "Seller Company",
      customer: customer?.company_name || "",
      customerEmail: customer?.email || "",
      poNumber: oc.po_number || "",
      ocNumber: oc.oc_number || "",
      ocDate: formatDate(oc.oc_date),
      items: orderItems.map((item) => ({
        sku: item.sku || "",
        quantity: item.quantity ?? "",
        notes: item.notes || "",
      })),
    });

    const storagePath = `generated/${Date.now()}-${safeFileName(
      `${oc.oc_number || "OC"}.pdf`
    )}`;

    const { error: uploadError } = await supabase.storage
      .from("oc-documents")
      .upload(storagePath, pdfBuffer, {
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

    const pdfUrl = publicUrlData.publicUrl;

    const { error: updateOCError } = await supabase
      .from("order_confirmations")
      .update({
        pdf_url: pdfUrl,
        status: "Generated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", oc.id);

    if (updateOCError) {
      return NextResponse.json(
        { ok: false, error: updateOCError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("order_items")
      .update({
        oc_pdf_url: pdfUrl,
        oc_status: "Generated",
      })
      .in("id", orderItemIds);

    return NextResponse.redirect(new URL(`/orders/${orderItemId}/oc`, req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate OC PDF",
      },
      { status: 500 }
    );
  }
}