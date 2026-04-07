"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge, buttonClassName } from "../../../../../components/ui";

type CustomerRecordShellProps = {
  customerName: string;
  historyHref: string;
  promiseRiskHref: string;
  statusLabel: string;
  workspaceHref: string;
};

export function CustomerRecordShell({
  customerName,
  historyHref,
  promiseRiskHref,
  statusLabel,
  workspaceHref
}: CustomerRecordShellProps) {
  const pathname = usePathname() ?? "";
  const vehicleHref = pathname.includes("/vehicles/") ? pathname : workspaceHref;
  const tabs = [
    { active: pathname.includes("/vehicles/"), href: vehicleHref, label: "Vehicle profile" },
    { active: false, href: workspaceHref, label: "Customer workspace" },
    { active: false, href: historyHref, label: "History" }
  ];

  return (
    <section className="workspace-section">
      <div className="page-header" style={{ gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <p className="eyebrow">Customer record</p>
          <strong className="ui-admin-context-bar__title">{customerName}</strong>
          <p className="copy" style={{ marginBottom: 0 }}>
            Keep relationship context close while reviewing standalone customer vehicle and service records.
          </p>
        </div>

        <div className="header-actions">
          <Badge tone="brand">{statusLabel}</Badge>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href="/dashboard/customers">
            Back to customers
          </Link>
          <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={promiseRiskHref}>
            Promise risk
          </Link>
        </div>
      </div>

      <div className="header-actions" style={{ marginBottom: "0.5rem" }}>
        {tabs.map((tab) => (
          <Link
            className={buttonClassName({ size: "sm", tone: tab.active ? "primary" : "ghost" })}
            href={tab.href}
            key={tab.label}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </section>
  );
}