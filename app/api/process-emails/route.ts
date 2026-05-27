import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cleanText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

// --------------------
// STRICT RELEVANCE GATE
// --------------------
async function classifyEmail(content: string) {
  const prompt = `
You are a strict business email classifier.

Your job is to classify emails into ONLY ONE category.

CATEGORIES:

1. ORDER
ONLY if:
- clear purchase intent
- order placement
- PO shared
- SKU + quantity requested
- production/shipping request

2. ENQUIRY
ONLY if:
- asking questions
- follow up
- checking status
- asking for confirmation
- delivery confirmation
- shipment confirmation
- payment clarification
- availability checks

3. CANCELLATION
ONLY if:
- cancel order
- stop shipment
- modify/remove order

4. IGNORE
Everything else:
- marketing
- newsletters
- spam
- OTP
- ads
- notifications
- signatures only
- irrelevant conversations
- social mails
- generic greetings
- empty content

VERY IMPORTANT:
- "confirm delivery" = ENQUIRY
- No SKU + no purchase intent = NOT ORDER
- unclear emails = IGNORE
- promotional emails = IGNORE
- recruitment emails = IGNORE
- calendar/invite mails = IGNORE

RETURN ONLY ONE WORD:
ORDER
ENQUIRY
CANCELLATION
IGNORE

EMAIL:
${content}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return (
    res.choices[0]?.message?.content
      ?.trim()
      ?.toUpperCase() || "IGNORE"
  );
}

// --------------------
// EXTRACTION
// --------------------
async function extractStructured(content: string) {
  const prompt = `
Extract structured business order/enquiry data.

Return STRICT JSON ONLY.

{
  "customer": "",
  "po_number": "",
  "items": [
    {
      "sku": "",
      "qty": 0
    }
  ],
  "notes": "",
  "priority": "low",
  "follow_up_date": ""
}

RULES:
- quantity must be numeric
- if missing -> 0
- if no sku -> empty items array
- no hallucination
- no fake values
- leave blank if unclear

EMAIL:
${content}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return JSON.parse(
    res.choices[0]?.message?.content || "{}"
  );
}

// --------------------
// OCR FALLBACK
// --------------------
async function extractFromAttachment(fileUrl: string) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all readable business/order text from this document.",
            },
            {
              type: "image_url",
              image_url: {
                url: fileUrl,
              },
            },
          ],
        },
      ],
    });

    return res.choices[0]?.message?.content || "";
  } catch (err) {
    console.error("OCR fallback failed", err);
    return "";
  }
}

// --------------------
// MAIN HANDLER
// --------------------
export async function GET() {
  try {
    const { data: emails, error } = await supabase
      .from("emails")
      .select("*")
      .eq("processed", false)
      .order("received_at", { ascending: true });

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
      });
    }

    for (const email of emails || []) {
      try {
        const externalId =
          email.external_message_id ||
          email.gmail_message_id ||
          email.id;

        // --------------------
        // COMBINE CONTENT
        // --------------------
        let content = cleanText(
          email.body_text ||
            email.body ||
            ""
        );

        if (email.attachment_text) {
          content += "\n\n" + cleanText(email.attachment_text);
        }

        // OCR fallback
        if (
          !email.attachment_text &&
          email.attachment_url
        ) {
          const extracted = await extractFromAttachment(
            email.attachment_url
          );

          if (extracted?.trim()) {
            content += "\n\n" + extracted;

            await supabase
              .from("emails")
              .update({
                attachment_text: extracted,
              })
              .eq("id", email.id);
          }
        }

        // --------------------
        // HARD CONTENT FILTER
        // --------------------
        if (
          !content ||
          content.length < 10
        ) {
          await supabase
            .from("emails")
            .update({
              processed: true,
              processing_status: "ignored",
              intent: "ignored",
            })
            .eq("id", email.id);

          continue;
        }

        // --------------------
        // CLASSIFY
        // --------------------
        const intent = await classifyEmail(content);

        // --------------------
        // IGNORE IRRELEVANT
        // --------------------
        if (
          intent === "IGNORE" ||
          !["ORDER", "ENQUIRY", "CANCELLATION"].includes(intent)
        ) {
          await supabase
            .from("emails")
            .update({
              processed: true,
              processing_status: "ignored",
              intent: "ignored",
            })
            .eq("id", email.id);

          continue;
        }

        // --------------------
        // EXTRACT
        // --------------------
        const structured =
          await extractStructured(content);

        const items = Array.isArray(structured.items)
          ? structured.items
          : [];

        // --------------------
        // EXTRA ORDER SAFETY
        // --------------------
        if (
          intent === "ORDER" &&
          items.length === 0
        ) {
          await supabase
            .from("emails")
            .update({
              processed: true,
              processing_status: "ignored",
              intent: "ignored",
            })
            .eq("id", email.id);

          continue;
        }

        // --------------------
        // SAVE EMAIL
        // --------------------
        await supabase
          .from("emails")
          .update({
            processed: true,
            processing_status: "processed",
            intent: intent.toLowerCase(),
          })
          .eq("id", email.id);

        // --------------------
        // PREVENT DUPLICATES
        // --------------------
        const { data: existing } = await supabase
          .from("order_items")
          .select("id")
          .eq("external_message_id", externalId)
          .limit(1);

        if (existing && existing.length > 0) {
          continue;
        }

        // --------------------
        // CREATE ITEMS
        // --------------------
        if (intent === "ORDER") {
          for (const item of items) {
            await supabase
              .from("order_items")
              .insert({
                action: "Place Order",
                customer:
                  structured.customer || "",
                po_number:
                  structured.po_number || "",
                sku: item.sku || "",
                quantity: Number(item.qty || 0),
                notes:
                  structured.notes || "",
                status: "New",
                external_message_id: externalId,
                gmail_message_id:
                  email.gmail_message_id || null,
                email_subject:
                  email.subject || "",
              });
          }
        }

        if (intent === "ENQUIRY") {
          await supabase
            .from("order_items")
            .insert({
              action: "Reply to Enquiry",
              customer:
                structured.customer || "",
              po_number:
                structured.po_number || "",
              sku:
                items
                  .map((i: any) => i.sku)
                  .filter(Boolean)
                  .join(", ") || "",
              quantity:
                items.reduce(
                  (sum: number, i: any) =>
                    sum + Number(i.qty || 0),
                  0
                ) || 0,
              notes:
                structured.notes ||
                email.subject ||
                "",
              status: "Pending",
              external_message_id: externalId,
              gmail_message_id:
                email.gmail_message_id || null,
              email_subject:
                email.subject || "",
            });
        }

        if (intent === "CANCELLATION") {
          await supabase
            .from("order_items")
            .insert({
              action: "Cancel Order",
              customer:
                structured.customer || "",
              po_number:
                structured.po_number || "",
              sku:
                items
                  .map((i: any) => i.sku)
                  .filter(Boolean)
                  .join(", ") || "",
              quantity:
                items.reduce(
                  (sum: number, i: any) =>
                    sum + Number(i.qty || 0),
                  0
                ) || 0,
              notes:
                structured.notes || "",
              status: "Pending",
              external_message_id: externalId,
              gmail_message_id:
                email.gmail_message_id || null,
              email_subject:
                email.subject || "",
            });
        }
      } catch (emailErr) {
        console.error(
          "Failed processing email",
          email.id,
          emailErr
        );

        await supabase
          .from("emails")
          .update({
            processing_status: "failed",
            last_processing_error: String(emailErr),
          })
          .eq("id", email.id);
      }
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        ok: false,
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}