"use client";

import { useMemo, useState } from "react";

type Template = {
  id: string;
  company_name: string | null;
  template_name: string | null;
  template_url: string | null;
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

type Mapping = {
  id: string;
  region_id: string | null;
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
  region_id: string | null;
  display_label: string | null;
  source_field: string | null;
  column_order: number | null;
};

type TemplateTotal = {
  id: string;
  region_id: string | null;
  display_label: string | null;
  total_key: string | null;
  formula_type: string | null;
  total_order: number | null;
};

type StaticBlock = {
  id: string;
  region_id: string | null;
  display_label: string | null;
  block_key: string | null;
  content: string | null;
  x_position: number | null;
  y_position: number | null;
  font_size: number | null;
};

type OCTemplateDesignerV4Props = {
  template: Template;
  regions: TemplateRegion[];
  mappings: Mapping[];
  columns: TemplateColumn[];
  totals: TemplateTotal[];
  staticBlocks: StaticBlock[];
};

const systemFields = [
  { key: "company_name", label: "Company Name" },
  { key: "customer_name", label: "Customer Name / Messrs" },
  { key: "customer_email", label: "Customer Email" },
  { key: "customer_address", label: "Customer Address" },
  { key: "oc_number", label: "OC Number" },
  { key: "oc_date", label: "OC Date" },
  { key: "po_number", label: "PO Number" },
  { key: "delivery_date", label: "Delivery Date" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "shipment_terms", label: "Shipment Terms" },
  { key: "customer_notes", label: "Customer Notes" },
];

const sourceFields = [
  { key: "sku", label: "SKU" },
  { key: "quantity", label: "Quantity" },
  { key: "unit_price", label: "Unit Price" },
  { key: "currency", label: "Currency" },
  { key: "line_total", label: "Line Total" },
  { key: "notes", label: "Notes" },
  { key: "custom.color", label: "Custom: Color" },
  { key: "custom.style_no", label: "Custom: Style No" },
  { key: "custom.season", label: "Custom: Season" },
  { key: "custom.delivery_date", label: "Custom: Delivery Date" },
  { key: "custom.buyer_ref", label: "Custom: Buyer Ref" },
  { key: "custom.composition", label: "Custom: Composition" },
];

const totalTypes = [
  { key: "manual", label: "Manual" },
  { key: "sum_quantity", label: "Sum Quantity" },
  { key: "sum_line_total", label: "Sum Line Total" },
  { key: "subtotal", label: "Subtotal" },
  { key: "grand_total", label: "Grand Total" },
];

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function regionTypeLabel(type: string | null) {
  if (type === "header") return "Header";
  if (type === "data") return "Data";
  if (type === "table") return "Table";
  if (type === "totals") return "Totals";
  if (type === "footer") return "Footer";
  if (type === "signature") return "Signature";
  return "Custom";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-4 rounded-lg border bg-gray-50 text-sm text-gray-500">
      {label}
    </div>
  );
}

export default function OCTemplateDesignerV4({
  template,
  regions,
  mappings,
  columns,
  totals,
  staticBlocks,
}: OCTemplateDesignerV4Props) {
  const [selectedRegionId, setSelectedRegionId] = useState(
    regions[0]?.id || ""
  );

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) || null,
    [regions, selectedRegionId]
  );

  const regionMappings = mappings.filter(
    (mapping) => mapping.region_id === selectedRegionId
  );

  const regionColumns = columns.filter(
    (column) => column.region_id === selectedRegionId
  );

  const regionTotals = totals.filter(
    (total) => total.region_id === selectedRegionId
  );

  const regionStaticBlocks = staticBlocks.filter(
    (block) => block.region_id === selectedRegionId
  );

  const [customFieldLabel, setCustomFieldLabel] = useState("");
  const [customColumnLabel, setCustomColumnLabel] = useState("");
  const [customTotalLabel, setCustomTotalLabel] = useState("");
  const [customStaticLabel, setCustomStaticLabel] = useState("");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-8">
      <div className="space-y-6">
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Regions</h2>

          <p className="text-sm text-gray-600">
            Select a region first. Fields, columns, totals and content blocks
            will be added inside the selected region.
          </p>

          {regions.length === 0 ? (
            <EmptyState label="No regions created yet. Add regions in the Region Designer below." />
          ) : (
            <div className="space-y-2">
              {regions.map((region) => {
                const active = region.id === selectedRegionId;

                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => setSelectedRegionId(region.id)}
                    className={`w-full text-left rounded-lg border p-3 transition ${
                      active
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-semibold text-sm">
                      {region.display_label || region.region_name}
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        active ? "text-gray-200" : "text-gray-500"
                      }`}
                    >
                      {regionTypeLabel(region.region_type)} ·{" "}
                      {region.region_name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold">Template PDF</h2>

          {template.template_url ? (
            <iframe
              src={`${template.template_url}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-[640px] border rounded-lg bg-white"
            />
          ) : (
            <EmptyState label="No template PDF available." />
          )}
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white border rounded-xl p-6 space-y-2">
          <div className="text-sm text-gray-500">Selected Region</div>

          {selectedRegion ? (
            <>
              <div className="text-2xl font-bold">
                {selectedRegion.display_label || selectedRegion.region_name}
              </div>
              <div className="text-sm text-gray-600">
                Type: {regionTypeLabel(selectedRegion.region_type)} · Page{" "}
                {selectedRegion.page_number || 1}
              </div>
            </>
          ) : (
            <div className="text-gray-500">No region selected</div>
          )}
        </div>

        {selectedRegion && (
          <>
            <div className="bg-white border rounded-xl p-6 space-y-5">
              <h2 className="text-xl font-semibold">Fields in this Region</h2>

              <form
                action="/api/oc-templates/save-mapping"
                method="POST"
                className="border rounded-xl p-4 space-y-4"
              >
                <input type="hidden" name="template_id" value={template.id} />
                <input
                  type="hidden"
                  name="region_id"
                  value={selectedRegion.id}
                />
                <input type="hidden" name="field_type" value="system" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    name="field_name"
                    className="border rounded-lg px-3 py-2 text-sm bg-white"
                    defaultValue="customer_name"
                  >
                    {systemFields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  <input
                    name="display_label"
                    placeholder="Display name, e.g. Messrs"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="page_number"
                    type="number"
                    defaultValue={selectedRegion.page_number || 1}
                    placeholder="Page"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="font_size"
                    type="number"
                    defaultValue={10}
                    placeholder="Font size"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="x_position"
                    type="number"
                    step="0.1"
                    defaultValue={selectedRegion.x_position || 50}
                    placeholder="X"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="y_position"
                    type="number"
                    step="0.1"
                    defaultValue={selectedRegion.y_position || 500}
                    placeholder="Y"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
                  Add System Field
                </button>
              </form>

              <form
                action="/api/oc-templates/save-mapping"
                method="POST"
                className="border rounded-xl p-4 space-y-4 bg-gray-50"
              >
                <input type="hidden" name="template_id" value={template.id} />
                <input
                  type="hidden"
                  name="region_id"
                  value={selectedRegion.id}
                />
                <input type="hidden" name="field_type" value="custom" />
                <input
                  type="hidden"
                  name="field_name"
                  value={
                    customFieldLabel.trim()
                      ? `custom.${normalizeKey(customFieldLabel)}`
                      : ""
                  }
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={customFieldLabel}
                    onChange={(event) =>
                      setCustomFieldLabel(event.target.value)
                    }
                    placeholder="Custom field name, e.g. Season"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="display_label"
                    value={customFieldLabel}
                    onChange={(event) =>
                      setCustomFieldLabel(event.target.value)
                    }
                    placeholder="Display name"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="page_number"
                    type="number"
                    defaultValue={selectedRegion.page_number || 1}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="font_size"
                    type="number"
                    defaultValue={10}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="x_position"
                    type="number"
                    step="0.1"
                    defaultValue={selectedRegion.x_position || 50}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />

                  <input
                    name="y_position"
                    type="number"
                    step="0.1"
                    defaultValue={selectedRegion.y_position || 500}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <button
                  disabled={!customFieldLabel.trim()}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-50"
                >
                  Add Custom Field
                </button>
              </form>

              {regionMappings.length === 0 ? (
                <EmptyState label="No fields assigned to this region yet." />
              ) : (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 border text-left">Name</th>
                        <th className="p-3 border text-left">Key</th>
                        <th className="p-3 border text-left">Type</th>
                        <th className="p-3 border text-left">Position</th>
                        <th className="p-3 border text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionMappings.map((mapping) => (
                        <tr key={mapping.id}>
                          <td className="p-3 border">
                            {mapping.display_label || mapping.field_name}
                          </td>
                          <td className="p-3 border">{mapping.field_name}</td>
                          <td className="p-3 border">{mapping.field_type}</td>
                          <td className="p-3 border">
                            X {mapping.x_position} / Y {mapping.y_position}
                          </td>
                          <td className="p-3 border">
                            <form
                              action="/api/oc-templates/delete-mapping"
                              method="POST"
                            >
                              <input
                                type="hidden"
                                name="template_id"
                                value={template.id}
                              />
                              <input
                                type="hidden"
                                name="mapping_id"
                                value={mapping.id}
                              />
                              <button className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
                                Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedRegion.region_type === "table" && (
              <div className="bg-white border rounded-xl p-6 space-y-5">
                <h2 className="text-xl font-semibold">
                  Columns in this Table Region
                </h2>

                <form
                  action="/api/oc-templates/save-column"
                  method="POST"
                  className="border rounded-xl p-4 space-y-4"
                >
                  <input type="hidden" name="template_id" value={template.id} />
                  <input
                    type="hidden"
                    name="region_id"
                    value={selectedRegion.id}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      name="display_label"
                      placeholder="Column label"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />

                    <select
                      name="source_field"
                      defaultValue="sku"
                      className="border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {sourceFields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>

                    <input
                      name="column_order"
                      type="number"
                      defaultValue={regionColumns.length + 1}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
                    Add Column
                  </button>
                </form>

                <form
                  action="/api/oc-templates/save-column"
                  method="POST"
                  className="border rounded-xl p-4 space-y-4 bg-gray-50"
                >
                  <input type="hidden" name="template_id" value={template.id} />
                  <input
                    type="hidden"
                    name="region_id"
                    value={selectedRegion.id}
                  />
                  <input
                    type="hidden"
                    name="source_field"
                    value={
                      customColumnLabel.trim()
                        ? `custom.${normalizeKey(customColumnLabel)}`
                        : ""
                    }
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      value={customColumnLabel}
                      onChange={(event) =>
                        setCustomColumnLabel(event.target.value)
                      }
                      placeholder="Custom column label"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />

                    <input
                      name="display_label"
                      value={customColumnLabel}
                      onChange={(event) =>
                        setCustomColumnLabel(event.target.value)
                      }
                      className="border rounded-lg px-3 py-2 text-sm"
                    />

                    <input
                      name="column_order"
                      type="number"
                      defaultValue={regionColumns.length + 1}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    disabled={!customColumnLabel.trim()}
                    className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-50"
                  >
                    Add Custom Column
                  </button>
                </form>

                {regionColumns.length === 0 ? (
                  <EmptyState label="No columns assigned to this table region yet." />
                ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 border text-left">Order</th>
                          <th className="p-3 border text-left">Label</th>
                          <th className="p-3 border text-left">Source</th>
                          <th className="p-3 border text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regionColumns.map((column) => (
                          <tr key={column.id}>
                            <td className="p-3 border">
                              {column.column_order}
                            </td>
                            <td className="p-3 border">
                              {column.display_label}
                            </td>
                            <td className="p-3 border">
                              {column.source_field}
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
                                <button className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
                                  Delete
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {selectedRegion.region_type === "totals" && (
              <div className="bg-white border rounded-xl p-6 space-y-5">
                <h2 className="text-xl font-semibold">
                  Totals in this Region
                </h2>

                <form
                  action="/api/oc-templates/save-total"
                  method="POST"
                  className="border rounded-xl p-4 space-y-4"
                >
                  <input type="hidden" name="template_id" value={template.id} />
                  <input
                    type="hidden"
                    name="region_id"
                    value={selectedRegion.id}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      name="display_label"
                      placeholder="Total label"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      name="total_key"
                      placeholder="total_key"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                      name="formula_type"
                      className="border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {totalTypes.map((type) => (
                        <option key={type.key} value={type.key}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="total_order"
                      type="number"
                      defaultValue={regionTotals.length + 1}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
                    Add Total
                  </button>
                </form>

                <form
                  action="/api/oc-templates/save-total"
                  method="POST"
                  className="border rounded-xl p-4 space-y-4 bg-gray-50"
                >
                  <input type="hidden" name="template_id" value={template.id} />
                  <input
                    type="hidden"
                    name="region_id"
                    value={selectedRegion.id}
                  />
                  <input
                    type="hidden"
                    name="total_key"
                    value={
                      customTotalLabel.trim()
                        ? `custom.${normalizeKey(customTotalLabel)}`
                        : ""
                    }
                  />
                  <input type="hidden" name="formula_type" value="manual" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={customTotalLabel}
                      onChange={(event) =>
                        setCustomTotalLabel(event.target.value)
                      }
                      placeholder="Custom total label"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      name="display_label"
                      value={customTotalLabel}
                      onChange={(event) =>
                        setCustomTotalLabel(event.target.value)
                      }
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      name="total_order"
                      type="number"
                      defaultValue={regionTotals.length + 1}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    disabled={!customTotalLabel.trim()}
                    className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-50"
                  >
                    Add Custom Total
                  </button>
                </form>

                {regionTotals.length === 0 ? (
                  <EmptyState label="No totals assigned to this region yet." />
                ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 border text-left">Order</th>
                          <th className="p-3 border text-left">Label</th>
                          <th className="p-3 border text-left">Key</th>
                          <th className="p-3 border text-left">Formula</th>
                          <th className="p-3 border text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regionTotals.map((total) => (
                          <tr key={total.id}>
                            <td className="p-3 border">
                              {total.total_order}
                            </td>
                            <td className="p-3 border">
                              {total.display_label}
                            </td>
                            <td className="p-3 border">{total.total_key}</td>
                            <td className="p-3 border">
                              {total.formula_type}
                            </td>
                            <td className="p-3 border">
                              <form
                                action="/api/oc-templates/delete-total"
                                method="POST"
                              >
                                <input
                                  type="hidden"
                                  name="template_id"
                                  value={template.id}
                                />
                                <input
                                  type="hidden"
                                  name="total_id"
                                  value={total.id}
                                />
                                <button className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
                                  Delete
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border rounded-xl p-6 space-y-5">
              <h2 className="text-xl font-semibold">
                Static Content Blocks in this Region
              </h2>

              <form
                action="/api/oc-templates/save-static-block"
                method="POST"
                className="border rounded-xl p-4 space-y-4"
              >
                <input type="hidden" name="template_id" value={template.id} />
                <input
                  type="hidden"
                  name="region_id"
                  value={selectedRegion.id}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    name="display_label"
                    placeholder="Block name, e.g. Payment Terms"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    name="block_key"
                    placeholder="block_key"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    name="x_position"
                    type="number"
                    step="0.1"
                    placeholder="X"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    name="y_position"
                    type="number"
                    step="0.1"
                    placeholder="Y"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    name="font_size"
                    type="number"
                    defaultValue={10}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <textarea
                    name="content"
                    placeholder="Static content"
                    className="md:col-span-2 border rounded-lg px-3 py-2 text-sm min-h-24"
                  />
                </div>

                <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
                  Add Static Block
                </button>
              </form>

              <form
                action="/api/oc-templates/save-static-block"
                method="POST"
                className="border rounded-xl p-4 space-y-4 bg-gray-50"
              >
                <input type="hidden" name="template_id" value={template.id} />
                <input
                  type="hidden"
                  name="region_id"
                  value={selectedRegion.id}
                />
                <input
                  type="hidden"
                  name="block_key"
                  value={
                    customStaticLabel.trim()
                      ? `custom.${normalizeKey(customStaticLabel)}`
                      : ""
                  }
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={customStaticLabel}
                    onChange={(event) =>
                      setCustomStaticLabel(event.target.value)
                    }
                    placeholder="Custom content block name"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    name="display_label"
                    value={customStaticLabel}
                    onChange={(event) =>
                      setCustomStaticLabel(event.target.value)
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <textarea
                    name="content"
                    placeholder="Static content"
                    className="md:col-span-2 border rounded-lg px-3 py-2 text-sm min-h-24"
                  />
                </div>

                <button
                  disabled={!customStaticLabel.trim()}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-50"
                >
                  Add Custom Static Block
                </button>
              </form>

              {regionStaticBlocks.length === 0 ? (
                <EmptyState label="No static content blocks assigned to this region yet." />
              ) : (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 border text-left">Name</th>
                        <th className="p-3 border text-left">Key</th>
                        <th className="p-3 border text-left">Content</th>
                        <th className="p-3 border text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionStaticBlocks.map((block) => (
                        <tr key={block.id}>
                          <td className="p-3 border">
                            {block.display_label}
                          </td>
                          <td className="p-3 border">{block.block_key}</td>
                          <td className="p-3 border max-w-sm truncate">
                            {block.content}
                          </td>
                          <td className="p-3 border">
                            <form
                              action="/api/oc-templates/delete-static-block"
                              method="POST"
                            >
                              <input
                                type="hidden"
                                name="template_id"
                                value={template.id}
                              />
                              <input
                                type="hidden"
                                name="block_id"
                                value={block.id}
                              />
                              <button className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
                                Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}