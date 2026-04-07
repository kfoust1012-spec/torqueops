"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type InvoiceDetailsDrawerProps = {
  children: ReactNode;
  closeHref: string;
  descriptionId?: string;
  titleId: string;
};

export function InvoiceDetailsDrawer({
  children,
  closeHref,
  descriptionId,
  titleId
}: InvoiceDetailsDrawerProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    lastFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    const animationFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const preferredTarget =
        panel.querySelector<HTMLElement>("[data-drawer-close]") ??
        panel.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );

      preferredTarget?.focus() ?? panel.focus();
    });

    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, []);

  function handleClose() {
    router.replace(closeHref, { scroll: false });
  }

  function handleClickCapture(event: MouseEvent<HTMLElement>) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (!target.closest("[data-drawer-close]")) {
      return;
    }

    event.preventDefault();
    handleClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const focusable = panel.querySelectorAll<HTMLElement>(
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
  }

  return (
    <div className="invoice-workspace-drawer" role="presentation">
      <button
        aria-label="Close invoice details drawer"
        className="invoice-workspace-drawer__scrim"
        onClick={handleClose}
        type="button"
      />
      <aside
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="invoice-workspace-drawer__panel"
        onClickCapture={handleClickCapture}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </aside>
    </div>
  );
}
