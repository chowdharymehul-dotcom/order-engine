import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";


export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function emptyAnalysis() {
  return {
    logos: [],
    regions: [],
    fields: [],
    columns: [],
    totals: [],
    static_blocks: [],
    lines: [],
    rectangles: [],
    table_borders: [],
  };
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function clean(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function mappedValue(row: any) {
  return clean(
    row?.mapped_to ||
      row?.source_field ||
      row?.field_name ||
      row?.total_key ||
      row?.block_key ||
      ""
  );
}

function numberOrFallback(value: any, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeForPostgres(input: string) {
  return String(input || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\\u0000/g, "")
    .replace(/\\u[0-9a-fA-F]{0,3}([^0-9a-fA-F]|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function safeJsonParse(raw: string) {
  try {
    const parsed = JSON.parse(raw);

    return {
      logos: asArray(parsed.logos),
      regions: asArray(parsed.regions),
      fields: asArray(parsed.fields),
      columns: asArray(parsed.columns),
      totals: asArray(parsed.totals),
      static_blocks: asArray(parsed.static_blocks),
      lines: asArray(parsed.lines),
      rectangles: asArray(parsed.rectangles),
      table_borders: asArray(parsed.table_borders),
    };
  } catch {
    return emptyAnalysis();
  }
}

function normalizeMappedPath(path: string) {
  const value = clean(path);

  const legacyMap: Record<string, string> = {
    company_name: "seller.company_name",
    seller_name: "seller.company_name",
    seller_address: "seller.address",
    seller_gst: "seller.gst_no",
    seller_phone: "seller.phone",
    seller_email: "seller.email",

    customer_name: "customer.name",
    customer_address: "customer.address",
    customer_country: "customer.country",

    agent_name: "agent.name",

    oc_number: "order.oc_number",
    oc_date: "order.oc_date",
    order_number: "order.oc_number",
    order_date: "order.oc_date",
    po_number: "order.po_number",
    po_date: "order.po_date",
    reference: "order.reference",
    payment_terms: "order.payment_terms",
    shipment_terms: "order.shipment_terms",
    shipping_address: "order.shipping_address",
    shipping_instructions: "order.shipping_instructions",
    delivery_date: "order.delivery_date",
    attention_of: "order.attention_of",
    total_amount: "order.total_amount",

    article_no: "item.article_no",
    sku: "item.sku",
    color_no: "item.color_no",
    colour_no: "item.color_no",
    color: "item.color",
    colour: "item.color",
    size: "item.size",
    width: "item.width",
    piece_length: "item.piece_length",
    quantity: "item.quantity",
    unit_price: "item.unit_price",
    amount: "item.amount",
  };

  return legacyMap[value] || value;
}

function convertVisualTopLeftToPdfBox(item: any, fallback: any = {}) {
  const width = clamp(
    numberOrFallback(item.width, fallback.width || 160),
    10,
    PDF_WIDTH
  );

  const height = clamp(
    numberOrFallback(item.height, fallback.height || 18),
    6,
    PDF_HEIGHT
  );

  const visualX = clamp(
    numberOrFallback(item.x_position, fallback.x_position || 40),
    0,
    PDF_WIDTH - 5
  );

  const visualYFromTop = clamp(
    numberOrFallback(item.y_position, fallback.y_position || 400),
    0,
    PDF_HEIGHT - 5
  );

  const pdfY = clamp(PDF_HEIGHT - visualYFromTop - height, 0, PDF_HEIGHT - 5);

  return {
    x_position: visualX,
    y_position: pdfY,
    width,
    height,
    font_size: clamp(
      numberOrFallback(item.font_size, fallback.font_size || 8),
      5,
      24
    ),
  };
}

function postProcessAnalysis(analysis: any) {
  const normalized = {
    logos: asArray(analysis.logos),
    regions: asArray(analysis.regions),
    fields: asArray(analysis.fields),
    columns: asArray(analysis.columns),
    totals: asArray(analysis.totals),
    static_blocks: asArray(analysis.static_blocks),
    lines: asArray(analysis.lines),
    rectangles: asArray(analysis.rectangles),
    table_borders: asArray(analysis.table_borders),
  };

  normalized.fields = normalized.fields
    .filter((field: any) => mappedValue(field))
    .map((field: any) => {
      const mapped = normalizeMappedPath(mappedValue(field));
      const box = convertVisualTopLeftToPdfBox(field, {
        x_position: 40,
        y_position: 300,
        width: 160,
        height: 18,
        font_size: 8,
      });

      return {
        ...field,
        region_name: clean(field.region_name || "main"),
        field_name: mapped,
        display_label: clean(field.display_label || mapped),
        field_type: clean(field.field_type || "system"),
        page_number: 1,
        ...box,
        mapped_to: mapped,
        source_type: clean(field.source_type || "system"),
        confidence: clamp(numberOrFallback(field.confidence, 0.75), 0, 1),
      };
    });

  normalized.columns = normalized.columns
    .filter((column: any) => mappedValue(column))
    .map((column: any, index: number) => {
      const mapped = normalizeMappedPath(mappedValue(column));
      const box = convertVisualTopLeftToPdfBox(column, {
        x_position: 35 + index * 60,
        y_position: 470,
        width: 60,
        height: 18,
        font_size: 8,
      });

      return {
        ...column,
        region_name: "item_table",
        display_label: clean(column.display_label || mapped),
        source_field: mapped,
        column_order: Number(column.column_order || index + 1),
        mapped_to: mapped,
        confidence: clamp(numberOrFallback(column.confidence, 0.75), 0, 1),
        ...box,
        row_height: clamp(numberOrFallback(column.row_height, 20), 10, 50),
      };
    })
    .sort((a: any, b: any) => Number(a.column_order) - Number(b.column_order));

  normalized.totals = normalized.totals
    .filter((total: any) => mappedValue(total))
    .map((total: any, index: number) => {
      const mapped = normalizeMappedPath(mappedValue(total));
      const box = convertVisualTopLeftToPdfBox(total, {
        x_position: 450,
        y_position: 650 + index * 18,
        width: 100,
        height: 18,
        font_size: 8,
      });

      return {
        ...total,
        region_name: "totals",
        display_label: clean(total.display_label || mapped),
        total_key: mapped,
        formula_type: clean(total.formula_type || "sum_column"),
        total_order: Number(total.total_order || index + 1),
        mapped_to: mapped,
        confidence: clamp(numberOrFallback(total.confidence, 0.75), 0, 1),
        ...box,
      };
    });

  normalized.logos = normalized.logos.map((logo: any) => {
    const box = convertVisualTopLeftToPdfBox(logo, {
      x_position: 35,
      y_position: 60,
      width: 120,
      height: 70,
      font_size: 8,
    });

    return {
      ...logo,
      logo_key: clean(logo.logo_key || "seller_logo"),
      display_label: clean(logo.display_label || "Seller Logo"),
      page_number: 1,
      ...box,
      mapped_to: "seller.logo",
      source_type: "seller_profile",
      confidence: clamp(numberOrFallback(logo.confidence, 0.75), 0, 1),
    };
  });

  normalized.regions = normalized.regions.map((region: any) => {
    const box = convertVisualTopLeftToPdfBox(region, {
      x_position: 40,
      y_position: 300,
      width: 200,
      height: 80,
      font_size: 8,
    });

    return {
      ...region,
      region_name: clean(region.region_name || "region"),
      display_label: clean(
        region.display_label || region.region_name || "Region"
      ),
      region_type: clean(region.region_type || "section"),
      page_number: 1,
      ...box,
      row_height: numberOrFallback(region.row_height, 20),
      column_gap: numberOrFallback(region.column_gap, 8),
    };
  });

  normalized.static_blocks = normalized.static_blocks.map((block: any) => {
    const box = convertVisualTopLeftToPdfBox(block, {
      x_position: 40,
      y_position: 700,
      width: 400,
      height: 40,
      font_size: 8,
    });

    return {
      ...block,
      region_name: clean(block.region_name || "footer"),
      display_label: clean(block.display_label || "Static Text"),
      block_key: clean(block.block_key || block.display_label || "static_text"),
      content: clean(block.content || ""),
      ...box,
      source_type: "static",
      confidence: clamp(numberOrFallback(block.confidence, 0.75), 0, 1),
    };
  });

  return normalized;
}

async function downloadBuffer(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function convertPdfFirstPageToPngUrl(templateUrl: string): Promise<string> {
  throw new Error(
    "PDF to PNG template analysis is disabled after removing CloudConvert. Upload a PNG/JPG template image instead."
  );
}

async function uploadPngToSupabase(params: {
  supabase: any;
  templateId: string;
  cloudConvertPngUrl: string;
}) {
  const { supabase, templateId, cloudConvertPngUrl } = params;

  const pngBuffer = await downloadBuffer(cloudConvertPngUrl);
  const storagePath = `ai-template-analysis/${templateId}-${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from("oc-documents")
    .upload(storagePath, pngBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from("oc-documents")
    .getPublicUrl(storagePath);

  if (!data.publicUrl) {
    throw new Error("Could not create public URL for analysis image");
  }

  return {
    imageUrl: data.publicUrl,
    imageStoragePath: storagePath,
    imageSizeBytes: pngBuffer.length,
  };
}

async function analyzeImageWithOpenAI(params: {
  openai: OpenAI;
  imageUrl: string;
  templateName: string;
  companyName: string;
  templateType: string;
}) {
  const { openai, imageUrl, templateName, companyName, templateType } = params;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are analyzing a BLANK Order Confirmation PDF template image.

Return ONLY valid JSON in this exact shape:

{
  "logos": [],
  "regions": [],
  "fields": [],
  "columns": [],
  "totals": [],
  "static_blocks": [],
  "lines": [],
  "rectangles": [],
  "table_borders": []
}

VERY IMPORTANT COORDINATE RULE:
Return coordinates in VISUAL IMAGE coordinates, NOT PDF coordinates.

Use:
- width = 595
- height = 842
- origin = TOP-LEFT
- x_position = distance from LEFT
- y_position = distance from TOP

The backend will convert your visual top-left coordinates into PDF bottom-left coordinates.

Your job:
Detect where values should be written on the blank template.

CRITICAL RULES:
- Do NOT place coordinates on printed labels.
- Do NOT place coordinates on borders.
- Do NOT place coordinates on table headers.
- Use the blank writable space where a human would type.
- For table columns, x/y must be the FIRST EMPTY DATA ROW below the header.
- For totals, x/y must be where the value should print, not the word TOTAL.
- Do not assume one fixed OC layout. Analyze the actual uploaded image.

Each field must include:
region_name, field_name, display_label, field_type, page_number, x_position, y_position, width, height, font_size, mapped_to, source_type, confidence

Each column must include:
region_name, display_label, source_field, column_order, mapped_to, confidence, x_position, y_position, width, height, font_size

Each total must include:
region_name, display_label, total_key, formula_type, total_order, mapped_to, confidence, x_position, y_position, width, height, font_size

Allowed mapped_to values:
seller.logo
seller.company_name
seller.address
seller.gst_no
seller.phone
seller.email
seller.bank_name
seller.bank_address
seller.account_number
seller.swift_code
customer.name
customer.address
customer.country
agent.name
agent.company
order.oc_number
order.oc_date
order.po_number
order.po_date
order.reference
order.payment_terms
order.shipment_terms
order.shipping_address
order.shipping_instructions
order.delivery_date
order.attention_of
order.total_amount
item.article_no
item.color_no
item.color
item.size
item.width
item.piece_length
item.quantity
item.unit_price
item.amount
manual.custom_text

Return JSON only.
`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
Template Name: ${templateName}
Company Name: ${companyName}
Template Type: ${templateType}

Analyze this blank OC template dynamically.

Return visual TOP-LEFT coordinates only.
Do not convert to PDF coordinates yourself.
`,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
  });

  const raw = response.choices[0].message.content || "{}";

  return {
    raw,
    analysis: postProcessAnalysis(safeJsonParse(raw)),
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const templateId = value(formData, "template_id");

    if (!templateId) {
      return NextResponse.json(
        { ok: false, error: "Missing template ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: template, error: templateError } = await supabase
      .from("oc_templates")
      .select("id, company_name, template_name, template_type, template_url")
      .eq("id", templateId)
      .maybeSingle();

    if (templateError) {
      return NextResponse.json(
        { ok: false, error: templateError.message },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "Template not found" },
        { status: 404 }
      );
    }

    if (!template.template_url) {
      return NextResponse.json(
        { ok: false, error: "Template PDF URL missing" },
        { status: 400 }
      );
    }

    const cloudConvertPngUrl = await convertPdfFirstPageToPngUrl(
      template.template_url
    );

    const imageUpload = await uploadPngToSupabase({
      supabase,
      templateId,
      cloudConvertPngUrl,
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const result = await analyzeImageWithOpenAI({
      openai,
      imageUrl: imageUpload.imageUrl,
      templateName: template.template_name || "",
      companyName: template.company_name || "",
      templateType: template.template_type || "blank",
    });

    const { data: draft, error: draftError } = await supabase
      .from("oc_template_ai_drafts")
      .insert({
        template_id: templateId,
        analysis: result.analysis,
        raw_text: "",
        raw_ai_response: result.analysis,
        analysis_version:
          "vision_cloudconvert_v8_visual_top_left_to_pdf_conversion",
        debug_notes:
          "V8 asks AI for visual top-left coordinates and converts them into PDF bottom-left coordinates before saving. This fixes image/PDF coordinate mismatch.",
        source_type: "vision_cloudconvert",
        image_url: imageUpload.imageUrl,
        confidence_score: null,
        vision_metadata: {
          source_type: "vision_cloudconvert",
          analysis_version:
            "vision_cloudconvert_v8_visual_top_left_to_pdf_conversion",
          raw_ai_content: sanitizeForPostgres(result.raw),
          image_url: imageUpload.imageUrl,
          image_storage_path: imageUpload.imageStoragePath,
          image_size_bytes: imageUpload.imageSizeBytes,
        },
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        {
          ok: false,
          error: draftError?.message || "Failed to save AI draft",
        },
        { status: 500 }
      );
    }

return NextResponse.redirect(
  new URL(
    `/oc-templates/${templateId}/preview?draft=${draft.id}`,
    req.url
  ),
  { status: 303 }
);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to analyze template with AI",
      },
      { status: 500 }
    );
  }
}