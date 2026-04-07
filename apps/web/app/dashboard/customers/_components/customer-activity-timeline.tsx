import { formatDateTime } from "@mobile-mechanic/core";
import type {
  CustomerCommunicationLogEntry,
  ServiceHistoryVisit
} from "@mobile-mechanic/types";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  Badge,
  Card,
  CardContent,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  StatusBadge
} from "../../../../components/ui";
import { isFollowUpVisitTitle } from "../../../../lib/jobs/follow-up";

type CustomerActivityTimelineProps = {
  communications: CustomerCommunicationLogEntry[];
  description?: ReactNode;
  footer?: ReactNode;
  maxItems?: number | undefined;
  timeZone: string;
  title: ReactNode;
  vehicleLinkBuilder: (vehicleId: string) => string;
  visits: ServiceHistoryVisit[];
};

type ActivityItem =
  | {
      followUp: boolean;
      id: string;
      kind: "communication";
      occurredAt: string;
      primaryActionHref: string | null;
      primaryActionLabel: string | null;
      status: string;
      subtitle: string;
      summary: string;
      title: string;
    }
  | {
      followUp: boolean;
      id: string;
      kind: "service";
      occurredAt: string;
      primaryActionHref: string;
      primaryActionLabel: string;
      status: string;
      subtitle: string;
      summary: string;
      title: string;
      vehicleHref: string;
    };

function formatCommunicationType(value: string) {
  switch (value) {
    case "follow_up_awaiting_parts":
      return "Awaiting parts update";
    case "follow_up_booked":
      return "Return visit booked";
    case "follow_up_rescheduled":
      return "Return visit rescheduled";
    case "follow_up_status_update":
      return "Return visit status";
    default:
      return value.replaceAll("_", " ");
  }
}

function isFollowUpCommunicationType(value: string) {
  return value.startsWith("follow_up_");
}

function buildActivityItems(args: {
  communications: CustomerCommunicationLogEntry[];
  visits: ServiceHistoryVisit[];
  vehicleLinkBuilder: (vehicleId: string) => string;
}) {
  const communicationItems = args.communications.map<ActivityItem>((entry) => ({
    followUp: isFollowUpCommunicationType(entry.communicationType),
    id: `communication-${entry.id}`,
    kind: "communication",
    occurredAt: entry.createdAt,
    primaryActionHref: entry.jobId ? `/dashboard/visits/${entry.jobId}` : null,
    primaryActionLabel: entry.jobId ? "Open visit" : null,
    status: entry.status,
    subtitle: `${
      isFollowUpCommunicationType(entry.communicationType) ? "Return-work update" : "Customer update"
    } · ${entry.channel.toUpperCase()} · ${entry.recipientEmail ?? entry.recipientPhone ?? "Unknown destination"}`,
    summary:
      entry.subject ??
      entry.errorMessage ??
      (isFollowUpCommunicationType(entry.communicationType)
        ? "Customer follow-up status was queued or delivered for return work."
        : "Customer update queued or delivered."),
    title: formatCommunicationType(entry.communicationType)
  }));

  const visitItems = args.visits.map<ActivityItem>((visit) => ({
    followUp: isFollowUpVisitTitle(visit.jobTitle),
    id: `visit-${visit.jobId}`,
    kind: "service",
    occurredAt: visit.sortAt,
    primaryActionHref: `/dashboard/visits/${visit.jobId}`,
    primaryActionLabel: "Open visit",
    status: visit.jobStatus,
    subtitle: visit.vehicleDisplayName,
    summary: visit.estimate
      ? `${visit.estimate.estimateNumber} · ${visit.invoice ? visit.invoice.invoiceNumber : "No invoice"}`
      : visit.invoice
        ? `${visit.invoice.invoiceNumber} · ${
            visit.payments.length ? `${visit.payments.length} payment${visit.payments.length === 1 ? "" : "s"}` : "No payments"
          }`
        : "Service visit recorded.",
    title: visit.jobTitle,
    vehicleHref: args.vehicleLinkBuilder(visit.vehicleId)
  }));

  return [...communicationItems, ...visitItems].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  );
}

export function CustomerActivityTimeline({
  communications,
  description,
  footer,
  maxItems,
  timeZone,
  title,
  vehicleLinkBuilder,
  visits
}: CustomerActivityTimelineProps) {
  const items = buildActivityItems({ communications, vehicleLinkBuilder, visits });
  const visibleItems = typeof maxItems === "number" ? items.slice(0, maxItems) : items;

  return (
    <Card padding="spacious">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Activity</CardEyebrow>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="ui-card__description">{description}</p> : null}
        </CardHeaderContent>
      </CardHeader>

      <CardContent>
        {visibleItems.length ? (
          <div className="ui-timeline">
            {visibleItems.map((item) => (
              <article className="ui-timeline-item" key={item.id}>
                <div className="ui-timeline-meta">
                  <Badge tone={item.kind === "service" ? "brand" : "neutral"}>
                    {item.kind === "service" ? "Service" : "Communication"}
                  </Badge>
                  {item.followUp ? <Badge tone="warning">Return work</Badge> : null}
                  <StatusBadge status={item.status} />
                  <span>{formatDateTime(item.occurredAt, { timeZone })}</span>
                </div>

                <div className="customer-activity-timeline__header">
                  <div>
                    <p className="customer-activity-timeline__title">{item.title}</p>
                    <p className="customer-activity-timeline__subtitle">
                      {item.kind === "service" ? (
                        <Link href={item.vehicleHref}>{item.subtitle}</Link>
                      ) : (
                        item.subtitle
                      )}
                    </p>
                  </div>

                  {item.primaryActionHref && item.primaryActionLabel ? (
                    <Link href={item.primaryActionHref}>{item.primaryActionLabel}</Link>
                  ) : null}
                </div>

                <p className="ui-timeline-copy">{item.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="No service visits or communications have been logged for this customer yet."
            eyebrow="Activity"
            title="No activity yet"
          />
        )}
        {footer ? <div className="customer-activity-timeline__footer">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
