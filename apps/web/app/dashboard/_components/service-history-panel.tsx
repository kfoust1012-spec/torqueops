import {
  formatCurrencyFromCents,
  formatDateTime,
  isTechnicianOnSiteJobStatus
} from "@mobile-mechanic/core";
import {
  estimateStatuses,
  inspectionStatuses,
  invoiceStatuses,
  jobStatuses,
  paymentStatuses,
  type ServiceHistoryQuery,
  type ServiceHistorySummary,
  type ServiceHistoryVehicleOption,
  type ServiceHistoryVisit
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
  Form,
  FormField,
  Input,
  Select,
  StatusBadge,
  buttonClassName
} from "../../../components/ui";
import {
  formatDateFilterValue,
  formatStatusLabel
} from "../../../lib/service-history/filters";
import {
  buildVisitDetailHref,
  buildVisitEstimateHref,
  buildVisitInspectionHref,
  buildVisitInvoiceHref,
  type VisitWorkspaceLinkOptions
} from "../../../lib/visits/workspace";

type ServiceHistoryPanelProps = {
  baseHref: string;
  clearHref: string;
  currentVehicleId?: string | undefined;
  description?: ReactNode;
  filters: Partial<ServiceHistoryQuery>;
  footer?: ReactNode;
  maxVisits?: number | undefined;
  showFilters?: boolean | undefined;
  showSummary?: boolean | undefined;
  summary: ServiceHistorySummary;
  timeZone: string;
  title: ReactNode;
  visitLinkOptions?: VisitWorkspaceLinkOptions | undefined;
  vehicleLinkBuilder?: ((vehicleId: string) => string) | undefined;
  vehicleOptions?: ServiceHistoryVehicleOption[] | undefined;
  visits: ServiceHistoryVisit[];
};

function renderDateTime(
  value: string | null | undefined,
  timeZone: string,
  fallback: string
) {
  return formatDateTime(value, { fallback, timeZone });
}

function renderStatusOptions(values: readonly string[]) {
  return values.map((value) => (
    <option key={value} value={value}>
      {formatStatusLabel(value)}
    </option>
  ));
}

function getVisitMilestone(visit: ServiceHistoryVisit, timeZone: string) {
  if (visit.canceledAt || visit.jobStatus === "canceled") {
    return {
      label: "Canceled",
      value: renderDateTime(visit.canceledAt, timeZone, "Canceled")
    };
  }

  if (visit.completedAt || visit.jobStatus === "completed") {
    return {
      label: "Completed",
      value: renderDateTime(visit.completedAt, timeZone, "Completed")
    };
  }

  if (visit.startedAt || isTechnicianOnSiteJobStatus(visit.jobStatus)) {
    return {
      label: "Started",
      value: renderDateTime(visit.startedAt, timeZone, "In progress")
    };
  }

  return {
    label: "Scheduled",
    value: renderDateTime(visit.scheduledStartAt, timeZone, "Not scheduled")
  };
}

export function ServiceHistoryPanel({
  baseHref,
  clearHref,
  currentVehicleId,
  description,
  filters,
  footer,
  maxVisits,
  showFilters = true,
  showSummary = true,
  summary,
  timeZone,
  title,
  visitLinkOptions,
  vehicleLinkBuilder,
  vehicleOptions = [],
  visits
}: ServiceHistoryPanelProps) {
  const visibleVisits = typeof maxVisits === "number" ? visits.slice(0, maxVisits) : visits;

  return (
    <Card className="customer-history-panel" padding="spacious">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Service thread</CardEyebrow>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="ui-card__description">{description}</p> : null}
        </CardHeaderContent>
      </CardHeader>

      <CardContent className="customer-history-panel__content">
        {showSummary ? (
          <div className="customer-history-panel__summary">
            <article className="customer-history-panel__stat">
              <p className="customer-history-panel__stat-label">Visits</p>
              <p className="customer-history-panel__stat-value">{summary.totalJobs}</p>
            </article>
            <article className="customer-history-panel__stat">
              <p className="customer-history-panel__stat-label">Completed</p>
              <p className="customer-history-panel__stat-value">{summary.completedJobs}</p>
            </article>
            <article className="customer-history-panel__stat">
              <p className="customer-history-panel__stat-label">Invoiced</p>
              <p className="customer-history-panel__stat-value">
                {formatCurrencyFromCents(summary.totalInvoicedCents)}
              </p>
            </article>
            <article className="customer-history-panel__stat">
              <p className="customer-history-panel__stat-label">Paid</p>
              <p className="customer-history-panel__stat-value">
                {formatCurrencyFromCents(summary.totalPaidCents)}
              </p>
            </article>
            <article className="customer-history-panel__stat">
              <p className="customer-history-panel__stat-label">Open balance</p>
              <p className="customer-history-panel__stat-value">
                {formatCurrencyFromCents(summary.openBalanceCents)}
              </p>
            </article>
            <article className="customer-history-panel__stat">
              <p className="customer-history-panel__stat-label">Last service</p>
              <p className="customer-history-panel__stat-value customer-history-panel__stat-value--date">
                {renderDateTime(summary.lastServiceAt, timeZone, "No history")}
              </p>
            </article>
          </div>
        ) : null}

        {showFilters ? (
          <Form action={baseHref} className="customer-history-panel__filters" method="get">
            <div className="customer-history-panel__filters-grid">
              <FormField label="From">
                <Input
                  defaultValue={formatDateFilterValue(filters.dateFrom)}
                  name="dateFrom"
                  type="date"
                />
              </FormField>

              <FormField label="To">
                <Input
                  defaultValue={formatDateFilterValue(filters.dateTo)}
                  name="dateTo"
                  type="date"
                />
              </FormField>

              <FormField label="Sort">
                <Select defaultValue={filters.sort ?? "service_date"} name="sort">
                  <option value="service_date">Service date</option>
                  <option value="created_at">Created at</option>
                </Select>
              </FormField>

              {vehicleOptions.length ? (
                <FormField label="Vehicle">
                  <Select defaultValue={filters.vehicleId ?? ""} name="vehicleId">
                    <option value="">All vehicles</option>
                    {vehicleOptions.map((vehicle) => (
                      <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                        {vehicle.displayName}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}
            </div>

            <details className="customer-history-panel__advanced">
              <summary className="customer-history-panel__advanced-toggle">
                More filters
              </summary>

              <div className="customer-history-panel__advanced-grid">
                <FormField label="Visit status">
                  <Select
                    defaultValue={filters.jobStatuses ?? []}
                    multiple
                    name="jobStatuses"
                    size={Math.min(jobStatuses.length, 6)}
                  >
                    {renderStatusOptions(jobStatuses)}
                  </Select>
                </FormField>

                <FormField label="Inspection status">
                  <Select
                    defaultValue={filters.inspectionStatuses ?? []}
                    multiple
                    name="inspectionStatuses"
                    size={Math.min(inspectionStatuses.length, 6)}
                  >
                    {renderStatusOptions(inspectionStatuses)}
                  </Select>
                </FormField>

                <FormField label="Estimate status">
                  <Select
                    defaultValue={filters.estimateStatuses ?? []}
                    multiple
                    name="estimateStatuses"
                    size={Math.min(estimateStatuses.length, 6)}
                  >
                    {renderStatusOptions(estimateStatuses)}
                  </Select>
                </FormField>

                <FormField label="Invoice status">
                  <Select
                    defaultValue={filters.invoiceStatuses ?? []}
                    multiple
                    name="invoiceStatuses"
                    size={Math.min(invoiceStatuses.length, 6)}
                  >
                    {renderStatusOptions(invoiceStatuses)}
                  </Select>
                </FormField>

                <FormField label="Payment status">
                  <Select
                    defaultValue={filters.paymentStatuses ?? []}
                    multiple
                    name="paymentStatuses"
                    size={Math.min(paymentStatuses.length, 6)}
                  >
                    {renderStatusOptions(paymentStatuses)}
                  </Select>
                </FormField>
              </div>
            </details>

            <div className="ui-button-grid">
              <button className={buttonClassName()} type="submit">
                Apply filters
              </button>
              <Link className={buttonClassName({ tone: "ghost" })} href={clearHref}>
                Clear
              </Link>
            </div>
          </Form>
        ) : null}

        {visibleVisits.length ? (
          <div className="customer-history-panel__visits">
            {visibleVisits.map((visit) => {
              const milestone = getVisitMilestone(visit, timeZone);
              const vehicleHref = vehicleLinkBuilder ? vehicleLinkBuilder(visit.vehicleId) : null;

              return (
                <article className="customer-history-panel__visit" key={visit.jobId}>
                  <div className="customer-history-panel__visit-header">
                    <div className="customer-history-panel__visit-copy">
                      <p className="customer-history-panel__visit-eyebrow">Service visit</p>
                      <h3 className="customer-history-panel__visit-title">{visit.jobTitle}</h3>
                      <p className="customer-history-panel__visit-meta">
                        {vehicleHref ? (
                          <Link href={vehicleHref}>{visit.vehicleDisplayName}</Link>
                        ) : (
                          visit.vehicleDisplayName
                        )}
                      </p>
                    </div>

                    <div className="ui-inline-meta">
                      {currentVehicleId && currentVehicleId === visit.vehicleId ? (
                        <Badge tone="brand">Current vehicle</Badge>
                      ) : null}
                      <StatusBadge status={visit.jobStatus} />
                    </div>
                  </div>

                  <div className="ui-detail-grid">
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Service date</p>
                      <p className="ui-detail-value">
                        {renderDateTime(visit.sortAt, timeZone, "Not available")}
                      </p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">{milestone.label}</p>
                      <p className="ui-detail-value">{milestone.value}</p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Estimate</p>
                      <p className="ui-detail-value">
                        {visit.estimate
                          ? `${visit.estimate.estimateNumber} · ${formatStatusLabel(visit.estimate.status)}`
                          : "Not created"}
                      </p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Invoice</p>
                      <p className="ui-detail-value">
                        {visit.invoice
                          ? `${visit.invoice.invoiceNumber} · ${formatCurrencyFromCents(
                              visit.invoice.balanceDueCents
                            )} due`
                          : "Not created"}
                      </p>
                    </div>
                  </div>

                  <div className="customer-history-panel__artifact-row">
                    {visit.inspection ? (
                      <div className="customer-history-panel__artifact">
                        <p className="customer-history-panel__artifact-label">Inspection</p>
                        <p className="customer-history-panel__artifact-value">
                          {formatStatusLabel(visit.inspection.status)} ·{" "}
                          {visit.inspection.criticalCount} critical
                        </p>
                      </div>
                    ) : null}

                    {visit.estimate ? (
                      <div className="customer-history-panel__artifact">
                        <p className="customer-history-panel__artifact-label">Estimate</p>
                        <p className="customer-history-panel__artifact-value">
                          {formatCurrencyFromCents(visit.estimate.totalCents)}
                        </p>
                      </div>
                    ) : null}

                    {visit.invoice ? (
                      <div className="customer-history-panel__artifact">
                        <p className="customer-history-panel__artifact-label">Invoice</p>
                        <p className="customer-history-panel__artifact-value">
                          {formatCurrencyFromCents(visit.invoice.totalCents)}
                        </p>
                      </div>
                    ) : null}

                    {visit.payments.length ? (
                      <div className="customer-history-panel__artifact">
                        <p className="customer-history-panel__artifact-label">Payments</p>
                        <p className="customer-history-panel__artifact-value">
                          {formatCurrencyFromCents(
                            visit.payments.reduce(
                              (total, payment) => total + payment.amountCents,
                              0
                            )
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="ui-table-actions">
                    <Link href={buildVisitDetailHref(visit.jobId, visitLinkOptions)}>Open visit</Link>
                    {visit.inspection ? (
                      <Link href={buildVisitInspectionHref(visit.jobId, visitLinkOptions)}>
                        Inspection
                      </Link>
                    ) : null}
                    {visit.estimate ? (
                      <Link href={buildVisitEstimateHref(visit.jobId, visitLinkOptions)}>
                        Estimate
                      </Link>
                    ) : null}
                    {visit.invoice ? (
                      <Link href={buildVisitInvoiceHref(visit.jobId, visitLinkOptions)}>
                        Invoice
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description="No matching service history is available for the current filters."
            eyebrow="History"
            title="No service history found"
          />
        )}
        {footer ? <div className="customer-history-panel__footer">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
