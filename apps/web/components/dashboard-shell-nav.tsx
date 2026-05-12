"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  dashboardPrimaryNavSections,
  dashboardUtilityNavItems,
  type DashboardNavItem
} from "./dashboard-nav-config";
import { normalizeOfficeOperatorRole } from "../lib/office-workspace-focus";
import { AppIcon, cx } from "./ui";

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

function DashboardShellNavItem({
  item,
  pathname,
  utility
}: {
  item: DashboardNavItem;
  pathname: string;
  utility?: boolean;
}) {
  const active = isDashboardNavItemActive(pathname, item);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cx(
        "ui-admin-nav__item",
        utility && "ui-admin-nav__item--utility",
        item.emphasis === "primary" && "ui-admin-nav__item--primary",
        active && "ui-admin-nav__item--active"
      )}
      data-active={active ? "true" : undefined}
      href={item.href}
      title={item.label}
    >
      <span aria-hidden className="ui-admin-nav__icon">
        <AppIcon name={item.icon} />
      </span>
      <span className="ui-admin-nav__content">
        <span className="ui-admin-nav__title">{item.label}</span>
        <span className="ui-admin-nav__compact-label">{item.compactLabel}</span>
        {active ? <span className="ui-admin-nav__hint">{item.hint}</span> : null}
      </span>
    </Link>
  );
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
            {section.items.map((item) => (
              <DashboardShellNavItem item={item} key={item.href} pathname={pathname} />
            ))}
          </div>
        </div>
      ))}

      <div className="ui-admin-nav__section ui-admin-nav__section--utility">
        <p className="ui-admin-nav__section-label">Utilities</p>
        <div className="ui-admin-nav__section-items">
          {dashboardUtilityNavItems.map((item) => (
            <DashboardShellNavItem item={item} key={item.href} pathname={pathname} utility />
          ))}
        </div>
      </div>
    </nav>
  );
}
