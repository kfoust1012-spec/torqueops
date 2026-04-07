import {
  Form,
  FormField,
  FormRow,
  Input,
  Select,
  SubmitButton,
  Textarea,
  buttonClassName
} from "../../../../components/ui";

type AvailabilityBlockFormProps = {
  action: (formData: FormData) => Promise<void>;
  technicianUserId: string;
  returnTo: string;
  defaultStartAt: string;
  defaultEndAt: string;
};

export function AvailabilityBlockForm({
  action,
  technicianUserId,
  returnTo,
  defaultStartAt,
  defaultEndAt
}: AvailabilityBlockFormProps) {
  return (
    <details>
      <summary className={buttonClassName({ size: "sm", tone: "tertiary" })}>
        Add availability block
      </summary>
      <Form action={action}>
        <input name="technicianUserId" type="hidden" value={technicianUserId} />
        <input name="returnTo" type="hidden" value={returnTo} />

        <FormRow>
          <FormField label="Type">
            <Select defaultValue="unavailable" name="blockType">
            <option value="unavailable">Unavailable</option>
            <option value="time_off">Time off</option>
            <option value="break">Break</option>
            <option value="training">Training</option>
            </Select>
          </FormField>

          <FormField label="Title" required>
            <Input defaultValue="Unavailable" name="title" required type="text" />
          </FormField>
        </FormRow>

        <FormRow>
          <FormField label="Start" required>
            <Input defaultValue={defaultStartAt} name="startsAt" required type="datetime-local" />
          </FormField>

          <FormField label="End" required>
            <Input defaultValue={defaultEndAt} name="endsAt" required type="datetime-local" />
          </FormField>
        </FormRow>

        <label className="ui-checkbox-row">
          <input name="isAllDay" type="checkbox" />
          All day block
        </label>

        <FormField label="Notes">
          <Textarea name="notes" rows={3} />
        </FormField>

        <SubmitButton pendingLabel="Saving block..." tone="secondary">
          Save block
        </SubmitButton>
      </Form>
    </details>
  );
}
