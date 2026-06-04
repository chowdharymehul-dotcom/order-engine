import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateOCPdfBuffer } from "@/lib/oc-pdf";

export const dynamic = "force-dynamic";

type OrderItem = {
  id: string;
  customer: string | null;
  po_number: string | null;
  sku: string | null;
  quantity: number | null;
  notes: string | null;
  email_subject: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
};

type EmailRow = {
  id: string;
  from_email: string | null;
  subject: string | null;
  external_message_id: string | null;
  gmail_message_id: string | null;
};

function parseIds(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function formatOCDate() {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function makeOCNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const t = String(now.getTime()).slice(-6);

  return `OC-${y}${m}${d}-${t}`;
}

function findEmailForOrder(items: OrderItem[], emails: EmailRow[]) {
  const first = items[0];

  const externalId = clean(first.external_message_id);
  const gmailId = clean(first.gmail_message_id);
  const subject = clean(first.email_subject).toLowerCase();

  return (
    emails.find((email) => email.external_message_id === externalId) ||
    emails.find((email) => email.gmail_message_id === gmailId) ||
    emails.find(
      (email) => clean(email.subject).toLowerCase() === subject && subject
    ) ||
    null
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const idsValue = String(formData.get("ids") || "").trim();

    if (!idsValue) {
      return NextResponse.json(
        { ok: false, error: "Missing order item ids" },
        { status: 400 }
      );
    }

    const ids = parseIds(idsValue);

    if (ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid order item ids received" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: template, error: templateError } = await supabase
      .from("oc_templates")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (templateError) {
      return NextResponse.json(
        { ok: false, error: templateError.message },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active OC template found. Please upload an OC template first.",
        },
        { status: 400 }
      );
    }

    const { data: rows, error: rowsError } = await supabase
      .from("order_items")
      .select(
        "id, customer, po_number, sku, quantity, notes, email_subject, external_message_id, gmail_message_id"
      )
      .in("id", ids);

    if (rowsError) {
      return NextResponse.json(
        { ok: false, error: rowsError.message },
        { status: 500 }
      );
    }

    const orderItems = (rows || []) as OrderItem[];

    if (orderItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No matching order items found" },
        { status: 404 }
      );
    }

    const { data: emailRows } = await supabase
      .from("emails")
      .select("id, from_email, subject, external_message_id, gmail_message_id")
      .limit(5000);

    const email = findEmailForOrder(orderItems, (emailRows || []) as EmailRow[]);

    const first = orderItems[0];
    const ocNumber = makeOCNumber();

    const pdfBuffer = await generateOCPdfBuffer({
      companyName: template.company_name || "Company",
      customer: first.customer || "",
      customerEmail: email?.from_email || "",
      poNumber: first.po_number || "",
      ocNumber,
      ocDate: formatOCDate(),
      items: orderItems.map((item) => ({
        sku: item.sku || "",
        quantity: item.quantity ?? "",
        notes: item.notes || "",
      })),
    });

    const storagePath = `generated/${Date.now()}-${safeFileName(
      `${ocNumber}.pdf`
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

    const { data: ocDoc, error: insertError } = await supabase
      .from("oc_documents")
      .insert({
        order_item_ids: ids,
        customer: first.customer || "",
        customer_email: email?.from_email || "",
        po_number: first.po_number || "",
        pdf_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        status: "Generated",
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("order_items")
      .update({
        oc_pdf_url: publicUrlData.publicUrl,
        oc_status: "Generated",
        oc_document_id: ocDoc.id,
      })
      .in("id", ids);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/orders", req.url), {
      status: 303,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate OC",
      },
      { status: 500 }
    );
  }
}