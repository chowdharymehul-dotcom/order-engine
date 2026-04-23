export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import OpenAI from "openai";
import EnquiryReplyComposer from "@/components/EnquiryReplyComposer";

type ReplyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SuggestionSet = {
  professional: string;
  warm: string;
  concise: string;
};

async function generateReplySuggestions(params: {
  customer: string;
  sku: string;
  quantity: string;
  query: string;
  isFollowUp: boolean;
}) {
  const fallbackProfessional = params.isFollowUp
    ? `Dear ${params.customer || "Customer"},

I hope you are doing well.

I am following up on your earlier enquiry regarding SKU ${
        params.sku || ""
      }${params.quantity ? `, quantity ${params.quantity}` : ""}.

Please let us know if you would like to proceed or if you need any further details from our side.

Best regards`
    : `Dear ${params.customer || "Customer"},

Thank you for your enquiry regarding SKU ${params.sku || ""}${
        params.quantity ? `, quantity ${params.quantity}` : ""
      }.

We have received your request and will get back to you shortly with the relevant details.

Best regards`;

  const fallbackWarm = params.isFollowUp
    ? `Dear ${params.customer || "Customer"},

Just following up on your earlier message regarding ${
        params.sku || "the requested item"
      }${params.quantity ? ` in quantity ${params.quantity}` : ""}.

Please let us know if you need any additional information from our side.

Warm regards`
    : `Dear ${params.customer || "Customer"},

Thank you for reaching out regarding ${params.sku || "the requested item"}${
        params.quantity ? ` in quantity ${params.quantity}` : ""
      }.

We are reviewing your enquiry and will respond shortly with the details.

Warm regards`;

  const fallbackConcise = params.isFollowUp
    ? `Dear ${params.customer || "Customer"},

Following up on your enquiry regarding ${params.sku || "the item requested"}.

Please let us know how you would like to proceed.

Best regards`
    : `Dear ${params.customer || "Customer"},

Thank you for your enquiry regarding ${params.sku || "the item requested"}.

We will get back to you shortly.

Best regards`;

  if (!process.env.OPENAI_API_KEY) {
    return {
      professional: fallbackProfessional,
      warm: fallbackWarm,
      concise: fallbackConcise,
    } satisfies SuggestionSet;
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Create 3 business email drafts for a customer communication.

Return JSON only in this exact format:
{
  "professional": "",
  "warm": "",
  "concise": ""
}

Rules:
- professional = formal and polished
- warm = friendly and human
- concise = short and direct
- plain text only
- include greeting and sign-off
- do not invent pricing, delivery dates, or commitments
- if this is a follow-up, write it as a polite follow-up email
- if this is not a follow-up, write it as a first reply to the enquiry`,
        },
        {
          role: "user",
          content: `Customer: ${params.customer}
SKU: ${params.sku}
Quantity: ${params.quantity}
Query: ${params.query}
Is follow up: ${params.isFollowUp ? "Yes" : "No"}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    return {
      professional: parsed.professional || fallbackProfessional,
      warm: parsed.warm || fallbackWarm,
      concise: parsed.concise || fallbackConcise,
    } satisfies SuggestionSet;
  } catch {
    return {
      professional: fallbackProfessional,
      warm: fallbackWarm,
      concise: fallbackConcise,
    } satisfies SuggestionSet;
  }
}

export default async function ReplyPage({ params }: ReplyPageProps) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, provider, customer, sku, quantity, notes, status, email_subject, source_email, action, follow_up_due_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">Reply</h1>
        <p className="text-red-600">Error loading enquiry: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const queryText = data.notes || data.email_subject || "";
  const isFollowUp = data.status === "Follow Up with Customer";

  const suggestions = await generateReplySuggestions({
    customer: data.customer || "",
    sku: data.sku || "",
    quantity: data.quantity ? String(data.quantity) : "",
    query: queryText,
    isFollowUp,
  });

  const defaultMessage = suggestions.professional;

  return (
    <div className="p-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {isFollowUp ? "Follow Up" : "Reply"}
        </h1>

        <Link
          href="/enquiries-follow-up"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <span className="text-sm text-gray-500">Provider</span>
          <div className="font-medium">{data.provider || ""}</div>
        </div>

        <div>
          <span className="text-sm text-gray-500">Customer</span>
          <div className="font-medium">{data.customer || ""}</div>
        </div>

        <div>
          <span className="text-sm text-gray-500">SKU</span>
          <div className="font-medium">{data.sku || ""}</div>
        </div>

        <div>
          <span className="text-sm text-gray-500">Quantity</span>
          <div className="font-medium">{data.quantity ?? ""}</div>
        </div>

        <div>
          <span className="text-sm text-gray-500">Current Status</span>
          <div className="font-medium">{data.status || ""}</div>
        </div>

        {data.follow_up_due_at ? (
          <div>
            <span className="text-sm text-gray-500">Follow Up Due</span>
            <div className="font-medium">
              {new Date(data.follow_up_due_at).toLocaleString()}
            </div>
          </div>
        ) : null}

        <div>
          <span className="text-sm text-gray-500">Query</span>
          <div className="mt-1">{queryText}</div>
        </div>
      </div>

      <EnquiryReplyComposer
        enquiryId={String(data.id)}
        to={data.source_email || ""}
        subject={data.email_subject || ""}
        suggestions={suggestions}
        defaultMessage={defaultMessage}
        isFollowUp={isFollowUp}
      />
    </div>
  );
}