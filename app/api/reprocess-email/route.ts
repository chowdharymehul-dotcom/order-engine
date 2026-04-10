import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  const formData = await req.formData();

  const emailId = formData.get("email_id") as string;
  const ocrText = formData.get("ocr_text") as string;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: email, error: emailError } = await supabaseAdmin
    .from("emails")
    .select("*")
    .eq("id", emailId)
    .single();

  if (emailError || !email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const combinedInput = `
Subject: ${email.subject}
From: ${email.from_email}

EMAIL BODY:
${email.body_text}

ATTACHMENT CONTENT:
${ocrText}
`;

  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4.1",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
Extract structured business actions.

Return JSON:
{
  "customer": "",
  "po_number": "",
  "items": [
    {
      "action": "",
      "sku": "",
      "quantity": 0,
      "notes": ""
    }
  ]
}

Rules:
- Extract multiple SKUs as separate items
- Use both email body and attachment content
- Valid actions: Place Order, Reply to Enquiry, Follow Up, Cancel Order, Confirm Delivery
- NEVER create an item with blank SKU
- NEVER create a Place Order item unless SKU is explicitly present in email body or attachment content
- If there is no actionable order/enquiry content, return:
{
  "customer": "",
  "po_number": "",
  "items": []
}
`,
      },
      {
        role: "user",
        content: combinedInput,
      },
    ],
  });

  const raw = aiResponse.choices[0].message.content || "{}";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { customer: "", po_number: "", items: [] };
  }

  for (const item of parsed.items || []) {
    if (!item.sku) continue;

    await supabaseAdmin.from("order_items").insert({
      action: item.action,
      customer: parsed.customer || "",
      po_number: parsed.po_number || "",
      sku: item.sku,
      quantity: item.quantity || null,
      notes: item.notes || "",
      status: "New",
      source_email: email.from_email,
      gmail_message_id: email.gmail_message_id,
      email_subject: email.subject,
    });
  }

  await supabaseAdmin
    .from("emails")
    .update({
      attachment_text: ocrText,
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  return NextResponse.redirect(new URL("/", req.url));
}