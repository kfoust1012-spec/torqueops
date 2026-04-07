import {
  formatDispatchDateTime,
  toDispatchDateTimeInput
} from "@mobile-mechanic/core";
import type { AssignableTechnicianOption, DispatchBoardJobItem } from "@mobile-mechanic/types";
import Link from "next/link";
import type { DispatchMeetYourMechanicStatus } from "../types";

import {
  Form,
  FormField,
  Input,
  PriorityBadge,
  Select,
  StatusBadge,
  SubmitButton,
  buttonClassName
} from "../../../../components/ui";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type DispatchJobCardProps = {
  job: DispatchBoardJobItem;
  meetYourMechanicStatus?: DispatchMeetYourMechanicStatus | null;
  technicians: AssignableTechnicianOption[];
  timeZone: string;
  returnTo: string;
  assignAction: (formData: FormData) => Promise<void>;
  rescheduleAction: (formData: FormData) => Promise<void>;
  sendAppointmentConfirmationAction: (formData: FormData) => Promise<void>;
  sendDispatchUpdateAction: (formData: FormData) => Promise<void>;
};

function getScheduleSummary(job: DispatchBoardJobItem, timeZone: string): string {
  if (!job.scheduledStartAt) {
    return "Unscheduled";
  }

  if (!job.scheduledEndAt) {
    return formatDispatchDateTime(job.scheduledStartAt, timeZone);
  }

  return `${formatDispatchDateTime(job.scheduledStartAt, timeZone)} to ${formatDispatchDateTime(
    job.scheduledEndAt,
    timeZone,
    {
      hour: "numeric",
      minute: "2-digit"
    }
  )}`;
}

export function DispatchJobCard({
  job,
  meetYourMechanicStatus = null,
  technicians,
  timeZone,
  returnTo,
  assignAction,
  rescheduleAction,
  sendAppointmentConfirmationAction,
  sendDispatchUpdateAction
}: DispatchJobCardProps) {
  return (
    <article className="ui-card ui-card--compact">
      <div className="ui-card__header">
        <div className="ui-card__header-content">
          <h3 className="ui-card__title" style={{ fontSize: "1.125rem", lineHeight: 1.2 }}>
            {job.title}
          </h3>
          <p className="ui-inline-copy">
            {job.customerDisplayName} · {job.vehicleDisplayName}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="ui-dispatch-chip-row">
        <span className="ui-dispatch-chip">{getScheduleSummary(job, timeZone)}</span>
        <PriorityBadge value={job.priority} />
        <span className="ui-dispatch-chip">{job.assignedTechnicianName ?? "Unassigned"}</span>
      </div>

      {job.assignedTechnicianUserId ? (
        <p className="ui-inline-copy">
          {meetYourMechanicStatus?.isReady
            ? "Customer updates will include the Meet Your Mechanic card."
            : `Customer updates will send without the mechanic card until ${(meetYourMechanicStatus?.missingFields ?? ["technician details"]).join(", ")} are added.`}
        </p>
      ) : null}

      <div className="ui-dispatch-forms">
        <Form action={assignAction} className="ui-dispatch-inline-form ui-dispatch-inline-form--narrow">
          <input name="jobId" type="hidden" value={job.id} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <FormField label="Technician">
            <Select
              defaultValue={job.assignedTechnicianUserId ?? ""}
              name="assignedTechnicianUserId"
            >
              <option value="">Unassigned</option>
              {technicians.map((technician) => (
                <option key={technician.userId} value={technician.userId}>
                  {technician.displayName}
                </option>
              ))}
            </Select>
          </FormField>
          <SubmitButton pendingLabel="Saving assignment...">Assign</SubmitButton>
        </Form>

        <Form action={rescheduleAction} className="ui-dispatch-inline-form ui-dispatch-inline-form--wide">
          <input name="jobId" type="hidden" value={job.id} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <FormField label="Start">
            <Input
              defaultValue={toDispatchDateTimeInput(job.scheduledStartAt, timeZone)}
              name="scheduledStartAt"
              required
              type="datetime-local"
            />
          </FormField>
          <FormField label="End">
            <Input
              defaultValue={toDispatchDateTimeInput(job.scheduledEndAt, timeZone)}
              name="scheduledEndAt"
              type="datetime-local"
            />
          </FormField>
          <SubmitButton pendingLabel="Saving schedule..." tone="secondary">
            Reschedule
          </SubmitButton>
        </Form>

        <div className="ui-button-grid">
          {job.scheduledStartAt ? (
            <form action={sendAppointmentConfirmationAction}>
              <input name="jobId" type="hidden" value={job.id} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <SubmitButton pendingLabel="Queueing..." size="sm" tone="secondary">
                Confirm appointment
              </SubmitButton>
            </form>
          ) : null}

          {job.assignedTechnicianUserId ? (
            <form action={sendDispatchUpdateAction}>
              <input name="jobId" type="hidden" value={job.id} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <input name="updateType" type="hidden" value="dispatched" />
              <SubmitButton pendingLabel="Queueing..." size="sm" tone="secondary">
                Send dispatch
              </SubmitButton>
            </form>
          ) : null}

          {job.assignedTechnicianUserId ? (
            <form action={sendDispatchUpdateAction}>
              <input name="jobId" type="hidden" value={job.id} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <input name="updateType" type="hidden" value="en_route" />
              <SubmitButton pendingLabel="Queueing..." size="sm" tone="secondary">
                Send en route
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <Link
        className={buttonClassName({ tone: "tertiary", size: "sm" })}
        href={buildDashboardAliasHref("/dashboard/visits", { jobId: job.id })}
      >
        Open visit thread
      </Link>
    </article>
  );
}
