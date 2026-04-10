import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("inbox_connections")
    .select("*")
    .eq("provider", "gmail")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (connectionError || !connection) {
    return NextResponse.json(
      { error: "No Gmail connection found" },
      { status: 404 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const listRes = await gmail.users.messages.list({
  userId: "me",
  maxResults: 10,
});

  const messages = listRes.data.messages || [];

  const fullMessages = [];

  for (const msg of messages) {
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    const payload = msgRes.data.payload;
    const headers = payload?.headers || [];

    const subject =
      headers.find((h) => h.name === "Subject")?.value || "";
    const from =
      headers.find((h) => h.name === "From")?.value || "";

    fullMessages.push({
      id: msgRes.data.id,
      threadId: msgRes.data.threadId,
      snippet: msgRes.data.snippet || "",
      subject,
      from,
      payload,
    });
  }

  return NextResponse.json({
    count: fullMessages.length,
    emails: fullMessages,
  });
}