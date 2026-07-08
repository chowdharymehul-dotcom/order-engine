import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function clean(value: any) {
  return String(value || "").trim();
}

function emailTypeLabel(value: string) {
  if (value === "quotation_follow_up") return "Quotation Follow Up";
  if (value === "order_follow_up") return "Order Follow Up";
  if (value === "re_engagement") return "Re-engagement Email";

  return "Sales Follow Up";
}

function toneLabel(value: string) {
  if (value === "friendly") return "Friendly";
  if (value === "luxury") return "Luxury and premium";
  if (value === "short_direct") return "Short and direct";

  return "Professional";
}

function fallbackDraft(params: {
  customerName: string;
  contactName: string;
  emailType: string;
}) {
  const name = params.contactName || params.customerName || "there";

  return {
    subject:
      params.emailType === "re_engagement"
        ? "Checking in"
        : "Following up",
    message: `Dear ${name},

I hope you are doing well.

I wanted to follow up and check if there are any current or upcoming requirements where we can assist you.

Please let us know if you would like us to share further details, samples, pricing or new developments.

Best regards,
Pinx International`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const customerId = clean(body.customer_id);
    const emailType = clean(body.email_type) || "sales_follow_up";
    const tone = clean(body.tone) || "professional";

    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "Missing customer id" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: customer, error: customerError } = await supabase
      .from("company_profiles")
      .select(
        "id, company_name, contact_person, email, city, country, notes"
      )
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json(
        { ok: false, error: customerError.message },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { ok: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    const { data: recentEmails } = await supabase
      .from("customer_email_logs")
      .select("subject, message, status, sent_at, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: followUps } = await supabase
      .from("customer_followups")
      .select("title, notes, due_date, priority, status")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .order("due_date", { ascending: true })
      .limit(5);

    const customerName = clean(customer.company_name);
    const contactName = clean(customer.contact_person);

    if (!process.env.OPENAI_API_KEY) {
      const fallback = fallbackDraft({
        customerName,
        contactName,
        emailType,
      });

      return NextResponse.json({
        ok: true,
        subject: fallback.subject,
        message: fallback.message,
        fallback: true,
      });
    }

    const prompt = `
You are writing a business email for Pinx International.

Customer:
Company: ${customerName}
Contact Person: ${contactName}
Email: ${clean(customer.email)}
Location: ${[customer.city, customer.country].filter(Boolean).join(", ")}
Notes: ${clean(customer.notes)}

Email Type: ${emailTypeLabel(emailType)}
Tone: ${toneLabel(tone)}

Recent Sent Emails:
${JSON.stringify(recentEmails || [], null, 2)}

Open / Recent Follow Ups:
${JSON.stringify(followUps || [], null, 2)}

Write a polished business email.

Rules:
- Return only valid JSON.
- JSON format: {"subject":"...","message":"..."}
- Keep it concise.
- Do not mention AI.
- Do not invent exact order details unless present in the context.
- Sign off as "Pinx International".
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful business email assistant for a textile/export company.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
      }),
    });

    const aiData = await aiRes.json();

    if (!aiRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            aiData?.error?.message ||
            "OpenAI failed to generate the email draft",
        },
        { status: 500 }
      );
    }

    const content = clean(aiData?.choices?.[0]?.message?.content);

    let parsed: any = null;

    try {
      parsed = JSON.parse(content);
    } catch {
      const fallback = fallbackDraft({
        customerName,
        contactName,
        emailType,
      });

      return NextResponse.json({
        ok: true,
        subject: fallback.subject,
        message: content || fallback.message,
        fallback: true,
      });
    }

    return NextResponse.json({
      ok: true,
      subject: clean(parsed.subject) || "Following up",
      message: clean(parsed.message),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate AI email draft",
      },
      { status: 500 }
    );
  }
}