import { formatDesignStatusLabel } from "@mobile-mechanic/core";
import type { JobStatus } from "@mobile-mechanic/types";

import {
  Form,
  FormField,
  Select,
  StatusBadge,
  SubmitButton,
  Textarea
} from "../../../../components/ui";

type JobStatusFormProps = {
  action: (formData: FormData) => Promise<void>;
  allowedStatuses: JobStatus[];
  currentStatus: JobStatus;
};

export function JobStatusForm({ action, allowedStatuses, currentStatus }: JobStatusFormProps) {
  if (!allowedStatuses.length) {
    return (
      <div className="ui-callout">
        <p className="ui-section-copy">No further status transitions are available for this visit.</p>
        <StatusBadge status={currentStatus} />
      </div>
    );
  }

  return (
    <Form action={action}>
      <div className="ui-inline-meta">
        <p className="ui-section-copy">Current status</p>
        <StatusBadge status={currentStatus} />
      </div>

      <FormField label="Next status">
        <Select defaultValue={allowedStatuses[0]} name="toStatus">
          {allowedStatuses.map((status) => (
            <option key={status} value={status}>
              {formatDesignStatusLabel(status)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        hint="Optional customer-safe or internal explanation for the transition."
        label="Reason"
      >
        <Textarea name="reason" rows={3} />
      </FormField>

      <SubmitButton pendingLabel="Saving status...">Change status</SubmitButton>
    </Form>
  );
}
