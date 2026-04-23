import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

function createRawGmailMessage(params: {
  to: string;
  from?: string;
  subject: string;
  body: string;
}) {
  const lines = [
    `To: ${params.to}`,
    ...(params.from ? [`From: ${params.from}`] : []),
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.body,
  ];

  const message = lines.join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function refreshOutlookToken(connection: any, supabaseAdmin: any) {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Refresh failed");
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from("inbox_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || connection.refresh_token,
      expires_at: expiresAt,
      connection_status: "active",
      last_error: null,
    })
    .eq("id", connection.id);

  if (error) {
    throw new Error(`Failed to save refreshed Outlook token: ${error.message}`);
  }

  return data.access_token;
}

async function getConnectionForProvider(
  supabaseAdmin: any,
  provider: string
) {
  const { data, error } = await supabaseAdmin
    .from("inbox_connections")
    .select("*")
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ${provider} connection: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No ${provider} inbox connection found`);
  }

  return data;
}

async function sendViaGmail(params: {
  accessToken: string;
  refreshToken?: string | null;
  to: string;
  subject: string;
  body: string;
}) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: params.accessToken,
    refresh_token: params.refreshToken || undefined,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const raw = createRawGmailMessage({
    to: params.to,
    subject: params.subject,
    body: params.body,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
    },
  });
}

async function sendViaOutlook(params: {
  supabaseAdmin: any;
  connection: any;
  to: string;
  subject: string;
  body: string;
}) {
  let accessToken = params.connection.access_token;

  if (
    params.connection.expires_at &&
    new Date(params.connection.expires_at).getTime() < Date.now()
  ) {
    accessToken = await refreshOutlookToken(
      params.connection,
      params.supabaseAdmin
    );
  }

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: {
          contentType: "Text",
          content: params.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: params.to,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outlook send failed: ${text || res.status}`);
  }
}

function getFollowUpDueAt(days = 3) {
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const rawEnquiryId = formData.get("enquiry_id");
    const rawTo = formData.get("to");
    const rawSubject = formData.get("subject");
    const rawMessage = formData.get("message");

    const enquiryId =
      typeof rawEnquiryId === "string"
        ? rawEnquiryId.trim()
        : String(rawEnquiryId ?? "").trim();

    const to =
      typeof rawTo === "string" ? rawTo.trim() : String(rawTo ?? "").trim();

    const subject =
      typeof rawSubject === "string"
        ? rawSubject.trim()
        : String(rawSubject ?? "").trim();

    const message =
      typeof rawMessage === "string"
        ? rawMessage.trim()
        : String(rawMessage ?? "").trim();

    if (!enquiryId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing enquiry id",
        },
        { status: 400 }
      );
    }

    if (!to) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing recipient email",
        },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing reply subject",
        },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reply message cannot be empty",
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: enquiry, error: enquiryError } = await supabase
      .from("order_items")
      .select(
        "id, provider, customer, sku, quantity, notes, status, email_subject, source_email, action"
      )
      .eq("id", enquiryId)
      .maybeSingle();

    if (enquiryError) {
      return NextResponse.json(
        {
          ok: false,
          error: enquiryError.message,
        },
        { status: 500 }
      );
    }

    if (!enquiry) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enquiry not found",
        },
        { status: 404 }
      );
    }

    let finalMessage = message;

    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const ai = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: `Rewrite the reply as a polished business email.
Preserve meaning. Do not invent facts, prices, or deadlines.
Return only the final email body text.`,
            },
            {
              role: "user",
              content: `Customer: ${enquiry.customer || ""}
SKU: ${enquiry.sku || ""}
Quantity: ${enquiry.quantity ?? ""}
Original query: ${enquiry.notes || enquiry.email_subject || ""}

Draft:
${message}`,
            },
          ],
        });

        finalMessage = ai.choices[0]?.message?.content?.trim() || message;
      } catch {
        finalMessage = message;
      }
    }

    const provider = (enquiry.provider || "").toLowerCase();

    if (provider === "gmail") {
      const connection = await getConnectionForProvider(supabase, "gmail");

      await sendViaGmail({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        to,
        subject,
        body: finalMessage,
      });
    } else if (provider === "outlook") {
      const connection = await getConnectionForProvider(supabase, "outlook");

      await sendViaOutlook({
        supabaseAdmin: supabase,
        connection,
        to,
        subject,
        body: finalMessage,
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "Unsupported provider for enquiry reply",
        },
        { status: 400 }
      );
    }

    const auditNote = [
      `Reply sent`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message: ${finalMessage}`,
    ].join("\n");

    const existingNotes = enquiry.notes?.trim() || "";
    const mergedNotes = existingNotes
      ? `${existingNotes}\n\n---\n${auditNote}`
      : auditNote;

    const { error: updateError } = await supabase
      .from("order_items")
      .update({
        status: "Replied",
        notes: mergedNotes,
        follow_up_due_at: getFollowUpDueAt(3),
      })
      .eq("id", enquiryId);

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL("/enquiries-follow-up", req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to send enquiry reply",
      },
      { status: 500 }
    );
  }
}