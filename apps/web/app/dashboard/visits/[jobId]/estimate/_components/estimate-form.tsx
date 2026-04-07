import type { Estimate } from "@mobile-mechanic/types";

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

type EstimateFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  initialValues?: Estimate | null;
  submitLabel: string;
};

export function EstimateForm({
  action,
  cancelHref,
  initialValues,
  submitLabel
}: EstimateFormProps) {
  return (
    <Card tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardTitle>Estimate details</CardTitle>
        </CardHeaderContent>
      </CardHeader>
      <CardContent>
        <Form action={action}>
          <FormRow>
            <FormField label="Estimate number" required>
              <Input
                defaultValue={initialValues?.estimateNumber ?? ""}
                name="estimateNumber"
                placeholder="EST-1001"
                required
                type="text"
              />
            </FormField>

            <FormField label="Title" required>
              <Input
                defaultValue={initialValues?.title ?? ""}
                name="title"
                placeholder="Recommended repairs"
                required
                type="text"
              />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField hint="100 basis points = 1%" label="Tax rate (basis points)">
              <Input
                defaultValue={initialValues?.taxRateBasisPoints ?? 0}
                max={2500}
                min={0}
                name="taxRateBasisPoints"
                type="number"
              />
            </FormField>

            <FormField label="Discount (cents)">
              <Input
                defaultValue={initialValues?.discountCents ?? 0}
                min={0}
                name="discountCents"
                type="number"
              />
            </FormField>
          </FormRow>

          <FormField
            hint="Use notes for approval context or customer-facing explanations."
            label="Notes"
          >
            <Textarea
              defaultValue={initialValues?.notes ?? ""}
              name="notes"
              placeholder="Internal or customer-facing estimate notes."
              rows={4}
            />
          </FormField>

          <FormField
            hint="Terms shown on the estimate link should stay concise and clear."
            label="Terms"
          >
            <Textarea
              defaultValue={initialValues?.terms ?? ""}
              name="terms"
              placeholder="Payment terms, warranty language, or estimate assumptions."
              rows={4}
            />
          </FormField>

          <CardFooter>
            <div className="ui-button-grid">
              <SubmitButton pendingLabel="Saving estimate...">{submitLabel}</SubmitButton>
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
