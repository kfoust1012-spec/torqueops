import type { JobNote } from "@mobile-mechanic/types";

import { Form, FormField, SubmitButton, Textarea } from "../../../../components/ui";

type JobNoteFormProps = {
  action: (formData: FormData) => Promise<void>;
  hiddenFields?: Array<{ name: string; value: string }>;
  initialValues?: JobNote | null;
  submitLabel: string;
};

export function JobNoteForm({
  action,
  hiddenFields = [],
  initialValues,
  submitLabel
}: JobNoteFormProps) {
  return (
    <Form action={action}>
      {hiddenFields.map((field) => (
        <input key={field.name} name={field.name} type="hidden" value={field.value} />
      ))}

      <FormField label="Note">
        <Textarea defaultValue={initialValues?.body ?? ""} name="body" rows={4} />
      </FormField>

      <label className="ui-checkbox-row">
        <input defaultChecked={initialValues?.isInternal ?? true} name="isInternal" type="checkbox" />
        Internal note
      </label>

      <SubmitButton pendingLabel="Saving note...">{submitLabel}</SubmitButton>
    </Form>
  );
}
