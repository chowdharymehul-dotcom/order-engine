import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Template = {
  id: string;
  template_url: string | null;
  storage_path: string | null;
  template_type: string | null;
  default_font: string | null;
  default_font_size: number | null;
  default_text_color: string | null;
};

type Mapping = {
  id: string;
  field_name: string | null;
  display_label: string | null;
  field_type: string | null;
  page_number: number | null;
  x_position: number | null;
  y_position: number | null;
  font_size: number | null;
  background_fill: string | null;
  background_width: number | null;
  background_height: number | null;
};

type TemplateColumn = {
  id: string;
  display_label: string | null;
  source_field: string | null;
  column_order: number | null;
};

type SellerProfile = {
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;
};

type Customer = {
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  iec_number: string | null;
};

type OrderConfirmation = {
  id: string;
  oc_number: string | null;
  oc_date: string | null;
  po_number: string | null;
  delivery_date: string | null;
  payment_terms: string | null;
  shipment_terms: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
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

type GenerateTemplatePdfParams = {
  template: Template;
  mappings: Mapping[];
  columns: TemplateColumn[];
  seller: SellerProfile | null;
  customer: Customer | null;
  oc: OrderConfirmation;
  lineItems: OCLineItem[];
  templateBytes: ArrayBuffer;
};

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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

function mappingValue(params: {
  fieldName: string;
  seller: SellerProfile | null;
  customer: Customer | null;
  oc: OrderConfirmation;
}) {
  const { fieldName, seller, customer, oc } = params;

  const customerAddress = joinAddress([
    customer?.address_line_1,
    customer?.address_line_2,
    customer?.city,
    customer?.state,
    customer?.country,
    customer?.postal_code,
  ]);

  const sellerAddress = joinAddress([
    seller?.address_line_1,
    seller?.address_line_2,
    seller?.city,
    seller?.state,
    seller?.country,
    seller?.postal_code,
  ]);

  const values: Record<string, string> = {
    company_name: clean(seller?.company_name),
    seller_name: clean(seller?.company_name),
    seller_email: clean(seller?.email),
    seller_phone: clean(seller?.phone),
    seller_website: clean(seller?.website),
    seller_address: sellerAddress,
    seller_gst: clean(seller?.gst_number),
    seller_pan: clean(seller?.pan_number),
    seller_iec: clean(seller?.iec_number),

    customer_name: clean(customer?.company_name),
    customer_contact: clean(customer?.contact_person),
    customer_email: clean(customer?.email),
    customer_phone: clean(customer?.phone),
    customer_address: customerAddress,
    customer_gst: clean(customer?.gst_number),
    customer_pan: clean(customer?.pan_number),
    customer_iec: clean(customer?.iec_number),

    oc_number: clean(oc.oc_number),
    oc_date: formatDate(oc.oc_date),
    po_number: clean(oc.po_number),
    delivery_date: formatDate(oc.delivery_date),
    payment_terms: clean(oc.payment_terms),
    shipment_terms: clean(oc.shipment_terms),
    internal_notes: clean(oc.internal_notes),
    customer_notes: clean(oc.customer_notes),
  };

  return values[fieldName] || "";
}

function getLineValue(line: OCLineItem, sourceField: string | null | undefined) {
  const field = clean(sourceField);

  if (!field) return "";

  if (field === "sku") return clean(line.sku);
  if (field === "quantity") return clean(line.quantity);
  if (field === "unit_price") return clean(line.unit_price);
  if (field === "currency") return clean(line.currency);
  if (field === "line_total") return clean(line.line_total);
  if (field === "notes") return clean(line.notes);

  if (field.startsWith("custom.")) {
    const key = field.replace("custom.", "");
    return clean(line.custom_fields?.[key]);
  }

  return "";
}

export async function generateTemplateOCPdfBuffer(
  params: GenerateTemplatePdfParams
) {
  const {
    template,
    mappings,
    columns,
    seller,
    customer,
    oc,
    lineItems,
    templateBytes,
  } = params;

  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();

  const font = await pdfDoc.embedFont(getFontName(template.default_font));
  const defaultFontSize = Number(template.default_font_size || 10);
  const defaultColor = hexToRgb(template.default_text_color);

  for (const mapping of mappings) {
    const fieldName = clean(mapping.field_name);

    if (!fieldName || fieldName === "sku_table") continue;

    const pageIndex = Math.max(Number(mapping.page_number || 1) - 1, 0);
    const page = pages[pageIndex] || pages[0];

    const x = Number(mapping.x_position || 0);
    const y = Number(mapping.y_position || 0);
    const size = Number(mapping.font_size || defaultFontSize);

    const text = mappingValue({
      fieldName,
      seller,
      customer,
      oc,
    });

    if (!text) continue;

    if (
      template.template_type === "sample" &&
      mapping.background_fill === "white"
    ) {
      page.drawRectangle({
        x,
        y: y - 2,
        width: Number(mapping.background_width || 150),
        height: Number(mapping.background_height || size + 6),
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });
    }

    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: defaultColor,
    });
  }

  const tableMapping = mappings.find(
    (mapping) => mapping.field_name === "sku_table"
  );

  if (tableMapping && columns.length > 0 && lineItems.length > 0) {
    const pageIndex = Math.max(Number(tableMapping.page_number || 1) - 1, 0);
    const page = pages[pageIndex] || pages[0];

    const startX = Number(tableMapping.x_position || 50);
    const startY = Number(tableMapping.y_position || 500);
    const fontSize = Number(tableMapping.font_size || defaultFontSize);
    const rowHeight = fontSize + 8;
    const columnWidth = 90;

    const sortedColumns = [...columns].sort(
      (a, b) => Number(a.column_order || 0) - Number(b.column_order || 0)
    );

    sortedColumns.forEach((column, columnIndex) => {
      page.drawText(clean(column.display_label), {
        x: startX + columnIndex * columnWidth,
        y: startY,
        size: fontSize,
        font,
        color: defaultColor,
      });
    });

    lineItems.forEach((line, rowIndex) => {
      const y = startY - (rowIndex + 1) * rowHeight;

      sortedColumns.forEach((column, columnIndex) => {
        const text = getLineValue(line, column.source_field);

        page.drawText(text, {
          x: startX + columnIndex * columnWidth,
          y,
          size: fontSize,
          font,
          color: defaultColor,
        });
      });
    });
  }

  const pdfBytes = await pdfDoc.save();

  return Buffer.from(pdfBytes);
}