export type OcrProvider = "cloudconvert";

export function getOcrProvider(): OcrProvider {
  const provider = process.env.OCR_PROVIDER;

  if (provider !== "cloudconvert") {
    throw new Error("Invalid OCR_PROVIDER. Expected 'cloudconvert'.");
  }

  return provider;
}

export function getCloudConvertApiKey(): string {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;

  if (!apiKey) {
    throw new Error("Missing CLOUDCONVERT_API_KEY");
  }

  return apiKey;
}

export function getAppBaseUrl(): string {
  const baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing APP_BASE_URL");
  }

  return baseUrl;
}

export function assertOcrConfig() {
  const provider = getOcrProvider();

  if (provider === "cloudconvert") {
    getCloudConvertApiKey();
  }

  getAppBaseUrl();

  return {
    provider,
    ok: true,
  };
}