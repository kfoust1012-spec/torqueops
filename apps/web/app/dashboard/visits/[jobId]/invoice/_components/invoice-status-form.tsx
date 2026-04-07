import type { InvoiceStatus } from "@mobile-mechanic/types";

import {
  Form,
  FormField,
  Select,
  StatusBadge,
  SubmitButton
} from "../../../../../../components/ui";

type InvoiceStatusFormProps = {
  action: (formData: FormData) => Promise<void>;
  allowedStatuses: InvoiceStatus[];
  currentStatus: InvoiceStatus;
};

export function InvoiceStatusForm({
  action,
  allowedStatuses,
  currentStatus
}: InvoiceStatusFormProps) {
  if (!allowedStatuses.length) {
    return (
      <div className="ui-callout">
        <p className="ui-section-copy">No further status transitions are available for this invoice.</p>
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
        <Select defaultValue={allowedStatuses[0]} name="status">
          {allowedStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </FormField>

      <SubmitButton pendingLabel="Updating status...">Update invoice status</SubmitButton>
    </Form>
  );
}
