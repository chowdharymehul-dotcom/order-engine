export type OcrProvider = "local";

export function getOcrProvider(): OcrProvider {
  return "local";
}

export function getAppBaseUrl(): string {
  const baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing APP_BASE_URL");
  }

  return baseUrl;
}

export function assertOcrConfig() {
  getAppBaseUrl();

  return {
    provider: "local",
    ok: true,
  };
}