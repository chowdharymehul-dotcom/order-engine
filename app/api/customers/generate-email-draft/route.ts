import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function clean(value: any) {
  return String(value || "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const prompt = clean(body.prompt);

    if (!prompt) {
      return NextResponse.json(
        {
          ok: false,
          error: "Prompt is required",
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "OPENAI_API_KEY not configured",
        },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: `
Generate a professional bulk customer email.

Return JSON only:

{
  "subject": "",
  "message": ""
}

Rules:
- Professional business tone
- No markdown
- No fake pricing
- No fake delivery commitments
- Use {{contact_person}} when appropriate
- Use {{company_name}} when appropriate
- Include greeting and sign-off
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      ok: true,
      subject: parsed.subject || "",
      message: parsed.message || "",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to generate email draft",
      },
      { status: 500 }
    );
  }
}