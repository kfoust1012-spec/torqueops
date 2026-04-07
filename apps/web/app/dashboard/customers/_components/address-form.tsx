import type { CustomerAddress } from "@mobile-mechanic/types";

import {
  Form,
  FormField,
  FormRow,
  Input,
  Select,
  Textarea,
  buttonClassName
} from "../../../../components/ui";

type AddressFormProps = {
  action: (formData: FormData) => Promise<void>;
  hiddenFields?: Array<{ name: string; value: string }>;
  initialValues?: CustomerAddress | null;
  submitLabel: string;
};

export function AddressForm({
  action,
  hiddenFields = [],
  initialValues,
  submitLabel
}: AddressFormProps) {
  const hasAdvancedValues = Boolean(
    initialValues?.line2 ||
      initialValues?.gateCode ||
      initialValues?.parkingNotes ||
      initialValues?.siteName ||
      initialValues?.serviceContactName ||
      initialValues?.serviceContactPhone ||
      initialValues?.accessWindowNotes
  );

  return (
    <Form action={action} className="customer-address-form">
      {hiddenFields.map((field) => (
        <input key={field.name} name={field.name} type="hidden" value={field.value} />
      ))}
      <input name="country" type="hidden" value={initialValues?.country ?? "US"} />

      <FormRow>
        <FormField htmlFor="customer-address-site-name" label="Site name">
          <Input
            defaultValue={initialValues?.siteName ?? ""}
            id="customer-address-site-name"
            name="siteName"
            placeholder="Warehouse north gate"
            type="text"
          />
        </FormField>

        <FormField htmlFor="customer-address-label" label="Type">
          <Select
            defaultValue={initialValues?.label ?? "service"}
            id="customer-address-label"
            name="label"
          >
            <option value="service">Service</option>
            <option value="billing">Billing</option>
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="other">Other</option>
          </Select>
        </FormField>

        <FormField
          htmlFor="customer-address-line1"
          label="Street address"
          required
        >
          <Input
            defaultValue={initialValues?.line1 ?? ""}
            id="customer-address-line1"
            name="line1"
            placeholder="123 Main St"
            required
            type="text"
          />
        </FormField>
      </FormRow>

      <FormRow>
        <FormField htmlFor="customer-address-city" label="City" required>
          <Input
            defaultValue={initialValues?.city ?? ""}
            id="customer-address-city"
            name="city"
            required
            type="text"
          />
        </FormField>

        <FormField htmlFor="customer-address-state" label="State" required>
          <Input
            defaultValue={initialValues?.state ?? ""}
            id="customer-address-state"
            maxLength={2}
            name="state"
            placeholder="TX"
            required
            type="text"
          />
        </FormField>

        <FormField htmlFor="customer-address-postal" label="Postal code" required>
          <Input
            defaultValue={initialValues?.postalCode ?? ""}
            id="customer-address-postal"
            name="postalCode"
            required
            type="text"
          />
        </FormField>
      </FormRow>

      <details className="customer-address-form__advanced" open={hasAdvancedValues}>
        <summary className="customer-address-form__advanced-toggle">
          Site contact, access details, and optional fields
        </summary>

        <div className="customer-address-form__advanced-fields">
          <FormRow>
            <FormField htmlFor="customer-address-contact-name" label="Site contact">
              <Input
                defaultValue={initialValues?.serviceContactName ?? ""}
                id="customer-address-contact-name"
                name="serviceContactName"
                placeholder="Loading dock manager"
                type="text"
              />
            </FormField>

            <FormField htmlFor="customer-address-contact-phone" label="Contact phone">
              <Input
                defaultValue={initialValues?.serviceContactPhone ?? ""}
                id="customer-address-contact-phone"
                name="serviceContactPhone"
                placeholder="Optional"
                type="tel"
              />
            </FormField>
          </FormRow>

          <FormField
            hint="Use this for delivery windows, site access hours, or arrival constraints."
            htmlFor="customer-address-access-window"
            label="Access window notes"
          >
            <Textarea
              defaultValue={initialValues?.accessWindowNotes ?? ""}
              id="customer-address-access-window"
              name="accessWindowNotes"
              rows={2}
            />
          </FormField>

          <FormRow>
            <FormField htmlFor="customer-address-line2" label="Street line 2">
              <Input
                defaultValue={initialValues?.line2 ?? ""}
                id="customer-address-line2"
                name="line2"
                placeholder="Suite, apartment, or building"
                type="text"
              />
            </FormField>

            <FormField htmlFor="customer-address-gate" label="Gate code">
              <Input
                defaultValue={initialValues?.gateCode ?? ""}
                id="customer-address-gate"
                name="gateCode"
                placeholder="Optional"
                type="text"
              />
            </FormField>
          </FormRow>

          <FormField
            hint="Use this for parking, gate access, pets, or arrival instructions."
            htmlFor="customer-address-parking"
            label="Access notes"
          >
            <Textarea
              defaultValue={initialValues?.parkingNotes ?? ""}
              id="customer-address-parking"
              name="parkingNotes"
              rows={3}
            />
          </FormField>
        </div>
      </details>

      <label className="customer-editor-form__toggle">
        <input
          defaultChecked={initialValues?.isPrimary ?? false}
          name="isPrimary"
          type="checkbox"
        />
        <span>Use as the primary service location</span>
      </label>

      <label className="customer-editor-form__toggle">
        <input
          defaultChecked={initialValues?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        <span>Keep this service location active for dispatch and intake</span>
      </label>

      <div className="ui-button-grid">
        <button className={buttonClassName()} type="submit">
          {submitLabel}
        </button>
      </div>
    </Form>
  );
}
