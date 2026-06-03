"use client";

import { useEffect, useState } from "react";

type BulkSelectionControlsProps = {
  formId: string;
  label?: string;
  showDelete?: boolean;
  showMove?: boolean;
  showRestore?: boolean;
  showPermanentDelete?: boolean;
};

export default function BulkSelectionControls({
  formId,
  label = "Select All",
  showDelete = true,
  showMove = true,
  showRestore = false,
  showPermanentDelete = false,
}: BulkSelectionControlsProps) {
  const [selectedCount, setSelectedCount] = useState(0);

  function getCheckboxes() {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="ids"][data-bulk-form="${formId}"]`
      )
    );
  }

  function refreshCount() {
    const checked = getCheckboxes().filter((box) => box.checked).length;
    setSelectedCount(checked);
  }

  function toggleAll(checked: boolean) {
    for (const box of getCheckboxes()) {
      box.checked = checked;
    }

    refreshCount();
  }

  useEffect(() => {
    const boxes = getCheckboxes();

    for (const box of boxes) {
      box.addEventListener("change", refreshCount);
    }

    refreshCount();

    return () => {
      for (const box of boxes) {
        box.removeEventListener("change", refreshCount);
      }
    };
  }, [formId]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          onChange={(event) => toggleAll(event.target.checked)}
        />
        {label}
      </label>

      <div className="text-sm text-gray-600">{selectedCount} selected</div>

      {showDelete && (
        <button
          form={formId}
          type="submit"
          name="operation"
          value="delete"
          className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-sm"
        >
          Delete Selected
        </button>
      )}

      {showRestore && (
        <button
          form={formId}
          type="submit"
          name="operation"
          value="restore"
          className="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm"
        >
          Restore Selected
        </button>
      )}

      {showPermanentDelete && (
        <button
          form={formId}
          type="submit"
          name="operation"
          value="permanent_delete"
          className="px-4 py-2 rounded-lg bg-red-200 text-red-800 hover:bg-red-300 text-sm"
        >
          Delete Permanently
        </button>
      )}

      {showMove && (
        <>
          <button
            form={formId}
            type="submit"
            name="operation"
            value="move_to_orders"
            className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm"
          >
            Move To Orders
          </button>

          <button
            form={formId}
            type="submit"
            name="operation"
            value="move_to_enquiries"
            className="px-4 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm"
          >
            Move To Enquiries
          </button>

          <button
            form={formId}
            type="submit"
            name="operation"
            value="move_to_cancellations"
            className="px-4 py-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 text-sm"
          >
            Move To Cancellations
          </button>
        </>
      )}
    </div>
  );
}