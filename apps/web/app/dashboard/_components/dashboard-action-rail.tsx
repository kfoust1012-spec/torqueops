"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  AppIcon,
  Badge,
  Form,
  SubmitButton,
  buttonClassName,
  cx,
  type ButtonTone,
  type AppIconName,
  type BadgeTone
} from "../../../components/ui";

export type DashboardActionItem = {
  actionHref: string;
  actionLabel: string;
  badgeLabel: string;
  badgeTone: BadgeTone;
  detail: string;
  id: string;
  meta?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  submitAction?: (formData: FormData) => Promise<void>;
  submitHiddenInputs?: Array<{
    name: string;
    value: string;
  }>;
  submitLabel?: string;
  submitPendingLabel?: string;
  submitTone?: ButtonTone;
  title: string;
};

export type DashboardActionSection = {
  emptyCopy: string;
  icon: AppIconName;
  items: DashboardActionItem[];
  key: string;
  title: string;
};

type DashboardActionRailProps = {
  sections: DashboardActionSection[];
};

export function DashboardActionRail({ sections }: DashboardActionRailProps) {
  const drawerId = "dashboard-action-drawer";
  const drawerTitleId = "dashboard-action-drawer-title";
  const drawerPanelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const flattenedItems = useMemo(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({
          ...item,
          icon: section.icon,
          sectionTitle: section.title
        }))
      ),
    [sections]
  );
  const sectionSummary = useMemo(
    () =>
      sections.map((section) => ({
        count: section.items.length,
        icon: section.icon,
        key: section.key,
        title: section.title
      })),
    [sections]
  );
  const defaultSectionKey = useMemo(
    () => sectionSummary.find((section) => section.count)?.key ?? sectionSummary[0]?.key ?? null,
    [sectionSummary]
  );
  const hasMultipleSections = sectionSummary.length > 1;
  const [focusedSectionKey, setFocusedSectionKey] = useState<string | null>(defaultSectionKey);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => flattenedItems.find((item) => item.id === selectedItemId) ?? null,
    [flattenedItems, selectedItemId]
  );
  const visibleSections = useMemo(
    () =>
      hasMultipleSections && focusedSectionKey
        ? sections.filter((section) => section.key === focusedSectionKey)
        : sections,
    [focusedSectionKey, hasMultipleSections, sections]
  );

  useEffect(() => {
    if (!focusedSectionKey || !sections.some((section) => section.key === focusedSectionKey)) {
      setFocusedSectionKey(defaultSectionKey);
    }
  }, [defaultSectionKey, focusedSectionKey, sections]);

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
      {hasMultipleSections ? (
        <div className="dashboard-cockpit__rail-summary" role="tablist" aria-label="Action categories">
          {sectionSummary.map((section) => (
            <button
              aria-selected={focusedSectionKey === section.key}
              className={cx(
                "dashboard-cockpit__rail-summary-item",
                focusedSectionKey === section.key && "dashboard-cockpit__rail-summary-item--selected"
              )}
              key={section.key}
              onClick={() => setFocusedSectionKey(section.key)}
              role="tab"
              type="button"
            >
              <div className="dashboard-cockpit__rail-summary-top">
                <AppIcon className="dashboard-cockpit__eyebrow-icon" name={section.icon} />
                <span>{section.title}</span>
              </div>
              <strong>{section.count}</strong>
            </button>
          ))}
        </div>
      ) : null}

      <div className="dashboard-cockpit__rail-sections">
        {visibleSections.map((section) => {
          const railListClassName = cx(
            "dashboard-cockpit__rail-list",
            hasMultipleSections && "dashboard-cockpit__rail-list--tabbed",
            !hasMultipleSections && section.items.length === 1 && "dashboard-cockpit__rail-list--single"
          );

          return (
            <section
              className={`dashboard-cockpit__rail-section dashboard-cockpit__rail-section--${section.key}${
                hasMultipleSections ? "" : " dashboard-cockpit__rail-section--compact"
              }`}
              key={section.key}
            >
              {!hasMultipleSections ? (
                <div className="dashboard-cockpit__panel-header">
                  <div>
                    <p className="dashboard-cockpit__eyebrow">
                      <AppIcon className="dashboard-cockpit__eyebrow-icon" name={section.icon} />
                      <span>{section.title}</span>
                    </p>
                    <h3 className="dashboard-cockpit__panel-title">
                      {section.items.length ? `${section.title} requiring follow-through` : section.title}
                    </h3>
                  </div>
                  <Badge tone={section.items.length ? "brand" : "neutral"}>{section.items.length}</Badge>
                </div>
              ) : null}
              <div className={railListClassName}>
                {section.items.length ? (
                  section.items.map((item) => (
                    <article
                      className={cx(
                        "dashboard-cockpit__rail-item",
                        selectedItemId === item.id && "dashboard-cockpit__rail-item--selected"
                      )}
                      key={item.id}
                    >
                      <div className="dashboard-cockpit__rail-item-top">
                        <Badge tone={item.badgeTone}>{item.badgeLabel}</Badge>
                      </div>
                      <div className="dashboard-cockpit__rail-item-body">
                        <p className="dashboard-cockpit__rail-item-title">{item.title}</p>
                        <p className="dashboard-cockpit__rail-item-copy">{item.detail}</p>
                        {item.meta ? <p className="dashboard-cockpit__rail-item-meta">{item.meta}</p> : null}
                      </div>
                      <div className="dashboard-cockpit__drawer-actions">
                        {item.submitAction && item.submitLabel ? (
                          <Form action={item.submitAction}>
                            {item.submitHiddenInputs?.map((input) => (
                              <input key={`${item.id}-${input.name}`} name={input.name} type="hidden" value={input.value} />
                            ))}
                            <SubmitButton
                              pendingLabel={item.submitPendingLabel}
                              size="sm"
                              tone={item.submitTone ?? "primary"}
                            >
                              {item.submitLabel}
                            </SubmitButton>
                          </Form>
                        ) : null}
                        <Link className={buttonClassName({ size: "sm" })} href={item.actionHref}>
                          {item.actionLabel}
                        </Link>
                        {item.secondaryHref && item.secondaryLabel ? (
                          <Link
                            className={buttonClassName({ size: "sm", tone: "secondary" })}
                            href={item.secondaryHref}
                          >
                            {item.secondaryLabel}
                          </Link>
                        ) : null}
                        <button
                          aria-controls={drawerId}
                          aria-expanded={selectedItemId === item.id}
                          aria-haspopup="dialog"
                          className={buttonClassName({ size: "sm", tone: "tertiary" })}
                          onClick={() =>
                            setSelectedItemId((currentValue) => (currentValue === item.id ? null : item.id))
                          }
                          type="button"
                        >
                          Inspect
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="dashboard-cockpit__empty">{section.emptyCopy}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selectedItem ? (
        <div className="dashboard-cockpit__drawer" role="presentation">
          <button
            aria-label="Close dashboard action drawer"
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
                  <AppIcon
                    className="dashboard-cockpit__eyebrow-icon"
                    name={selectedItem.icon}
                  />
                  <span>{selectedItem.sectionTitle}</span>
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
              <Badge tone={selectedItem.badgeTone}>{selectedItem.badgeLabel}</Badge>
              {selectedItem.meta ? (
                <span className="dashboard-cockpit__drawer-meta">{selectedItem.meta}</span>
              ) : null}
            </div>

            <p className="dashboard-cockpit__drawer-copy">{selectedItem.detail}</p>

            <div className="dashboard-cockpit__drawer-actions">
              <Link className={buttonClassName({ size: "sm" })} href={selectedItem.actionHref}>
                {selectedItem.actionLabel}
              </Link>
              {selectedItem.secondaryHref && selectedItem.secondaryLabel ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "secondary" })}
                  href={selectedItem.secondaryHref}
                >
                  {selectedItem.secondaryLabel}
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
