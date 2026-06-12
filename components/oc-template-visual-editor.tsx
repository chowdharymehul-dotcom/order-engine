"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VisualEditorProps = {
  templateId: string;
  draftId: string;
  analysis: any;
  previewData: any;
  sampleData?: any;
  originalImageUrl?: string;
  generatedPdfUrl?: string;
  pageWidth: number;
  pageHeight: number;
  fullScreen?: boolean;
  templateName?: string;
  backUrl?: string;
  sellerProfileId?: string;
};

type SectionType =
  | "logos"
  | "fields"
  | "columns"
  | "totals"
  | "static_blocks"
  | "lines"
  | "rectangles"
  | "table_borders";

type SelectedItem = {
  section: SectionType;
  index: number;
};

type DragState = {
  type: "move" | "resize";
  section: SectionType;
  index: number;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startX2?: number;
  startY2?: number;
};

type DeletedSnapshot = {
  section: SectionType;
  index: number;
  item: any;
};

const fieldLibrary = [
  "seller.logo",
  "seller.company_name",
  "seller.address",
  "seller.gst_no",
  "seller.phone",
  "seller.fax",
  "seller.email",
  "seller.bank_name",
  "seller.account_number",
  "seller.swift_code",
  "customer.name",
  "customer.address",
  "customer.country",
  "agent.name",
  "agent.company",
  "order.oc_number",
  "order.oc_date",
  "order.po_number",
  "order.po_date",
  "order.reference",
  "order.payment_terms",
  "order.shipment_terms",
  "order.shipping_address",
  "order.shipping_instructions",
  "order.delivery_date",
  "order.attention_of",
  "order.total_amount",
  "item.sku",
  "item.article_no",
  "item.color",
  "item.color_no",
  "item.size",
  "item.width",
  "item.piece_length",
  "item.quantity",
  "item.unit_price",
  "item.currency",
  "item.amount",
  "item.notes",
  "manual.custom_text",
];

const previewItems = [
  {
    sku: "A13116",
    article_no: "A13116",
    color: "WHITE",
    color_no: "001",
    size: "STANDARD",
    width: "135",
    piece_length: "50",
    quantity: "60",
    unit_price: "12.50",
    currency: "USD",
    amount: "750.00",
    notes: "",
  },
  {
    sku: "T28090/1",
    article_no: "T28090/1",
    color: "WHITE",
    color_no: "002",
    size: "STANDARD",
    width: "110",
    piece_length: "25",
    quantity: "2",
    unit_price: "250.00",
    currency: "USD",
    amount: "500.00",
    notes: "Color change to white",
  },
];

function clone(value: any) {
  return JSON.parse(JSON.stringify(value || {}));
}

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function valueAt(row: any, key: string) {
  return String(row?.[key] ?? "");
}

function mappedValue(row: any) {
  return (
    row?.mapped_to ||
    row?.source_field ||
    row?.field_name ||
    row?.total_key ||
    row?.block_key ||
    ""
  );
}

function getByPath(data: any, path: string) {
  if (!path || !data) return "";
  return path.split(".").reduce((acc, key) => acc?.[key], data) || "";
}

function previewValue(row: any, previewData: any, sampleData?: any) {
  const mapped = mappedValue(row);
  const manualText = valueAt(row, "preview_text");

  if (manualText) return manualText;

  const sampleValue = getByPath(sampleData, mapped);
  const previewDataValue = getByPath(previewData, mapped);
  const value = sampleValue || previewDataValue;

  if (value) return String(value);

  return valueAt(row, "display_label") || mapped || "";
}

function itemValue(column: any, item: any) {
  const mapped = mappedValue(column);
  const itemPath = mapped.startsWith("item.")
    ? mapped.replace("item.", "")
    : valueAt(column, "source_field");

  return String(item?.[itemPath] ?? "");
}

function numberOrFallback(value: any, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function positionToPercent(item: any, pageWidth: number, pageHeight: number) {
  const x = numberOrFallback(item.x_position, 0);
  const y = numberOrFallback(item.y_position, 0);
  const width = numberOrFallback(item.width, 0);
  const height = numberOrFallback(item.height, 0);

  return {
    x_percent:
      Number.isFinite(Number(item.x_percent)) && Number(item.x_percent) > 0
        ? Number(item.x_percent)
        : x / pageWidth,
    y_percent:
      Number.isFinite(Number(item.y_percent)) && Number(item.y_percent) > 0
        ? Number(item.y_percent)
        : y / pageHeight,
    width_percent:
      Number.isFinite(Number(item.width_percent)) &&
      Number(item.width_percent) > 0
        ? Number(item.width_percent)
        : width / pageWidth,
    height_percent:
      Number.isFinite(Number(item.height_percent)) &&
      Number(item.height_percent) > 0
        ? Number(item.height_percent)
        : height / pageHeight,
  };
}

function percentToPosition(item: any, pageWidth: number, pageHeight: number) {
  const xPercent = Number(item.x_percent);
  const yPercent = Number(item.y_percent);
  const widthPercent = Number(item.width_percent);
  const heightPercent = Number(item.height_percent);

  return {
    x_position: Number.isFinite(xPercent)
      ? Math.round(xPercent * pageWidth)
      : numberOrFallback(item.x_position, 0),
    y_position: Number.isFinite(yPercent)
      ? Math.round(yPercent * pageHeight)
      : numberOrFallback(item.y_position, 0),
    width:
      Number.isFinite(widthPercent) && widthPercent > 0
        ? Math.round(widthPercent * pageWidth)
        : numberOrFallback(item.width, 180),
    height:
      Number.isFinite(heightPercent) && heightPercent > 0
        ? Math.round(heightPercent * pageHeight)
        : numberOrFallback(item.height || item.font_size, 18),
  };
}

function normalizedItem(
  item: any,
  section: string,
  index: number,
  pageWidth: number,
  pageHeight: number
) {
  const positioned = percentToPosition(item, pageWidth, pageHeight);

  if (section === "columns") {
    return {
      ...item,
      x_position: positioned.x_position || 35 + index * 65,
      y_position: positioned.y_position || 530,
      width: positioned.width || 65,
      height: positioned.height || 30,
      row_height: item.row_height || item.height || 22,
      font_size: item.font_size || 8,
    };
  }

  if (section === "totals") {
    return {
      ...item,
      x_position: positioned.x_position || 360,
      y_position: positioned.y_position || 180 - index * 18,
      width: positioned.width || 160,
      height: positioned.height || 18,
      font_size: item.font_size || 10,
    };
  }

  if (section === "logos") {
    return {
      ...item,
      x_position: positioned.x_position || 30,
      y_position: positioned.y_position || 760,
      width: positioned.width || 100,
      height: positioned.height || 50,
    };
  }

  if (section === "rectangles") {
    return {
      ...item,
      x_position: positioned.x_position || 50,
      y_position: positioned.y_position || 500,
      width: positioned.width || 200,
      height: positioned.height || 80,
      border_thickness: item.border_thickness || 1,
      border_color: item.border_color || "#111827",
      fill_color: item.fill_color || "transparent",
    };
  }

  if (section === "table_borders") {
    return {
      ...item,
      x_position: positioned.x_position || 35,
      y_position: positioned.y_position || 530,
      width: positioned.width || 520,
      height: positioned.height || 150,
      border_thickness: item.border_thickness || 1,
      border_color: item.border_color || "#111827",
      row_count: item.row_count || 4,
      column_count: item.column_count || 6,
      row_height: item.row_height || 24,
    };
  }

  return {
    ...item,
    x_position: positioned.x_position,
    y_position: positioned.y_position,
    width: positioned.width || 180,
    height: positioned.height || item.font_size || 18,
    font_size: item.font_size || 10,
  };
}

function withPercentCoordinates(
  analysis: any,
  pageWidth: number,
  pageHeight: number
) {
  const normalized = normalizeAnalysis(analysis);

  function addPercentsToItem(item: any) {
    const percents = positionToPercent(item, pageWidth, pageHeight);

    return {
      ...item,
      ...percents,
    };
  }

  function addPercentsToLine(item: any) {
    const x1 = numberOrFallback(item.x1, 0);
    const y1 = numberOrFallback(item.y1, 0);
    const x2 = numberOrFallback(item.x2, 0);
    const y2 = numberOrFallback(item.y2, 0);

    return {
      ...item,
      x1_percent:
        Number.isFinite(Number(item.x1_percent)) &&
        Number(item.x1_percent) > 0
          ? Number(item.x1_percent)
          : x1 / pageWidth,
      y1_percent:
        Number.isFinite(Number(item.y1_percent)) &&
        Number(item.y1_percent) > 0
          ? Number(item.y1_percent)
          : y1 / pageHeight,
      x2_percent:
        Number.isFinite(Number(item.x2_percent)) &&
        Number(item.x2_percent) > 0
          ? Number(item.x2_percent)
          : x2 / pageWidth,
      y2_percent:
        Number.isFinite(Number(item.y2_percent)) &&
        Number(item.y2_percent) > 0
          ? Number(item.y2_percent)
          : y2 / pageHeight,
    };
  }

  return {
    ...normalized,
    logos: normalized.logos.map(addPercentsToItem),
    regions: normalized.regions.map(addPercentsToItem),
    fields: normalized.fields.map(addPercentsToItem),
    columns: normalized.columns.map(addPercentsToItem),
    totals: normalized.totals.map(addPercentsToItem),
    static_blocks: normalized.static_blocks.map(addPercentsToItem),
    rectangles: normalized.rectangles.map(addPercentsToItem),
    table_borders: normalized.table_borders.map(addPercentsToItem),
    lines: normalized.lines.map(addPercentsToLine),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAnalysis(analysis: any) {
  return {
    logos: asArray(analysis?.logos),
    regions: asArray(analysis?.regions),
    fields: asArray(analysis?.fields),
    columns: asArray(analysis?.columns),
    totals: asArray(analysis?.totals),
    static_blocks: asArray(analysis?.static_blocks),
    lines: asArray(analysis?.lines),
    rectangles: asArray(analysis?.rectangles),
    table_borders: asArray(analysis?.table_borders),
  };
}

export default function OCTemplateVisualEditor({
  templateId,
  draftId,
  analysis,
  previewData,
  sampleData,
  originalImageUrl = "",
  generatedPdfUrl = "",
  pageWidth,
  pageHeight,
  fullScreen = false,
  templateName = "Sample OC Layout",
  backUrl = "",
  sellerProfileId = "",
}: VisualEditorProps) {
  const safePageWidth = pageWidth > 0 ? pageWidth : 595;
  const safePageHeight = pageHeight > 0 ? pageHeight : 842;

  const originalAnalysis = useMemo(
    () => withPercentCoordinates(clone(analysis), safePageWidth, safePageHeight),
    [analysis, safePageWidth, safePageHeight]
  );

  const [localAnalysis, setLocalAnalysis] = useState<any>(() =>
    withPercentCoordinates(clone(analysis), safePageWidth, safePageHeight)
  );
  const [history, setHistory] = useState<any[]>([]);
  const [deletedHistory, setDeletedHistory] = useState<DeletedSnapshot[]>([]);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [zoom, setZoom] = useState(fullScreen ? 1.25 : 1);
  const [nudgeStep, setNudgeStep] = useState(2);

  const selectedCurrentItem = useMemo(() => {
    if (!selected) return null;
    return asArray(localAnalysis[selected.section])[selected.index] || null;
  }, [localAnalysis, selected]);

  useEffect(() => {
    if (!hasUnsavedChanges || dragState || isRegenerating) return;

    const timer = window.setTimeout(() => {
      autosaveLayout();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [localAnalysis, hasUnsavedChanges, dragState, isRegenerating]);

  function convertValuesToPercents(values: any) {
    const nextValues = { ...values };

    if ("x_position" in nextValues) {
      nextValues.x_percent = Number(nextValues.x_position || 0) / safePageWidth;
    }

    if ("y_position" in nextValues) {
      nextValues.y_percent =
        Number(nextValues.y_position || 0) / safePageHeight;
    }

    if ("width" in nextValues) {
      nextValues.width_percent = Number(nextValues.width || 0) / safePageWidth;
    }

    if ("height" in nextValues) {
      nextValues.height_percent =
        Number(nextValues.height || 0) / safePageHeight;
    }

    if ("x1" in nextValues) {
      nextValues.x1_percent = Number(nextValues.x1 || 0) / safePageWidth;
    }

    if ("y1" in nextValues) {
      nextValues.y1_percent = Number(nextValues.y1 || 0) / safePageHeight;
    }

    if ("x2" in nextValues) {
      nextValues.x2_percent = Number(nextValues.x2 || 0) / safePageWidth;
    }

    if ("y2" in nextValues) {
      nextValues.y2_percent = Number(nextValues.y2 || 0) / safePageHeight;
    }

    return nextValues;
  }

  function commit(nextAnalysis: any) {
    setHistory((current) => [...current.slice(-49), clone(localAnalysis)]);
    setLocalAnalysis(nextAnalysis);
    setHasUnsavedChanges(true);
    setSaveMessage("Unsaved changes");
  }

  function updateSelected(key: string, value: string) {
    if (!selected) return;

    const numericKeys = [
      "x_position",
      "y_position",
      "width",
      "height",
      "font_size",
      "confidence",
      "column_order",
      "total_order",
      "x1",
      "y1",
      "x2",
      "y2",
      "thickness",
      "border_thickness",
      "row_count",
      "column_count",
      "row_height",
      "x_percent",
      "y_percent",
      "width_percent",
      "height_percent",
      "x1_percent",
      "y1_percent",
      "x2_percent",
      "y2_percent",
    ];

    const nextAnalysis = {
      ...localAnalysis,
      [selected.section]: asArray(localAnalysis[selected.section]).map(
        (item, index) => {
          if (index !== selected.index) return item;

          const nextItem = {
            ...item,
            [key]: numericKeys.includes(key) ? Number(value || 0) : value,
          };

          return convertValuesToPercents(nextItem);
        }
      ),
    };

    commit(nextAnalysis);
  }

  function updateItem(
    section: SectionType,
    index: number,
    values: any,
    saveHistory = false
  ) {
    const nextValues = convertValuesToPercents(values);

    const nextAnalysis = {
      ...localAnalysis,
      [section]: asArray(localAnalysis[section]).map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return { ...item, ...nextValues };
      }),
    };

    if (saveHistory) {
      commit(nextAnalysis);
    } else {
      setLocalAnalysis(nextAnalysis);
      setHasUnsavedChanges(true);
      setSaveMessage("Editing...");
    }
  }

  function startMove(
    event: React.MouseEvent,
    section: SectionType,
    index: number,
    item: any
  ) {
    event.preventDefault();
    event.stopPropagation();

    setHistory((current) => [...current.slice(-49), clone(localAnalysis)]);
    setSelected({ section, index });

    setDragState({
      type: "move",
      section,
      index,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: Number(item.x_position || item.x1 || 0),
      startY: Number(item.y_position || item.y1 || 0),
      startWidth: Number(item.width || 180),
      startHeight: Number(item.height || 18),
      startX2: Number(item.x2 || 0),
      startY2: Number(item.y2 || 0),
    });
  }

  function startResize(
    event: React.MouseEvent,
    section: SectionType,
    index: number,
    item: any
  ) {
    event.preventDefault();
    event.stopPropagation();

    setHistory((current) => [...current.slice(-49), clone(localAnalysis)]);
    setSelected({ section, index });

    setDragState({
      type: "resize",
      section,
      index,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: Number(item.x_position || item.x1 || 0),
      startY: Number(item.y_position || item.y1 || 0),
      startWidth: Number(item.width || 180),
      startHeight: Number(item.height || 18),
      startX2: Number(item.x2 || 0),
      startY2: Number(item.y2 || 0),
    });
  }

  function onMouseMove(event: React.MouseEvent) {
    if (!dragState) return;

    const deltaX = (event.clientX - dragState.startMouseX) / zoom;
    const deltaY = (event.clientY - dragState.startMouseY) / zoom;

    if (dragState.section === "lines") {
      if (dragState.type === "move") {
        updateItem(dragState.section, dragState.index, {
          x1: Math.round(clamp(dragState.startX + deltaX, 0, safePageWidth)),
          y1: Math.round(clamp(dragState.startY - deltaY, 0, safePageHeight)),
          x2: Math.round(
            clamp((dragState.startX2 || 0) + deltaX, 0, safePageWidth)
          ),
          y2: Math.round(
            clamp((dragState.startY2 || 0) - deltaY, 0, safePageHeight)
          ),
        });
      }

      if (dragState.type === "resize") {
        updateItem(dragState.section, dragState.index, {
          x2: Math.round(
            clamp((dragState.startX2 || 0) + deltaX, 0, safePageWidth)
          ),
          y2: Math.round(
            clamp((dragState.startY2 || 0) - deltaY, 0, safePageHeight)
          ),
        });
      }

      return;
    }

    if (dragState.type === "move") {
      updateItem(dragState.section, dragState.index, {
        x_position: Math.round(
          clamp(dragState.startX + deltaX, 0, safePageWidth)
        ),
        y_position: Math.round(
          clamp(dragState.startY - deltaY, 0, safePageHeight)
        ),
      });
    }

    if (dragState.type === "resize") {
      updateItem(dragState.section, dragState.index, {
        width: Math.round(
          clamp(dragState.startWidth + deltaX, 20, safePageWidth)
        ),
        height: Math.round(
          clamp(dragState.startHeight + deltaY, 10, safePageHeight)
        ),
      });
    }
  }

  function stopDrag() {
    setDragState(null);
  }

  async function saveDraftAnalysis(message = "Saved") {
    setIsSaving(true);

    const formData = new FormData();
    formData.append("template_id", templateId);
    formData.append("draft_id", draftId);
    formData.append("action", "save_all");
    formData.append(
      "analysis",
      JSON.stringify(
        withPercentCoordinates(localAnalysis, safePageWidth, safePageHeight)
      )
    );

    const response = await fetch("/api/oc-templates/update-ai-draft", {
      method: "POST",
      body: formData,
    });

    setIsSaving(false);

    if (response.ok) {
      setHistory([]);
      setDeletedHistory([]);
      setHasUnsavedChanges(false);
      setSaveMessage(message);
      return true;
    }

    setSaveMessage("Save failed");
    return false;
  }

  async function autosaveLayout() {
    if (isSaving || isRegenerating) return;

    setSaveMessage("Autosaving...");

    const formData = new FormData();
    formData.append("template_id", templateId);
    formData.append("draft_id", draftId);
    formData.append("action", "save_all");
    formData.append(
      "analysis",
      JSON.stringify(
        withPercentCoordinates(localAnalysis, safePageWidth, safePageHeight)
      )
    );

    const response = await fetch("/api/oc-templates/update-ai-draft", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setHasUnsavedChanges(false);
      setSaveMessage("Autosaved");
    } else {
      setSaveMessage("Autosave failed");
    }
  }

  async function saveAllChanges() {
    await saveDraftAnalysis("Saved");
  }

  async function saveAndRegeneratePreview() {
    setIsRegenerating(true);
    setSaveMessage("Saving layout...");

    const saved = await saveDraftAnalysis("Layout saved");

    if (!saved) {
      setIsRegenerating(false);
      return;
    }

    setSaveMessage("Generating actual PDF...");

    const generateFormData = new FormData();
    generateFormData.append("template_id", templateId);
    generateFormData.append("draft_id", draftId);
    generateFormData.append("seller_profile_id", sellerProfileId);

    const generateResponse = await fetch("/api/oc-templates/generate-sample-oc", {
      method: "POST",
      body: generateFormData,
      redirect: "follow",
    });

    setIsRegenerating(false);

    if (!generateResponse.ok && !generateResponse.redirected) {
      setSaveMessage("Generate failed");
      return;
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("draft", draftId);

    if (sellerProfileId) {
      currentUrl.searchParams.set("seller_id", sellerProfileId);
    }

    currentUrl.searchParams.set("r", String(Date.now()));
    window.location.href = currentUrl.toString();
  }

  function undoLastChange() {
    const previous = history[history.length - 1];
    if (!previous) return;

    setLocalAnalysis(previous);
    setHistory((current) => current.slice(0, -1));
    setHasUnsavedChanges(true);
    setSaveMessage("Unsaved changes");
  }

  function deleteSelected() {
    if (!selected) return;

    const item = asArray(localAnalysis[selected.section])[selected.index];
    if (!item) return;

    const nextAnalysis = {
      ...localAnalysis,
      [selected.section]: asArray(localAnalysis[selected.section]).filter(
        (_item, index) => index !== selected.index
      ),
    };

    setDeletedHistory((current) => [
      { section: selected.section, index: selected.index, item: clone(item) },
      ...current,
    ]);

    commit(nextAnalysis);
    setSelected(null);
  }

  function undoDelete() {
    const deleted = deletedHistory[0];
    if (!deleted) return;

    const items = asArray(localAnalysis[deleted.section]);
    const insertIndex = clamp(deleted.index, 0, items.length);

    const nextItems = [
      ...items.slice(0, insertIndex),
      deleted.item,
      ...items.slice(insertIndex),
    ];

    const nextAnalysis = {
      ...localAnalysis,
      [deleted.section]: nextItems,
    };

    setDeletedHistory((current) => current.slice(1));
    commit(nextAnalysis);
  }

  function resetSelectedItem() {
    if (!selected) return;

    const originalItem =
      asArray(originalAnalysis[selected.section])[selected.index];
    if (!originalItem) return;

    const nextAnalysis = {
      ...localAnalysis,
      [selected.section]: asArray(localAnalysis[selected.section]).map(
        (item, index) => (index === selected.index ? clone(originalItem) : item)
      ),
    };

    commit(nextAnalysis);
  }

  function nudgeSelected(deltaX: number, deltaY: number) {
    if (!selected || !selectedCurrentItem) return;

    if (selected.section === "lines") {
      const nextX1 = clamp(
        Number(selectedCurrentItem.x1 || 0) + deltaX,
        0,
        safePageWidth
      );
      const nextX2 = clamp(
        Number(selectedCurrentItem.x2 || 0) + deltaX,
        0,
        safePageWidth
      );
      const nextY1 = clamp(
        Number(selectedCurrentItem.y1 || 0) + deltaY,
        0,
        safePageHeight
      );
      const nextY2 = clamp(
        Number(selectedCurrentItem.y2 || 0) + deltaY,
        0,
        safePageHeight
      );

      updateItem(
        selected.section,
        selected.index,
        {
          x1: Math.round(nextX1),
          x2: Math.round(nextX2),
          y1: Math.round(nextY1),
          y2: Math.round(nextY2),
        },
        true
      );

      return;
    }

    const nextX = clamp(
      Number(selectedCurrentItem.x_position || 0) + deltaX,
      0,
      safePageWidth
    );
    const nextY = clamp(
      Number(selectedCurrentItem.y_position || 0) + deltaY,
      0,
      safePageHeight
    );

    updateItem(
      selected.section,
      selected.index,
      {
        x_position: Math.round(nextX),
        y_position: Math.round(nextY),
      },
      true
    );
  }

  function addItem(section: SectionType) {
    const items = asArray(localAnalysis[section]);

    const defaultX = safePageWidth * 0.08;
    const defaultY = safePageHeight * 0.6;

    const defaults: Partial<Record<SectionType, any>> = {
      lines: {
        line_key: `line_${items.length + 1}`,
        line_type: "horizontal",
        x1: defaultX,
        y1: defaultY,
        x2: safePageWidth * 0.92,
        y2: defaultY,
        thickness: 1,
        color: "#111827",
        confidence: 1,
      },
      rectangles: {
        rectangle_key: `rectangle_${items.length + 1}`,
        display_label: "New Box",
        x_position: defaultX,
        y_position: defaultY,
        width: safePageWidth * 0.35,
        height: safePageHeight * 0.1,
        border_thickness: 1,
        border_color: "#111827",
        fill_color: "transparent",
        confidence: 1,
      },
      table_borders: {
        table_key: `table_border_${items.length + 1}`,
        display_label: "Table Border",
        x_position: safePageWidth * 0.06,
        y_position: safePageHeight * 0.63,
        width: safePageWidth * 0.87,
        height: safePageHeight * 0.18,
        border_thickness: 1,
        border_color: "#111827",
        row_count: 4,
        column_count: 6,
        row_height: safePageHeight * 0.028,
        confidence: 1,
      },
      columns: {
        display_label: "New Column",
        source_field: "notes",
        column_order: items.length + 1,
        mapped_to: "item.notes",
        x_position: safePageWidth * 0.06 + items.length * 65,
        y_position: safePageHeight * 0.63,
        width: safePageWidth * 0.11,
        height: safePageHeight * 0.035,
        row_height: safePageHeight * 0.026,
        font_size: 8,
        confidence: 1,
      },
      fields: {
        display_label: "New Field",
        field_name: `custom.new_field_${items.length + 1}`,
        field_type: "custom",
        region_name: "custom_new_region",
        page_number: 1,
        x_position: defaultX,
        y_position: defaultY,
        width: safePageWidth * 0.3,
        height: safePageHeight * 0.022,
        font_size: 10,
        mapped_to: "manual.custom_text",
        source_type: "manual",
        confidence: 1,
      },
    };

    const itemWithPercents = convertValuesToPercents(defaults[section] || {});

    const nextAnalysis = {
      ...localAnalysis,
      [section]: [...items, itemWithPercents],
    };

    commit(nextAnalysis);
  }

  const editorCanvas = (
    <div
      className="relative bg-white border shadow-xl overflow-hidden select-none"
      style={{
        width: safePageWidth,
        height: safePageHeight,
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
      }}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <CanvasBackground url={originalImageUrl} />

      <Canvas
        analysis={localAnalysis}
        previewData={previewData}
        sampleData={sampleData}
        selected={selected}
        onSelect={setSelected}
        onStartMove={startMove}
        onStartResize={startResize}
        pageWidth={safePageWidth}
        pageHeight={safePageHeight}
      />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
        <div className="h-16 bg-white border-b px-5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            {backUrl ? (
              <Link
                href={backUrl}
                className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
              >
                ← Back
              </Link>
            ) : null}

            <div className="min-w-0">
              <div className="font-semibold truncate">{templateName}</div>
              <div className="text-xs text-gray-500">
                Live editor · percentage coordinates · no hardcoded page size
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((current) => clamp(current - 0.1, 0.5, 2))}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            >
              −
            </button>

            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            >
              100%
            </button>

            <button
              type="button"
              onClick={() => setZoom(1.25)}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            >
              125%
            </button>

            <button
              type="button"
              onClick={() => setZoom(1.5)}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            >
              150%
            </button>

            <button
              type="button"
              onClick={() => setZoom((current) => clamp(current + 0.1, 0.5, 2))}
              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
            >
              +
            </button>

            <button
              type="button"
              onClick={saveAllChanges}
              disabled={isSaving || isRegenerating}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm disabled:opacity-50"
            >
              {isSaving && !isRegenerating ? "Saving..." : "Save Layout"}
            </button>

            <button
              type="button"
              onClick={saveAndRegeneratePreview}
              disabled={isSaving || isRegenerating}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isRegenerating ? "Generating..." : "Generate PDF Check"}
            </button>

            {saveMessage && (
              <span className="text-sm text-gray-600">{saveMessage}</span>
            )}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[1fr_420px] min-h-0">
          <div className="overflow-auto p-10">
            <div
              className="mx-auto"
              style={{
                width: safePageWidth * zoom,
                height: safePageHeight * zoom,
              }}
            >
              {editorCanvas}
            </div>
          </div>

          <EditorSidePanel
            selected={selected}
            selectedCurrentItem={selectedCurrentItem}
            updateSelected={updateSelected}
            deleteSelected={deleteSelected}
            undoLastChange={undoLastChange}
            undoDelete={undoDelete}
            resetSelectedItem={resetSelectedItem}
            addItem={addItem}
            nudgeSelected={nudgeSelected}
            nudgeStep={nudgeStep}
            setNudgeStep={setNudgeStep}
            generatedPdfUrl={generatedPdfUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[1fr_420px] gap-6">
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <EditorHeader
          undoLastChange={undoLastChange}
          undoDelete={undoDelete}
          resetSelectedItem={resetSelectedItem}
          saveAllChanges={saveAllChanges}
          saveAndRegeneratePreview={saveAndRegeneratePreview}
          isSaving={isSaving}
          isRegenerating={isRegenerating}
          saveMessage={saveMessage}
          addItem={addItem}
        />

        <div className="overflow-auto">
          <div
            className="mx-auto"
            style={{
              width: safePageWidth * zoom,
              height: safePageHeight * zoom,
            }}
          >
            {editorCanvas}
          </div>
        </div>
      </div>

      <EditorSidePanel
        selected={selected}
        selectedCurrentItem={selectedCurrentItem}
        updateSelected={updateSelected}
        deleteSelected={deleteSelected}
        undoLastChange={undoLastChange}
        undoDelete={undoDelete}
        resetSelectedItem={resetSelectedItem}
        addItem={addItem}
        nudgeSelected={nudgeSelected}
        nudgeStep={nudgeStep}
        setNudgeStep={setNudgeStep}
        generatedPdfUrl={generatedPdfUrl}
      />
    </div>
  );
}

function EditorHeader({
  undoLastChange,
  undoDelete,
  resetSelectedItem,
  saveAllChanges,
  saveAndRegeneratePreview,
  isSaving,
  isRegenerating,
  saveMessage,
  addItem,
}: any) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Live Sample OC Editor</h2>
          <p className="text-sm text-gray-500 mt-1">
            Drag values directly. Coordinates save as percentages.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SmallButton label="+ Field" onClick={() => addItem("fields")} />
          <SmallButton label="+ Column" onClick={() => addItem("columns")} />
          <SmallButton label="+ Line" onClick={() => addItem("lines")} />
          <SmallButton label="+ Box" onClick={() => addItem("rectangles")} />
          <SmallButton
            label="+ Table Border"
            onClick={() => addItem("table_borders")}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border rounded-lg p-3 bg-gray-50">
        <SmallButton label="Undo Last Change" onClick={undoLastChange} />
        <SmallButton label="Undo Delete" onClick={undoDelete} />
        <SmallButton label="Reset Selected" onClick={resetSelectedItem} />

        <button
          type="button"
          onClick={saveAllChanges}
          disabled={isSaving || isRegenerating}
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 border hover:bg-gray-200 text-sm disabled:opacity-50"
        >
          {isSaving && !isRegenerating ? "Saving..." : "Save Layout"}
        </button>

        <button
          type="button"
          onClick={saveAndRegeneratePreview}
          disabled={isSaving || isRegenerating}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
        >
          {isRegenerating ? "Generating..." : "Generate PDF Check"}
        </button>

        {saveMessage && (
          <span className="px-3 py-2 text-sm text-gray-600">
            {saveMessage}
          </span>
        )}
      </div>
    </>
  );
}

function EditorSidePanel({
  selected,
  selectedCurrentItem,
  updateSelected,
  deleteSelected,
  undoLastChange,
  undoDelete,
  resetSelectedItem,
  addItem,
  nudgeSelected,
  nudgeStep,
  setNudgeStep,
  generatedPdfUrl,
}: any) {
  return (
    <div className="bg-white border-l p-5 space-y-4 overflow-auto">
      <h2 className="text-lg font-semibold">Properties</h2>

      <div className="grid grid-cols-2 gap-2">
        <SmallButton label="+ Field" onClick={() => addItem("fields")} />
        <SmallButton label="+ Column" onClick={() => addItem("columns")} />
        <SmallButton label="+ Line" onClick={() => addItem("lines")} />
        <SmallButton label="+ Box" onClick={() => addItem("rectangles")} />
      </div>

      <div className="grid grid-cols-1 gap-2 border-t pt-4">
        <SmallButton label="Undo Last Change" onClick={undoLastChange} />
        <SmallButton label="Undo Delete" onClick={undoDelete} />
        <SmallButton label="Reset Selected" onClick={resetSelectedItem} />
      </div>

      {!selected || !selectedCurrentItem ? (
        <div className="p-4 rounded-lg bg-gray-50 text-sm text-gray-500">
          Select a value on the Sample OC.
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-500">
            {selected.section} #{selected.index + 1}
          </div>

          <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Nudge Selected
            </div>

            <div className="flex gap-2">
              {[1, 2, 5, 10].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setNudgeStep(step)}
                  className={`px-3 py-1 rounded border text-xs ${
                    nudgeStep === step
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700"
                  }`}
                >
                  {step}px
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-[160px]">
              <div />
              <button
                type="button"
                onClick={() => nudgeSelected(0, nudgeStep)}
                className="px-3 py-2 rounded border bg-white hover:bg-gray-100"
              >
                ↑
              </button>
              <div />

              <button
                type="button"
                onClick={() => nudgeSelected(-nudgeStep, 0)}
                className="px-3 py-2 rounded border bg-white hover:bg-gray-100"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() => nudgeSelected(0, -nudgeStep)}
                className="px-3 py-2 rounded border bg-white hover:bg-gray-100"
              >
                ↓
              </button>

              <button
                type="button"
                onClick={() => nudgeSelected(nudgeStep, 0)}
                className="px-3 py-2 rounded border bg-white hover:bg-gray-100"
              >
                →
              </button>
            </div>
          </div>

          {selected.section !== "lines" && (
            <EditorInput
              label="Label"
              value={valueAt(selectedCurrentItem, "display_label")}
              onChange={(value) => updateSelected("display_label", value)}
            />
          )}

          {selected.section !== "lines" &&
            selected.section !== "rectangles" &&
            selected.section !== "table_borders" && (
              <>
                <EditorInput
                  label="Override Preview Text"
                  value={valueAt(selectedCurrentItem, "preview_text")}
                  onChange={(value) => updateSelected("preview_text", value)}
                />

                <label className="block text-sm text-gray-600">
                  Mapped To
                  <select
                    value={mappedValue(selectedCurrentItem)}
                    onChange={(event) =>
                      updateSelected("mapped_to", event.target.value)
                    }
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select mapping</option>
                    {fieldLibrary.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

          {selected.section === "lines" ? (
            <div className="grid grid-cols-2 gap-3">
              <EditorInput
                label="X1"
                value={valueAt(selectedCurrentItem, "x1")}
                onChange={(v) => updateSelected("x1", v)}
              />
              <EditorInput
                label="Y1"
                value={valueAt(selectedCurrentItem, "y1")}
                onChange={(v) => updateSelected("y1", v)}
              />
              <EditorInput
                label="X2"
                value={valueAt(selectedCurrentItem, "x2")}
                onChange={(v) => updateSelected("x2", v)}
              />
              <EditorInput
                label="Y2"
                value={valueAt(selectedCurrentItem, "y2")}
                onChange={(v) => updateSelected("y2", v)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <EditorInput
                label="X"
                value={valueAt(selectedCurrentItem, "x_position")}
                onChange={(v) => updateSelected("x_position", v)}
              />
              <EditorInput
                label="Y"
                value={valueAt(selectedCurrentItem, "y_position")}
                onChange={(v) => updateSelected("y_position", v)}
              />
              <EditorInput
                label="Width"
                value={valueAt(selectedCurrentItem, "width")}
                onChange={(v) => updateSelected("width", v)}
              />
              <EditorInput
                label="Height"
                value={valueAt(selectedCurrentItem, "height")}
                onChange={(v) => updateSelected("height", v)}
              />
            </div>
          )}

          {!["lines", "rectangles", "table_borders"].includes(
            selected.section
          ) && (
            <div className="grid grid-cols-2 gap-3">
              <EditorInput
                label="Font Size"
                value={valueAt(selectedCurrentItem, "font_size") || "10"}
                onChange={(v) => updateSelected("font_size", v)}
              />
              <EditorInput
                label="Font Color"
                value={valueAt(selectedCurrentItem, "font_color") || "#111827"}
                onChange={(v) => updateSelected("font_color", v)}
              />
            </div>
          )}

          <button
            type="button"
            onClick={deleteSelected}
            className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-sm"
          >
            Delete Selected
          </button>
        </>
      )}

      <div className="border-t pt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Actual Generated PDF
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Use this only as final verification.
          </p>
        </div>

        {generatedPdfUrl ? (
          <>
            <a
              href={generatedPdfUrl}
              target="_blank"
              className="inline-block text-sm text-blue-700 hover:underline"
            >
              Open actual generated PDF
            </a>

            <iframe
              src={`${generatedPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1`}
              className="w-full h-[420px] border rounded-lg bg-white"
            />
          </>
        ) : (
          <div className="p-4 rounded-lg bg-yellow-50 text-sm text-yellow-800">
            No PDF check yet. Use Generate PDF Check when your layout looks correct.
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasBackground({ url }: { url: string }) {
  if (!url) {
    return <div className="absolute inset-0 bg-white" />;
  }

  const lower = url.toLowerCase();

  if (lower.includes(".pdf")) {
    return (
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&page=1&zoom=page-fit`}
        className="absolute inset-0 w-full h-full border-0 pointer-events-none bg-white"
      />
    );
  }

  return (
    <img
      src={url}
      alt="Sample OC background"
      className="absolute inset-0 w-full h-full object-fill pointer-events-none"
    />
  );
}

function Canvas({
  analysis,
  previewData,
  sampleData,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
  pageWidth,
  pageHeight,
}: {
  analysis: any;
  previewData: any;
  sampleData?: any;
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem) => void;
  onStartMove: (
    event: React.MouseEvent,
    section: SectionType,
    index: number,
    item: any
  ) => void;
  onStartResize: (
    event: React.MouseEvent,
    section: SectionType,
    index: number,
    item: any
  ) => void;
  pageWidth: number;
  pageHeight: number;
}) {
  const tableBorders = asArray(analysis.table_borders);
  const rectangles = asArray(analysis.rectangles);
  const lines = asArray(analysis.lines);
  const logos = asArray(analysis.logos);
  const fields = asArray(analysis.fields);
  const columns = asArray(analysis.columns);
  const totals = asArray(analysis.totals);
  const staticBlocks = asArray(analysis.static_blocks);

  return (
    <>
      {tableBorders.map((item, index) => (
        <TableBorderBox
          key={`table-border-${index}`}
          item={normalizedItem(item, "table_borders", index, pageWidth, pageHeight)}
          index={index}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        />
      ))}

      {rectangles.map((item, index) => (
        <RectangleBox
          key={`rect-${index}`}
          item={normalizedItem(item, "rectangles", index, pageWidth, pageHeight)}
          index={index}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        />
      ))}

      {lines.map((item, index) => (
        <LineBox
          key={`line-${index}`}
          item={item}
          index={index}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        />
      ))}

      {logos.map((logo, index) => (
        <SelectableBox
          key={`logo-${index}`}
          section="logos"
          index={index}
          item={normalizedItem(logo, "logos", index, pageWidth, pageHeight)}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        >
          Logo
        </SelectableBox>
      ))}

      {fields.map((field, index) => (
        <SelectableBox
          key={`field-${index}`}
          section="fields"
          index={index}
          item={normalizedItem(field, "fields", index, pageWidth, pageHeight)}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        >
          {previewValue(field, previewData, sampleData)}
        </SelectableBox>
      ))}

      {columns.map((column, index) => (
        <ColumnBox
          key={`column-${index}`}
          column={normalizedItem(column, "columns", index, pageWidth, pageHeight)}
          index={index}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        />
      ))}

      {totals.map((total, index) => (
        <SelectableBox
          key={`total-${index}`}
          section="totals"
          index={index}
          item={normalizedItem(total, "totals", index, pageWidth, pageHeight)}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        >
          {previewValue(total, previewData, sampleData)}
        </SelectableBox>
      ))}

      {staticBlocks.map((block, index) => (
        <SelectableBox
          key={`static-${index}`}
          section="static_blocks"
          index={index}
          item={normalizedItem(block, "static_blocks", index, pageWidth, pageHeight)}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        >
          {valueAt(block, "content") ||
            valueAt(block, "preview_text") ||
            valueAt(block, "display_label")}
        </SelectableBox>
      ))}
    </>
  );
}

function TableBorderBox({
  item,
  index,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
  pageHeight,
}: any) {
  const isSelected =
    selected?.section === "table_borders" && selected?.index === index;
  const x = Number(item.x_position || 35);
  const y = Number(item.y_position || 530);
  const width = Number(item.width || 520);
  const height = Number(item.height || 150);

  return (
    <button
      type="button"
      onClick={() => onSelect({ section: "table_borders", index })}
      onMouseDown={(e) => onStartMove(e, "table_borders", index, item)}
      className={`absolute bg-transparent ${
        isSelected ? "ring-2 ring-blue-300" : ""
      }`}
      style={{
        left: x,
        top: pageHeight - y - height,
        width,
        height,
        border: `${item.border_thickness || 1}px solid ${
          item.border_color || "#111827"
        }`,
      }}
    >
      {isSelected && (
        <ResizeHandle
          onMouseDown={(e) => onStartResize(e, "table_borders", index, item)}
        />
      )}
    </button>
  );
}

function RectangleBox({
  item,
  index,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
  pageHeight,
}: any) {
  const isSelected =
    selected?.section === "rectangles" && selected?.index === index;

  return (
    <button
      type="button"
      onClick={() => onSelect({ section: "rectangles", index })}
      onMouseDown={(e) => onStartMove(e, "rectangles", index, item)}
      className={`absolute ${isSelected ? "ring-2 ring-blue-300" : ""}`}
      style={{
        left: item.x_position,
        top: pageHeight - item.y_position - item.height,
        width: item.width,
        height: item.height,
        border: `${item.border_thickness || 1}px solid ${
          item.border_color || "#111827"
        }`,
        background: item.fill_color || "transparent",
      }}
    >
      {isSelected && (
        <ResizeHandle
          onMouseDown={(e) => onStartResize(e, "rectangles", index, item)}
        />
      )}
    </button>
  );
}

function LineBox({
  item,
  index,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
  pageHeight,
}: any) {
  const isSelected = selected?.section === "lines" && selected?.index === index;
  const x1 = Number(item.x1 || 0);
  const y1 = Number(item.y1 || 0);
  const x2 = Number(item.x2 || 100);
  const y2 = Number(item.y2 || y1);
  const left = Math.min(x1, x2);
  const top = pageHeight - Math.max(y1, y2);
  const width = Math.max(Math.abs(x2 - x1), 4);
  const height = Math.max(Math.abs(y2 - y1), Number(item.thickness || 1), 4);

  return (
    <button
      type="button"
      onClick={() => onSelect({ section: "lines", index })}
      onMouseDown={(e) => onStartMove(e, "lines", index, item)}
      className={`absolute ${isSelected ? "ring-2 ring-blue-300" : ""}`}
      style={{ left, top, width, height }}
    >
      <span
        className="absolute left-0 top-1/2 w-full"
        style={{
          borderTop: `${item.thickness || 1}px solid ${
            item.color || "#111827"
          }`,
        }}
      />
      {isSelected && (
        <ResizeHandle
          onMouseDown={(e) => onStartResize(e, "lines", index, item)}
        />
      )}
    </button>
  );
}

function ColumnBox({
  column,
  index,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
  pageHeight,
}: any) {
  const isSelected =
    selected?.section === "columns" && selected?.index === index;
  const x = Number(column.x_position || 35 + index * 65);
  const y = Number(column.y_position || 530);
  const width = Number(column.width || 65);
  const fontSize = Number(column.font_size || 8);
  const rowHeight = Number(column.row_height || 22);

  return (
    <>
      {previewItems.map((item, itemIndex) => (
        <button
          key={`column-cell-${index}-${itemIndex}`}
          type="button"
          onClick={() => onSelect({ section: "columns", index })}
          onMouseDown={(e) => onStartMove(e, "columns", index, column)}
          className={`absolute text-left bg-white/70 border px-1 overflow-hidden ${
            isSelected
              ? "border-blue-500 ring-2 ring-blue-200"
              : "border-gray-300 hover:border-blue-300"
          }`}
          style={{
            left: x,
            top: pageHeight - y - fontSize + itemIndex * rowHeight,
            width,
            height: Math.max(rowHeight, fontSize + 4),
            fontSize,
            cursor: "move",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          {itemValue(column, item)}
          {isSelected && itemIndex === 0 && (
            <ResizeHandle
              onMouseDown={(e) => onStartResize(e, "columns", index, column)}
            />
          )}
        </button>
      ))}
    </>
  );
}

function SelectableBox({
  section,
  index,
  item,
  selected,
  onSelect,
  onStartMove,
  onStartResize,
  pageHeight,
  children,
}: any) {
  const isSelected = selected?.section === section && selected?.index === index;
  const x = Number(item.x_position || 0);
  const y = Number(item.y_position || 0);
  const width = Number(item.width || 180);
  const height = Number(item.height || item.font_size || 18);
  const fontSize = Number(item.font_size || 10);

  return (
    <button
      type="button"
      onClick={() => onSelect({ section, index })}
      onMouseDown={(e) => onStartMove(e, section, index, item)}
      className={`absolute text-left bg-white/70 border px-1 overflow-hidden ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-gray-300 hover:border-blue-300"
      }`}
      style={{
        left: x,
        top: pageHeight - y - fontSize,
        width,
        height,
        fontSize,
        color: item.font_color || "#111827",
        fontFamily: item.font_family || "Arial",
        cursor: "move",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      {children}
      {isSelected && (
        <ResizeHandle
          onMouseDown={(e) => onStartResize(e, section, index, item)}
        />
      )}
    </button>
  );
}

function ResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (event: React.MouseEvent) => void;
}) {
  return (
    <span
      onMouseDown={onMouseDown}
      className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 border border-white"
      style={{ cursor: "nwse-resize" }}
    />
  );
}

function EditorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-gray-600">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}

function SmallButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-lg bg-gray-50 text-gray-700 border hover:bg-gray-100 text-sm"
    >
      {label}
    </button>
  );
}