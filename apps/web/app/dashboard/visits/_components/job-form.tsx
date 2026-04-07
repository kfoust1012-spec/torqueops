import type {
  AssignableTechnicianOption,
  CustomerAddress,
  CustomerListItem,
  CustomerVehicleSummary,
  VehicleCarfaxSummary,
  Job
} from "@mobile-mechanic/types";

import { VehiclePickerWithCarfax } from "./vehicle-picker-with-carfax";

type JobFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  customer: CustomerListItem;
  serviceSites: CustomerAddress[];
  technicians: AssignableTechnicianOption[];
  vehicles: Array<
    CustomerVehicleSummary & {
      carfaxSummary: VehicleCarfaxSummary | null;
    }
  >;
  initialValues?: Job | null;
  submitLabel: string;
};

function toLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}

export function JobForm({
  action,
  cancelHref,
  customer,
  serviceSites,
  technicians,
  vehicles,
  initialValues,
  submitLabel
}: JobFormProps) {
  return (
    <form action={action} className="panel stack">
      <input name="customerId" type="hidden" value={customer.id} />

      <div className="workspace-card inline-panel">
        <p className="detail-label">Selected customer</p>
        <p className="detail-value" style={{ marginBottom: 0 }}>
          {customer.displayName}
        </p>
      </div>

      <div className="form-grid">
        <VehiclePickerWithCarfax
          defaultVehicleId={initialValues?.vehicleId ?? vehicles[0]?.id ?? ""}
          vehicles={vehicles}
        />

        <label className="label">
          Service site
          <select
            className="input"
            defaultValue={initialValues?.serviceSiteId ?? serviceSites[0]?.id ?? ""}
            name="serviceSiteId"
          >
            {serviceSites.map((site) => (
              <option key={site.id} value={site.id}>
                {[site.siteName, site.line1, `${site.city}, ${site.state}`].filter(Boolean).join(" • ")}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Technician
          <select
            className="input"
            defaultValue={initialValues?.assignedTechnicianUserId ?? ""}
            name="assignedTechnicianUserId"
          >
            <option value="">Unassigned</option>
            {technicians.map((technician) => (
              <option key={technician.userId} value={technician.userId}>
                {technician.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Title
          <input
            className="input"
            defaultValue={initialValues?.title ?? ""}
            name="title"
            placeholder="Brake inspection and front axle noise"
            required
            type="text"
          />
        </label>

        <label className="label">
          Priority
          <select
            className="input"
            defaultValue={initialValues?.priority ?? "normal"}
            name="priority"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <label className="label">
          Source
          <select className="input" defaultValue={initialValues?.source ?? "office"} name="source">
            <option value="office">Office</option>
            <option value="phone">Phone</option>
            <option value="web">Web</option>
          </select>
        </label>

        <label className="label">
          Scheduled start
          <input
            className="input"
            defaultValue={toLocalDateTimeInput(initialValues?.scheduledStartAt)}
            name="scheduledStartAt"
            type="datetime-local"
          />
        </label>

        <label className="label">
          Scheduled end
          <input
            className="input"
            defaultValue={toLocalDateTimeInput(initialValues?.scheduledEndAt)}
            name="scheduledEndAt"
            type="datetime-local"
          />
        </label>

        <label className="label">
          Arrival window start
          <input
            className="input"
            defaultValue={toLocalDateTimeInput(initialValues?.arrivalWindowStartAt)}
            name="arrivalWindowStartAt"
            type="datetime-local"
          />
        </label>

        <label className="label">
          Arrival window end
          <input
            className="input"
            defaultValue={toLocalDateTimeInput(initialValues?.arrivalWindowEndAt)}
            name="arrivalWindowEndAt"
            type="datetime-local"
          />
        </label>
      </div>

      <label className="label">
        Customer concern
        <textarea
          className="textarea"
          defaultValue={initialValues?.customerConcern ?? ""}
          name="customerConcern"
          rows={4}
        />
      </label>

      <label className="label">
        Internal summary
        <textarea
          className="textarea"
          defaultValue={initialValues?.internalSummary ?? ""}
          name="internalSummary"
          rows={4}
        />
      </label>

      <label className="label">
        Description
        <textarea
          className="textarea"
          defaultValue={initialValues?.description ?? ""}
          name="description"
          rows={4}
        />
      </label>

      <label className="checkbox-row">
        <input defaultChecked={initialValues?.isActive ?? true} name="isActive" type="checkbox" />
        Active job
      </label>

      <div className="action-row">
        <button className="button" type="submit">
          {submitLabel}
        </button>
        <a className="button secondary-button button-link" href={cancelHref}>
          Cancel
        </a>
      </div>
    </form>
  );
}
