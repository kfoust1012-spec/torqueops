"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Badge, buttonClassName } from "../../../../../components/ui";
import {
  buildVisitReturnThreadHref,
  normalizeVisitReturnTo
} from "../../../../../lib/visits/workspace";

type VisitWorkspaceShellProps = {
  customerHref: string;
  customerName: string;
  dispatchHref: string;
  jobId: string;
  signals: Array<{
    label: string;
    tone: "brand" | "danger" | "neutral" | "success" | "warning";
    value: string;
  }>;
  statusLabel: string;
  statusTone: "brand" | "danger" | "neutral" | "success" | "warning";
  vehicleLabel: string;
  visitsHref: string;
};

const tabDefinitions = [
  { href: "", label: "Timeline" },
  { href: "/estimate", label: "Estimate" },
  { href: "/inspection", label: "Inspection" },
  { href: "/photos", label: "Photos" },
  { href: "/parts", label: "Parts" },
  { href: "/inventory", label: "Inventory" },
  { href: "/invoice", label: "Invoice" }
] as const;

function buildVisitWorkspaceHref(
  visitBaseHref: string,
  tabHref: string,
  options: {
    returnLabel: string;
    returnScope: string;
    returnTo: string;
  }
) {
  const href = `${visitBaseHref}${tabHref}`;
  const params = new URLSearchParams();

  if (options.returnScope) {
    params.set("returnScope", options.returnScope);
  }

  if (options.returnTo) {
    params.set("returnTo", options.returnTo);
  }

  if (options.returnLabel) {
    params.set("returnLabel", options.returnLabel);
  }

  if (!params.size) {
    return href;
  }

  return `${href}?${params.toString()}`;
}

function isTabActive(pathname: string, href: string) {
  if (!href) {
    return !tabDefinitions.some((tab) => tab.href && pathname.includes(tab.href));
  }

  return pathname.includes(href);
}

export function VisitWorkspaceShell({
  customerHref,
  customerName,
  dispatchHref,
  jobId,
  signals,
  statusLabel,
  statusTone,
  vehicleLabel,
  visitsHref
}: VisitWorkspaceShellProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const returnScope = searchParams?.get("returnScope")?.trim() ?? "";
  const returnTo = normalizeVisitReturnTo(searchParams?.get("returnTo")) ?? "";
  const returnLabel = searchParams?.get("returnLabel")?.trim() ?? "";
  const visitBaseHref = `/dashboard/visits/${jobId}`;
  const threadHref = returnTo
    ? returnTo
    : returnScope || returnLabel
      ? buildVisitReturnThreadHref(jobId, returnScope, {
          returnLabel: returnLabel || null
        })
      : visitsHref;
  const threadLabel = returnLabel || (returnTo ? "Back to workspace" : returnScope ? "Back to queue" : "Visit thread");

  return (
    <section className="workspace-section">
      <div className="page-header" style={{ gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <p className="eyebrow">Visit thread</p>
          <strong className="ui-admin-context-bar__title">{customerName}</strong>
          <p className="copy" style={{ marginBottom: 0 }}>
            {vehicleLabel}
          </p>
        </div>

        <div className="header-actions">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={threadHref}>
            {threadLabel}
          </Link>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={dispatchHref}>
            Dispatch
          </Link>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={customerHref}>
            Customer
          </Link>
        </div>
      </div>

      <div className="header-actions" style={{ marginBottom: "0.5rem" }}>
        {tabDefinitions.map((tab) => {
          const href = buildVisitWorkspaceHref(visitBaseHref, tab.href, {
            returnLabel,
            returnScope,
            returnTo
          });
          const active = isTabActive(pathname, tab.href);

          return (
            <Link
              className={buttonClassName({ size: "sm", tone: active ? "primary" : "ghost" })}
              href={href}
              key={tab.label}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="header-actions" style={{ marginBottom: "0.5rem" }}>
        {signals.map((signal) => (
          <Badge key={signal.label} tone={signal.tone}>
            {signal.label}: {signal.value}
          </Badge>
        ))}
      </div>
    </section>
  );
}
