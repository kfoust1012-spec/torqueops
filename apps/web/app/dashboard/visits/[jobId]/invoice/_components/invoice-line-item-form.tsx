import type { InvoiceLineItem } from "@mobile-mechanic/types";

import {
  Form,
  FormField,
  FormRow,
  Input,
  Select,
  SubmitButton,
  Textarea
} from "../../../../../../components/ui";

type InvoiceLineItemFormProps = {
  action: (formData: FormData) => Promise<void>;
  hiddenFields?: Array<{ name: string; value: string }>;
  initialValues?: InvoiceLineItem | null;
  submitLabel: string;
};

function formatCurrencyInputFromCents(value: number | null | undefined) {
  return value ? (value / 100).toFixed(2) : "0.00";
}

export function InvoiceLineItemForm({
  action,
  hiddenFields = [],
  initialValues,
  submitLabel
}: InvoiceLineItemFormProps) {
  return (
    <Form action={action}>
      {hiddenFields.map((field) => (
        <input key={field.name} name={field.name} type="hidden" value={field.value} />
      ))}

      <FormRow>
        <FormField label="Item type">
          <Select defaultValue={initialValues?.itemType ?? "labor"} name="itemType">
            <option value="labor">Labor</option>
            <option value="part">Part</option>
            <option value="fee">Fee</option>
          </Select>
        </FormField>

        <FormField label="Name" required>
          <Input
            defaultValue={initialValues?.name ?? ""}
            name="name"
            placeholder="Front brake pad replacement"
            required
            type="text"
          />
        </FormField>
      </FormRow>

      <FormRow>
        <FormField label="Quantity" required>
          <Input
            defaultValue={initialValues?.quantity ?? 1}
            min={0.01}
            name="quantity"
            required
            step="0.01"
            type="number"
          />
        </FormField>

        <FormField label="Unit price ($)" required>
          <Input
            defaultValue={formatCurrencyInputFromCents(initialValues?.unitPriceCents)}
            min={0}
            name="unitPriceCents"
            required
            step="0.01"
            type="number"
          />
        </FormField>
      </FormRow>

      <FormField label="Description">
        <Textarea
          defaultValue={initialValues?.description ?? ""}
          name="description"
          rows={3}
        />
      </FormField>

      <label className="ui-checkbox-row">
        <input defaultChecked={initialValues?.taxable ?? true} name="taxable" type="checkbox" />
        Taxable item
      </label>

      <SubmitButton pendingLabel="Saving item...">{submitLabel}</SubmitButton>
    </Form>
  );
}
