import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export default function ProcessPage() {
  async function processEmail(formData: FormData) {
    "use server";

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const email = formData.get("email") as string;
    const attachment = formData.get("attachment") as string;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Extract ALL actionable items from EMAIL + ATTACHMENT.

CRITICAL RULES:
- Each SKU must be a separate item
- Do NOT merge multiple SKUs into one item
- If multiple SKUs exist, create multiple items
- Use attachment for SKU + quantity
- Use email for instructions (reply, follow up, etc.)

ACTIONS MUST BE ONE OF:
- Place Order
- Reply to Enquiry
- Follow Up
- Cancel Order
- Confirm Delivery

RETURN ONLY JSON:

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
`,
        },
        {
          role: "user",
          content: `EMAIL:\n${email}\n\nATTACHMENT:\n${attachment}`,
        },
      ],
    });

    const text = response.choices[0].message.content || "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }

    if (!parsed.items || !Array.isArray(parsed.items)) {
      return;
    }

    for (const item of parsed.items) {
      await supabaseAdmin.from("order_items").insert({
        action: item.action,
        customer: parsed.customer || "",
        po_number: parsed.po_number || "",
        sku: item.sku,
        quantity: item.quantity || null,
        notes: item.notes || "",
        status: "New",
      });
    }
  }

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Process Email</h1>

      <form action={processEmail} className="space-y-4">
        <textarea
          name="email"
          placeholder="Paste email here"
          className="w-full border p-2 h-40"
        />

        <textarea
          name="attachment"
          placeholder="Paste attachment text here"
          className="w-full border p-2 h-40"
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Process
        </button>
      </form>
    </div>
  );
}