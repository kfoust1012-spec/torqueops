import type { ReactNode } from "react";

import type { VehicleCarfaxSummary } from "@mobile-mechanic/types";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  SeverityBadge,
  StatusBadge
} from "../../../components/ui";
import {
  formatCarfaxDate,
  getTopCarfaxHistoryFlags,
  getTopCarfaxMaintenanceHighlights,
  hasReadyCarfaxSummary
} from "../../../lib/carfax/presentation";

type CarfaxSummaryCardProps = {
  summary: VehicleCarfaxSummary | null;
  vin: string | null;
  isConfigured?: boolean;
  action?: ReactNode;
};

type CarfaxSummaryCompactCardProps = {
  summary: VehicleCarfaxSummary;
  eyebrow?: string;
  title?: string;
};

export function CarfaxSummaryCard({ summary, vin, isConfigured = true, action }: CarfaxSummaryCardProps) {
  return (
    <div className="workspace-card panel-subsection">
      <div className="section-header">
        <div>
          <p className="eyebrow">Carfax</p>
          <h2 className="section-title">Vehicle history summary</h2>
        </div>

        <StatusBadge status={summary?.status ?? "not_pulled"} />
      </div>

      {!vin ? (
        <>
          <p className="copy" style={{ marginBottom: 0 }}>
            Add a valid VIN before requesting a Carfax summary.
          </p>
          {action}
        </>
      ) : null}

      {vin && !summary && !isConfigured ? (
        <>
          <p className="copy" style={{ marginBottom: 0 }}>
            Carfax integration is not configured in this environment yet. Vehicle, intake, and estimate workflows remain unchanged.
          </p>
        </>
      ) : null}

      {vin && !summary && isConfigured ? (
        <>
          <p className="copy" style={{ marginBottom: 0 }}>
            No Carfax summary has been pulled for this vehicle yet. Fetch it manually when history context is needed.
          </p>
          {action}
        </>
      ) : null}

      {summary?.status === "not_available" ? (
        <>
          <p className="copy" style={{ marginBottom: 0 }}>
            No Carfax report summary is available for this VIN right now.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Last attempted: {formatCarfaxDate(summary.lastAttemptedAt)}
          </p>
          {action}
        </>
      ) : null}

      {summary?.status === "provider_error" ? (
        <>
          <p className="copy" style={{ marginBottom: 0 }}>
            Carfax could not be reached right now. Core vehicle, intake, and estimate workflows are unchanged.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {summary.lastErrorMessage ?? "Try again later."}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Last attempted: {formatCarfaxDate(summary.lastAttemptedAt)}
          </p>
          {action}
        </>
      ) : null}

      {hasReadyCarfaxSummary(summary) ? (
        <div className="stack">
          <div className="detail-grid">
            <div className="detail-item">
              <p className="detail-label">Report date</p>
              <p className="detail-value">{formatCarfaxDate(summary.summary.reportDate)}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Owners</p>
              <p className="detail-value">{summary.summary.ownerCount ?? "Not reported"}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Service records</p>
              <p className="detail-value">{summary.summary.serviceRecordCount ?? "Not reported"}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Open recalls</p>
              <p className="detail-value">{summary.summary.openRecallCount ?? "Not reported"}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Accidents</p>
              <p className="detail-value">{summary.summary.accidentCount ?? "Not reported"}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Damage events</p>
              <p className="detail-value">{summary.summary.damageCount ?? "Not reported"}</p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Last reported odometer</p>
              <p className="detail-value">
                {summary.summary.lastReportedOdometer !== null
                  ? summary.summary.lastReportedOdometer.toLocaleString()
                  : "Not reported"}
              </p>
            </div>
            <div className="detail-item">
              <p className="detail-label">Fetched</p>
              <p className="detail-value">{formatCarfaxDate(summary.fetchedAt)}</p>
            </div>
          </div>

          <div className="detail-item">
            <p className="detail-label">History flags</p>
            {getTopCarfaxHistoryFlags(summary.summary).length ? (
              <div className="timeline-list">
                {getTopCarfaxHistoryFlags(summary.summary).map((flag) => (
                  <article key={`${flag.kind}-${flag.label}-${flag.reportedAt ?? "unknown"}`} className="timeline-item">
                    <div className="note-meta">
                      <strong>{flag.label}</strong>
                      <span>{flag.kind.replaceAll("_", " ")}</span>
                      <SeverityBadge value={flag.severity} />
                    </div>
                    {flag.details ? (
                      <p className="detail-value" style={{ marginBottom: 0 }}>
                        {flag.details}
                      </p>
                    ) : null}
                    <p className="muted" style={{ margin: 0 }}>
                      Reported: {formatCarfaxDate(flag.reportedAt)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="detail-value">No notable flags were summarized.</p>
            )}
          </div>

          <div className="detail-item">
            <p className="detail-label">Maintenance highlights</p>
            {getTopCarfaxMaintenanceHighlights(summary.summary).length ? (
              <div className="timeline-list">
                {getTopCarfaxMaintenanceHighlights(summary.summary).map((highlight) => (
                  <article
                    key={`${highlight.label}-${highlight.performedAt ?? "unknown"}-${highlight.odometer ?? "na"}`}
                    className="timeline-item"
                  >
                    <div className="note-meta">
                      <strong>{highlight.label}</strong>
                      <span>{formatCarfaxDate(highlight.performedAt)}</span>
                      <span>
                        {highlight.odometer !== null
                          ? `${highlight.odometer.toLocaleString()} mi`
                          : "Mileage unavailable"}
                      </span>
                    </div>
                    <p className="detail-value" style={{ marginBottom: 0 }}>
                      {highlight.details ?? "No additional maintenance detail provided."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="detail-value">No maintenance highlights were summarized.</p>
            )}
          </div>

          {summary.summary.warnings.length ? (
            <div className="detail-item">
              <p className="detail-label">Warnings</p>
              <div className="stack" style={{ gap: 8 }}>
                {summary.summary.warnings.map((warning) => (
                  <p key={warning} className="muted" style={{ margin: 0 }}>
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <p className="muted" style={{ margin: 0 }}>
            External history context only. Confirm report details manually before using them for customer-facing decisions.
          </p>

          {action}
        </div>
      ) : null}
    </div>
  );
}

export function CarfaxSummaryCompactCard({
  summary,
  eyebrow = "Vehicle history",
  title = "Carfax context"
}: CarfaxSummaryCompactCardProps) {
  if (!hasReadyCarfaxSummary(summary)) {
    return null;
  }

  return (
    <Card tone="subtle">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>{eyebrow}</CardEyebrow>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Cached external history context for estimate review.</CardDescription>
        </CardHeaderContent>
        <Badge tone="brand">Cached</Badge>
      </CardHeader>

      <CardContent className="ui-action-grid">
        <div className="ui-detail-grid">
          <div className="ui-detail-item">
            <p className="ui-detail-label">Service records</p>
            <p className="ui-detail-value">{summary.summary.serviceRecordCount ?? "Not reported"}</p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Open recalls</p>
            <p className="ui-detail-value">{summary.summary.openRecallCount ?? "Not reported"}</p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Accidents</p>
            <p className="ui-detail-value">{summary.summary.accidentCount ?? "Not reported"}</p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Last odometer</p>
            <p className="ui-detail-value">
            {summary.summary.lastReportedOdometer !== null
              ? summary.summary.lastReportedOdometer.toLocaleString()
              : "Not reported"}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Fetched</p>
            <p className="ui-detail-value">{formatCarfaxDate(summary.fetchedAt)}</p>
          </div>
        </div>

        {getTopCarfaxHistoryFlags(summary.summary, 2).length ? (
          <div className="ui-detail-item">
            <p className="ui-detail-label">Watch items</p>
            <div className="ui-card-list">
            {getTopCarfaxHistoryFlags(summary.summary, 2).map((flag) => (
                <div key={`${flag.kind}-${flag.label}-${flag.reportedAt ?? "unknown"}`} className="ui-timeline-item">
                  <div className="ui-timeline-meta">
                    <strong>{flag.label}</strong>
                    <span>{flag.kind.replaceAll("_", " ")}</span>
                    <span>{formatCarfaxDate(flag.reportedAt)}</span>
                    <SeverityBadge value={flag.severity} />
                  </div>
                </div>
            ))}
            </div>
          </div>
        ) : null}

        {getTopCarfaxMaintenanceHighlights(summary.summary, 2).length ? (
          <div className="ui-detail-item">
            <p className="ui-detail-label">Maintenance highlights</p>
            <div className="ui-card-list">
            {getTopCarfaxMaintenanceHighlights(summary.summary, 2).map((highlight) => (
              <div
                key={`${highlight.label}-${highlight.performedAt ?? "unknown"}-${highlight.odometer ?? "na"}`}
                className="ui-timeline-item"
              >
                <div className="ui-timeline-meta">
                  <strong>{highlight.label}</strong>
                  <span>{formatCarfaxDate(highlight.performedAt)}</span>
                  <span>
                    {highlight.odometer !== null
                      ? `${highlight.odometer.toLocaleString()} mi`
                      : "Mileage unavailable"}
                  </span>
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : null}

        <p className="ui-section-copy">
          Cached external context only. Verify manually before relying on it.
        </p>
      </CardContent>
    </Card>
  );
}
