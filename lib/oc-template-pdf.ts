import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Template = {
  id: string;
  template_url: string | null;
  storage_path: string | null;
  template_type: string | null;
  default_font?: string | null;
  default_font_size?: number | null;
  default_text_color?: string | null;
};

type Mapping = {
  id?: string;
  field_name: string | null;
  display_label?: string | null;
  field_type?: string | null;
  page_number?: number | null;
  x_position: number | null;
  y_position: number | null;
  width?: number | null;
  height?: number | null;
  x_percent?: number | null;
  y_percent?: number | null;
  width_percent?: number | null;
  height_percent?: number | null;
  font_size?: number | null;
  font_color?: string | null;
  preview_text?: string | null;
  content?: string | null;
  background_fill?: string | null;
  background_width?: number | null;
  background_height?: number | null;
};

type TemplateColumn = {
  id?: string;
  display_label: string | null;
  source_field: string | null;
  column_order: number | null;
  mapped_to?: string | null;
  preview_text?: string | null;
  x_position?: number | null;
  y_position?: number | null;
  width?: number | null;
  height?: number | null;
  x_percent?: number | null;
  y_percent?: number | null;
  width_percent?: number | null;
  height_percent?: number | null;
  font_size?: number | null;
  font_color?: string | null;
  row_height?: number | null;
};

type SellerProfile = {
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website?: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  pan_number?: string | null;
  iec_number?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  swift_code?: string | null;
  ifsc_code?: string | null;
  logo_url?: string | null;
};

type Customer = {
  company_name: string | null;
  contact_person?: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  iec_number?: string | null;
};

type OrderConfirmation = {
  id: string;
  oc_number: string | null;
  oc_date: string | null;
  po_number: string | null;
  po_date?: string | null;
  reference?: string | null;
  delivery_date: string | null;
  payment_terms: string | null;
  shipment_terms: string | null;
  shipping_address?: string | null;
  shipping_instructions?: string | null;
  attention_of?: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  total_amount?: string | number | null;
};

type OCLineItem = {
  id: string;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  currency: string | null;
  line_total: number | null;
  notes: string | null;
  custom_fields: Record<string, any> | null;
};

type AIAnalysis = {
  fields?: any[];
  columns?: any[];
  totals?: any[];
  logos?: any[];
  static_blocks?: any[];
  lines?: any[];
  rectangles?: any[];
  table_borders?: any[];
};

type GenerateTemplatePdfParams = {
  template: Template;
  mappings?: Mapping[];
  columns?: TemplateColumn[];
  seller: SellerProfile | null;
  customer: Customer | null;
  oc: OrderConfirmation;
  lineItems: OCLineItem[];
  templateBytes: ArrayBuffer;
  analysis?: AIAnalysis | null;
};

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function numberOrFallback(value: any, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function percentOrNull(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function fromPercentOrValue(params: {
  percent: any;
  value: any;
  pageSize: number;
  fallback: number;
}) {
  const percent = percentOrNull(params.percent);

  if (percent !== null) {
    return percent * params.pageSize;
  }

  return numberOrFallback(params.value, params.fallback);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return clean(value);

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function joinAddress(parts: Array<string | null | undefined>) {
  return parts.map(clean).filter(Boolean).join(", ");
}

function hexToRgb(hex: string | null | undefined) {
  const value = clean(hex || "#000000").replace("#", "");

  if (value.length !== 6) return rgb(0, 0, 0);

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  return rgb(r, g, b);
}

function getFontName(fontName: string | null | undefined) {
  const name = clean(fontName).toLowerCase();

  if (name.includes("times")) return StandardFonts.TimesRoman;
  if (name.includes("courier")) return StandardFonts.Courier;
  if (name.includes("helvetica")) return StandardFonts.Helvetica;

  return StandardFonts.Helvetica;
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

function overrideText(row: any) {
  return clean(row?.preview_text);
}

function normalizeMappedPath(path: string) {
  const value = clean(path);

  const legacyMap: Record<string, string> = {
    company_name: "seller.company_name",
    seller_name: "seller.company_name",
    seller_email: "seller.email",
    seller_phone: "seller.phone",
    seller_website: "seller.website",
    seller_address: "seller.address",
    seller_gst: "seller.gst_no",
    seller_pan: "seller.pan_number",
    seller_iec: "seller.iec_number",
    customer_name: "customer.name",
    customer_contact: "customer.contact_person",
    customer_email: "customer.email",
    customer_phone: "customer.phone",
    customer_address: "customer.address",
    customer_gst: "customer.gst_number",
    customer_pan: "customer.pan_number",
    customer_iec: "customer.iec_number",
    oc_number: "order.oc_number",
    oc_date: "order.oc_date",
    po_number: "order.po_number",
    delivery_date: "order.delivery_date",
    payment_terms: "order.payment_terms",
    shipment_terms: "order.shipment_terms",
    internal_notes: "order.internal_notes",
    customer_notes: "order.customer_notes",
  };

  return legacyMap[value] || value;
}

function getPathValue(params: {
  path: string;
  seller: SellerProfile | null;
  customer: Customer | null;
  oc: OrderConfirmation;
}) {
  const { path, seller, customer, oc } = params;
  const mapped = normalizeMappedPath(path);

  const sellerAddress = joinAddress([
    seller?.address_line_1,
    seller?.address_line_2,
    seller?.city,
    seller?.state,
    seller?.postal_code,
    seller?.country,
  ]);

  const customerAddress = joinAddress([
    customer?.address_line_1,
    customer?.address_line_2,
    customer?.city,
    customer?.state,
    customer?.postal_code,
    customer?.country,
  ]);

  const values: Record<string, string> = {
    "seller.company_name": clean(seller?.company_name),
    "seller.address": sellerAddress,
    "seller.email": clean(seller?.email),
    "seller.phone": clean(seller?.phone),
    "seller.website": clean(seller?.website),
    "seller.gst_no": clean(seller?.gst_number),
    "seller.pan_number": clean(seller?.pan_number),
    "seller.iec_number": clean(seller?.iec_number),
    "seller.bank_name": clean(seller?.bank_name),
    "seller.account_name": clean(seller?.account_name),
    "seller.account_number": clean(seller?.account_number),
    "seller.swift_code": clean(seller?.swift_code),
    "seller.ifsc_code": clean(seller?.ifsc_code),

    "customer.name": clean(customer?.company_name),
    "customer.company_name": clean(customer?.company_name),
    "customer.contact_person": clean(customer?.contact_person),
    "customer.address": customerAddress,
    "customer.email": clean(customer?.email),
    "customer.phone": clean(customer?.phone),
    "customer.country": clean(customer?.country),
    "customer.gst_number": clean(customer?.gst_number),
    "customer.pan_number": clean(customer?.pan_number),
    "customer.iec_number": clean(customer?.iec_number),

    "agent.name": "CHIH FAN TEXTILE CO. LTD.(A)",
    "agent.company": "CHIH FAN TEXTILE CO. LTD.(A)",

    "order.oc_number": clean(oc.oc_number),
    "order.oc_date": formatDate(oc.oc_date),
    "order.po_number": clean(oc.po_number),
    "order.po_date": formatDate(oc.po_date),
    "order.reference": clean(oc.reference),
    "order.delivery_date": formatDate(oc.delivery_date),
    "order.payment_terms": clean(oc.payment_terms),
    "order.shipment_terms": clean(oc.shipment_terms),
    "order.shipping_address": clean(oc.shipping_address),
    "order.shipping_instructions": clean(oc.shipping_instructions),
    "order.attention_of": clean(oc.attention_of),
    "order.internal_notes": clean(oc.internal_notes),
    "order.customer_notes": clean(oc.customer_notes),
    "order.notes": clean(oc.customer_notes || oc.internal_notes),
    "order.total_amount": clean(oc.total_amount),

    "manual.agent_name": "CHIH FAN TEXTILE CO. LTD.(A)",
    "manual.attention_of": clean(oc.attention_of),
    "manual.notes": clean(oc.customer_notes || oc.internal_notes),
    "manual.custom_text": "",
  };

  return values[mapped] || "";
}

function getLineValue(line: OCLineItem, sourceField: string | null | undefined) {
  const field = normalizeMappedPath(clean(sourceField));

  if (!field) return "";

  if (field === "item.sku" || field === "sku") return clean(line.sku);
  if (field === "item.quantity" || field === "quantity")
    return clean(line.quantity);
  if (field === "item.unit_price" || field === "unit_price")
    return clean(line.unit_price);
  if (field === "item.currency" || field === "currency")
    return clean(line.currency);
  if (field === "item.amount" || field === "line_total")
    return clean(line.line_total);
  if (field === "item.notes" || field === "notes") return clean(line.notes);

  if (field === "item.article_no") {
    return clean(line.custom_fields?.article_no || line.sku);
  }

  if (field === "item.color") return clean(line.custom_fields?.color);
  if (field === "item.color_no") return clean(line.custom_fields?.color_no);
  if (field === "item.size") return clean(line.custom_fields?.size);
  if (field === "item.width") return clean(line.custom_fields?.width);
  if (field === "item.piece_length")
    return clean(line.custom_fields?.piece_length);

  if (field.startsWith("custom.")) {
    const key = field.replace("custom.", "");
    return clean(line.custom_fields?.[key]);
  }

  if (field.startsWith("item.")) {
    const key = field.replace("item.", "");
    return clean(line.custom_fields?.[key]);
  }

  return "";
}

function mappingFromAnalysisItem(params: {
  item: any;
  index: number;
  pageWidth: number;
  pageHeight: number;
  type: "field" | "total";
}) {
  const { item, index, pageWidth, pageHeight, type } = params;
  const mapped = mappedValue(item);
  const preview = overrideText(item);

  return {
    id: `ai-${type}-${index}`,
    field_name: mapped || `manual.override_${type}_${index}`,
    display_label: clean(item.display_label),
    field_type: type === "total" ? "system" : clean(item.field_type || "system"),
    page_number: Number(item.page_number || 1),
    x_position: fromPercentOrValue({
      percent: item.x_percent,
      value: item.x_position,
      pageSize: pageWidth,
      fallback: 0,
    }),
    y_position: fromPercentOrValue({
      percent: item.y_percent,
      value: item.y_position,
      pageSize: pageHeight,
      fallback: 0,
    }),
    width: fromPercentOrValue({
      percent: item.width_percent,
      value: item.width,
      pageSize: pageWidth,
      fallback: 180,
    }),
    height: fromPercentOrValue({
      percent: item.height_percent,
      value: item.height,
      pageSize: pageHeight,
      fallback: 18,
    }),
    font_size: numberOrFallback(item.font_size, 8),
    font_color: clean(item.font_color || ""),
    preview_text: preview,
    background_fill: null,
    background_width: fromPercentOrValue({
      percent: item.width_percent,
      value: item.width || item.background_width,
      pageSize: pageWidth,
      fallback: 180,
    }),
    background_height: fromPercentOrValue({
      percent: item.height_percent,
      value: item.height || item.background_height,
      pageSize: pageHeight,
      fallback: 18,
    }),
  } as Mapping;
}

function analysisFieldsToMappings(
  analysis: AIAnalysis | null | undefined,
  pageWidth: number,
  pageHeight: number
) {
  return asArray(analysis?.fields)
    .filter((field: any) => mappedValue(field) || overrideText(field))
    .map((field: any, index: number) =>
      mappingFromAnalysisItem({
        item: field,
        index,
        pageWidth,
        pageHeight,
        type: "field",
      })
    ) as Mapping[];
}

function analysisTotalsToMappings(
  analysis: AIAnalysis | null | undefined,
  pageWidth: number,
  pageHeight: number
) {
  return asArray(analysis?.totals)
    .filter((total: any) => mappedValue(total) || overrideText(total))
    .map((total: any, index: number) =>
      mappingFromAnalysisItem({
        item: total,
        index,
        pageWidth,
        pageHeight,
        type: "total",
      })
    ) as Mapping[];
}

function analysisColumnsToColumns(
  analysis: AIAnalysis | null | undefined,
  pageWidth: number,
  pageHeight: number
) {
  return asArray(analysis?.columns)
    .filter((column: any) => mappedValue(column) || overrideText(column))
    .map((column: any, index: number) => {
      const mapped = mappedValue(column);
      const preview = overrideText(column);

      return {
        id: `ai-column-${index}`,
        display_label: clean(column.display_label),
        source_field: mapped || `manual.override_column_${index}`,
        column_order: Number(column.column_order || index + 1),
        mapped_to: mapped || `manual.override_column_${index}`,
        preview_text: preview,
        x_position: fromPercentOrValue({
          percent: column.x_percent,
          value: column.x_position,
          pageSize: pageWidth,
          fallback: 35 + index * 65,
        }),
        y_position: fromPercentOrValue({
          percent: column.y_percent,
          value: column.y_position,
          pageSize: pageHeight,
          fallback: 395,
        }),
        width: fromPercentOrValue({
          percent: column.width_percent,
          value: column.width,
          pageSize: pageWidth,
          fallback: 70,
        }),
        height: fromPercentOrValue({
          percent: column.height_percent,
          value: column.height,
          pageSize: pageHeight,
          fallback: 20,
        }),
        row_height: numberOrFallback(column.row_height, column.height || 20),
        font_size: numberOrFallback(column.font_size, 8),
        font_color: clean(column.font_color || ""),
      };
    }) as TemplateColumn[];
}

function drawStaticBlocks(params: {
  pages: ReturnType<PDFDocument["getPages"]>;
  analysis: AIAnalysis | null | undefined;
  font: any;
  defaultFontSize: number;
  defaultColor: any;
}) {
  const { pages, analysis, font, defaultFontSize, defaultColor } = params;

  const blocks = asArray(analysis?.static_blocks);

  for (const block of blocks) {
    const content =
      clean(block.content) ||
      clean(block.preview_text) ||
      clean(block.display_label) ||
      clean(block.block_key);

    if (!content) continue;

    const pageIndex = Math.max(Number(block.page_number || 1) - 1, 0);
    const page = pages[pageIndex] || pages[0];

    if (!page) continue;

    const pageSize = page.getSize();

    const x = fromPercentOrValue({
      percent: block.x_percent,
      value: block.x_position,
      pageSize: pageSize.width,
      fallback: 0,
    });

    const y = fromPercentOrValue({
      percent: block.y_percent,
      value: block.y_position,
      pageSize: pageSize.height,
      fallback: 0,
    });

    const width = fromPercentOrValue({
      percent: block.width_percent,
      value: block.width,
      pageSize: pageSize.width,
      fallback: 180,
    });

    const height = fromPercentOrValue({
      percent: block.height_percent,
      value: block.height,
      pageSize: pageSize.height,
      fallback: 18,
    });

    const size = numberOrFallback(block.font_size, defaultFontSize);
    const color = block.font_color ? hexToRgb(block.font_color) : defaultColor;

    const shouldCover =
      block.cover_background === true ||
      block.cover_background === "true" ||
      block.cover_background === "1" ||
      block.background_fill ||
      block.fill_color;

    if (shouldCover) {
      page.drawRectangle({
        x,
        y: y - 3,
        width,
        height: Math.max(height, size + 6),
        color: hexToRgb(
          clean(block.background_fill || block.fill_color || "#ffffff")
        ),
      });
    }

    page.drawText(content, {
      x,
      y,
      size,
      font,
      color,
      maxWidth: width,
      lineHeight: size + 2,
    });
  }
}

function drawRectangles(params: {
  pages: ReturnType<PDFDocument["getPages"]>;
  analysis: AIAnalysis | null | undefined;
}) {
  const { pages, analysis } = params;

  for (const rectangle of asArray(analysis?.rectangles)) {
    const pageIndex = Math.max(Number(rectangle.page_number || 1) - 1, 0);
    const page = pages[pageIndex] || pages[0];
    if (!page) continue;

    const pageSize = page.getSize();

    const x = fromPercentOrValue({
      percent: rectangle.x_percent,
      value: rectangle.x_position,
      pageSize: pageSize.width,
      fallback: 0,
    });

    const y = fromPercentOrValue({
      percent: rectangle.y_percent,
      value: rectangle.y_position,
      pageSize: pageSize.height,
      fallback: 0,
    });

    const width = fromPercentOrValue({
      percent: rectangle.width_percent,
      value: rectangle.width,
      pageSize: pageSize.width,
      fallback: 100,
    });

    const height = fromPercentOrValue({
      percent: rectangle.height_percent,
      value: rectangle.height,
      pageSize: pageSize.height,
      fallback: 50,
    });

    const borderWidth = numberOrFallback(rectangle.border_thickness, 1);
    const borderColor = hexToRgb(rectangle.border_color || "#111827");

    const fill = clean(rectangle.fill_color);

    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth,
      borderColor,
      color:
        fill && fill !== "transparent" ? hexToRgb(fill) : undefined,
    });
  }
}

function drawTableBorders(params: {
  pages: ReturnType<PDFDocument["getPages"]>;
  analysis: AIAnalysis | null | undefined;
}) {
  const { pages, analysis } = params;

  for (const table of asArray(analysis?.table_borders)) {
    const pageIndex = Math.max(Number(table.page_number || 1) - 1, 0);
    const page = pages[pageIndex] || pages[0];
    if (!page) continue;

    const pageSize = page.getSize();

    const x = fromPercentOrValue({
      percent: table.x_percent,
      value: table.x_position,
      pageSize: pageSize.width,
      fallback: 0,
    });

    const y = fromPercentOrValue({
      percent: table.y_percent,
      value: table.y_position,
      pageSize: pageSize.height,
      fallback: 0,
    });

    const width = fromPercentOrValue({
      percent: table.width_percent,
      value: table.width,
      pageSize: pageSize.width,
      fallback: 100,
    });

    const height = fromPercentOrValue({
      percent: table.height_percent,
      value: table.height,
      pageSize: pageSize.height,
      fallback: 50,
    });

    const borderWidth = numberOrFallback(table.border_thickness, 1);
    const borderColor = hexToRgb(table.border_color || "#111827");

    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth,
      borderColor,
    });
  }
}

function drawLines(params: {
  pages: ReturnType<PDFDocument["getPages"]>;
  analysis: AIAnalysis | null | undefined;
}) {
  const { pages, analysis } = params;

  for (const line of asArray(analysis?.lines)) {
    const pageIndex = Math.max(Number(line.page_number || 1) - 1, 0);
    const page = pages[pageIndex] || pages[0];
    if (!page) continue;

    const pageSize = page.getSize();

    const x1 = fromPercentOrValue({
      percent: line.x1_percent,
      value: line.x1,
      pageSize: pageSize.width,
      fallback: 0,
    });

    const y1 = fromPercentOrValue({
      percent: line.y1_percent,
      value: line.y1,
      pageSize: pageSize.height,
      fallback: 0,
    });

    const x2 = fromPercentOrValue({
      percent: line.x2_percent,
      value: line.x2,
      pageSize: pageSize.width,
      fallback: 100,
    });

    const y2 = fromPercentOrValue({
      percent: line.y2_percent,
      value: line.y2,
      pageSize: pageSize.height,
      fallback: 0,
    });

    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: numberOrFallback(line.thickness, 1),
      color: hexToRgb(line.color || "#111827"),
    });
  }
}

export async function generateTemplateOCPdfBuffer(
  params: GenerateTemplatePdfParams
) {
  const {
    template,
    seller,
    customer,
    oc,
    lineItems,
    templateBytes,
    analysis = null,
  } = params;

  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const firstPageSize = pages[0]?.getSize() || { width: 595, height: 842 };

  const pageWidth = firstPageSize.width;
  const pageHeight = firstPageSize.height;

  const mappings =
    analysis &&
    (asArray(analysis.fields).length > 0 || asArray(analysis.totals).length > 0)
      ? [
          ...analysisFieldsToMappings(analysis, pageWidth, pageHeight),
          ...analysisTotalsToMappings(analysis, pageWidth, pageHeight),
        ]
      : params.mappings || [];

  const columns =
    analysis && asArray(analysis.columns).length > 0
      ? analysisColumnsToColumns(analysis, pageWidth, pageHeight)
      : params.columns || [];

  const font = await pdfDoc.embedFont(getFontName(template.default_font));
  const defaultFontSize = Number(template.default_font_size || 8);
  const defaultColor = hexToRgb(template.default_text_color);

  drawRectangles({
    pages,
    analysis,
  });

  drawTableBorders({
    pages,
    analysis,
  });

  drawLines({
    pages,
    analysis,
  });

  drawStaticBlocks({
    pages,
    analysis,
    font,
    defaultFontSize,
    defaultColor,
  });

  for (const mapping of mappings) {
    const fieldName = clean(mapping.field_name);

    if (!fieldName || fieldName === "sku_table") continue;

    const pageIndex = Math.max(Number(mapping.page_number || 1) - 1, 0);
    const page = pages[pageIndex] || pages[0];

    if (!page) continue;

    const pageSize = page.getSize();

    const x = fromPercentOrValue({
      percent: mapping.x_percent,
      value: mapping.x_position,
      pageSize: pageSize.width,
      fallback: 0,
    });

    const y = fromPercentOrValue({
      percent: mapping.y_percent,
      value: mapping.y_position,
      pageSize: pageSize.height,
      fallback: 0,
    });

    const width = fromPercentOrValue({
      percent: mapping.width_percent,
      value: mapping.width || mapping.background_width,
      pageSize: pageSize.width,
      fallback: 180,
    });

    const size = Number(mapping.font_size || defaultFontSize);
    const color = mapping.font_color
      ? hexToRgb(mapping.font_color)
      : defaultColor;

    const text =
      clean(mapping.preview_text) ||
      getPathValue({
        path: fieldName,
        seller,
        customer,
        oc,
      });

    if (!text) continue;

    page.drawText(text, {
      x,
      y,
      size,
      font,
      color,
      maxWidth: width,
      lineHeight: size + 2,
    });
  }

  if (columns.length > 0 && lineItems.length > 0) {
    const sortedColumns = [...columns].sort(
      (a, b) => Number(a.column_order || 0) - Number(b.column_order || 0)
    );

    sortedColumns.forEach((column) => {
      const page = pages[0];
      if (!page) return;

      const pageSize = page.getSize();

      const x = fromPercentOrValue({
        percent: column.x_percent,
        value: column.x_position,
        pageSize: pageSize.width,
        fallback: 50,
      });

      const startY = fromPercentOrValue({
        percent: column.y_percent,
        value: column.y_position,
        pageSize: pageSize.height,
        fallback: 395,
      });

      const width = fromPercentOrValue({
        percent: column.width_percent,
        value: column.width,
        pageSize: pageSize.width,
        fallback: 70,
      });

      const fontSize = Number(column.font_size || 8);
      const rowHeight = Number(column.row_height || column.height || 20);
      const color = column.font_color
        ? hexToRgb(column.font_color)
        : defaultColor;

      lineItems.forEach((line, rowIndex) => {
        const text =
          clean(column.preview_text) ||
          getLineValue(line, column.mapped_to || column.source_field);

        if (!text) return;

        page.drawText(text, {
          x,
          y: startY - rowIndex * rowHeight,
          size: fontSize,
          font,
          color,
          maxWidth: width,
        });
      });
    });
  }

  const pdfBytes = await pdfDoc.save();

  return Buffer.from(pdfBytes);
}