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
  buildServiceHistoryHref,
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

type ServiceHistoryViewProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  basePath: string;
  clearHref: string;
  filters: ServiceHistoryQuery;
  summary: ServiceHistorySummary;
  visits: ServiceHistoryVisit[];
  backLinks: Array<{
    href: string;
    label: string;
  }>;
  timeZone: string;
  vehicleOptions?: ServiceHistoryVehicleOption[];
  currentVehicleId?: string | undefined;
  customerHistoryHref?: string | undefined;
  vehicleHistoryHrefBuilder?: ((vehicleId: string) => string) | undefined;
  visitLinkOptions?: VisitWorkspaceLinkOptions | undefined;
};

function renderDateTime(value: string | null | undefined, timeZone: string, fallback: string) {
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
    label: "Started",
    value: renderDateTime(visit.startedAt, timeZone, "Not started")
  };
}

export function ServiceHistoryView({
  eyebrow,
  title,
  description,
  basePath,
  clearHref,
  filters,
  summary,
  visits,
  backLinks,
  timeZone,
  vehicleOptions = [],
  currentVehicleId,
  customerHistoryHref,
  vehicleHistoryHrefBuilder,
  visitLinkOptions
}: ServiceHistoryViewProps) {
  return (
    <section className="workspace-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
          <p className="copy" style={{ marginBottom: 0 }}>
            {description}
          </p>
        </div>

        <div className="header-actions">
          {customerHistoryHref ? (
            <Link className="button secondary-button button-link" href={customerHistoryHref}>
              Customer thread history
            </Link>
          ) : null}
          {backLinks.map((link) => (
            <Link key={link.href} className="button secondary-button button-link" href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="history-summary-grid">
        <article className="stat-card">
          <p className="stat-label">Total visits</p>
          <p className="stat-value">{summary.totalJobs}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Completed</p>
          <p className="stat-value">{summary.completedJobs}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Invoiced</p>
          <p className="stat-value">{formatCurrencyFromCents(summary.totalInvoicedCents)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Paid</p>
          <p className="stat-value">{formatCurrencyFromCents(summary.totalPaidCents)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Open balance</p>
          <p className="stat-value">{formatCurrencyFromCents(summary.openBalanceCents)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Last service</p>
          <p className="stat-value history-stat-date">{renderDateTime(summary.lastServiceAt, timeZone, "No history")}</p>
        </article>
      </div>

      {vehicleOptions.length ? (
        <div className="workspace-card panel-subsection">
          <div className="section-header">
            <div>
              <p className="eyebrow">Vehicles</p>
              <h2 className="section-title">Quick vehicle history</h2>
            </div>
          </div>

          <div className="history-chip-row">
            {vehicleOptions.map((vehicle) => {
              const href = vehicleHistoryHrefBuilder
                ? buildServiceHistoryHref(vehicleHistoryHrefBuilder(vehicle.vehicleId), {
                    dateFrom: filters.dateFrom,
                    dateTo: filters.dateTo,
                    jobStatuses: filters.jobStatuses,
                    inspectionStatuses: filters.inspectionStatuses,
                    estimateStatuses: filters.estimateStatuses,
                    invoiceStatuses: filters.invoiceStatuses,
                    paymentStatuses: filters.paymentStatuses,
                    sort: filters.sort
                  })
                : null;

              const content = (
                <>
                  <span>{vehicle.displayName}</span>
                  {!vehicle.isActive ? <span className="badge">Archived</span> : null}
                </>
              );

              return href ? (
                <Link
                  key={vehicle.vehicleId}
                  className={`history-chip${currentVehicleId === vehicle.vehicleId ? " history-chip-active" : ""}`}
                  href={href}
                >
                  {content}
                </Link>
              ) : (
                <span
                  className={`history-chip${currentVehicleId === vehicle.vehicleId ? " history-chip-active" : ""}`}
                  key={vehicle.vehicleId}
                >
                  {content}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="workspace-card">
        <form action={basePath} className="panel-subsection" method="get">
          <div className="section-header">
            <div>
              <p className="eyebrow">Filters</p>
              <h2 className="section-title">Filter history</h2>
            </div>
          </div>

          <div className="filter-grid">
            <label className="label">
              Service date from
              <input className="input" defaultValue={formatDateFilterValue(filters.dateFrom)} name="dateFrom" type="date" />
            </label>

            <label className="label">
              Service date to
              <input className="input" defaultValue={formatDateFilterValue(filters.dateTo)} name="dateTo" type="date" />
            </label>

            <label className="label">
              Sort by
              <select className="input" defaultValue={filters.sort ?? "service_date"} name="sort">
                <option value="service_date">Service date</option>
                <option value="created_at">Created at</option>
              </select>
            </label>

            {vehicleOptions.length ? (
              <label className="label">
                Vehicle
                <select className="input" defaultValue={filters.vehicleId ?? ""} name="vehicleId">
                  <option value="">All vehicles</option>
                  {vehicleOptions.map((vehicle) => (
                    <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                      {vehicle.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="label">
              Visit status
              <select className="input history-multi-select" defaultValue={filters.jobStatuses ?? []} multiple name="jobStatuses" size={Math.min(jobStatuses.length, 6)}>
                {renderStatusOptions(jobStatuses)}
              </select>
            </label>

            <label className="label">
              Inspection status
              <select className="input history-multi-select" defaultValue={filters.inspectionStatuses ?? []} multiple name="inspectionStatuses" size={Math.min(inspectionStatuses.length, 6)}>
                {renderStatusOptions(inspectionStatuses)}
              </select>
            </label>

            <label className="label">
              Estimate status
              <select className="input history-multi-select" defaultValue={filters.estimateStatuses ?? []} multiple name="estimateStatuses" size={Math.min(estimateStatuses.length, 6)}>
                {renderStatusOptions(estimateStatuses)}
              </select>
            </label>

            <label className="label">
              Invoice status
              <select className="input history-multi-select" defaultValue={filters.invoiceStatuses ?? []} multiple name="invoiceStatuses" size={Math.min(invoiceStatuses.length, 6)}>
                {renderStatusOptions(invoiceStatuses)}
              </select>
            </label>

            <label className="label">
              Payment status
              <select className="input history-multi-select" defaultValue={filters.paymentStatuses ?? []} multiple name="paymentStatuses" size={Math.min(paymentStatuses.length, 6)}>
                {renderStatusOptions(paymentStatuses)}
              </select>
            </label>
          </div>

          <div className="action-row">
            <button className="button" type="submit">
              Apply filters
            </button>
            <Link className="button secondary-button button-link" href={clearHref}>
              Clear
            </Link>
          </div>
        </form>
      </div>

      {visits.length ? (
        <div className="timeline-list">
          {visits.map((visit) => {
            const milestone = getVisitMilestone(visit, timeZone);

            return (
            <article key={visit.jobId} className="timeline-item">
              <div className="history-visit-header">
                <div>
                  <p className="eyebrow">Service visit</p>
                  <h2 className="section-title">{visit.jobTitle}</h2>
                  <p className="copy" style={{ marginBottom: 0 }}>
                    {vehicleOptions.length && vehicleHistoryHrefBuilder ? (
                      <Link
                        href={buildServiceHistoryHref(
                          vehicleHistoryHrefBuilder(visit.vehicleId),
                          {
                            dateFrom: filters.dateFrom,
                            dateTo: filters.dateTo,
                            jobStatuses: filters.jobStatuses,
                            inspectionStatuses: filters.inspectionStatuses,
                            estimateStatuses: filters.estimateStatuses,
                            invoiceStatuses: filters.invoiceStatuses,
                            paymentStatuses: filters.paymentStatuses,
                            sort: filters.sort
                          }
                        )}
                      >
                        {visit.vehicleDisplayName}
                      </Link>
                    ) : (
                      visit.vehicleDisplayName
                    )}
                  </p>
                </div>

                <div className="history-chip-row">
                  <span className="badge">{formatStatusLabel(visit.jobStatus)}</span>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <p className="detail-label">Service date</p>
                  <p className="detail-value">{renderDateTime(visit.sortAt, timeZone, "Not available")}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Scheduled</p>
                  <p className="detail-value">{renderDateTime(visit.scheduledStartAt, timeZone, "Not scheduled")}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">{milestone.label}</p>
                  <p className="detail-value">{milestone.value}</p>
                </div>
                <div className="detail-item">
                  <p className="detail-label">Created</p>
                  <p className="detail-value">{renderDateTime(visit.createdAt, timeZone, "Not available")}</p>
                </div>
              </div>

              <div className="history-linked-grid">
                {visit.inspection ? (
                  <section className="history-linked-card">
                    <p className="detail-label">Inspection</p>
                    <p className="detail-value">
                      {formatStatusLabel(visit.inspection.status)} · {visit.inspection.criticalCount} critical · {visit.inspection.highCount} high
                    </p>
                    <p className="muted" style={{ margin: 0 }}>
                      Started {renderDateTime(visit.inspection.startedAt, timeZone, "Not started")}
                    </p>
                    <p className="muted" style={{ margin: 0 }}>
                      Recommendations: {visit.inspection.recommendationCount}
                    </p>
                  </section>
                ) : null}

                {visit.estimate ? (
                  <section className="history-linked-card">
                    <p className="detail-label">Estimate</p>
                    <p className="detail-value">
                      {visit.estimate.estimateNumber} · {formatStatusLabel(visit.estimate.status)}
                    </p>
                    <p className="muted" style={{ margin: 0 }}>{visit.estimate.title}</p>
                    <p className="muted" style={{ margin: 0 }}>
                      Total {formatCurrencyFromCents(visit.estimate.totalCents)}
                    </p>
                  </section>
                ) : null}

                {visit.invoice ? (
                  <section className="history-linked-card">
                    <p className="detail-label">Invoice</p>
                    <p className="detail-value">
                      {visit.invoice.invoiceNumber} · {formatStatusLabel(visit.invoice.status)}
                    </p>
                    <p className="muted" style={{ margin: 0 }}>{visit.invoice.title}</p>
                    <p className="muted" style={{ margin: 0 }}>
                      Balance {formatCurrencyFromCents(visit.invoice.balanceDueCents)}
                    </p>
                  </section>
                ) : null}

                {visit.payments.length ? (
                  <section className="history-linked-card">
                    <p className="detail-label">Payments</p>
                    <div className="history-payment-list">
                      {visit.payments.map((payment) => (
                        <div key={payment.paymentId} className="history-payment-row">
                          <div>
                            <p className="detail-value" style={{ marginBottom: 0 }}>
                              {formatCurrencyFromCents(payment.amountCents)}
                            </p>
                            <p className="muted" style={{ margin: 0 }}>
                              {renderDateTime(payment.paidAt, timeZone, "Unknown date")}
                            </p>
                          </div>
                          <span className="badge">{formatStatusLabel(payment.status)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="action-row">
                <Link href={buildVisitDetailHref(visit.jobId, visitLinkOptions)}>Open visit</Link>
                {visit.inspection ? <Link href={buildVisitInspectionHref(visit.jobId, visitLinkOptions)}>Open inspection</Link> : null}
                {visit.estimate ? <Link href={buildVisitEstimateHref(visit.jobId, visitLinkOptions)}>Open estimate</Link> : null}
                {visit.invoice ? <Link href={buildVisitInvoiceHref(visit.jobId, visitLinkOptions)}>Open invoice</Link> : null}
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <p className="eyebrow">No history</p>
          <h2 className="section-title">No matching service history</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            Adjust the filters or add service activity for this customer or vehicle.
          </p>
        </div>
      )}
    </section>
  );
}
