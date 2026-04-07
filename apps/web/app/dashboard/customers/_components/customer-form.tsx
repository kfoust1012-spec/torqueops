import type { Customer } from "@mobile-mechanic/types";
import Link from "next/link";

import {
  Form,
  FormField,
  FormRow,
  Input,
  Select,
  Textarea,
  buttonClassName
} from "../../../../components/ui";

type CustomerFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  cancelLabel?: string | undefined;
  initialValues?: Customer | null;
  mode?: "inline" | "page" | undefined;
  submitLabel: string;
};

export function CustomerForm({
  action,
  cancelHref,
  cancelLabel = "Cancel",
  initialValues,
  mode = "page",
  submitLabel
}: CustomerFormProps) {
  return (
    <Form action={action} className="customer-editor-form">
      <FormRow className={mode === "inline" ? "customer-editor-form__row--compact" : undefined}>
        <FormField htmlFor="customer-relationship-type" label="Relationship type" required>
          <Select
            defaultValue={initialValues?.relationshipType ?? "retail_customer"}
            id="customer-relationship-type"
            name="relationshipType"
          >
            <option value="retail_customer">Retail customer</option>
            <option value="fleet_account">Fleet account</option>
          </Select>
        </FormField>

        <FormField
          hint="Use this for managed fleets, commercial accounts, or company relationships."
          htmlFor="customer-company-name"
          label="Account / fleet name"
        >
          <Input
            defaultValue={initialValues?.companyName ?? ""}
            id="customer-company-name"
            name="companyName"
            placeholder="Northside Plumbing Fleet"
            type="text"
          />
        </FormField>
      </FormRow>

      <FormRow className={mode === "inline" ? "customer-editor-form__row--compact" : undefined}>
        <FormField htmlFor="customer-first-name" label="Primary contact first name" required>
          <Input
            defaultValue={initialValues?.firstName ?? ""}
            id="customer-first-name"
            name="firstName"
            placeholder="Alex"
            required
            type="text"
          />
        </FormField>

        <FormField htmlFor="customer-last-name" label="Primary contact last name" required>
          <Input
            defaultValue={initialValues?.lastName ?? ""}
            id="customer-last-name"
            name="lastName"
            placeholder="Morgan"
            required
            type="text"
          />
        </FormField>
      </FormRow>

      <FormRow>
        <FormField htmlFor="customer-email" label="Email">
          <Input
            defaultValue={initialValues?.email ?? ""}
            id="customer-email"
            name="email"
            placeholder="alex@example.com"
            type="email"
          />
        </FormField>

        <FormField htmlFor="customer-phone" label="Phone">
          <Input
            defaultValue={initialValues?.phone ?? ""}
            id="customer-phone"
            name="phone"
            placeholder="555-555-5555"
            type="tel"
          />
        </FormField>
      </FormRow>

      <FormField
        hint="Keep this short and operational: access issues, billing notes, contact preferences, fleet instructions, or repeat concerns."
        htmlFor="customer-notes"
        label="Notes"
      >
        <Textarea
          defaultValue={initialValues?.notes ?? ""}
          id="customer-notes"
          name="notes"
          placeholder="Access notes, preferred contact method, or customer context."
          rows={4}
        />
      </FormField>

      <label className="customer-editor-form__toggle">
        <input
          defaultChecked={initialValues?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        <span>Customer is active for new service work</span>
      </label>

      <div className="ui-button-grid">
        <button className={buttonClassName()} type="submit">
          {submitLabel}
        </button>
        <Link className={buttonClassName({ tone: "ghost" })} href={cancelHref}>
          {cancelLabel}
        </Link>
      </div>
    </Form>
  );
}
