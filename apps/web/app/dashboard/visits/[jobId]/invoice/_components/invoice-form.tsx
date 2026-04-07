import { toDispatchDateTimeInput } from "@mobile-mechanic/core";
import type { Invoice } from "@mobile-mechanic/types";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  Form,
  FormField,
  FormRow,
  Input,
  SubmitButton,
  Textarea,
  buttonClassName
} from "../../../../../../components/ui";

type InvoiceFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  initialValues?: Invoice | null;
  submitLabel: string;
  timeZone: string;
};

function formatPercentInputFromBasisPoints(value: number | null | undefined) {
  return value ? (value / 100).toFixed(2) : "0.00";
}

function formatCurrencyInputFromCents(value: number | null | undefined) {
  return value ? (value / 100).toFixed(2) : "0.00";
}

export function InvoiceForm({
  action,
  cancelHref,
  initialValues,
  submitLabel,
  timeZone
}: InvoiceFormProps) {
  return (
    <Card tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardTitle>Invoice details</CardTitle>
        </CardHeaderContent>
      </CardHeader>
      <CardContent>
        <Form action={action}>
          <FormRow>
            <FormField label="Invoice number" required>
              <Input
                defaultValue={initialValues?.invoiceNumber ?? ""}
                name="invoiceNumber"
                placeholder="INV-1001"
                required
                type="text"
              />
            </FormField>

            <FormField label="Title" required>
              <Input
                defaultValue={initialValues?.title ?? ""}
                name="title"
                placeholder="Completed repair invoice"
                required
                type="text"
              />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField hint="Enter the customer-facing tax percent." label="Tax rate (%)">
              <Input
                defaultValue={formatPercentInputFromBasisPoints(initialValues?.taxRateBasisPoints)}
                max={25}
                min={0}
                name="taxRateBasisPoints"
                step="0.01"
                type="number"
              />
            </FormField>

            <FormField hint="Enter the total invoice discount in dollars." label="Discount ($)">
              <Input
                defaultValue={formatCurrencyInputFromCents(initialValues?.discountCents)}
                min={0}
                name="discountCents"
                step="0.01"
                type="number"
              />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField
              hint="Use this only when the invoice needs a fixed due date."
              label="Due at"
            >
              <Input
                defaultValue={toDispatchDateTimeInput(initialValues?.dueAt ?? null, timeZone)}
                name="dueAt"
                type="datetime-local"
              />
            </FormField>
          </FormRow>

          <FormField
            hint="Use notes for completion context or invoice-specific explanations."
            label="Notes"
          >
            <Textarea
              defaultValue={initialValues?.notes ?? ""}
              name="notes"
              placeholder="Invoice notes or completion summary."
              rows={4}
            />
          </FormField>

          <FormField
            hint="Terms shown on the public invoice should stay short and customer-readable."
            label="Terms"
          >
            <Textarea
              defaultValue={initialValues?.terms ?? ""}
              name="terms"
              placeholder="Payment terms and service terms."
              rows={4}
            />
          </FormField>

          <CardFooter>
            <div className="ui-button-grid">
              <SubmitButton pendingLabel="Saving invoice...">{submitLabel}</SubmitButton>
              <a className={buttonClassName({ tone: "secondary" })} href={cancelHref}>
                Cancel
              </a>
            </div>
          </CardFooter>
        </Form>
      </CardContent>
    </Card>
  );
}
