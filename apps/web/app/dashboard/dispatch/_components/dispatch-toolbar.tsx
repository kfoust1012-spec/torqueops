import Link from "next/link";
import type {
  AssignableTechnicianOption,
  DispatchCalendarScope,
  DispatchCalendarView
} from "@mobile-mechanic/types";

import { AppIcon, Button, Select, buttonClassName, cx } from "../../../../components/ui";
import type {
  DispatchInterventionAction,
  DispatchInterventionSummaryItem
} from "./dispatch-intervention-model";

type DispatchToolbarProps = {
  backlogCount: number;
  backHref: string;
  closeoutRiskCount: number;
  conflictsOpen: boolean;
  currentDateLabel: string;
  dominantInterventionAction: DispatchInterventionAction | null;
  focusMode: boolean;
  focusToggleHref: string;
  intakeCount: number;
  interventionSummaryItems: DispatchInterventionSummaryItem[];
  nextHref: string;
  operationsRailOpen: boolean;
  onRefresh: () => void;
  onToggleOperationsRail: () => void;
  onSelectSingleTechnician: (technicianUserId: string) => void;
  onToggleQueue: () => void;
  onScopeChange: (scope: DispatchCalendarScope) => void;
  onToggleUtilities: () => void;
  onViewChange: (view: DispatchCalendarView) => void;
  onZoomPresetChange: (preset: "overview" | "comfortable" | "detail") => void;
  previousHref: string;
  queueCount: number;
  queueOpen: boolean;
  readyQueueCount: number;
  roleFocus?: {
    links: Array<{
      href: string;
      label: string;
      tone: "primary" | "secondary" | "tertiary";
    }>;
    title: string;
  } | null;
  pageTitle: string;
  followUpVisitCount: number;
  staleFollowUpVisitCount: number;
  scope: DispatchCalendarScope;
  selectedSingleTechnicianId: string;
  selectedSavedViewName?: string | null | undefined;
  staleApprovalCount: number;
  showQueueToggle: boolean;
  technicians: AssignableTechnicianOption[];
  timeZoneLabel: string;
  totalTechnicianCount: number;
  todayHref: string;
  utilitiesOpen: boolean;
  view: DispatchCalendarView;
  visibleResourceCount: number;
  visitsNeedsAssignmentHref: string;
  visitsReturnVisitHref: string;
  visitsStaleReturnVisitHref: string;
  visitsReadyDispatchHref: string;
  visitsStaleApprovalHref: string;
  financeHref: string;
  working?: boolean | undefined;
  zoomPreset: "overview" | "comfortable" | "detail";
};

export function DispatchToolbar({
  backlogCount,
  backHref,
  closeoutRiskCount,
  conflictsOpen,
  currentDateLabel,
  dominantInterventionAction,
  focusMode,
  focusToggleHref,
  intakeCount,
  interventionSummaryItems,
  nextHref,
  operationsRailOpen,
  onRefresh,
  onToggleOperationsRail,
  onSelectSingleTechnician,
  onToggleQueue,
  onScopeChange,
  onToggleUtilities,
  onViewChange,
  onZoomPresetChange,
  previousHref,
  queueCount,
  queueOpen,
  readyQueueCount,
  roleFocus,
  pageTitle,
  followUpVisitCount,
  staleFollowUpVisitCount,
  scope,
  selectedSingleTechnicianId,
  selectedSavedViewName,
  staleApprovalCount,
  showQueueToggle,
  technicians,
  timeZoneLabel,
  totalTechnicianCount,
  todayHref,
  utilitiesOpen,
  view,
  visibleResourceCount,
  visitsNeedsAssignmentHref,
  visitsReturnVisitHref,
  visitsStaleReturnVisitHref,
  visitsReadyDispatchHref,
  visitsStaleApprovalHref,
  financeHref,
  working,
  zoomPreset
}: DispatchToolbarProps) {
  const zoomOverviewLabel = view === "day" ? "Fit crew" : "Overview";
  const showSingleTechPicker = scope === "single_tech" && technicians.length > 0;
  const showAllCrewShortcut = scope !== "all_workers" && technicians.length > 1;
  const activeDominantInterventionAction = operationsRailOpen ? null : dominantInterventionAction;
  const boardLabel =
    view === "month" ? "Route planning" : view === "week" ? "Weekly board" : "Board";
  const scopeSummary =
    scope === "all_workers"
      ? `${visibleResourceCount} lane${visibleResourceCount === 1 ? "" : "s"}`
      : scope === "single_tech"
        ? "Focused lane"
        : `${visibleResourceCount}/${totalTechnicianCount} active`;
  const queueToggleLabel = queueOpen ? `Hide queue (${queueCount})` : `Queue (${queueCount})`;
  const utilitiesToggleLabel = utilitiesOpen ? "Close controls" : "Controls";
  const boardOnlyLabel = operationsRailOpen ? "Hide rail" : "Exceptions";
  const primarySignal =
    !operationsRailOpen && !conflictsOpen ? interventionSummaryItems[0] ?? null : null;
  const showPrimarySignal = Boolean(primarySignal) && !operationsRailOpen && !conflictsOpen;
  const getPrimarySignalIconName = (signal: DispatchInterventionSummaryItem | null) => {
    switch (signal?.id) {
      case "conflicts":
      case "promise_risk":
        return "alert";
      case "ready_release":
      case "stale_approval":
        return "approval";
      case "closeout_risk":
        return "money";
      case "supply_blocked":
        return "inventory";
      default:
        return "dispatch";
    }
  };

  return (
    <div
      aria-label={`${pageTitle} controls`}
      className="dispatch-command-strip dispatch-command-strip--controls-only"
    >
      <div className="dispatch-command-strip__bar">
        <div className="dispatch-command-strip__rail dispatch-command-strip__rail--secondary">
          <div className="dispatch-command-strip__zone dispatch-command-strip__zone--controls">
            <section className="dispatch-command-strip__control-cluster dispatch-command-strip__control-cluster--date">
              <div className="dispatch-command-strip__nav" aria-label="Dispatch date controls">
                <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={previousHref}>
                  <span className="dispatch-command-strip__button-copy">Previous</span>
                </Link>
                <strong className="dispatch-command-strip__command-value dispatch-command-strip__command-value--date">
                  {currentDateLabel}
                </strong>
                <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={todayHref}>
                  <AppIcon className="dispatch-command-strip__button-icon" name="today" />
                  <span className="dispatch-command-strip__button-copy">Today</span>
                </Link>
                <Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href={nextHref}>
                  <span className="dispatch-command-strip__button-copy">Next</span>
                </Link>
              </div>
            </section>

            <section className="dispatch-command-strip__control-cluster dispatch-command-strip__control-cluster--toggle">
              <div className="dispatch-command-strip__segment" role="tablist" aria-label="Dispatch calendar view">
                <button
                  aria-selected={view === "day"}
                  className={cx(view === "day" && "dispatch-command-strip__segment-button--active")}
                  onClick={() => onViewChange("day")}
                  role="tab"
                  tabIndex={view === "day" ? 0 : -1}
                  type="button"
                >
                  Day
                </button>
                <button
                  aria-selected={view === "week"}
                  className={cx(view === "week" && "dispatch-command-strip__segment-button--active")}
                  onClick={() => onViewChange("week")}
                  role="tab"
                  tabIndex={view === "week" ? 0 : -1}
                  type="button"
                >
                  Week
                </button>
                <button
                  aria-selected={view === "month"}
                  className={cx(view === "month" && "dispatch-command-strip__segment-button--active")}
                  onClick={() => onViewChange("month")}
                  role="tab"
                  tabIndex={view === "month" ? 0 : -1}
                  type="button"
                >
                  Month
                </button>
              </div>
            </section>

            {view !== "month" ? (
              <section className="dispatch-command-strip__control-cluster dispatch-command-strip__control-cluster--toggle">
                <div className="dispatch-command-strip__segment" role="tablist" aria-label="Dispatch calendar zoom">
                  <button
                    aria-selected={zoomPreset === "overview"}
                    className={cx(zoomPreset === "overview" && "dispatch-command-strip__segment-button--active")}
                    onClick={() => onZoomPresetChange("overview")}
                    role="tab"
                    tabIndex={zoomPreset === "overview" ? 0 : -1}
                    type="button"
                  >
                    {zoomOverviewLabel}
                  </button>
                  <button
                    aria-selected={zoomPreset === "comfortable"}
                    className={cx(zoomPreset === "comfortable" && "dispatch-command-strip__segment-button--active")}
                    onClick={() => onZoomPresetChange("comfortable")}
                    role="tab"
                    tabIndex={zoomPreset === "comfortable" ? 0 : -1}
                    type="button"
                  >
                    Work
                  </button>
                  <button
                    aria-selected={zoomPreset === "detail"}
                    className={cx(zoomPreset === "detail" && "dispatch-command-strip__segment-button--active")}
                    onClick={() => onZoomPresetChange("detail")}
                    role="tab"
                    tabIndex={zoomPreset === "detail" ? 0 : -1}
                    type="button"
                  >
                    Detail
                  </button>
                </div>
              </section>
            ) : null}

            <section className="dispatch-command-strip__control-cluster dispatch-command-strip__control-cluster--scope">
              <div className="dispatch-command-strip__scope-inline">
                <label className="dispatch-command-strip__scope">
                  <span className="dispatch-command-strip__label">Crew scope</span>
                  <Select
                    onChange={(event) => onScopeChange(event.currentTarget.value as DispatchCalendarScope)}
                    value={scope}
                  >
                    <option value="all_workers">All lanes</option>
                    <option value="single_tech">Single lane</option>
                    <option value="subset">Lane subset</option>
                  </Select>
                </label>

                {showSingleTechPicker ? (
                  <label className="dispatch-command-strip__tech-picker">
                    <span className="dispatch-command-strip__label">Technician</span>
                    <Select
                      onChange={(event) => onSelectSingleTechnician(event.currentTarget.value)}
                      value={selectedSingleTechnicianId}
                    >
                      {technicians.map((technician) => (
                        <option key={technician.userId} value={technician.userId}>
                          {technician.displayName}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}

                {showAllCrewShortcut ? (
                  <Button onClick={() => onScopeChange("all_workers")} size="sm" tone="tertiary" type="button">
                    Reset all lanes
                  </Button>
                ) : null}
              </div>
            </section>
          </div>

          <div className="dispatch-command-strip__zone dispatch-command-strip__zone--actions">
            {showPrimarySignal ? (
              <div className="dispatch-command-strip__signal-strip">
                {primarySignal?.onClick ? (
                  <button
                    className={cx(
                      "dispatch-command-strip__signal",
                      "dispatch-command-strip__signal--button",
                      primarySignal.tone === "danger"
                        ? "dispatch-command-strip__signal--danger"
                        : primarySignal.tone === "warning"
                          ? "dispatch-command-strip__signal--warning"
                          : "dispatch-command-strip__signal--neutral",
                      primarySignal.id === "conflicts" && conflictsOpen && "dispatch-command-strip__signal--active"
                    )}
                    onClick={primarySignal.onClick}
                    type="button"
                  >
                    <AppIcon
                      className="dispatch-command-strip__signal-icon"
                      name={getPrimarySignalIconName(primarySignal)}
                    />
                    <strong>{primarySignal.label}</strong>
                    <span>{primarySignal.secondary}</span>
                  </button>
                ) : null}

                {primarySignal?.href ? (
                  <Link
                    className={cx(
                      "dispatch-command-strip__signal",
                      primarySignal.tone === "danger"
                        ? "dispatch-command-strip__signal--danger"
                        : primarySignal.tone === "warning"
                          ? "dispatch-command-strip__signal--warning"
                          : "dispatch-command-strip__signal--neutral"
                    )}
                    href={primarySignal.href}
                  >
                    <AppIcon
                      className="dispatch-command-strip__signal-icon"
                      name={getPrimarySignalIconName(primarySignal)}
                    />
                    <strong>{primarySignal.label}</strong>
                    <span>{primarySignal.secondary}</span>
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="dispatch-command-strip__actions-main">
              <Link
                className={buttonClassName({ size: "sm", tone: focusMode ? "secondary" : "tertiary" })}
                href={focusToggleHref}
              >
                <span className="dispatch-command-strip__button-copy">
                  {focusMode ? "Full view" : "Focus mode"}
                </span>
              </Link>
              {activeDominantInterventionAction?.kind === "batch" ? (
                <Button
                  loading={activeDominantInterventionAction.pending}
                  onClick={activeDominantInterventionAction.onClick}
                  size="sm"
                  tone="primary"
                  type="button"
                >
                  <span className="dispatch-command-strip__button-copy">
                    {activeDominantInterventionAction.label}
                  </span>
                </Button>
              ) : activeDominantInterventionAction?.kind === "link" ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "primary" })}
                  href={activeDominantInterventionAction.href ?? "#"}
                >
                  <span className="dispatch-command-strip__button-copy">
                    {activeDominantInterventionAction.label}
                  </span>
                </Link>
              ) : null}
              {showQueueToggle ? (
                <Button
                  onClick={onToggleQueue}
                  size="sm"
                  tone={queueOpen ? "secondary" : "tertiary"}
                  type="button"
                >
                  <AppIcon className="dispatch-command-strip__button-icon" name="jobs" />
                  <span className="dispatch-command-strip__button-copy">{queueToggleLabel}</span>
                </Button>
              ) : null}
              <Button
                onClick={onToggleOperationsRail}
                size="sm"
                tone={operationsRailOpen ? "secondary" : "tertiary"}
                type="button"
              >
                <AppIcon className="dispatch-command-strip__button-icon" name="alert" />
                <span className="dispatch-command-strip__button-copy">{boardOnlyLabel}</span>
              </Button>
              <Button
                onClick={onToggleUtilities}
                size="sm"
                tone={utilitiesOpen ? "secondary" : "tertiary"}
                type="button"
              >
                <AppIcon className="dispatch-command-strip__button-icon" name="settings" />
                <span className="dispatch-command-strip__button-copy">{utilitiesToggleLabel}</span>
              </Button>
              {utilitiesOpen ? (
                <Button loading={working} onClick={onRefresh} size="sm" tone="secondary" type="button">
                  <AppIcon className="dispatch-command-strip__button-icon" name="today" />
                  <span className="dispatch-command-strip__button-copy">Sync</span>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
