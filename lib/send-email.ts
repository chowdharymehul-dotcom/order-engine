import { google } from "googleapis";
import { getValidOutlookAccessToken } from "@/lib/outlook-token";

function createRawGmailMessage(params: {
  to: string;
  subject: string;
  body: string;
}) {
  const lines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    params.body,
  ];

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendViaGmail(params: {
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

  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: createRawGmailMessage({
        to: params.to,
        subject: params.subject,
        body: params.body,
      }),
    },
  });
}

export async function sendViaOutlook(params: {
  to: string;
  subject: string;
  body: string;
}) {
  const { accessToken } = await getValidOutlookAccessToken();

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