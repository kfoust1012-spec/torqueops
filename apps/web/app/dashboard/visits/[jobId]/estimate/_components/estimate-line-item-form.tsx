import type { EstimateLineItem } from "@mobile-mechanic/types";

import {
  Form,
  FormField,
  FormRow,
  Input,
  Select,
  SubmitButton,
  Textarea
} from "../../../../../../components/ui";

type EstimateLineItemFormProps = {
  action: (formData: FormData) => Promise<void>;
  hiddenFields?: Array<{ name: string; value: string }>;
  initialValues?: EstimateLineItem | null;
  submitLabel: string;
};

export function EstimateLineItemForm({
  action,
  hiddenFields = [],
  initialValues,
  submitLabel
}: EstimateLineItemFormProps) {
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
            placeholder="Front brake pads"
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

        <FormField label="Unit price (cents)" required>
          <Input
            defaultValue={initialValues?.unitPriceCents ?? 0}
            min={0}
            name="unitPriceCents"
            required
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
