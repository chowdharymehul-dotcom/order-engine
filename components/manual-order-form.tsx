"use client";

import { useState } from "react";

type Customer = {
  id: string;
  company_name: string | null;
  email: string | null;
};

type Props = {
  customers: Customer[];
};

type CustomField = {
  name: string;
  value: string;
};

type Item = {
  sku: string;
  quantity: string;
  unitPrice: string;
  currency: string;
  customFields: CustomField[];
};

function defaultDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export default function ManualOrderForm({
  customers,
}: Props) {
  const [items, setItems] = useState<Item[]>([
    {
      sku: "",
      quantity: "1",
      unitPrice: "",
      currency: "USD",
      customFields: [],
    },
  ]);

  function addItem() {
    setItems((current) => [
      ...current,
      {
        sku: "",
        quantity: "1",
        unitPrice: "",
        currency: "USD",
        customFields: [],
      },
    ]);
  }

  function addCustomField(itemIndex: number) {
    setItems((current) =>
      current.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              customFields: [
                ...item.customFields,
                { name: "", value: "" },
              ],
            }
          : item
      )
    );
  }

  function updateItem(
    index: number,
    field: keyof Item,
    value: string
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function updateCustomField(
    itemIndex: number,
    fieldIndex: number,
    field: "name" | "value",
    value: string
  ) {
    setItems((current) =>
      current.map((item, index) => {
        if (index !== itemIndex) return item;

        return {
          ...item,
          customFields: item.customFields.map((customField, i) =>
            i === fieldIndex
              ? { ...customField, [field]: value }
              : customField
          ),
        };
      })
    );
  }

  return (
    <form
      action="/api/orders/create-manual"
      method="POST"
      className="space-y-6"
    >
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">
          Customer Information
        </h2>

        <select
          name="customer_id"
          required
          className="w-full border rounded-lg px-4 py-3"
        >
          <option value="">Select Customer</option>

          {customers.map((customer) => (
            <option
              key={customer.id}
              value={customer.id}
            >
              {customer.company_name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">
          Order Details
        </h2>

        <input
          name="po_number"
          placeholder="PO Number"
          className="w-full border rounded-lg px-4 py-3"
        />

        <input
          type="date"
          name="delivery_date"
          defaultValue={defaultDeliveryDate()}
          className="w-full border rounded-lg px-4 py-3"
        />

        <textarea
          name="notes"
          rows={4}
          placeholder="Notes"
          className="w-full border rounded-lg px-4 py-3"
        />
      </div>

      {items.map((item, itemIndex) => (
        <div
          key={itemIndex}
          className="bg-white border rounded-xl p-6 space-y-4"
        >
          <h2 className="text-xl font-semibold">
            Order Item {itemIndex + 1}
          </h2>

          <div className="grid grid-cols-4 gap-4">
            <input
              placeholder="SKU"
              value={item.sku}
              onChange={(e) =>
                updateItem(
                  itemIndex,
                  "sku",
                  e.target.value
                )
              }
              className="border rounded-lg px-4 py-3"
            />

            <input
              placeholder="Quantity"
              value={item.quantity}
              onChange={(e) =>
                updateItem(
                  itemIndex,
                  "quantity",
                  e.target.value
                )
              }
              className="border rounded-lg px-4 py-3"
            />

            <input
              placeholder="Unit Price"
              value={item.unitPrice}
              onChange={(e) =>
                updateItem(
                  itemIndex,
                  "unitPrice",
                  e.target.value
                )
              }
              className="border rounded-lg px-4 py-3"
            />

            <input
              placeholder="Currency"
              value={item.currency}
              onChange={(e) =>
                updateItem(
                  itemIndex,
                  "currency",
                  e.target.value
                )
              }
              className="border rounded-lg px-4 py-3"
            />
          </div>

          <input
            type="hidden"
            name="items"
            value={JSON.stringify(items)}
          />

          <div className="space-y-3">
            {item.customFields.map((field, fieldIndex) => (
              <div
                key={fieldIndex}
                className="grid grid-cols-2 gap-3"
              >
                <input
                  placeholder="Field Name"
                  value={field.name}
                  onChange={(e) =>
                    updateCustomField(
                      itemIndex,
                      fieldIndex,
                      "name",
                      e.target.value
                    )
                  }
                  className="border rounded-lg px-4 py-3"
                />

                <input
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) =>
                    updateCustomField(
                      itemIndex,
                      fieldIndex,
                      "value",
                      e.target.value
                    )
                  }
                  className="border rounded-lg px-4 py-3"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addCustomField(itemIndex)}
            className="px-4 py-2 rounded-lg border"
          >
            + Add Custom Field
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="px-4 py-2 rounded-lg border"
      >
        + Add Item
      </button>

      <div className="flex gap-3">
        <button
          type="submit"
          name="action_type"
          value="save"
          className="px-6 py-3 rounded-lg bg-gray-900 text-white"
        >
          Save Order
        </button>

        <button
          type="submit"
          name="action_type"
          value="generate_oc"
          className="px-6 py-3 rounded-lg bg-purple-600 text-white"
        >
          Save + Generate OC
        </button>
      </div>
    </form>
  );
}