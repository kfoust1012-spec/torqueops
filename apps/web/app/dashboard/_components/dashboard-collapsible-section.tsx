import type { ReactNode } from "react";

type DashboardCollapsibleSectionProps = {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  summary: string;
  summaryLabel: string;
};

export function DashboardCollapsibleSection({
  children,
  className,
  defaultOpen = false,
  summary,
  summaryLabel
}: DashboardCollapsibleSectionProps) {
  const rootClassName = ["dashboard-cockpit__collapsible", className].filter(Boolean).join(" ");

  return (
    <details className={rootClassName} open={defaultOpen}>
      <summary className="dashboard-cockpit__collapsible-summary">
        <div className="dashboard-cockpit__collapsible-summary-main">
          <span className="dashboard-cockpit__collapsible-summary-label">{summaryLabel}</span>
          <strong className="dashboard-cockpit__collapsible-summary-copy">{summary}</strong>
        </div>
        <span className="dashboard-cockpit__collapsible-summary-action" aria-hidden="true">
          <span className="dashboard-cockpit__collapsible-summary-state dashboard-cockpit__collapsible-summary-state--closed">
            Show
          </span>
          <span className="dashboard-cockpit__collapsible-summary-state dashboard-cockpit__collapsible-summary-state--open">
            Hide
          </span>
        </span>
      </summary>
      <div className="dashboard-cockpit__collapsible-content">{children}</div>
    </details>
  );
}
