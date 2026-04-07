"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  dashboardPrimaryNavSections,
  dashboardUtilityNavItems,
  type DashboardNavItem
} from "./dashboard-nav-config";
import { normalizeOfficeOperatorRole } from "../lib/office-workspace-focus";
import { AppIcon, buttonClassName, cx } from "./ui";

export function isDashboardNavPathActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isDashboardNavItemActive(pathname: string, item: DashboardNavItem) {
  if (isDashboardNavPathActive(pathname, item.href)) {
    return true;
  }

  return item.matchPrefixes?.some((prefix) => isDashboardNavPathActive(pathname, prefix)) ?? false;
}

type DashboardShellNavProps = {
  operatorRole?: string;
};

export function DashboardShellNav({ operatorRole }: DashboardShellNavProps) {
  const pathname = usePathname();
  const resolvedRole = normalizeOfficeOperatorRole(operatorRole);
  const primarySections = dashboardPrimaryNavSections.map((section) => ({
    ...section,
    items:
      resolvedRole === "owner"
        ? section.items
        : section.items.filter((item) => item.href !== "/dashboard")
  }));

  return (
    <nav aria-label="Primary navigation" className="ui-admin-nav">
      {primarySections.map((section) => (
        <div className="ui-admin-nav__section" key={section.label}>
          <p className="ui-admin-nav__section-label">{section.label}</p>
          <div className="ui-admin-nav__section-items">
            {section.items.map((item) => {
              const active = isDashboardNavItemActive(pathname, item);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={cx(
                    "ui-admin-nav__item",
                    item.emphasis === "primary" && "ui-admin-nav__item--primary",
                    active && "ui-admin-nav__item--active"
                  )}
                  data-active={active ? "true" : undefined}
                  href={item.href}
                  key={item.href}
                  title={item.label}
                >
                  <span aria-hidden className="ui-admin-nav__icon">
                    <AppIcon name={item.icon} />
                  </span>
                  <span className="ui-admin-nav__content">
                    <span className="ui-admin-nav__title">{item.label}</span>
                    {active ? <span className="ui-admin-nav__hint">{item.hint}</span> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="ui-admin-nav__section">
        <p className="ui-admin-nav__section-label">Utilities</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {dashboardUtilityNavItems.map((item) => {
            const active = isDashboardNavItemActive(pathname, item);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={buttonClassName({ size: "sm", tone: active ? "secondary" : "ghost" })}
                href={item.href}
                key={item.href}
                title={item.hint}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
