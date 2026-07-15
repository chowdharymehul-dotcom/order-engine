declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    text?: string;
    version?: string;
  };

  type PdfParseOptions = {
    pagerender?: (pageData: unknown) => Promise<string> | string;
    max?: number;
    version?: string;
  };

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;
}
