"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  AppIcon,
  Badge,
  StatusBadge,
  buttonClassName,
  cx,
  type BadgeTone
} from "../../../components/ui";

export type DashboardQueueItem = {
  customerName: string;
  dispatchHref: string;
  id: string;
  nextActionHref?: string;
  nextActionLabel: string;
  routeLabel: string;
  scheduledLabel: string;
  status: string;
  technicianName: string;
  title: string;
  valueLabel: string;
  vehicleLabel: string;
  visitHref: string;
  workflowLabel: string;
};

type DashboardQueuePanelProps = {
  items: DashboardQueueItem[];
};

export function DashboardQueuePanel({ items }: DashboardQueuePanelProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const drawerId = "dashboard-queue-drawer";
  const drawerTitleId = "dashboard-queue-drawer-title";
  const drawerPanelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    lastFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [selectedItem]);

  const handleDrawerKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSelectedItemId(null);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const drawer = drawerPanelRef.current;

    if (!drawer) {
      return;
    }

    const focusable = drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusable.length) {
      return;
    }

    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);

    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div aria-hidden="true" className="dashboard-cockpit__queue-head">
        <span>Visit</span>
        <span>Time</span>
        <span>Technician</span>
        <span>Status</span>
        <span>Value</span>
      </div>

      <div className="dashboard-cockpit__queue-list">
        {items.map((item) => {
          const accessibilityLabel = [
            item.title,
            `${item.customerName} · ${item.vehicleLabel}`,
            item.scheduledLabel,
            item.technicianName,
            item.workflowLabel,
            item.valueLabel
          ]
            .filter(Boolean)
            .filter((value, index, values) => index === 0 || value !== values[index - 1])
            .join(". ");

          return (
          <button
            aria-label={accessibilityLabel}
            className={cx(
              "dashboard-cockpit__queue-row",
              selectedItemId === item.id && "dashboard-cockpit__queue-row--selected"
            )}
            key={item.id}
            aria-controls={drawerId}
            aria-expanded={selectedItemId === item.id}
            aria-haspopup="dialog"
            onClick={() =>
              setSelectedItemId((currentValue) => (currentValue === item.id ? null : item.id))
            }
            type="button"
          >
            <div className="dashboard-cockpit__queue-primary">
              <div className="dashboard-cockpit__queue-primary-top">
                <p className="dashboard-cockpit__queue-title">{item.title}</p>
              </div>
              <p className="dashboard-cockpit__queue-copy">
                {item.customerName} · {item.vehicleLabel}
              </p>
              <p className="dashboard-cockpit__queue-subcopy">{item.routeLabel}</p>
              <div className="dashboard-cockpit__queue-mobile">
                <div className="dashboard-cockpit__queue-mobile-meta">
                  <span>{item.scheduledLabel}</span>
                  <span>{item.technicianName}</span>
                </div>
                <div className="dashboard-cockpit__queue-mobile-signals">
                  <StatusBadge status={item.status} />
                  <strong className="dashboard-cockpit__queue-mobile-value">{item.valueLabel}</strong>
                </div>
              </div>
            </div>
            <span aria-hidden="true" className="dashboard-cockpit__queue-cell dashboard-cockpit__queue-cell--time">
              {item.scheduledLabel}
            </span>
            <span aria-hidden="true" className="dashboard-cockpit__queue-cell dashboard-cockpit__queue-cell--tech">
              {item.technicianName}
            </span>
            <span aria-hidden="true" className="dashboard-cockpit__queue-cell dashboard-cockpit__queue-cell--status">
              <StatusBadge status={item.status} />
            </span>
            <strong aria-hidden="true" className="dashboard-cockpit__queue-value">
              {item.valueLabel}
            </strong>
          </button>
          );
        })}
      </div>

      {selectedItem ? (
        <div className="dashboard-cockpit__drawer" role="presentation">
          <button
            aria-label="Close dashboard queue drawer"
            className="dashboard-cockpit__drawer-backdrop"
            onClick={() => setSelectedItemId(null)}
            type="button"
          />
          <aside
            aria-labelledby={drawerTitleId}
            aria-modal="true"
            className="dashboard-cockpit__drawer-panel"
            id={drawerId}
            onKeyDown={handleDrawerKeyDown}
            ref={drawerPanelRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="dashboard-cockpit__drawer-header">
              <div>
                <p className="dashboard-cockpit__eyebrow">
                  <AppIcon className="dashboard-cockpit__eyebrow-icon" name="jobs" />
                  <span>Visit inspector</span>
                </p>
                <h3 className="dashboard-cockpit__drawer-title" id={drawerTitleId}>
                  {selectedItem.title}
                </h3>
              </div>
              <button
                className={buttonClassName({ size: "sm", tone: "tertiary" })}
                onClick={() => setSelectedItemId(null)}
                ref={closeButtonRef}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="dashboard-cockpit__drawer-signals">
              <StatusBadge status={selectedItem.status} />
              <Badge tone="neutral">{selectedItem.valueLabel}</Badge>
              <Badge tone={resolveQueueRouteTone(selectedItem.routeLabel)}>{selectedItem.workflowLabel}</Badge>
            </div>

            <dl className="dashboard-cockpit__drawer-facts">
              <div>
                <dt>Customer</dt>
                <dd>{selectedItem.customerName}</dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>{selectedItem.vehicleLabel}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{selectedItem.scheduledLabel}</dd>
              </div>
              <div>
                <dt>Technician</dt>
                <dd>{selectedItem.technicianName}</dd>
              </div>
              <div>
                <dt>Route</dt>
                <dd>{selectedItem.routeLabel}</dd>
              </div>
              <div>
                <dt>Next move</dt>
                <dd>{selectedItem.nextActionLabel}</dd>
              </div>
            </dl>

            <div className="dashboard-cockpit__drawer-actions">
              <Link className={buttonClassName({ size: "sm" })} href={selectedItem.visitHref}>
                Open visit
              </Link>
              <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={selectedItem.dispatchHref}>
                Open dispatch
              </Link>
              {selectedItem.nextActionHref ? (
                <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={selectedItem.nextActionHref}>
                  {selectedItem.nextActionLabel}
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function resolveQueueRouteTone(routeLabel: string): BadgeTone {
  const value = routeLabel.toLowerCase();

  if (value.includes("delayed") || value.includes("behind")) {
    return "danger";
  }

  if (value.includes("unassigned") || value.includes("dispatch")) {
    return "warning";
  }

  if (value.includes("onsite") || value.includes("on site") || value.includes("active")) {
    return "success";
  }

  if (value.includes("travel") || value.includes("arrival")) {
    return "info";
  }

  return "neutral";
}
