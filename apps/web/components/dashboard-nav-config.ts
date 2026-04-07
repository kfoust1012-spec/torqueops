import type { AppIconName } from "./ui/icons";

export type DashboardNavItem = {
  commandKeywords?: readonly string[];
  compactLabel: string;
  emphasis?: "primary";
  href: string;
  hint: string;
  icon: AppIconName;
  label: string;
  matchPrefixes?: readonly string[];
};

export type DashboardNavSection = {
  items: readonly DashboardNavItem[];
  label: string;
};

const commandCenterItems: readonly DashboardNavItem[] = [
  {
    commandKeywords: ["brief", "today", "owner", "manager", "exceptions", "home"],
    compactLabel: "NOW",
    href: "/dashboard",
    hint: "Owner exception brief for route, unblock, and closeout risk",
    icon: "dashboard",
    label: "Today brief"
  },
  {
    commandKeywords: ["board", "schedule", "routes", "lanes", "dispatch"],
    compactLabel: "DSP",
    emphasis: "primary",
    href: "/dashboard/dispatch",
    hint: "Routes, crew, and live recovery",
    icon: "dispatch",
    label: "Dispatch"
  },
  {
    commandKeywords: ["jobs", "queue", "work orders", "visits", "estimates", "approvals", "release"],
    compactLabel: "VIS",
    emphasis: "primary",
    href: "/dashboard/visits",
    hint: "Service threads, approvals, and release runway",
    icon: "jobs",
    label: "Visits",
    matchPrefixes: ["/dashboard/estimates"]
  },
  {
    commandKeywords: ["crm", "relationships", "owners", "customers"],
    compactLabel: "CUS",
    href: "/dashboard/customers",
    hint: "Relationship risk and service thread",
    icon: "customers",
    label: "Customers",
    matchPrefixes: ["/dashboard/customer-vehicles"]
  }
];

const operationsDeskItems: readonly DashboardNavItem[] = [
  {
    commandKeywords: ["map", "capacity", "team", "units", "fleet"],
    compactLabel: "FLT",
    href: "/dashboard/fleet",
    hint: "Capacity, route health, and readiness",
    icon: "fleet",
    label: "Fleet",
    matchPrefixes: ["/dashboard/fleet-vehicles", "/dashboard/team"]
  },
  {
    commandKeywords: ["parts", "inventory", "orders", "stock", "supply"],
    compactLabel: "SUP",
    href: "/dashboard/supply",
    hint: "Parts blockers, carts, and stock",
    icon: "parts",
    label: "Supply",
    matchPrefixes: ["/dashboard/parts", "/dashboard/inventory"]
  },
  {
    commandKeywords: ["collections", "payments", "billing", "finance"],
    compactLabel: "FIN",
    href: "/dashboard/finance",
    hint: "Closeout, reminders, and collections",
    icon: "invoices",
    label: "Finance",
    matchPrefixes: ["/dashboard/invoices"]
  }
];

const commandCenterSection: DashboardNavSection = {
  items: commandCenterItems,
  label: "Command center"
};

const operationsDeskSection: DashboardNavSection = {
  items: operationsDeskItems,
  label: "Operations desks"
};

export const dashboardPrimaryNavSections = [
  commandCenterSection,
  operationsDeskSection
] as const;

export const dashboardUtilityNavItems: readonly DashboardNavItem[] = [
  {
    commandKeywords: ["analytics", "kpis", "reporting", "reports"],
    compactLabel: "RPT",
    href: "/dashboard/reports",
    hint: "Operating signal, revenue drag, and throughput",
    icon: "reports",
    label: "Reports"
  },
  {
    commandKeywords: ["setup", "integrations", "settings"],
    compactLabel: "SET",
    href: "/dashboard/settings",
    hint: "Operating system setup and integrations",
    icon: "settings",
    label: "Settings"
  }
] as const;

export const dashboardNavSections = [
  ...dashboardPrimaryNavSections,
  {
    label: "Utilities",
    items: dashboardUtilityNavItems
  }
] as const;
