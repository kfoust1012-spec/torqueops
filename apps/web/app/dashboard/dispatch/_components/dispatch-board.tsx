import {
  formatDesignLabel,
  formatDispatchDateTime,
  getDispatchLocalDate
} from "@mobile-mechanic/core";
import type {
  AssignableTechnicianOption,
  DispatchBoardData,
  DispatchBoardJobItem,
  TechnicianAvailabilityBlock
} from "@mobile-mechanic/types";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  SubmitButton
} from "../../../../components/ui";
import { AvailabilityBlockForm } from "./availability-block-form";
import { DispatchJobCard } from "./dispatch-job-card";
import type { DispatchMeetYourMechanicStatus } from "../types";

type DispatchBoardProps = {
  board: DispatchBoardData;
  technicians: AssignableTechnicianOption[];
  returnTo: string;
  meetYourMechanicByTechnicianUserId?: Record<string, DispatchMeetYourMechanicStatus>;
  assignAction: (formData: FormData) => Promise<void>;
  rescheduleAction: (formData: FormData) => Promise<void>;
  sendAppointmentConfirmationAction: (formData: FormData) => Promise<void>;
  sendDispatchUpdateAction: (formData: FormData) => Promise<void>;
  createAvailabilityBlockAction: (formData: FormData) => Promise<void>;
  deleteAvailabilityBlockAction: (formData: FormData) => Promise<void>;
};

function overlapsDay(
  startAt: string | null,
  endAt: string | null,
  dayStartAt: string,
  dayEndAt: string
): boolean {
  if (!startAt) {
    return false;
  }

  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt ?? startAt).getTime();
  const dayStartTime = new Date(dayStartAt).getTime();
  const dayEndTime = new Date(dayEndAt).getTime();

  return startTime < dayEndTime && endTime > dayStartTime;
}

function renderAvailabilityBlock(
  block: TechnicianAvailabilityBlock,
  timeZone: string,
  returnTo: string,
  deleteAvailabilityBlockAction: (formData: FormData) => Promise<void>
) {
  return (
    <Card key={block.id} padding="compact" tone="subtle">
      <CardHeader>
        <CardHeaderContent>
          <CardTitle style={{ fontSize: "1rem", lineHeight: 1.2 }}>{block.title}</CardTitle>
          <CardDescription>
            {block.isAllDay
              ? "All day"
              : `${formatDispatchDateTime(block.startsAt, timeZone)} to ${formatDispatchDateTime(
                  block.endsAt,
                  timeZone,
                  {
                    hour: "numeric",
                    minute: "2-digit"
                  }
                )}`}
          </CardDescription>
        </CardHeaderContent>
        <Badge tone="warning">{formatDesignLabel(block.blockType)}</Badge>
      </CardHeader>

      {block.notes ? (
        <p className="ui-detail-value">{block.notes}</p>
      ) : null}

      <form action={deleteAvailabilityBlockAction}>
        <input name="blockId" type="hidden" value={block.id} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <SubmitButton
          confirmMessage="Remove this availability block from the dispatch board?"
          pendingLabel="Removing..."
          size="sm"
          tone="secondary"
        >
          Remove block
        </SubmitButton>
      </form>
    </Card>
  );
}

function renderDayColumn(
  day: DispatchBoardData["visibleDays"][number],
  dayJobs: DispatchBoardJobItem[],
  dayBlocks: TechnicianAvailabilityBlock[],
  board: DispatchBoardData,
  technicians: AssignableTechnicianOption[],
  returnTo: string,
  meetYourMechanicByTechnicianUserId: Record<string, DispatchMeetYourMechanicStatus>,
  assignAction: (formData: FormData) => Promise<void>,
  rescheduleAction: (formData: FormData) => Promise<void>,
  sendAppointmentConfirmationAction: (formData: FormData) => Promise<void>,
  sendDispatchUpdateAction: (formData: FormData) => Promise<void>,
  deleteAvailabilityBlockAction: (formData: FormData) => Promise<void>
) {
  return (
    <div className="ui-dispatch-column" key={day.date}>
      {board.view === "week" ? <p className="ui-dispatch-column__heading">{day.label}</p> : null}

      <div className="ui-card-list">
        {dayBlocks.map((block) =>
          renderAvailabilityBlock(block, board.timezone, returnTo, deleteAvailabilityBlockAction)
        )}

        {dayJobs.map((job) => (
          <DispatchJobCard
            key={job.id}
            assignAction={assignAction}
            job={job}
            meetYourMechanicStatus={
              job.assignedTechnicianUserId
                ? meetYourMechanicByTechnicianUserId[job.assignedTechnicianUserId] ?? null
                : null
            }
            rescheduleAction={rescheduleAction}
            returnTo={returnTo}
            sendAppointmentConfirmationAction={sendAppointmentConfirmationAction}
            sendDispatchUpdateAction={sendDispatchUpdateAction}
            technicians={technicians}
            timeZone={board.timezone}
          />
        ))}

        {!dayBlocks.length && !dayJobs.length ? <p className="ui-dispatch-empty">No scheduled work</p> : null}
      </div>
    </div>
  );
}

export function DispatchBoard({
  board,
  technicians,
  returnTo,
  meetYourMechanicByTechnicianUserId = {},
  assignAction,
  rescheduleAction,
  sendAppointmentConfirmationAction,
  sendDispatchUpdateAction,
  createAvailabilityBlockAction,
  deleteAvailabilityBlockAction
}: DispatchBoardProps) {
  const defaultStartAt = `${board.visibleDays[0]?.date ?? board.date}T08:00`;
  const defaultEndAt = `${board.visibleDays[0]?.date ?? board.date}T09:00`;

  return (
    <div className="ui-dispatch-layout">
      <aside className="ui-dispatch-sidebar">
        <Card tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Unassigned</CardEyebrow>
              <CardTitle>Ready to assign</CardTitle>
              <CardDescription>Scheduled work without a technician. Clear this lane before working backlog.</CardDescription>
            </CardHeaderContent>
            <Badge tone="brand">{board.unassignedJobs.length}</Badge>
          </CardHeader>

          <CardContent className="ui-dispatch-column-grid ui-dispatch-column-grid--single">
            {board.visibleDays.map((day) => {
              const dayJobs = board.unassignedJobs.filter((job) =>
                overlapsDay(job.scheduledStartAt, job.scheduledEndAt, day.startAt, day.endAt)
              );

              return renderDayColumn(
                day,
                dayJobs,
                [],
                board,
                technicians,
                  returnTo,
                  meetYourMechanicByTechnicianUserId,
                  assignAction,
                  rescheduleAction,
                  sendAppointmentConfirmationAction,
                  sendDispatchUpdateAction,
                  deleteAvailabilityBlockAction
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Backlog</CardEyebrow>
              <CardTitle>Unscheduled jobs</CardTitle>
              <CardDescription>Work that still needs a time slot after scheduled assignments are covered.</CardDescription>
            </CardHeaderContent>
            <Badge tone="brand">{board.unscheduledUnassignedJobs.length}</Badge>
          </CardHeader>

          <CardContent className="ui-card-list">
            {board.unscheduledUnassignedJobs.length ? (
              board.unscheduledUnassignedJobs.map((job) => (
                <DispatchJobCard
                  key={job.id}
                  assignAction={assignAction}
                  job={job}
                  meetYourMechanicStatus={
                    job.assignedTechnicianUserId
                      ? meetYourMechanicByTechnicianUserId[job.assignedTechnicianUserId] ?? null
                      : null
                  }
                  rescheduleAction={rescheduleAction}
                  returnTo={returnTo}
                  sendAppointmentConfirmationAction={sendAppointmentConfirmationAction}
                  sendDispatchUpdateAction={sendDispatchUpdateAction}
                  technicians={technicians}
                  timeZone={board.timezone}
                />
              ))
            ) : (
              <p className="ui-dispatch-empty">No unscheduled backlog.</p>
            )}
          </CardContent>
        </Card>
      </aside>

      <div className="ui-dispatch-lanes">
        {board.technicians.map((lane) => {
          const laneTodayCount = lane.jobs.filter(
            (job) => job.scheduledStartAt && getDispatchLocalDate(job.scheduledStartAt, board.timezone) === board.date
          ).length;

          return (
            <Card key={lane.technicianUserId} tone="raised">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Technician</CardEyebrow>
                  <CardTitle>{lane.displayName}</CardTitle>
                  <CardDescription>
                    {lane.role} · {lane.jobs.length} scheduled · {lane.unscheduledJobs.length} unscheduled · {laneTodayCount} today
                  </CardDescription>
                </CardHeaderContent>

                <AvailabilityBlockForm
                  action={createAvailabilityBlockAction}
                  defaultEndAt={defaultEndAt}
                  defaultStartAt={defaultStartAt}
                  returnTo={returnTo}
                  technicianUserId={lane.technicianUserId}
                />
              </CardHeader>

              <CardContent className={`ui-dispatch-column-grid ${board.view === "day" ? "ui-dispatch-column-grid--single" : ""}`}>
                {board.visibleDays.map((day) => {
                  const dayJobs = lane.jobs.filter((job) =>
                    overlapsDay(job.scheduledStartAt, job.scheduledEndAt, day.startAt, day.endAt)
                  );
                  const dayBlocks = lane.availabilityBlocks.filter((block) =>
                    overlapsDay(block.startsAt, block.endsAt, day.startAt, day.endAt)
                  );

                  return renderDayColumn(
                    day,
                    dayJobs,
                    dayBlocks,
                    board,
                    technicians,
                    returnTo,
                    meetYourMechanicByTechnicianUserId,
                    assignAction,
                    rescheduleAction,
                    sendAppointmentConfirmationAction,
                    sendDispatchUpdateAction,
                    deleteAvailabilityBlockAction
                  );
                })}
              </CardContent>

              <CardContent className="ui-card-list">
                <div className="ui-toolbar">
                <div className="ui-action-grid">
                  <p className="ui-summary-label">Backlog</p>
                  <h3 className="ui-card__title" style={{ fontSize: "1.125rem", lineHeight: 1.2 }}>
                    Assigned backlog
                  </h3>
                </div>
                  <Badge tone="brand">{lane.unscheduledJobs.length}</Badge>
                </div>

                <div className="ui-card-list">
                  {lane.unscheduledJobs.length ? (
                    lane.unscheduledJobs.map((job) => (
                      <DispatchJobCard
                        key={job.id}
                        assignAction={assignAction}
                        job={job}
                        meetYourMechanicStatus={
                          job.assignedTechnicianUserId
                            ? meetYourMechanicByTechnicianUserId[job.assignedTechnicianUserId] ?? null
                            : null
                        }
                        rescheduleAction={rescheduleAction}
                        returnTo={returnTo}
                        sendAppointmentConfirmationAction={sendAppointmentConfirmationAction}
                        sendDispatchUpdateAction={sendDispatchUpdateAction}
                        technicians={technicians}
                        timeZone={board.timezone}
                      />
                    ))
                  ) : (
                    <p className="ui-dispatch-empty">No unscheduled work in this lane.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!board.technicians.length ? (
          <EmptyState
            description="Add or reactivate a technician, owner, or admin membership before dispatching jobs."
            eyebrow="No technicians"
            title="No assignable technicians available"
          />
        ) : null}
      </div>
    </div>
  );
}
