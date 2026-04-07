"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dashboardNavSections } from "./dashboard-nav-config";
import { getOfficeHomeWorkspace } from "../lib/office-workspace-focus";
import { isDashboardNavPathActive } from "./dashboard-shell-nav";
import { AppIcon, type AppIconName, cx } from "./ui";

type MobileNavItem = {
  emphasis?: "primary";
  href: string;
  icon: AppIconName;
  label: string;
  matchPrefixes?: readonly string[];
};

type DashboardMobileNavProps = {
  operatorRole?: string;
};

export function DashboardMobileNav({ operatorRole }: DashboardMobileNavProps) {
  const pathname = usePathname();
  const homeWorkspace = getOfficeHomeWorkspace(operatorRole);
  const navItemsByHref = new Map(
    dashboardNavSections.flatMap((section) =>
      section.items.map((item) => [
        item.href,
        {
          href: item.href,
          icon: item.icon,
          label: item.label,
          ...(item.emphasis ? { emphasis: item.emphasis } : {}),
          ...(item.matchPrefixes ? { matchPrefixes: item.matchPrefixes } : {})
        }
      ])
    )
  );

  const homeItem =
    homeWorkspace.href === "/dashboard"
      ? ({ href: "/dashboard", icon: "dashboard" as AppIconName, label: "Today" } satisfies MobileNavItem)
      : navItemsByHref.get(homeWorkspace.href);
  const orderedItems = [
    homeItem,
    navItemsByHref.get("/dashboard/dispatch"),
    navItemsByHref.get("/dashboard/visits"),
    navItemsByHref.get("/dashboard/customers"),
    navItemsByHref.get("/dashboard/fleet")
  ].filter((item): item is MobileNavItem => Boolean(item));
  const mobileNavItems = orderedItems.filter(
    (item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index
  );

  return (
    <nav aria-label="Core mobile navigation" className="ui-admin-bottom-nav">
      {mobileNavItems.map((item) => {
        const active =
          isDashboardNavPathActive(pathname, item.href) ||
          item.matchPrefixes?.some((prefix) => isDashboardNavPathActive(pathname, prefix));

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cx(
              "ui-admin-bottom-nav__item",
              item.emphasis === "primary" && "ui-admin-bottom-nav__item--primary",
              active && "ui-admin-bottom-nav__item--active"
            )}
            href={item.href}
            key={item.href}
          >
            <span className="ui-admin-bottom-nav__icon">
              <AppIcon name={item.icon} />
            </span>
            <span className="ui-admin-bottom-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
