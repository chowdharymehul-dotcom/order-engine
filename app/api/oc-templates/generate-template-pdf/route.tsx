import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const A4_WIDTH = 595;
const A4_HEIGHT = 842;

const MASK_PADDING_X = 10;
const MASK_PADDING_Y = 6;

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function isDynamicField(row: any) {
  const mappedTo = String(
    row?.mapped_to ||
      row?.source_field ||
      row?.field_name ||
      row?.total_key ||
      row?.block_key ||
      ""
  );

  return (
    mappedTo.startsWith("seller.") ||
    mappedTo.startsWith("customer.") ||
    mappedTo.startsWith("agent.") ||
    mappedTo.startsWith("order.") ||
    mappedTo.startsWith("item.") ||
    mappedTo.startsWith("manual.")
  );
}

function topFromY(y: any, height = 0) {
  return A4_HEIGHT - Number(y || 0) - Number(height || 0);
}

function rectToSvg(row: any, fallbackWidth = 180, fallbackHeight = 16) {
  const x = Number(row.x_position || 0);
  const y = Number(row.y_position || 0);
  const width = Number(row.width || fallbackWidth);
  const height = Number(row.height || fallbackHeight);

  const left = Math.max(0, x - MASK_PADDING_X);
  const top = Math.max(0, topFromY(y, height) - MASK_PADDING_Y);
  const finalWidth = Math.min(A4_WIDTH - left, width + MASK_PADDING_X * 2);
  const finalHeight = Math.min(A4_HEIGHT - top, height + MASK_PADDING_Y * 2);

  return `<rect x="${left}" y="${top}" width="${finalWidth}" height="${finalHeight}" fill="white" />`;
}

function logoToSvg(row: any) {
  return rectToSvg(row, 100, 50);
}

function columnToSvg(column: any, columnIndex: number) {
  const x = Number(column.x_position || 35 + columnIndex * 65);
  const y = Number(column.y_position || 309);
  const width = Number(column.width || 65);
  const height = Number(column.height || 111);

  return rectToSvg(
    {
      x_position: x,
      y_position: y,
      width,
      height,
    },
    65,
    111
  );
}

function buildMaskSvg(analysis: any) {
  const logos = asArray(analysis.logos);
  const fields = asArray(analysis.fields);
  const columns = asArray(analysis.columns);
  const totals = asArray(analysis.totals);

  const rects = [
    ...logos.map((logo: any) => logoToSvg(logo)),
    ...fields
      .filter((field: any) => isDynamicField(field))
      .map((field: any) =>
        rectToSvg(field, 240, Number(field.font_size || 10) + 12)
      ),
    ...columns.map((column: any, index: number) => columnToSvg(column, index)),
    ...totals
      .filter((total: any) => isDynamicField(total))
      .map((total: any) =>
        rectToSvg(total, 220, Number(total.font_size || 10) + 12)
      ),
  ].join("\n");

  return `
<svg width="${A4_WIDTH}" height="${A4_HEIGHT}" viewBox="0 0 ${A4_WIDTH} ${A4_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${rects}
</svg>`;
}

async function downloadBuffer(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function makeMaskedPng(params: {
  backgroundImageUrl: string;
  analysis: any;
}) {
  const { backgroundImageUrl, analysis } = params;

  const backgroundBuffer = await downloadBuffer(backgroundImageUrl);

  const resizedBackground = await sharp(backgroundBuffer)
    .resize(A4_WIDTH, A4_HEIGHT, {
      fit: "fill",
    })
    .png()
    .toBuffer();

  const maskSvg = buildMaskSvg(analysis);
  const maskBuffer = Buffer.from(maskSvg);

  return sharp(resizedBackground)
    .composite([
      {
        input: maskBuffer,
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const templateId = value(formData, "template_id");
    const draftId = value(formData, "draft_id");

    if (!templateId || !draftId) {
      return NextResponse.json(
        { ok: false, error: "Missing template or draft ID" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: draft, error: draftError } = await supabase
      .from("oc_template_ai_drafts")
      .select("id, analysis, image_url")
      .eq("id", draftId)
      .eq("template_id", templateId)
      .maybeSingle();

    if (draftError || !draft) {
      return NextResponse.json(
        { ok: false, error: draftError?.message || "Draft not found" },
        { status: 404 }
      );
    }

    if (!draft.image_url) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This draft does not have an original image background. Please run Analyze With AI again.",
        },
        { status: 400 }
      );
    }

    const maskedPng = await makeMaskedPng({
      backgroundImageUrl: draft.image_url,
      analysis: draft.analysis || {},
    });

    const path = `generated-template-pdfs/${templateId}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("oc-documents")
      .upload(path, maskedPng, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("oc-documents")
      .getPublicUrl(path);

    const imageUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("oc_templates")
      .update({
        template_status: "pending_approval",
        approved_template_json: draft.analysis || {},
        approved_pdf_url: imageUrl,
      })
      .eq("id", templateId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL(`/oc-templates/${templateId}/preview?draft=${draftId}`, req.url),
      { status: 303 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to generate template image" },
      { status: 500 }
    );
  }
}