import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "email-attachments";

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadAttachmentToSupabase(params: {
  provider: string;
  messageId: string;
  filename: string;
  fileBuffer: Buffer;
  mimeType: string;
}) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const safeFilename = sanitizeFilename(params.filename || "attachment.bin");
  const path = `${params.provider}/${params.messageId}/${Date.now()}-${safeFilename}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(path, params.fileBuffer, {
      contentType: params.mimeType || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload attachment: ${uploadError.message}`);
  }

  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}