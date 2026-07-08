import { google } from "googleapis";
import { getValidOutlookAccessToken } from "@/lib/outlook-token";

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer | Uint8Array | ArrayBuffer | string;
};

function clean(value: any) {
  return String(value || "").trim();
}

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function attachmentToBuffer(content: EmailAttachment["content"]) {
  if (Buffer.isBuffer(content)) return content;
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (content instanceof ArrayBuffer) return Buffer.from(content);
  return Buffer.from(String(content));
}

function createRawGmailMessage(params: {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
}) {
  const attachments = params.attachments || [];
  const hasAttachments = attachments.length > 0;
  const boundary = `boundary_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

  if (!hasAttachments) {
    const lines = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      "MIME-Version: 1.0",
      params.htmlBody
        ? "Content-Type: text/html; charset=UTF-8"
        : "Content-Type: text/plain; charset=UTF-8",
      "",
      params.htmlBody || params.body,
    ];

    return toBase64Url(lines.join("\r\n"));
  }

  const lines: string[] = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    params.htmlBody
      ? "Content-Type: text/html; charset=UTF-8"
      : "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    params.htmlBody || params.body,
    "",
  ];

  for (const attachment of attachments) {
    const buffer = attachmentToBuffer(attachment.content);
    const base64 = buffer
  .toString("base64")
  .replace(/(.{76})/g, "$1\r\n");

    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      base64,
      ""
    );
  }

  lines.push(`--${boundary}--`);

  return toBase64Url(lines.join("\r\n"));
}

export async function refreshGmailAccessToken(refreshToken: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    throw new Error(
      tokenData?.error_description ||
        tokenData?.error ||
        "Failed to refresh Gmail token"
    );
  }

  const accessToken = clean(tokenData.access_token);
  const expiresIn = Number(tokenData.expires_in || 3600);

  if (!accessToken) {
    throw new Error("Gmail refresh did not return an access token");
  }

  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function sendViaGmail(params: {
  accessToken: string;
  refreshToken?: string | null;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
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
        htmlBody: params.htmlBody,
        attachments: params.attachments || [],
      }),
    },
  });
}

export async function sendViaOutlook(params: {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
}) {
  const { accessToken } = await getValidOutlookAccessToken();
  const attachments = params.attachments || [];

  const graphAttachments = attachments.map((attachment) => {
    const buffer = attachmentToBuffer(attachment.content);

    return {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachment.filename,
      contentType: attachment.contentType,
      contentBytes: buffer.toString("base64"),
    };
  });

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
          contentType: params.htmlBody ? "HTML" : "Text",
          content: params.htmlBody || params.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: params.to,
            },
          },
        ],
        attachments: graphAttachments,
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outlook send failed: ${text || res.status}`);
  }
}