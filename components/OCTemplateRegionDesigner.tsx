"use client";

import { useState } from "react";

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

type OCTemplateRegionDesignerProps = {
  templateId: string;
  regions: TemplateRegion[];
};

const regionPresets = [
  { region_name: "header_region", display_label: "Header Region", region_type: "header" },
  { region_name: "customer_region", display_label: "Customer / Messrs Region", region_type: "data" },
  { region_name: "shipping_region", display_label: "Shipping Region", region_type: "data" },
  { region_name: "bank_region", display_label: "Bank Details Region", region_type: "data" },
  { region_name: "table_region", display_label: "Item Table Region", region_type: "table" },
  { region_name: "totals_region", display_label: "Totals Region", region_type: "totals" },
  { region_name: "footer_region", display_label: "Footer / Notes Region", region_type: "footer" },
  { region_name: "signature_region", display_label: "Signature Region", region_type: "signature" },
];

const regionTypes = [
  { value: "header", label: "Header" },
  { value: "data", label: "Data Block" },
  { value: "table", label: "Table Block" },
  { value: "totals", label: "Totals Block" },
  { value: "footer", label: "Footer Block" },
  { value: "signature", label: "Signature Block" },
  { value: "custom", label: "Custom Block" },
];

function regionFor(regions: TemplateRegion[], regionName: string) {
  return regions.find((region) => region.region_name === regionName) || null;
}

function normalizeRegionKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function typeLabel(value: string | null | undefined) {
  return regionTypes.find((item) => item.value === value)?.label || "Custom Block";
}

function RegionForm({
  templateId,
  region,
  regionName,
  displayLabel,
  defaultRegionType,
}: {
  templateId: string;
  region: TemplateRegion | null;
  regionName: string;
  displayLabel: string;
  defaultRegionType: string;
}) {
  const isExisting = Boolean(region?.id);

  return (
    <div className="border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-sm">
            {region?.display_label || displayLabel}
          </h3>

          <p className="text-xs text-gray-500">
            Key: {regionName} · Type: {typeLabel(region?.region_type || defaultRegionType)}
          </p>
        </div>

        <div className="flex gap-2">
          {isExisting ? (
            <form action="/api/oc-templates/delete-region" method="POST">
              <input type="hidden" name="template_id" value={templateId} />
              <input type="hidden" name="region_id" value={region?.id || ""} />

              <button className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-xs">
                Delete Region
              </button>
            </form>
          ) : (
            <span className="px-3 py-2 rounded-lg bg-gray-50 text-gray-500 border text-xs">
              Not saved yet
            </span>
          )}
        </div>
      </div>

      <form action="/api/oc-templates/save-region" method="POST" className="space-y-4">
        <input type="hidden" name="template_id" value={templateId} />
        <input type="hidden" name="region_id" value={region?.id || ""} />
        <input type="hidden" name="region_name" value={regionName} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Region Name
            </label>

            <input
              name="display_label"
              defaultValue={region?.display_label || displayLabel}
              placeholder="Display Label"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Region Type
            </label>

            <select
              name="region_type"
              defaultValue={region?.region_type || defaultRegionType}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {regionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Page</label>
            <input
              name="page_number"
              type="number"
              defaultValue={region?.page_number || 1}
              placeholder="Page"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">X</label>
            <input
              name="x_position"
              type="number"
              step="0.1"
              defaultValue={region?.x_position ?? 50}
              placeholder="X"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Y</label>
            <input
              name="y_position"
              type="number"
              step="0.1"
              defaultValue={region?.y_position ?? 500}
              placeholder="Y"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Width</label>
            <input
              name="width"
              type="number"
              step="0.1"
              defaultValue={region?.width ?? 300}
              placeholder="Width"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Height</label>
            <input
              name="height"
              type="number"
              step="0.1"
              defaultValue={region?.height ?? 100}
              placeholder="Height"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Row Height
            </label>
            <input
              name="row_height"
              type="number"
              step="0.1"
              defaultValue={region?.row_height ?? ""}
              placeholder="Row Height"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Column Gap
            </label>
            <input
              name="column_gap"
              type="number"
              step="0.1"
              defaultValue={region?.column_gap ?? ""}
              placeholder="Column Gap"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm">
          {isExisting ? "Update Region" : "Save Region"}
        </button>
      </form>
    </div>
  );
}

export default function OCTemplateRegionDesigner({
  templateId,
  regions,
}: OCTemplateRegionDesignerProps) {
  const [customRegionLabel, setCustomRegionLabel] = useState("");
  const [customRegionType, setCustomRegionType] = useState("custom");

  const presetNames = regionPresets.map((region) => region.region_name);

  const customRegions = regions.filter(
    (region) => region.region_name && !presetNames.includes(region.region_name)
  );

  const customRegionName = customRegionLabel.trim()
    ? `custom_${normalizeRegionKey(customRegionLabel)}`
    : "";

  return (
    <div className="bg-white border rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Region Designer</h2>
        <p className="text-sm text-gray-600 mt-1">
          Add, edit, update, or delete any template region. Regions help the PDF
          engine understand complex OC layouts such as tables, totals, footer,
          signature and custom blocks.
        </p>
      </div>

      <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
        <h3 className="font-semibold text-sm">Add Custom Region</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={customRegionLabel}
            onChange={(event) => setCustomRegionLabel(event.target.value)}
            placeholder="Example: Terms Block / Agent Block / Tax Block"
            className="md:col-span-2 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />

          <select
            value={customRegionType}
            onChange={(event) => setCustomRegionType(event.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {regionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <form action="/api/oc-templates/save-region" method="POST">
          <input type="hidden" name="template_id" value={templateId} />
          <input type="hidden" name="region_name" value={customRegionName} />
          <input type="hidden" name="display_label" value={customRegionLabel} />
          <input type="hidden" name="region_type" value={customRegionType} />
          <input type="hidden" name="page_number" value="1" />
          <input type="hidden" name="x_position" value="50" />
          <input type="hidden" name="y_position" value="500" />
          <input type="hidden" name="width" value="300" />
          <input type="hidden" name="height" value="100" />

          <button
            disabled={!customRegionName}
            className="px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-50"
          >
            Add Region
          </button>
        </form>

        <p className="text-xs text-gray-500">
          Examples: Agent Block, Tax Block, Special Instructions, Delivery Block,
          Certification Block.
        </p>
      </div>

      <div className="space-y-4">
        {regionPresets.map((preset) => {
          const existing = regionFor(regions, preset.region_name);

          return (
            <RegionForm
              key={preset.region_name}
              templateId={templateId}
              region={existing}
              regionName={preset.region_name}
              displayLabel={preset.display_label}
              defaultRegionType={preset.region_type}
            />
          );
        })}

        {customRegions.map((region) => (
          <RegionForm
            key={region.id}
            templateId={templateId}
            region={region}
            regionName={region.region_name || ""}
            displayLabel={region.display_label || region.region_name || "Custom Region"}
            defaultRegionType={region.region_type || "custom"}
          />
        ))}
      </div>
    </div>
  );
}