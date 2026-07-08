"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

type Props = {
  ocId: string;
  orderItemId: string;
  initialAnalysis: any;
  previewData: any;
  originalImageUrl: string;
  generatedPdfUrl: string;
  pageWidth: number;
  pageHeight: number;
  backUrl: string;
  title: string;
};

const fieldLibrary = [
  "seller.logo",
  "seller.company_name",
  "seller.address",
  "seller.gst_no",
  "seller.phone",
  "seller.email",
  "seller.bank_name",
  "seller.account_number",
  "seller.swift_code",
  "customer.name",
  "customer.address",
  "customer.country",
  "customer.email",
  "customer.phone",
  "order.oc_number",
  "order.oc_date",
  "order.po_number",
  "order.delivery_date",
  "order.payment_terms",
  "order.shipment_terms",
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

function previewValue(row: any, previewData: any) {
  const manualText = valueAt(row, "preview_text");
  if (manualText) return manualText;

  const mapped = mappedValue(row);
  const value = getByPath(previewData, mapped);

  if (value) return String(value);

  return (
    valueAt(row, "content") || valueAt(row, "display_label") || mapped || ""
  );
}

function itemValue(column: any, item: any) {
  const mapped = mappedValue(column);
  const itemPath = mapped.startsWith("item.")
    ? mapped.replace("item.", "")
    : valueAt(column, "source_field");

  return String(item?.[itemPath] ?? "");
}

function numberOrFallback(value: any, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function removeRuntimeKeys(item: any) {
  const copy = deepClone(item);

  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;

  return copy;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAnalysis(analysis: any) {
  return {
    logos: asArray(analysis?.logos),
    fields: asArray(analysis?.fields),
    columns: asArray(analysis?.columns),
    totals: asArray(analysis?.totals),
    static_blocks: asArray(analysis?.static_blocks),
    lines: asArray(analysis?.lines),
    rectangles: asArray(analysis?.rectangles),
    table_borders: asArray(analysis?.table_borders),
  };
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

function withPercentCoordinates(
  analysis: any,
  pageWidth: number,
  pageHeight: number
) {
  const normalized = normalizeAnalysis(analysis);

  function convert(item: any) {
    return {
      ...item,
      ...positionToPercent(item, pageWidth, pageHeight),
    };
  }

  function convertLine(item: any) {
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
    logos: normalized.logos.map(convert),
    fields: normalized.fields.map(convert),
    columns: normalized.columns.map(convert),
    totals: normalized.totals.map(convert),
    static_blocks: normalized.static_blocks.map(convert),
    rectangles: normalized.rectangles.map(convert),
    table_borders: normalized.table_borders.map(convert),
    lines: normalized.lines.map(convertLine),
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
  section: SectionType,
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

export default function FinalOCVisualEditor({
  ocId,
  orderItemId,
  initialAnalysis,
  previewData,
  originalImageUrl,
  generatedPdfUrl,
  pageWidth,
  pageHeight,
  backUrl,
  title,
}: Props) {
  const safePageWidth = pageWidth > 0 ? pageWidth : 595;
  const safePageHeight = pageHeight > 0 ? pageHeight : 842;

  const [analysis, setAnalysis] = useState(() =>
    withPercentCoordinates(clone(initialAnalysis), safePageWidth, safePageHeight)
  );
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [deletedHistory, setDeletedHistory] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1.25);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [livePdfUrl, setLivePdfUrl] = useState(generatedPdfUrl);
  const [dragState, setDragState] = useState<any>(null);
  const [nudgeStep, setNudgeStep] = useState(2);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [inlineEdit, setInlineEdit] = useState<{
  section: SectionType;
  index: number;
  value: string;
} | null>(null);
const [clipboard, setClipboard] = useState<{
  section: SectionType;
  item: any;
} | null>(null);

  const autoTimerRef = useRef<number | null>(null);
  const firstLoadRef = useRef(true);
  const latestAnalysisRef = useRef<any>(analysis);

  const selectedItem = useMemo(() => {
    if (!selected) return null;
    return asArray(analysis[selected.section])[selected.index] || null;
  }, [analysis, selected]);

  useEffect(() => {
    latestAnalysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }

    if (!hasUnsavedChanges || dragState || isSaving || isGenerating) return;

    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
    }

    autoTimerRef.current = window.setTimeout(() => {
      saveFinalLayout(true, true);
    }, 1400);

    return () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current);
      }
    };
  }, [analysis, hasUnsavedChanges, dragState, isSaving, isGenerating]);

useEffect(() => {
  function onWindowKeyDown(event: KeyboardEvent) {
    handleEditorKeyDown(event);
  }

  window.addEventListener("keydown", onWindowKeyDown);

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown);
  };
}, [analysis, selected, clipboard, inlineEdit]);


function startInlineEdit(section: SectionType, index: number, item: any) {
  if (["lines", "rectangles", "table_borders", "logos"].includes(section)) {
    return;
  }

  const value =
    valueAt(item, "preview_text") ||
    valueAt(item, "content") ||
    valueAt(item, "display_label") ||
    mappedValue(item);

  setSelected({ section, index });
  setInlineEdit({ section, index, value });
}

function cancelInlineEdit() {
  setInlineEdit(null);
}

function saveInlineEdit() {
  if (!inlineEdit) return;

  const { section, index, value } = inlineEdit;

  const nextAnalysis = {
    ...analysis,
    [section]: asArray(analysis[section]).map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      if (section === "static_blocks") {
        return {
          ...item,
          content: value,
          preview_text: value,
        };
      }

      return {
        ...item,
        preview_text: value,
      };
    }),
  };

  commit(nextAnalysis);
  setInlineEdit(null);
}  
function convertValuesToPercents(values: any) {
    const nextValues = { ...values };

    if ("x_position" in nextValues) {
      nextValues.x_percent = Number(nextValues.x_position || 0) / safePageWidth;
    }

    if ("y_position" in nextValues) {
      nextValues.y_percent = Number(nextValues.y_position || 0) / safePageHeight;
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

  function markChanged(message = "Unsaved changes") {
    setHasUnsavedChanges(true);
    setSaveMessage(message);
  }

  function commit(nextAnalysis: any) {
    setHistory((current) => [...current.slice(-49), clone(analysis)]);
    setAnalysis(nextAnalysis);
    markChanged("Unsaved changes");
  }

  function updateSelected(key: string, value: string) {
    if (!selected) return;

    const numericKeys = [
      "x_position",
      "y_position",
      "width",
      "height",
      "font_size",
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
    ];

    const nextAnalysis = {
      ...analysis,
      [selected.section]: asArray(analysis[selected.section]).map(
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

  function updateItem(section: SectionType, index: number, values: any) {
    const nextValues = convertValuesToPercents(values);

    setAnalysis((current: any) => ({
      ...current,
      [section]: asArray(current[section]).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...nextValues } : item
      ),
    }));

    markChanged("Editing...");
  }

  function startMove(
    event: React.MouseEvent,
    section: SectionType,
    index: number,
    item: any
  ) {
    event.preventDefault();
    event.stopPropagation();

    setHistory((current) => [...current.slice(-49), clone(analysis)]);
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

    setHistory((current) => [...current.slice(-49), clone(analysis)]);
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
          x2: Math.round(clamp(dragState.startX2 + deltaX, 0, safePageWidth)),
          y2: Math.round(clamp(dragState.startY2 - deltaY, 0, safePageHeight)),
        });
      } else {
        updateItem(dragState.section, dragState.index, {
          x2: Math.round(clamp(dragState.startX2 + deltaX, 0, safePageWidth)),
          y2: Math.round(clamp(dragState.startY2 - deltaY, 0, safePageHeight)),
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
    } else {
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

  function addItem(section: SectionType) {
    const items = asArray(analysis[section]);
    const defaultX = safePageWidth * 0.08;
    const defaultY = safePageHeight * 0.6;

    const defaults: Partial<Record<SectionType, any>> = {
      fields: {
        display_label: "New Field",
        field_name: `custom.final_field_${items.length + 1}`,
        mapped_to: "manual.custom_text",
        page_number: 1,
        x_position: defaultX,
        y_position: defaultY,
        width: safePageWidth * 0.3,
        height: safePageHeight * 0.025,
        font_size: 10,
        font_color: "#111827",
        preview_text: "Editable Text",
      },
      static_blocks: {
        display_label: "Fixed Text",
        block_key: `fixed_text_${items.length + 1}`,
        content: "Fixed Text",
        page_number: 1,
        x_position: defaultX,
        y_position: defaultY,
        width: safePageWidth * 0.3,
        height: safePageHeight * 0.025,
        font_size: 10,
        font_color: "#111827",
      },
      columns: {
        display_label: "New Column",
        source_field: "item.notes",
        mapped_to: "item.notes",
        column_order: items.length + 1,
        x_position: safePageWidth * 0.06 + items.length * 65,
        y_position: safePageHeight * 0.63,
        width: safePageWidth * 0.11,
        height: safePageHeight * 0.035,
        row_height: safePageHeight * 0.026,
        font_size: 8,
      },
      totals: {
        display_label: "Total",
        total_key: "order.total_amount",
        mapped_to: "order.total_amount",
        x_position: safePageWidth * 0.65,
        y_position: safePageHeight * 0.25,
        width: safePageWidth * 0.25,
        height: safePageHeight * 0.025,
        font_size: 10,
      },
      lines: {
        line_key: `line_${items.length + 1}`,
        x1: defaultX,
        y1: defaultY,
        x2: safePageWidth * 0.92,
        y2: defaultY,
        thickness: 1,
        color: "#111827",
      },
      rectangles: {
        rectangle_key: `rectangle_${items.length + 1}`,
        display_label: "Box",
        x_position: defaultX,
        y_position: defaultY,
        width: safePageWidth * 0.35,
        height: safePageHeight * 0.1,
        border_thickness: 1,
        border_color: "#111827",
        fill_color: "transparent",
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
      },
    };

    const item = convertValuesToPercents(defaults[section] || {});

    commit({
      ...analysis,
      [section]: [...items, item],
    });
  }

  function undoLastChange() {
    const previous = history[history.length - 1];
    if (!previous) return;

    setAnalysis(previous);
    setHistory((current) => current.slice(0, -1));
    markChanged("Unsaved changes");
  }

  function deleteSelected() {
    if (!selected) return;

    const item = asArray(analysis[selected.section])[selected.index];

    setDeletedHistory((current) => [
      { section: selected.section, index: selected.index, item: clone(item) },
      ...current,
    ]);

    commit({
      ...analysis,
      [selected.section]: asArray(analysis[selected.section]).filter(
        (_item, index) => index !== selected.index
      ),
    });

    setSelected(null);
  }

  function undoDelete() {
    const deleted = deletedHistory[0];
    if (!deleted) return;

    const deletedSection = deleted.section as SectionType;
    const items = asArray(analysis[deletedSection]);
    const insertIndex = clamp(deleted.index, 0, items.length);

    commit({
      ...analysis,
      [deletedSection]: [
        ...items.slice(0, insertIndex),
        deleted.item,
        ...items.slice(insertIndex),
      ],
    });

    setDeletedHistory((current) => current.slice(1));
  }

  function nudgeSelected(deltaX: number, deltaY: number) {
    if (!selected || !selectedItem) return;

    if (selected.section === "lines") {
      updateItem(selected.section, selected.index, {
        x1: Math.round(Number(selectedItem.x1 || 0) + deltaX),
        x2: Math.round(Number(selectedItem.x2 || 0) + deltaX),
        y1: Math.round(Number(selectedItem.y1 || 0) + deltaY),
        y2: Math.round(Number(selectedItem.y2 || 0) + deltaY),
      });

      return;
    }

    updateItem(selected.section, selected.index, {
      x_position: Math.round(Number(selectedItem.x_position || 0) + deltaX),
      y_position: Math.round(Number(selectedItem.y_position || 0) + deltaY),
    });
  }

  async function saveFinalLayout(generatePdf: boolean, isAuto = false) {
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }

    setIsSaving(!generatePdf);
    setIsGenerating(generatePdf);
    setSaveMessage(
      isAuto
        ? "Autosaving and updating preview..."
        : generatePdf
        ? "Generating final PDF..."
        : "Saving..."
    );

    const formData = new FormData();
    formData.append("oc_id", ocId);
    formData.append("order_item_id", orderItemId);
    formData.append(
      "analysis",
      JSON.stringify(
        withPercentCoordinates(
          latestAnalysisRef.current,
          safePageWidth,
          safePageHeight
        )
      )
    );
    formData.append("generate_pdf", generatePdf ? "1" : "0");

    const response = await fetch("/api/orders/final-oc/save", {
      method: "POST",
      body: formData,
    });

    const result = await response.json().catch(() => null);

    setIsSaving(false);
    setIsGenerating(false);

    if (!response.ok || !result?.ok) {
      setSaveMessage(result?.error || "Save failed");
      return;
    }

    setHasUnsavedChanges(false);

    if (generatePdf && result.pdf_url) {
      setLivePdfUrl(`${result.pdf_url}?t=${Date.now()}`);
      setSaveMessage(
        isAuto ? "Autosaved · Preview updated" : "Final PDF generated"
      );
      return;
    }

    setSaveMessage(isAuto ? "Autosaved" : "Saved");
  }

function handleEditorKeyDown(
  event: React.KeyboardEvent<HTMLDivElement> | KeyboardEvent
) {
  if (inlineEdit) return;
  if (!selected) return;

  const target = event.target as HTMLElement;

  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  ) {
    return;
  }

  const section = selected.section;
  const index = selected.index;
  const items = asArray(analysis[section]);

  if (!items[index]) return;

  const item = deepClone(items[index]);
  const step = event.shiftKey ? 10 : 1;

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelected();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
    event.preventDefault();

    setClipboard({
      section,
      item: removeRuntimeKeys(item),
    });

    setSaveMessage("Copied");
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();

    const duplicate = removeRuntimeKeys(item);

    duplicate.x_position = Number(duplicate.x_position || 0) + 10;
    duplicate.y_position = Number(duplicate.y_position || 0) - 10;

    const next = [...items];
    next.splice(index + 1, 0, duplicate);

    commit({
      ...analysis,
      [section]: next,
    });

    setSelected({ section, index: index + 1 });
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
    event.preventDefault();

    if (!clipboard) {
      setSaveMessage("Nothing copied");
      return;
    }

    const pastedSection = clipboard.section;
    const pastedItems = asArray(analysis[pastedSection]);
    const pasted = deepClone(clipboard.item);

    pasted.x_position = Number(pasted.x_position || 0) + 10;
    pasted.y_position = Number(pasted.y_position || 0) - 10;

    commit({
      ...analysis,
      [pastedSection]: [...pastedItems, pasted],
    });

    setSelected({
      section: pastedSection,
      index: pastedItems.length,
    });

    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoLastChange();
    return;
  }

  if (
    event.key.startsWith("Arrow") &&
    ["fields", "columns", "totals", "static_blocks", "logos"].includes(section)
  ) {
    event.preventDefault();

    const nextItem = {
      ...item,
      x_position: Number(item.x_position || 0),
      y_position: Number(item.y_position || 0),
    };

    if (event.key === "ArrowLeft") {
      nextItem.x_position -= step;
    }

    if (event.key === "ArrowRight") {
      nextItem.x_position += step;
    }

    if (event.key === "ArrowUp") {
      nextItem.y_position += step;
    }

    if (event.key === "ArrowDown") {
      nextItem.y_position -= step;
    }

    const nextItems = [...items];
    nextItems[index] = convertValuesToPercents(nextItem);

    commit({
      ...analysis,
      [section]: nextItems,
    });
  }
}

  const previewItems = asArray(previewData?.items);

  return (
 <div
  className="fixed inset-0 bg-gray-100 z-50 flex flex-col"
  suppressHydrationWarning
>
      <div className="h-16 bg-white border-b px-5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={backUrl}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
          >
            ← Back
          </Link>

          <div className="min-w-0">
            <div className="font-semibold truncate">{title}</div>
            <div className="text-xs text-gray-500">
              Final OC editor · autosaves and updates PDF preview
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
            onClick={() => setZoom((current) => clamp(current + 0.1, 0.5, 2))}
            className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => saveFinalLayout(false)}
            disabled={isSaving || isGenerating}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Final Layout"}
          </button>

          <button
            type="button"
            onClick={() => saveFinalLayout(true)}
            disabled={isSaving || isGenerating}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Final PDF"}
          </button>,<Link
  href={`/orders/${orderItemId}/oc/send`}
  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
>
  Send Final OC
</Link>

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
  analysis={analysis}
  previewData={previewData}
  previewItems={previewItems}
  selected={selected}
  inlineEdit={inlineEdit}
  onSelect={setSelected}
  onStartMove={startMove}
  onStartResize={startResize}
  onStartInlineEdit={startInlineEdit}
  onInlineEditChange={(value: string) =>
    setInlineEdit((current) =>
      current ? { ...current, value } : current
    )
  }
  onInlineEditSave={saveInlineEdit}
  onInlineEditCancel={cancelInlineEdit}
  pageWidth={safePageWidth}
  pageHeight={safePageHeight}
/>
            </div>
          </div>
        </div>

        <div className="bg-white border-l p-5 space-y-4 overflow-auto">
          <h2 className="text-lg font-semibold">Properties</h2>

          <div className="grid grid-cols-2 gap-2">
            <SmallButton label="+ Field" onClick={() => addItem("fields")} />
            <SmallButton
              label="+ Fixed Text"
              onClick={() => addItem("static_blocks")}
            />
            <SmallButton label="+ Column" onClick={() => addItem("columns")} />
            <SmallButton label="+ Total" onClick={() => addItem("totals")} />
            <SmallButton label="+ Line" onClick={() => addItem("lines")} />
            <SmallButton label="+ Box" onClick={() => addItem("rectangles")} />
            <SmallButton
              label="+ Table Border"
              onClick={() => addItem("table_borders")}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 border-t pt-4">
            <SmallButton label="Undo Last Change" onClick={undoLastChange} />
            <SmallButton label="Undo Delete" onClick={undoDelete} />
          </div>

          {!selected || !selectedItem ? (
            <div className="p-4 rounded-lg bg-gray-50 text-sm text-gray-500">
              Select any text, field, column, line or box on the OC.
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
                  value={valueAt(selectedItem, "display_label")}
                  onChange={(value) => updateSelected("display_label", value)}
                />
              )}

              {!["lines", "rectangles", "table_borders"].includes(
                selected.section
              ) && (
                <>
                  <EditorInput
                    label="Edit Text / Override Text"
                    value={valueAt(selectedItem, "preview_text")}
                    onChange={(value) => updateSelected("preview_text", value)}
                  />

                  {selected.section === "static_blocks" && (
                    <EditorInput
                      label="Fixed Text Content"
                      value={valueAt(selectedItem, "content")}
                      onChange={(value) => updateSelected("content", value)}
                    />
                  )}

                  <label className="block text-sm text-gray-600">
                    Mapped To
                    <select
                      value={mappedValue(selectedItem)}
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
                    value={valueAt(selectedItem, "x1")}
                    onChange={(value) => updateSelected("x1", value)}
                  />
                  <EditorInput
                    label="Y1"
                    value={valueAt(selectedItem, "y1")}
                    onChange={(value) => updateSelected("y1", value)}
                  />
                  <EditorInput
                    label="X2"
                    value={valueAt(selectedItem, "x2")}
                    onChange={(value) => updateSelected("x2", value)}
                  />
                  <EditorInput
                    label="Y2"
                    value={valueAt(selectedItem, "y2")}
                    onChange={(value) => updateSelected("y2", value)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <EditorInput
                    label="X"
                    value={valueAt(selectedItem, "x_position")}
                    onChange={(value) => updateSelected("x_position", value)}
                  />
                  <EditorInput
                    label="Y"
                    value={valueAt(selectedItem, "y_position")}
                    onChange={(value) => updateSelected("y_position", value)}
                  />
                  <EditorInput
                    label="Width"
                    value={valueAt(selectedItem, "width")}
                    onChange={(value) => updateSelected("width", value)}
                  />
                  <EditorInput
                    label="Height"
                    value={valueAt(selectedItem, "height")}
                    onChange={(value) => updateSelected("height", value)}
                  />
                </div>
              )}

              {!["lines", "rectangles", "table_borders"].includes(
                selected.section
              ) && (
                <div className="grid grid-cols-2 gap-3">
                  <EditorInput
                    label="Font Size"
                    value={valueAt(selectedItem, "font_size") || "10"}
                    onChange={(value) => updateSelected("font_size", value)}
                  />
                  <EditorInput
                    label="Font Color"
                    value={valueAt(selectedItem, "font_color") || "#111827"}
                    onChange={(value) => updateSelected("font_color", value)}
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
            <h3 className="text-sm font-semibold text-gray-800">
              Final Generated PDF
            </h3>

            {livePdfUrl ? (
              <>
                <a
                  href={livePdfUrl}
                  target="_blank"
                  className="inline-block text-sm text-blue-700 hover:underline"
                >
                  Open final PDF
                </a>

                <iframe
                  src={`${livePdfUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1`}
                  className="w-full h-[420px] border rounded-lg bg-white"
                />
              </>
            ) : (
              <div className="p-4 rounded-lg bg-yellow-50 text-sm text-yellow-800">
                No final PDF yet. Click Generate Final PDF.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasBackground({ url }: { url: string }) {
  if (!url) return <div className="absolute inset-0 bg-white" />;

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
      alt="OC background"
      className="absolute inset-0 w-full h-full object-fill pointer-events-none"
    />
  );
}

function Canvas({
  analysis,
  previewData,
  previewItems,
  selected,
inlineEdit,
  onSelect,
  onStartMove,
  onStartResize,
onStartInlineEdit,
onInlineEditChange,
onInlineEditSave,
onInlineEditCancel,
  pageWidth,
  pageHeight,
}: any) {
  return (
    <>
      {asArray(analysis.table_borders).map((item, index) => (
        <TableBorderBox
          key={`table-${index}`}
          item={normalizedItem(
            item,
            "table_borders",
            index,
            pageWidth,
            pageHeight
          )}
          index={index}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        />
      ))}

      {asArray(analysis.rectangles).map((item, index) => (
        <RectangleBox
          key={`rect-${index}`}
          item={normalizedItem(
            item,
            "rectangles",
            index,
            pageWidth,
            pageHeight
          )}
          index={index}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        />
      ))}

      {asArray(analysis.lines).map((item, index) => (
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

      {asArray(analysis.logos).map((item, index) => (
        <SelectableBox
          key={`logo-${index}`}
          section="logos"
          index={index}
          item={normalizedItem(item, "logos", index, pageWidth, pageHeight)}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        >
          Logo
        </SelectableBox>
      ))}

      {asArray(analysis.fields).map((item, index) => (
        <SelectableBox
  key={`field-${index}`}
  section="fields"
  index={index}
  item={normalizedItem(item, "fields", index, pageWidth, pageHeight)}
  selected={selected}
  inlineEdit={inlineEdit}
  onSelect={onSelect}
  onStartMove={onStartMove}
  onStartResize={onStartResize}
  onStartInlineEdit={onStartInlineEdit}
  onInlineEditChange={onInlineEditChange}
  onInlineEditSave={onInlineEditSave}
  onInlineEditCancel={onInlineEditCancel}
  pageHeight={pageHeight}
>
          {previewValue(item, previewData)}
        </SelectableBox>
      ))}

      {asArray(analysis.columns).map((column, index) => (
        <ColumnBox
          key={`column-${index}`}
          column={normalizedItem(
            column,
            "columns",
            index,
            pageWidth,
            pageHeight
          )}
          index={index}
          previewItems={previewItems}
          selected={selected}
          onSelect={onSelect}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          pageHeight={pageHeight}
        />
      ))}

      {asArray(analysis.totals).map((item, index) => (
       <SelectableBox
  key={`total-${index}`}
  section="totals"
  index={index}
  item={normalizedItem(item, "totals", index, pageWidth, pageHeight)}
  selected={selected}
  inlineEdit={inlineEdit}
  onSelect={onSelect}
  onStartMove={onStartMove}
  onStartResize={onStartResize}
  onStartInlineEdit={onStartInlineEdit}
  onInlineEditChange={onInlineEditChange}
  onInlineEditSave={onInlineEditSave}
  onInlineEditCancel={onInlineEditCancel}
  pageHeight={pageHeight}
>
          {previewValue(item, previewData)}
        </SelectableBox>
      ))}

      {asArray(analysis.static_blocks).map((item, index) => (
        <SelectableBox
  key={`static-${index}`}
  section="static_blocks"
  index={index}
  item={normalizedItem(
    item,
    "static_blocks",
    index,
    pageWidth,
    pageHeight
  )}
  selected={selected}
  inlineEdit={inlineEdit}
  onSelect={onSelect}
  onStartMove={onStartMove}
  onStartResize={onStartResize}
  onStartInlineEdit={onStartInlineEdit}
  onInlineEditChange={onInlineEditChange}
  onInlineEditSave={onInlineEditSave}
  onInlineEditCancel={onInlineEditCancel}
  pageHeight={pageHeight}
>
          {valueAt(item, "content") ||
            valueAt(item, "preview_text") ||
            valueAt(item, "display_label")}
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

  return (
    <button
      type="button"
      onClick={() => onSelect({ section: "table_borders", index })}
      onMouseDown={(event) =>
        onStartMove(event, "table_borders", index, item)
      }
      className={`absolute bg-transparent ${
        isSelected ? "ring-2 ring-blue-300" : ""
      }`}
      style={{
        left: item.x_position,
        top: pageHeight - item.y_position - item.height,
        width: item.width,
        height: item.height,
        border: `${item.border_thickness || 1}px solid ${
          item.border_color || "#111827"
        }`,
      }}
    >
      {isSelected && (
        <ResizeHandle
          onMouseDown={(event) =>
            onStartResize(event, "table_borders", index, item)
          }
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
      onMouseDown={(event) => onStartMove(event, "rectangles", index, item)}
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
          onMouseDown={(event) =>
            onStartResize(event, "rectangles", index, item)
          }
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
      onMouseDown={(event) => onStartMove(event, "lines", index, item)}
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
          onMouseDown={(event) => onStartResize(event, "lines", index, item)}
        />
      )}
    </button>
  );
}

function ColumnBox({
  column,
  index,
  previewItems,
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
      {previewItems.map((item: any, itemIndex: number) => (
        <button
          key={`column-cell-${index}-${itemIndex}`}
          type="button"
          onClick={() => onSelect({ section: "columns", index })}
          onMouseDown={(event) => onStartMove(event, "columns", index, column)}
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
              onMouseDown={(event) =>
                onStartResize(event, "columns", index, column)
              }
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
inlineEdit,
  onSelect,
  onStartMove,
  onStartResize,
onStartInlineEdit,
onInlineEditChange,
onInlineEditSave,
onInlineEditCancel,
  pageHeight,
  children,
}: any) {
  const isSelected = selected?.section === section && selected?.index === index;
const isInlineEditing =
  inlineEdit?.section === section && inlineEdit?.index === index;
  const x = Number(item.x_position || 0);
  const y = Number(item.y_position || 0);
  const width = Number(item.width || 180);
  const height = Number(item.height || item.font_size || 18);
  const fontSize = Number(item.font_size || 10);

  return (
    <button
  type="button"
  onClick={() => onSelect({ section, index })}
  onDoubleClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    onStartInlineEdit?.(section, index, item);
  }}
  onMouseDown={(event) => {
    if (isInlineEditing) return;
    onStartMove(event, section, index, item);
  }}
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
     {isInlineEditing ? (
  <input
    autoFocus
    value={inlineEdit.value}
    onChange={(event) => onInlineEditChange(event.target.value)}
    onBlur={onInlineEditSave}
    onKeyDown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onInlineEditSave();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onInlineEditCancel();
      }
    }}
    className="w-full bg-white border border-blue-400 px-1 outline-none"
    style={{
      fontSize,
      color: item.font_color || "#111827",
      fontFamily: item.font_family || "Arial",
    }}
  />
) : (
  children
)}
      {isSelected && (
        <ResizeHandle
          onMouseDown={(event) => onStartResize(event, section, index, item)}
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