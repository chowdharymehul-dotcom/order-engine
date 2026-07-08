"use client";

import { useState } from "react";

type CustomField = {
  name: string;
  value: string;
};

type Item = {
  id: string;
  sku: string;
  quantity: string | number;
  unitPrice: string | number;
  currency: string;
  customFields: CustomField[];
};

type Props = {
  initialItems: Item[];
};

export default function ReviewOcItemsEditor({ initialItems }: Props) {
  const [items, setItems] = useState<Item[]>(
    initialItems.length > 0
      ? initialItems
      : [
          {
            id: "",
            sku: "",
            quantity: 1,
            unitPrice: "",
            currency: "USD",
            customFields: [],
          },
        ]
  );

  function renumberedItems(nextItems: Item[]) {
    return nextItems;
  }

  function addItem() {
    setItems(
      renumberedItems([
        ...items,
        {
          id: "",
          sku: "",
          quantity: 1,
          unitPrice: "",
          currency: "USD",
          customFields: [],
        },
      ])
    );
  }

  function removeItem(index: number) {
    if (items.length === 1) return;

    setItems(renumberedItems(items.filter((_, itemIndex) => itemIndex !== index)));
  }

  function updateItem(index: number, key: keyof Item, newValue: string) {
    const next = [...items];

    next[index] = {
      ...next[index],
      [key]: newValue,
    };

    setItems(next);
  }

  function addCustomField(index: number) {
    const next = [...items];

    next[index] = {
      ...next[index],
      customFields: [...next[index].customFields, { name: "", value: "" }],
    };

    setItems(next);
  }

  function removeCustomField(itemIndex: number, fieldIndex: number) {
    const next = [...items];

    next[itemIndex] = {
      ...next[itemIndex],
      customFields: next[itemIndex].customFields.filter(
        (_, index) => index !== fieldIndex
      ),
    };

    setItems(next);
  }

  function updateCustomField(
    itemIndex: number,
    fieldIndex: number,
    key: keyof CustomField,
    newValue: string
  ) {
    const next = [...items];
    const customFields = [...next[itemIndex].customFields];

    customFields[fieldIndex] = {
      ...customFields[fieldIndex],
      [key]: newValue,
    };

    next[itemIndex] = {
      ...next[itemIndex],
      customFields,
    };

    setItems(next);
  }

  return (
    <>
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div id="order-items-wrapper" className="space-y-6">
        {items.map((item, index) => (
          <div
            key={`${item.id || "new"}-${index}`}
            className="manual-order-item bg-white border rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Order Item {index + 1}</h2>

              <button
                type="button"
                onClick={() => removeItem(index)}
                className={`remove-item px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 ${
                  items.length === 1 ? "hidden" : ""
                }`}
              >
                Remove Item
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  SKU / Article
                </label>

                <input
                  value={item.sku}
                  onChange={(event) =>
                    updateItem(index, "sku", event.target.value)
                  }
                  required
                  placeholder="Enter SKU"
                  className="w-full border rounded-lg px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Quantity
                </label>

                <input
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, "quantity", event.target.value)
                  }
                  type="number"
                  min="1"
                  required
                  className="w-full border rounded-lg px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Unit Price
                </label>

                <input
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateItem(index, "unitPrice", event.target.value)
                  }
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  className="w-full border rounded-lg px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Currency
                </label>

                <input
                  value={item.currency}
                  onChange={(event) =>
                    updateItem(index, "currency", event.target.value)
                  }
                  placeholder="USD"
                  className="w-full border rounded-lg px-4 py-3"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Optional Fields</h3>

                <button
                  type="button"
                  onClick={() => addCustomField(index)}
                  className="add-custom-field px-4 py-2 rounded-lg border hover:bg-gray-50"
                >
                  + Add Optional Field
                </button>
              </div>

              <div className="custom-fields space-y-3">
                {item.customFields.map((field, fieldIndex) => (
                  <div
                    key={fieldIndex}
                    className="custom-field-row grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3"
                  >
                    <input
                      value={field.name}
                      onChange={(event) =>
                        updateCustomField(
                          index,
                          fieldIndex,
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="Field Name e.g. Width, Color, Piece Length, Description"
                      className="border rounded-lg px-4 py-3"
                    />

                    <input
                      value={field.value}
                      onChange={(event) =>
                        updateCustomField(
                          index,
                          fieldIndex,
                          "value",
                          event.target.value
                        )
                      }
                      placeholder="Value"
                      className="border rounded-lg px-4 py-3"
                    />

                    <button
                      type="button"
                      onClick={() => removeCustomField(index, fieldIndex)}
                      className="remove-custom-field px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        id="add-item"
        onClick={addItem}
        className="px-5 py-3 rounded-lg border bg-white hover:bg-gray-50"
      >
        + Add Item
      </button>
    </>
  );
}