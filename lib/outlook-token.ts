import { createClient } from "@supabase/supabase-js";

type OutlookConnection = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

export async function getValidOutlookAccessToken() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: connections, error } = await supabaseAdmin
    .from("inbox_connections")
    .select("*")
    .eq("provider", "outlook")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !connections?.[0]) {
    throw new Error(error?.message || "No Outlook connection found");
  }

  const connection = connections[0] as OutlookConnection;

  if (!connection.refresh_token) {
    throw new Error("Outlook refresh_token missing. Please reconnect Outlook.");
  }

  const expiresAt = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : 0;

  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

  if (
    connection.access_token &&
    expiresAt &&
    expiresAt > fiveMinutesFromNow
  ) {
    return {
      accessToken: connection.access_token,
      connection,
      refreshed: false,
    };
  }

  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
        scope: [
          "openid",
          "profile",
          "email",
          "offline_access",
          "User.Read",
          "Mail.Read",
          "Mail.Send",
        ].join(" "),
      }),
    }
  );

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    await supabaseAdmin
      .from("inbox_connections")
      .update({
        connection_status: "error",
        last_error: JSON.stringify(tokenData),
      })
      .eq("id", connection.id);

    throw new Error(
      `Outlook token refresh failed: ${JSON.stringify(tokenData)}`
    );
  }

  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token || connection.refresh_token;
  const expiresIn = Number(tokenData.expires_in || 3600);
  const expiresAtIso = new Date(Date.now() + expiresIn * 1000).toISOString();

  if (!newAccessToken) {
    throw new Error("Outlook token refresh did not return access_token");
  }

  const { error: updateError } = await supabaseAdmin
    .from("inbox_connections")
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAtIso,
      connection_status: "active",
      last_error: null,
    })
    .eq("id", connection.id);

  if (updateError) {
    throw new Error(
      `Failed to save refreshed Outlook token: ${updateError.message}`
    );
  }

  return {
    accessToken: newAccessToken,
    connection: {
      ...connection,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAtIso,
    },
    refreshed: true,
  };
}