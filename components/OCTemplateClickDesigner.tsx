"use client";

import { useMemo, useState } from "react";

type Template = {
  id: string;
  template_url: string | null;
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
};

type TemplateColumn = {
  id: string;
  display_label: string | null;
  source_field: string | null;
  column_order: number | null;
};

type TemplateRegion = {
  id: string;
  region_name: string | null;
  display_label: string | null;
  region_type: string | null;
  page_number: number | null;
  x_position: number | null;
  y_position: number | null;
  width: number | null;
  height: number | null;
  row_height: number | null;
  column_gap: number | null;
};

type OCTemplateClickDesignerProps = {
  template: Template;
  mappings: Mapping[];
  columns: TemplateColumn[];
  regions?: TemplateRegion[];
};

const DESIGN_WIDTH = 595;
const DESIGN_HEIGHT = 842;

const systemFields = [
  { field_name: "company_name", display_label: "Company Name" },
  { field_name: "customer_name", display_label: "Customer Name / Messrs" },
  { field_name: "customer_email", display_label: "Customer Email" },
  { field_name: "oc_number", display_label: "OC Number" },
  { field_name: "oc_date", display_label: "OC Date" },
  { field_name: "po_number", display_label: "PO Number" },
  { field_name: "delivery_date", display_label: "Delivery Date" },
  { field_name: "payment_terms", display_label: "Payment Terms" },
  { field_name: "shipment_terms", display_label: "Shipment Terms" },
  { field_name: "customer_notes", display_label: "Customer Notes" },
  { field_name: "sku_table", display_label: "SKU Table Start" },
];

const sourceFields = [
  { value: "sku", label: "SKU" },
  { value: "quantity", label: "Quantity" },
  { value: "unit_price", label: "Unit Price" },
  { value: "currency", label: "Currency" },
  { value: "line_total", label: "Line Total" },
  { value: "notes", label: "Notes" },
  { value: "custom.color", label: "Custom: Color" },
  { value: "custom.style_no", label: "Custom: Style No" },
  { value: "custom.season", label: "Custom: Season" },
  { value: "custom.delivery_date", label: "Custom: Delivery Date" },
  { value: "custom.buyer_ref", label: "Custom: Buyer Ref" },
  { value: "custom.composition", label: "Custom: Composition" },
];

const regionOptions = [
  {
    region_name: "header_region",
    display_label: "Header Region",
    region_type: "header",
  },
  {
    region_name: "customer_region",
    display_label: "Customer / Messrs Region",
    region_type: "data",
  },
  {
    region_name: "shipping_region",
    display_label: "Shipping Region",
    region_type: "data",
  },
  {
    region_name: "bank_region",
    display_label: "Bank Details Region",
    region_type: "data",
  },
  {
    region_name: "table_region",
    display_label: "Item Table Region",
    region_type: "table",
  },
  {
    region_name: "totals_region",
    display_label: "Totals Region",
    region_type: "totals",
  },
  {
    region_name: "footer_region",
    display_label: "Footer / Notes Region",
    region_type: "footer",
  },
  {
    region_name: "signature_region",
    display_label: "Signature Region",
    region_type: "signature",
  },
  {
    region_name: "custom_visual_region",
    display_label: "Custom Region",
    region_type: "custom",
  },
];

function mappingFor(mappings: Mapping[], fieldName: string) {
  return mappings.find((mapping) => mapping.field_name === fieldName) || null;
}

function normalizeCustomKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function displayFieldName(fieldName: string, displayLabel?: string | null) {
  if (displayLabel) return displayLabel;
  return fieldName;
}

function regionColor(regionType: string | null | undefined) {
  if (regionType === "header") return "rgba(37, 99, 235, 0.25)";
  if (regionType === "data") return "rgba(22, 163, 74, 0.25)";
  if (regionType === "table") return "rgba(249, 115, 22, 0.25)";
  if (regionType === "totals") return "rgba(147, 51, 234, 0.25)";
  if (regionType === "footer") return "rgba(220, 38, 38, 0.25)";
  if (regionType === "signature") return "rgba(107, 114, 128, 0.25)";
  return "rgba(17, 24, 39, 0.2)";
}

function regionBorder(regionType: string | null | undefined) {
  if (regionType === "header") return "rgb(37, 99, 235)";
  if (regionType === "data") return "rgb(22, 163, 74)";
  if (regionType === "table") return "rgb(249, 115, 22)";
  if (regionType === "totals") return "rgb(147, 51, 234)";
  if (regionType === "footer") return "rgb(220, 38, 38)";
  if (regionType === "signature") return "rgb(107, 114, 128)";
  return "rgb(17, 24, 39)";
}

function pdfToPercentX(x: number | null | undefined) {
  return ((Number(x || 0) / DESIGN_WIDTH) * 100).toFixed(4);
}

function pdfToPercentY(y: number | null | undefined) {
  return (100 - (Number(y || 0) / DESIGN_HEIGHT) * 100).toFixed(4);
}

function pdfToPercentWidth(width: number | null | undefined) {
  return ((Number(width || 0) / DESIGN_WIDTH) * 100).toFixed(4);
}

function pdfToPercentHeight(height: number | null | undefined) {
  return ((Number(height || 0) / DESIGN_HEIGHT) * 100).toFixed(4);
}

export default function OCTemplateClickDesigner({
  template,
  mappings,
  columns,
  regions = [],
}: OCTemplateClickDesignerProps) {
  const customMappings = mappings.filter(
    (mapping) => mapping.field_type === "custom"
  );

  const initialField = systemFields[0].field_name;

  const [mode, setMode] = useState<"field" | "region">("field");

  const [selectedField, setSelectedField] = useState(initialField);
  const [fieldType, setFieldType] = useState<"system" | "custom">("system");
  const [displayLabel, setDisplayLabel] = useState(systemFields[0].display_label);
  const [customLabel, setCustomLabel] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [xPosition, setXPosition] = useState<number | "">("");
  const [yPosition, setYPosition] = useState<number | "">("");
  const [fontSize, setFontSize] = useState(10);

  const [columnLabel, setColumnLabel] = useState("");
  const [columnSource, setColumnSource] = useState("sku");
  const [columnOrder, setColumnOrder] = useState(
    columns.length > 0 ? columns.length + 1 : 1
  );

  const [selectedRegionName, setSelectedRegionName] = useState("table_region");
  const [selectedRegionLabel, setSelectedRegionLabel] = useState("Item Table Region");
  const [selectedRegionType, setSelectedRegionType] = useState("table");

  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(
    null
  );
  const [drawnRegion, setDrawnRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedMapping = useMemo(
    () => mappingFor(mappings, selectedField),
    [mappings, selectedField]
  );

  function loadExistingMapping(
    fieldName: string,
    nextFieldType: "system" | "custom"
  ) {
    const existing = mappingFor(mappings, fieldName);
    const systemField = systemFields.find(
      (field) => field.field_name === fieldName
    );

    setSelectedField(fieldName);
    setFieldType(nextFieldType);
    setDisplayLabel(existing?.display_label || systemField?.display_label || fieldName);
    setPageNumber(existing?.page_number || 1);
    setXPosition(existing?.x_position ?? "");
    setYPosition(existing?.y_position ?? "");
    setFontSize(existing?.font_size || 10);
  }

  function startNewCustomField() {
    const label = customLabel.trim();

    if (!label) return;

    const customKey = `custom.${normalizeCustomKey(label)}`;

    setSelectedField(customKey);
    setFieldType("custom");
    setDisplayLabel(label);
    setPageNumber(1);
    setXPosition("");
    setYPosition("");
    setFontSize(10);
    setCustomLabel("");
  }

  function handleRegionOptionChange(value: string) {
    const option =
      regionOptions.find((region) => region.region_name === value) ||
      regionOptions[0];

    setSelectedRegionName(option.region_name);
    setSelectedRegionLabel(option.display_label);
    setSelectedRegionType(option.region_type);
  }

  function getRelativePoint(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const x = (clickX / rect.width) * DESIGN_WIDTH;
    const y = DESIGN_HEIGHT - (clickY / rect.height) * DESIGN_HEIGHT;

    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      screenX: clickX,
      screenY: clickY,
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
  }

  function handlePreviewClick(event: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "field") return;

    const point = getRelativePoint(event);

    setXPosition(point.x);
    setYPosition(point.y);
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "region") return;

    const point = getRelativePoint(event);

    setDragging(true);
    setDragStart({ x: point.screenX, y: point.screenY });
    setDragCurrent({ x: point.screenX, y: point.screenY });
    setDrawnRegion(null);
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "region" || !dragging || !dragStart) return;

    const point = getRelativePoint(event);

    setDragCurrent({ x: point.screenX, y: point.screenY });
  }

  function handleMouseUp(event: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "region" || !dragging || !dragStart) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const point = getRelativePoint(event);

    const startScreenX = dragStart.x;
    const startScreenY = dragStart.y;
    const endScreenX = point.screenX;
    const endScreenY = point.screenY;

    const leftScreen = Math.min(startScreenX, endScreenX);
    const topScreen = Math.min(startScreenY, endScreenY);
    const widthScreen = Math.abs(endScreenX - startScreenX);
    const heightScreen = Math.abs(endScreenY - startScreenY);

    const x = (leftScreen / rect.width) * DESIGN_WIDTH;
    const yTopPdf = DESIGN_HEIGHT - (topScreen / rect.height) * DESIGN_HEIGHT;
    const width = (widthScreen / rect.width) * DESIGN_WIDTH;
    const height = (heightScreen / rect.height) * DESIGN_HEIGHT;
    const y = yTopPdf - height;

    setDrawnRegion({
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      width: Number(width.toFixed(1)),
      height: Number(height.toFixed(1)),
    });

    setDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }

  function currentDragBox() {
    if (!dragStart || !dragCurrent) return null;

    const left = Math.min(dragStart.x, dragCurrent.x);
    const top = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);

    return { left, top, width, height };
  }

  const dragBox = currentDragBox();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Visual Template Mapping</h2>

        <p className="text-sm text-gray-600">
          Use Field Mode to click exact text positions. Use Region Mode to drag
          rectangles for table, totals, footer, signature and custom blocks.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("field")}
            className={`px-4 py-2 rounded-lg border text-sm ${
              mode === "field"
                ? "bg-gray-700 text-white"
                : "bg-white text-gray-900 hover:bg-gray-100"
            }`}
          >
            Field Mode
          </button>

          <button
            type="button"
            onClick={() => setMode("region")}
            className={`px-4 py-2 rounded-lg border text-sm ${
              mode === "region"
                ? "bg-gray-700 text-white"
                : "bg-white text-gray-900 hover:bg-gray-100"
            }`}
          >
            Region Mode
          </button>
        </div>

        <div
          onClick={handlePreviewClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative w-full h-[900px] border rounded-lg overflow-hidden bg-gray-100 ${
            mode === "region" ? "cursor-crosshair" : "cursor-pointer"
          }`}
        >
          {template.template_url ? (
            <iframe
              src={`${template.template_url}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full pointer-events-none bg-white"
            />
          ) : (
            <div className="p-6 text-gray-500">No PDF available.</div>
          )}

          {regions.map((region) => (
            <div
              key={region.id}
              className="absolute border-2 text-[10px] font-semibold px-1 overflow-hidden"
              style={{
                left: `${pdfToPercentX(region.x_position)}%`,
                top: `${pdfToPercentY(
                  Number(region.y_position || 0) + Number(region.height || 0)
                )}%`,
                width: `${pdfToPercentWidth(region.width)}%`,
                height: `${pdfToPercentHeight(region.height)}%`,
                backgroundColor: regionColor(region.region_type),
                borderColor: regionBorder(region.region_type),
                color: regionBorder(region.region_type),
              }}
            >
              {region.display_label || region.region_name}
            </div>
          ))}

          {mode === "field" && xPosition !== "" && yPosition !== "" && (
            <div
              className="absolute w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow"
              style={{
                left: `calc(${(Number(xPosition) / DESIGN_WIDTH) * 100}% - 8px)`,
                top: `calc(${
                  100 - (Number(yPosition) / DESIGN_HEIGHT) * 100
                }% - 8px)`,
              }}
            />
          )}

          {dragBox && (
            <div
              className="absolute border-2 border-dashed border-blue-700 bg-blue-200/30"
              style={{
                left: dragBox.left,
                top: dragBox.top,
                width: dragBox.width,
                height: dragBox.height,
              }}
            />
          )}

          {drawnRegion && (
            <div
              className="absolute border-2 border-dashed border-black bg-black/10"
              style={{
                left: `${pdfToPercentX(drawnRegion.x)}%`,
                top: `${pdfToPercentY(drawnRegion.y + drawnRegion.height)}%`,
                width: `${pdfToPercentWidth(drawnRegion.width)}%`,
                height: `${pdfToPercentHeight(drawnRegion.height)}%`,
              }}
            />
          )}
        </div>

        <div className="text-xs text-gray-500">
          Coordinates use A4 PDF points: width 595, height 842. Use Region Mode
          to drag a rectangle and save it below.
        </div>

        {drawnRegion && (
          <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
            <h3 className="font-semibold text-sm">Save Drawn Region</h3>

            <form action="/api/oc-templates/save-region" method="POST" className="space-y-4">
              <input type="hidden" name="template_id" value={template.id} />
              <input type="hidden" name="region_name" value={selectedRegionName} />
              <input type="hidden" name="display_label" value={selectedRegionLabel} />
              <input type="hidden" name="region_type" value={selectedRegionType} />
              <input type="hidden" name="page_number" value="1" />
              <input type="hidden" name="x_position" value={drawnRegion.x} />
              <input type="hidden" name="y_position" value={drawnRegion.y} />
              <input type="hidden" name="width" value={drawnRegion.width} />
              <input type="hidden" name="height" value={drawnRegion.height} />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Assign Region
                </label>

                <select
                  value={selectedRegionName}
                  onChange={(event) =>
                    handleRegionOptionChange(event.target.value)
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  {regionOptions.map((region) => (
                    <option key={region.region_name} value={region.region_name}>
                      {region.display_label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>X: {drawnRegion.x}</div>
                <div>Y: {drawnRegion.y}</div>
                <div>W: {drawnRegion.width}</div>
                <div>H: {drawnRegion.height}</div>
              </div>

              <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
                Save Drawn Region
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="space-y-8">
        <div className="bg-white border rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Header Field Mapping</h2>

          <div className="border rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-sm">System Fields</h3>

            <div>
              <label className="block text-sm font-medium mb-1">
                Select Field
              </label>

              <select
                value={fieldType === "system" ? selectedField : ""}
                onChange={(event) =>
                  loadExistingMapping(event.target.value, "system")
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="" disabled>
                  Select system field
                </option>

                {systemFields.map((field) => (
                  <option key={field.field_name} value={field.field_name}>
                    {field.display_label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-sm">Add Custom Header Field</h3>

            <p className="text-xs text-gray-500">
              Use this for company-specific header fields such as Messrs,
              Season, Buyer Ref, Style No, Port, Terms, or any other variable.
            </p>

            <div className="flex gap-2">
              <input
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Example: Messrs / Season / Style No"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

              <button
                type="button"
                onClick={startNewCustomField}
                className="px-4 py-3 rounded-lg bg-gray-200 text-gray-900 border hover:bg-gray-300 text-sm"
              >
                Add
              </button>
            </div>

            {customMappings.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Existing Custom Fields
                </label>

                <select
                  value={fieldType === "custom" ? selectedField : ""}
                  onChange={(event) =>
                    loadExistingMapping(event.target.value, "custom")
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  <option value="" disabled>
                    Select custom field
                  </option>

                  {customMappings.map((mapping) => (
                    <option
                      key={mapping.field_name || mapping.id}
                      value={mapping.field_name || ""}
                    >
                      {mapping.display_label || mapping.field_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedMapping && (
            <div className="p-3 rounded-lg bg-gray-50 border text-sm text-gray-600">
              Existing mapping loaded for this field.
            </div>
          )}

          <form
            action="/api/oc-templates/save-mapping"
            method="POST"
            className="space-y-4 border rounded-xl p-4"
          >
            <input type="hidden" name="template_id" value={template.id} />
            <input type="hidden" name="field_name" value={selectedField} />
            <input type="hidden" name="field_type" value={fieldType} />

            <div>
              <label className="block text-sm font-medium mb-1">
                Display Label
              </label>

              <input
                name="display_label"
                value={displayLabel}
                onChange={(event) => setDisplayLabel(event.target.value)}
                placeholder="Example: Messrs"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

              <p className="text-xs text-gray-500 mt-1">
                This is the label/name shown for this field in this company’s
                template.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Page</label>
                <input
                  name="page_number"
                  type="number"
                  value={pageNumber}
                  onChange={(event) => setPageNumber(Number(event.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Font Size
                </label>
                <input
                  name="font_size"
                  type="number"
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">X</label>
                <input
                  name="x_position"
                  type="number"
                  step="0.1"
                  value={xPosition}
                  onChange={(event) =>
                    setXPosition(
                      event.target.value === "" ? "" : Number(event.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Y</label>
                <input
                  name="y_position"
                  type="number"
                  step="0.1"
                  value={yPosition}
                  onChange={(event) =>
                    setYPosition(
                      event.target.value === "" ? "" : Number(event.target.value)
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>

            <button className="px-5 py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
              Save Mapping
            </button>
          </form>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border text-left">Type</th>
                  <th className="p-3 border text-left">Field Key</th>
                  <th className="p-3 border text-left">Display Label</th>
                  <th className="p-3 border text-left">X</th>
                  <th className="p-3 border text-left">Y</th>
                  <th className="p-3 border text-left">Font</th>
                </tr>
              </thead>

              <tbody>
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No mappings saved yet.
                    </td>
                  </tr>
                ) : (
                  mappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-50">
                      <td className="p-3 border">
                        {mapping.field_type || "system"}
                      </td>
                      <td className="p-3 border">{mapping.field_name || ""}</td>
                      <td className="p-3 border">
                        {displayFieldName(
                          mapping.field_name || "",
                          mapping.display_label
                        )}
                      </td>
                      <td className="p-3 border">{mapping.x_position ?? ""}</td>
                      <td className="p-3 border">{mapping.y_position ?? ""}</td>
                      <td className="p-3 border">{mapping.font_size ?? ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Table Column Designer</h2>

          <p className="text-sm text-gray-600">
            Define which columns should appear in the item table for this
            template. Different sellers can have different columns.
          </p>

          <form
            action="/api/oc-templates/save-column"
            method="POST"
            className="border rounded-xl p-4 space-y-4"
          >
            <input type="hidden" name="template_id" value={template.id} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Column Label
                </label>

                <input
                  name="display_label"
                  value={columnLabel}
                  onChange={(event) => setColumnLabel(event.target.value)}
                  placeholder="Example: FOB Price"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Source Field
                </label>

                <select
                  name="source_field"
                  value={columnSource}
                  onChange={(event) => setColumnSource(event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  {sourceFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Column Order
                </label>

                <input
                  name="column_order"
                  type="number"
                  value={columnOrder}
                  onChange={(event) => setColumnOrder(Number(event.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>

            <button className="px-5 py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
              Add Column
            </button>
          </form>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border text-left">Order</th>
                  <th className="p-3 border text-left">Column Label</th>
                  <th className="p-3 border text-left">Source Field</th>
                  <th className="p-3 border text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {columns.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500">
                      No table columns configured yet.
                    </td>
                  </tr>
                ) : (
                  columns.map((column) => (
                    <tr key={column.id} className="hover:bg-gray-50">
                      <td className="p-3 border">
                        {column.column_order ?? ""}
                      </td>

                      <td className="p-3 border">
                        {column.display_label || ""}
                      </td>

                      <td className="p-3 border">
                        {column.source_field || ""}
                      </td>

                      <td className="p-3 border">
                        <form
                          action="/api/oc-templates/delete-column"
                          method="POST"
                        >
                          <input
                            type="hidden"
                            name="template_id"
                            value={template.id}
                          />
                          <input
                            type="hidden"
                            name="column_id"
                            value={column.id}
                          />

                          <button className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-sm">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-500">
            Examples: SKU → sku, Qty → quantity, Price → unit_price, Color →
            custom.color, Style No → custom.style_no.
          </div>
        </div>
      </div>
    </div>
  );
}