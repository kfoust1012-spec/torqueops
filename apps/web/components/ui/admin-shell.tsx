"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams
} from "next/navigation";

import { dashboardNavSections } from "../dashboard-nav-config";
import { buildCustomerWorkspaceHref } from "../../lib/customers/workspace";
import {
  hotThreadTargetEventName,
  isHotThreadTarget,
  pinnedHotThreadStorageKey,
  readPinnedHotThread,
  type HotThreadTarget,
  type HotThreadTargetEventDetail,
  writePinnedHotThread
} from "../../lib/hot-thread/shared";
import type { ActiveServiceThread } from "../../lib/service-thread/continuity";
import { buildVisitEstimateHref, buildVisitInvoiceHref, buildVisitThreadHref } from "../../lib/visits/workspace";
import { buttonClassName } from "./button";
import { AppIcon } from "./icons";
import { cx } from "./utils";

type AdminShellProps = {
  children: ReactNode;
  mobileNav?: ReactNode;
  operatorRole?: string;
  sidebar: ReactNode;
};

const desktopSidebarStorageKey = "mobile-mechanic:web:admin-sidebar-collapsed";
const adminSidebarId = "admin-shell-sidebar";
const adminCommandPaletteInputId = "admin-command-palette-input";

type ShellCommand = {
  hint: string;
  href: string;
  icon: Parameters<typeof AppIcon>[0]["name"];
  keywords: readonly string[];
  label: string;
  shortcut?: string;
  tier: "control" | "support" | "workspace";
};

function getShellCommandTier(href: string): ShellCommand["tier"] {
  if (
    href === "/dashboard/dispatch" ||
    href === "/dashboard/visits" ||
    href === "/dashboard/customers" ||
    href === "/dashboard/fleet"
  ) {
    return "workspace";
  }

  if (href === "/dashboard/supply" || href === "/dashboard/finance") {
    return "support";
  }

  if (href === "/dashboard/reports" || href === "/dashboard/settings") {
    return "control";
  }

  return "control";
}

type OfficeOperatorRole = "owner" | "admin" | "dispatcher" | "technician";

type ShellContext =
  | {
      actionHref?: string;
      actionLabel?: string;
      description: string;
      eyebrow?: string;
      title: string;
      tone: "detail" | "primary" | "secondary";
    }
  | null;

type ServiceThreadContext =
  | {
      description: string;
      links: Array<{
        href: string;
        label: string;
      }>;
      title: string;
    }
  | null;

type HotThreadTone = "brand" | "danger" | "neutral" | "success" | "warning";
type HotThreadActionTone = "ghost" | "primary" | "secondary" | "tertiary";
type HotThreadJumpId = "customer" | "dispatch" | "finance" | "site" | "visit";

type HotThreadPayload = {
  activeThread: ActiveServiceThread;
  actions: Array<{
    href: string;
    label: string;
    tone: HotThreadActionTone;
  }>;
  badges: Array<{
    label: string;
    tone: HotThreadTone;
  }>;
  caseItems: Array<{
    copy?: string;
    href?: string;
    label: string;
    value: string;
  }>;
  description: string;
  eyebrow: string;
  jumps: Array<{
    href: string;
    id: HotThreadJumpId;
    label: string;
  }>;
  kind: "customer" | "invoice" | "visit";
  ledger: Array<{
    copy: string;
    label: string;
    tone: HotThreadTone;
    value: string;
  }>;
  mutations: Array<{
    body:
      | {
          action:
            | "appointment_confirmation"
            | "estimate_notification"
            | "invoice_notification"
            | "payment_reminder";
        }
      | {
          action: "dispatch_update";
          updateType: "dispatched" | "en_route";
        };
    endpoint: string;
    id: string;
    label: string;
    pendingLabel: string;
    successMessage: string;
    tone: HotThreadActionTone;
  }>;
  nextMove: {
    copy: string;
    href: string;
    label: string;
    tone: HotThreadTone;
  } | null;
  sections: Array<{
    description?: string;
    id: string;
    items: Array<{
      copy?: string;
      href?: string;
      label: string;
      value: string;
    }>;
    label: string;
  }>;
  subtitle: string;
  title: string;
};

const hotThreadJumpShortcutById: Record<HotThreadJumpId, string> = {
  customer: "Alt+Shift+3",
  dispatch: "Alt+Shift+2",
  finance: "Alt+Shift+4",
  site: "Alt+Shift+5",
  visit: "Alt+Shift+1"
};

const hotThreadJumpToneById: Record<HotThreadJumpId, HotThreadActionTone> = {
  customer: "ghost",
  dispatch: "secondary",
  finance: "tertiary",
  site: "secondary",
  visit: "primary"
};

function getThreadCommandIcon(label: string, href: string): Parameters<typeof AppIcon>[0]["name"] {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("dispatch") || href.startsWith("/dashboard/dispatch")) {
    return "dispatch";
  }

  if (
    normalizedLabel.includes("billing") ||
    normalizedLabel.includes("finance") ||
    normalizedLabel.includes("invoice") ||
    href.startsWith("/dashboard/finance")
  ) {
    return "invoices";
  }

  if (
    normalizedLabel.includes("estimate") ||
    normalizedLabel.includes("runway") ||
    href.startsWith("/dashboard/estimates")
  ) {
    return "estimates";
  }

  if (
    normalizedLabel.includes("customer") ||
    normalizedLabel.includes("service site") ||
    href.startsWith("/dashboard/customers")
  ) {
    return "customers";
  }

  return "jobs";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getPathVisitJobId(pathname: string | null) {
  if (!pathname?.startsWith("/dashboard/visits/")) {
    return "";
  }

  const [, , , jobId] = pathname.split("/");
  return isUuid(jobId ?? "") ? (jobId ?? "") : "";
}

function getPathCustomerId(pathname: string | null) {
  if (!pathname?.startsWith("/dashboard/customers/")) {
    return "";
  }

  const [, , , customerId] = pathname.split("/");
  return isUuid(customerId ?? "") ? (customerId ?? "") : "";
}

function getHotThreadTarget(
  pathname: string | null,
  searchParams: ReadonlyURLSearchParams | null
): HotThreadTarget | null {
  if (!pathname) {
    return null;
  }

  const queryInvoiceId = searchParams?.get("invoiceId")?.trim() ?? "";
  const queryCustomerId = searchParams?.get("customerId")?.trim() ?? "";
  const queryJobId = searchParams?.get("jobId")?.trim() ?? "";
  const querySiteId = searchParams?.get("editAddressId")?.trim() ?? "";
  const pathVisitId = getPathVisitJobId(pathname);
  const pathCustomerId = getPathCustomerId(pathname);

  if ((pathname.startsWith("/dashboard/finance") || pathname.startsWith("/dashboard/invoices")) && isUuid(queryInvoiceId)) {
    return {
      id: queryInvoiceId,
      kind: "invoice"
    };
  }

  if (
    (pathname === "/dashboard/customers" || pathname.startsWith("/dashboard/customers/")) &&
    (isUuid(queryCustomerId) || pathCustomerId)
  ) {
    return {
      id: isUuid(queryCustomerId) ? queryCustomerId : pathCustomerId,
      kind: "customer",
      ...(isUuid(querySiteId) ? { siteId: querySiteId } : {})
    };
  }

  if (
    (pathname === "/dashboard/dispatch" ||
      pathname === "/dashboard/visits" ||
      pathname.startsWith("/dashboard/visits/") ||
      pathname.startsWith("/dashboard/estimates")) &&
    (isUuid(queryJobId) || pathVisitId)
  ) {
    return {
      id: isUuid(queryJobId) ? queryJobId : pathVisitId,
      kind: "visit"
    };
  }

  return null;
}

function getDeskFocusModeHref(
  pathname: string | null,
  searchParams: ReadonlyURLSearchParams | null
) {
  if (!pathname) {
    return null;
  }

  const focusableDeskPrefixes = [
    "/dashboard",
    "/dashboard/dispatch",
    "/dashboard/visits",
    "/dashboard/customers",
    "/dashboard/fleet",
    "/dashboard/supply",
    "/dashboard/finance",
    "/dashboard/estimates"
  ];

  if (!focusableDeskPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  const params = new URLSearchParams(searchParams?.toString() ?? "");

  if (params.get("focus") === "1") {
    params.delete("focus");
  } else {
    params.set("focus", "1");
  }

  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function areHotThreadTargetsEqual(left: HotThreadTarget | null, right: HotThreadTarget | null) {
  if (!left || !right) {
    return left === right;
  }

  return left.kind === right.kind && left.id === right.id && (left.siteId ?? "") === (right.siteId ?? "");
}

function getServiceThreadContext(
  pathname: string | null,
  searchParams: ReadonlyURLSearchParams | null
): ServiceThreadContext {
  const queryJobId = searchParams?.get("jobId")?.trim() ?? "";
  const queryCustomerId = searchParams?.get("customerId")?.trim() ?? "";
  const queueScope = searchParams?.get("scope")?.trim() ?? "";
  const returnScope = searchParams?.get("returnScope")?.trim() ?? "";
  const threadScope = returnScope || queueScope;
  const jobId = isUuid(queryJobId) ? queryJobId : getPathVisitJobId(pathname);

  if (!jobId && queryCustomerId) {
    return {
      description: "Keep relationship, vehicles, service locations, and finance follow-through anchored to the same customer thread.",
      links: [
        {
          href: buildCustomerWorkspaceHref(queryCustomerId),
          label: pathname === "/dashboard/customers" ? "Customer live" : "Open customer"
        },
        {
          href: buildCustomerWorkspaceHref(queryCustomerId, { tab: "addresses" }),
          label: pathname === "/dashboard/customers" && searchParams?.get("tab") === "addresses"
            ? "Service sites live"
            : "Open service sites"
        },
        {
          href: buildCustomerWorkspaceHref(queryCustomerId, { tab: "vehicles" }),
          label: pathname === "/dashboard/customers" && searchParams?.get("tab") === "vehicles"
            ? "Vehicles live"
            : "Open vehicles"
        },
        { href: "/dashboard/finance", label: pathname === "/dashboard/finance" ? "Finance live" : "Open finance" }
      ],
      title: pathname === "/dashboard/customers" ? "Customer hot thread" : "Customer thread active"
    };
  }

  if (!jobId) {
    return null;
  }

  const isDispatchThread = pathname?.startsWith("/dashboard/dispatch") ?? false;
  const isVisitArtifactThread = pathname?.startsWith(`/dashboard/visits/${jobId}/`) ?? false;
  const isVisitQueueThread = pathname === "/dashboard/visits";
  const isEstimateThread =
    (pathname?.startsWith("/dashboard/estimates") ?? false) ||
    (pathname?.startsWith(`/dashboard/visits/${jobId}/estimate`) ?? false);
  const isInvoiceThread = pathname?.startsWith(`/dashboard/visits/${jobId}/invoice`) ?? false;
  const isVisitThread = isVisitQueueThread || isVisitArtifactThread;
  const visitHref = threadScope ? buildVisitThreadHref(jobId, { scope: threadScope }) : buildVisitThreadHref(jobId);
  const estimateHref = buildVisitEstimateHref(jobId, {
    workspace: true,
    ...(threadScope ? { returnScope: threadScope } : {})
  });
  const invoiceHref = buildVisitInvoiceHref(jobId, threadScope ? { returnScope: threadScope } : undefined);
  const customerHref = queryCustomerId ? buildCustomerWorkspaceHref(queryCustomerId) : null;
  const serviceSitesHref = queryCustomerId
    ? buildCustomerWorkspaceHref(queryCustomerId, { tab: "addresses" })
    : null;

  return {
    description: "Keep dispatch, visit, release runway, customer, and billing moves anchored to the same active service thread.",
    links: [
      { href: visitHref, label: isVisitThread ? "Visit thread" : "Open visit" },
      { href: `/dashboard/dispatch?jobId=${jobId}`, label: isDispatchThread ? "Dispatch live" : "Open dispatch" },
      {
        href: estimateHref,
        label: isEstimateThread ? "Runway live" : "Open runway"
      },
      ...(customerHref
        ? [{ href: customerHref, label: pathname === "/dashboard/customers" ? "Customer live" : "Open customer" }]
        : []),
      ...(serviceSitesHref
        ? [{ href: serviceSitesHref, label: "Service sites" }]
        : []),
      {
        href: invoiceHref,
        label: isInvoiceThread ? "Billing live" : "Open billing"
      }
    ],
    title: isDispatchThread
      ? "Dispatch thread active"
      : isInvoiceThread
        ? "Billing thread active"
        : isEstimateThread
        ? "Release runway active"
        : isVisitThread
          ? "Visit thread active"
          : "Service thread active"
  };
}

function getShellContext(pathname: string | null): ShellContext {
  if (!pathname) {
    return null;
  }

  if (pathname === "/dashboard") {
    return {
      description: "Owner exception brief for route, unblock, and closeout risk.",
      title: "Today brief",
      tone: "primary"
    };
  }

  if (pathname.startsWith("/dashboard/dispatch")) {
    return {
      description: "Live routing, recovery, and lane control.",
      title: "Dispatch",
      tone: "primary"
    };
  }

  if (pathname === "/dashboard/visits") {
    return {
      description: "Office queue for release runway, assignment, and follow-through.",
      title: "Visits",
      tone: "primary"
    };
  }

  if (pathname === "/dashboard/customers" || pathname === "/dashboard/customer-vehicles") {
    return {
      description: "Relationship context, vehicle history, and customer follow-through.",
      title: "Customers",
      tone: "primary"
    };
  }

  if (pathname === "/dashboard/fleet" || pathname === "/dashboard/fleet-vehicles" || pathname === "/dashboard/team") {
    return {
      description: "Capacity, route health, and field readiness.",
      title: "Fleet",
      tone: "primary"
    };
  }

  if (pathname === "/dashboard/supply" || pathname === "/dashboard/parts" || pathname === "/dashboard/inventory") {
    return {
      description: "Parts blockers, stock pressure, and procurement follow-through.",
      title: "Supply",
      tone: "secondary"
    };
  }

  if (pathname === "/dashboard/finance" || pathname === "/dashboard/invoices") {
    return {
      description: "Closeout, reminders, and collections pressure.",
      title: "Finance",
      tone: "secondary"
    };
  }

  if (pathname.startsWith("/dashboard/estimates")) {
    return {
      description: "Approval pressure and approved-to-dispatch handoff inside the visit operating system.",
      eyebrow: "Release runway",
      title: "Visits",
      tone: "secondary"
    };
  }

  if (pathname.startsWith("/dashboard/reports")) {
    return {
      description: "Throughput, revenue, and operational signal.",
      title: "Reports",
      tone: "secondary"
    };
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return {
      description: "Setup, integrations, and policy controls.",
      title: "Settings",
      tone: "secondary"
    };
  }

  if (pathname.startsWith("/dashboard/visits/")) {
    return {
      description: "Audit, history, and edge-case controls.",
      title: "Visit record",
      actionHref: "/dashboard/visits",
      actionLabel: "Back to visits",
      tone: "detail"
    };
  }

  if (pathname.startsWith("/dashboard/customers/")) {
    return {
      description: "Relationship detail, service history, and record cleanup.",
      title: "Customer record",
      actionHref: "/dashboard/customers",
      actionLabel: "Back to customers",
      tone: "detail"
    };
  }

  if (pathname.startsWith("/dashboard/fleet/") || pathname.startsWith("/dashboard/fleet-vehicles/")) {
    return {
      description: "Field detail, readiness, and lane-level controls.",
      title: "Fleet detail",
      actionHref: "/dashboard/fleet",
      actionLabel: "Back to fleet",
      tone: "detail"
    };
  }

  if (
    pathname.startsWith("/dashboard/supply/") ||
    pathname.startsWith("/dashboard/parts/") ||
    pathname.startsWith("/dashboard/inventory/")
  ) {
    return {
      description: "Supply detail, blockers, and stock controls.",
      title: "Supply detail",
      actionHref: "/dashboard/supply",
      actionLabel: "Back to supply",
      tone: "detail"
    };
  }

  if (pathname.startsWith("/dashboard/finance/") || pathname.startsWith("/dashboard/invoices/")) {
    return {
      description: "Collections detail, closeout state, and customer follow-through.",
      title: "Finance detail",
      actionHref: "/dashboard/finance",
      actionLabel: "Back to finance",
      tone: "detail"
    };
  }

  return {
    description: "Linked to the live operating flow.",
    title: "Connected view",
    tone: "secondary"
  };
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function normalizeOfficeOperatorRole(role: string | undefined): OfficeOperatorRole | "office" {
  if (role === "owner" || role === "admin" || role === "dispatcher" || role === "technician") {
    return role;
  }

  return "office";
}

function getRoleCommandHeading(role: string | undefined) {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return "Dispatcher defaults";
    case "admin":
      return "Admin follow-through";
    case "owner":
      return "Owner oversight";
    case "technician":
      return "Technician actions";
    default:
      return "Office defaults";
  }
}

function getCommandTierRank(tier: ShellCommand["tier"]) {
  switch (tier) {
    case "workspace":
      return 0;
    case "support":
      return 1;
    default:
      return 2;
  }
}

function getRoleCommandPriority(role: string | undefined) {
  switch (normalizeOfficeOperatorRole(role)) {
    case "dispatcher":
      return [
        "/dashboard/dispatch",
        "/dashboard/visits?scope=promise_risk",
        "/dashboard/visits?scope=needs_assignment",
        "/dashboard/visits?scope=stale_return_visit",
        "/dashboard/visits?scope=return_visit",
        "/dashboard/visits?scope=ready_dispatch",
        "/dashboard/visits/new"
      ];
    case "admin":
      return [
        "/dashboard/visits",
        "/dashboard/visits?scope=stale_approval",
        "/dashboard/visits?scope=ready_dispatch",
        "/dashboard/visits/new?mode=estimate",
        "/dashboard/customers",
        "/dashboard/finance?stage=reminder_due",
        "/dashboard/finance?stage=aged_risk"
      ];
    case "owner":
      return [
        "/dashboard",
        "/dashboard/finance?stage=aged_risk",
        "/dashboard/finance?stage=reminder_due",
        "/dashboard/dispatch",
        "/dashboard/reports",
        "/dashboard/customers"
      ];
    default:
      return ["/dashboard/dispatch", "/dashboard/visits", "/dashboard/customers"];
  }
}

function orderShellCommandsForRole(commands: readonly ShellCommand[], role: string | undefined) {
  const priority = getRoleCommandPriority(role);
  const priorityIndexByHref = new Map(priority.map((href, index) => [href, index]));

  return [...commands].sort((left, right) => {
    const leftPriority = priorityIndexByHref.get(left.href) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priorityIndexByHref.get(right.href) ?? Number.MAX_SAFE_INTEGER;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const tierDelta = getCommandTierRank(left.tier) - getCommandTierRank(right.tier);

    if (tierDelta !== 0) {
      return tierDelta;
    }

    return left.label.localeCompare(right.label);
  });
}

const shellCommands: readonly ShellCommand[] = [
  ...dashboardNavSections.flatMap((section) =>
    section.items.map((item) => {
      const shortcut =
        item.href === "/dashboard"
          ? "Alt+Shift+T"
          : item.href === "/dashboard/dispatch"
            ? "Alt+Shift+D"
            : item.href === "/dashboard/visits"
              ? "Alt+Shift+V"
              : item.href === "/dashboard/customers"
                ? "Alt+Shift+C"
                : item.href === "/dashboard/fleet"
                  ? "Alt+Shift+F"
                  : item.href === "/dashboard/supply"
                    ? "Alt+Shift+S"
                    : item.href === "/dashboard/finance"
                      ? "Alt+Shift+M"
                      : null;

      return {
        hint: item.hint,
        href: item.href,
        icon: item.icon,
        keywords: [section.label, item.label, ...(item.commandKeywords ?? [])],
        label: item.label,
        tier: getShellCommandTier(item.href),
        ...(shortcut ? { shortcut } : {})
      };
    })
  ),
  {
    hint: "Start a new service visit from the office workflow.",
    href: "/dashboard/visits/new",
    icon: "jobs",
    keywords: ["create", "new", "intake", "visit"],
    label: "New visit",
    shortcut: "Alt+Shift+N",
    tier: "workspace" as const
  },
  {
    hint: "Start a new estimate intake without leaving the visits model.",
    href: "/dashboard/visits/new?mode=estimate",
    icon: "estimates",
    keywords: ["create", "new", "estimate", "quote"],
    label: "New estimate intake",
    tier: "support" as const
  },
  {
    hint: "Open the visits slice for slipping promised work.",
    href: "/dashboard/visits?scope=promise_risk",
    icon: "jobs",
    keywords: ["late", "eta", "promise", "risk", "queue"],
    label: "Promise risk queue",
    tier: "workspace" as const
  },
  {
    hint: "Open the visits slice for active return-work chains.",
    href: "/dashboard/visits?scope=return_visit",
    icon: "jobs",
    keywords: ["return", "follow-up", "chain", "queue"],
    label: "Return visits queue",
    tier: "workspace" as const
  },
  {
    hint: "Open the visits slice for delayed return-work threads.",
    href: "/dashboard/visits?scope=stale_return_visit",
    icon: "jobs",
    keywords: ["stale", "return", "follow-up", "queue"],
    label: "Stale return queue",
    tier: "workspace" as const
  },
  {
    hint: "Open the visits slice for sent estimates that need approval follow-through now.",
    href: "/dashboard/visits?scope=stale_approval",
    icon: "approval",
    keywords: ["stale", "approval", "estimate", "follow-up", "runway", "queue"],
    label: "Approval runway queue",
    tier: "workspace" as const
  },
  {
    hint: "Open the visits slice for approved work that can move onto the board now.",
    href: "/dashboard/visits?scope=ready_dispatch",
    icon: "dispatch",
    keywords: ["ready", "dispatch", "routing", "release", "runway", "queue"],
    label: "Release runway",
    tier: "workspace" as const
  },
  {
    hint: "Open the collections slice for reminder pressure.",
    href: "/dashboard/finance?stage=reminder_due",
    icon: "invoices",
    keywords: ["finance", "collections", "reminder", "payments"],
    label: "Reminder due queue",
    tier: "support" as const
  },
  {
    hint: "Open the collections slice for older balances that need escalation.",
    href: "/dashboard/finance?stage=aged_risk",
    icon: "invoices",
    keywords: ["finance", "collections", "aging", "aged", "risk", "payments"],
    label: "Aged risk queue",
    tier: "support" as const
  }
];

export function AdminShell({ children, mobileNav, operatorRole, sidebar }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFleetRoute = pathname?.startsWith("/dashboard/fleet") ?? false;
  const isDetailRoute =
    pathname?.startsWith("/dashboard/visits/") ||
    pathname?.startsWith("/dashboard/customers/") ||
    pathname?.startsWith("/dashboard/supply/") ||
    pathname?.startsWith("/dashboard/parts/") ||
    pathname?.startsWith("/dashboard/inventory/") ||
    pathname?.startsWith("/dashboard/finance/") ||
    pathname?.startsWith("/dashboard/invoices/") ||
    false;
  const shellContext = getShellContext(pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [canCollapseDesktopSidebar, setCanCollapseDesktopSidebar] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [hasLoadedDesktopSidebarPreference, setHasLoadedDesktopSidebarPreference] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [liveCommandResults, setLiveCommandResults] = useState<readonly ShellCommand[]>([]);
  const [isLiveCommandSearchPending, setIsLiveCommandSearchPending] = useState(false);
  const [hotThreadPayload, setHotThreadPayload] = useState<HotThreadPayload | null>(null);
  const [isHotThreadPending, setIsHotThreadPending] = useState(false);
  const [pinnedHotThread, setPinnedHotThread] = useState<HotThreadTarget | null>(null);
  const [pendingHotThreadMutationId, setPendingHotThreadMutationId] = useState<string | null>(null);
  const [hotThreadFeedback, setHotThreadFeedback] = useState<{
    message: string;
    tone: "danger" | "success";
  } | null>(null);
  const [hotThreadReloadNonce, setHotThreadReloadNonce] = useState(0);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const fleetSidebarPreferenceRef = useRef<boolean | null>(null);
  const normalizedCommandQuery = commandQuery.trim();
  const hotThreadTarget = useMemo(
    () => getHotThreadTarget(pathname, searchParams),
    [pathname, searchParams]
  );
  const effectiveHotThreadTarget = hotThreadTarget ?? pinnedHotThread;
  const hasPinnedHotThread = Boolean(pinnedHotThread);
  const isPinnedHotThread = areHotThreadTargetsEqual(pinnedHotThread, hotThreadTarget);
  const roleCommandHeading = useMemo(() => getRoleCommandHeading(operatorRole), [operatorRole]);
  const focusModeHref = useMemo(
    () => getDeskFocusModeHref(pathname, searchParams),
    [pathname, searchParams]
  );
  const isFocusModeActive = searchParams?.get("focus") === "1";
  const focusModeCommand = useMemo<ShellCommand | null>(() => {
    if (!focusModeHref) {
      return null;
    }

    return {
      hint: isFocusModeActive
        ? "Restore the standard desk chrome for this operating surface."
        : "Strip low-value chrome and keep only the main canvas, carried thread, and next move.",
      href: focusModeHref,
      icon: "dashboard",
      keywords: ["focus", "mode", "operator", "chrome", "canvas"],
      label: isFocusModeActive ? "Exit focus mode" : "Enter focus mode",
      shortcut: "Alt+Shift+O",
      tier: "control"
    };
  }, [focusModeHref, isFocusModeActive]);
  const serviceThreadContext = useMemo(
    () => getServiceThreadContext(pathname, searchParams),
    [pathname, searchParams]
  );
  const hotThreadCommands = useMemo<readonly ShellCommand[]>(() => {
    if (!hotThreadPayload) {
      return [];
    }

    const commands: ShellCommand[] = [];
    const seenHrefs = new Set<string>();

    for (const jump of hotThreadPayload.jumps) {
      commands.push({
        hint: hotThreadPayload.description,
        href: jump.href,
        icon: getThreadCommandIcon(jump.label, jump.href),
        keywords: ["active", "current", "hot", "thread", "case", hotThreadPayload.title, jump.label],
        label: jump.label,
        shortcut: hotThreadJumpShortcutById[jump.id],
        tier: "workspace"
      });
      seenHrefs.add(jump.href);
    }

    for (const action of hotThreadPayload.actions) {
      if (seenHrefs.has(action.href)) {
        continue;
      }

      commands.push({
        hint: hotThreadPayload.description,
        href: action.href,
        icon: getThreadCommandIcon(action.label, action.href),
        keywords: ["active", "current", "hot", "thread", "case", hotThreadPayload.title, action.label],
        label: action.label,
        tier: action.tone === "ghost" ? "support" : "workspace"
      });
    }

    for (const action of hotThreadPayload.activeThread.actions) {
      if (seenHrefs.has(action.href)) {
        continue;
      }

      commands.push({
        hint: hotThreadPayload.description,
        href: action.href,
        icon: getThreadCommandIcon(action.label, action.href),
        keywords: ["active", "current", "case", "service", "thread", hotThreadPayload.title, action.label],
        label: action.label,
        tier:
          action.id === "closeout" || action.id === "finance"
            ? "support"
            : action.id === "customer"
              ? "support"
              : "workspace"
      });
      seenHrefs.add(action.href);
    }

    for (const target of hotThreadPayload.activeThread.drawerTargets) {
      if (seenHrefs.has(target.href)) {
        continue;
      }

      commands.push({
        hint: hotThreadPayload.description,
        href: target.href,
        icon: getThreadCommandIcon(target.label, target.href),
        keywords: ["active", "current", "case", "service", "thread", "file", hotThreadPayload.title, target.label],
        label: target.label,
        tier: "support"
      });
      seenHrefs.add(target.href);
    }

    return commands;
  }, [hotThreadPayload]);
  const hotThreadShortcutCommands = useMemo(() => {
    if (!hotThreadPayload) {
      return new Map<string, string>();
    }

    return new Map(
      hotThreadPayload.jumps.map((jump) => [hotThreadJumpShortcutById[jump.id].slice(-1).toLowerCase(), jump.href])
    );
  }, [hotThreadPayload]);
  const hotThreadWorkspaceActions = useMemo(() => {
    if (!hotThreadPayload) {
      return [] as Array<{ href: string; label: string; shortcut?: string; tone: HotThreadActionTone }>;
    }

    const mergedActions: Array<{ href: string; label: string; shortcut?: string; tone: HotThreadActionTone }> = [];
    const seenHrefs = new Set<string>();

    for (const jump of hotThreadPayload.jumps) {
      const matchingAction = hotThreadPayload.actions.find((action) => action.href === jump.href);
      mergedActions.push({
        href: jump.href,
        label: jump.label,
        shortcut: hotThreadJumpShortcutById[jump.id],
        tone: matchingAction?.tone ?? hotThreadJumpToneById[jump.id]
      });
      seenHrefs.add(jump.href);
    }

    for (const action of hotThreadPayload.actions) {
      if (seenHrefs.has(action.href)) {
        continue;
      }

      mergedActions.push({
        href: action.href,
        label: action.label,
        tone: action.tone
      });
    }

    for (const action of hotThreadPayload.activeThread.actions) {
      if (seenHrefs.has(action.href)) {
        continue;
      }

      mergedActions.push({
        href: action.href,
        label: action.label,
        tone:
          action.id === "closeout" || action.id === "finance"
            ? "tertiary"
            : action.id === "site"
              ? "secondary"
              : action.id === "customer"
                ? "ghost"
                : "secondary"
      });
      seenHrefs.add(action.href);
    }

    for (const target of hotThreadPayload.activeThread.drawerTargets) {
      if (seenHrefs.has(target.href)) {
        continue;
      }

      mergedActions.push({
        href: target.href,
        label: target.label,
        tone: "ghost"
      });
      seenHrefs.add(target.href);
    }

    return mergedActions;
  }, [hotThreadPayload]);
  const contextualCommands = useMemo<readonly ShellCommand[]>(() => {
    if (hotThreadCommands.length) {
      return focusModeCommand ? [focusModeCommand, ...hotThreadCommands] : hotThreadCommands;
    }

    if (!serviceThreadContext) {
      return focusModeCommand ? [focusModeCommand] : [];
    }

    const commands = serviceThreadContext.links.map<ShellCommand>((link, index) => ({
      hint: serviceThreadContext.description,
      href: link.href,
      icon: getThreadCommandIcon(link.label, link.href),
      keywords: ["active", "current", "hot", "thread", serviceThreadContext.title],
      label: link.label,
      tier: index <= 2 ? "workspace" : "support"
    }));

    if (focusModeCommand) {
      commands.unshift(focusModeCommand);
    }

    return commands;
  }, [focusModeCommand, hotThreadCommands, serviceThreadContext]);
  const filteredCommands = useMemo(() => {
    const orderedCommands = orderShellCommandsForRole(shellCommands, operatorRole);
    const mergedCommands = [
      ...contextualCommands,
      ...orderedCommands.filter(
        (command) => !contextualCommands.some((contextCommand) => contextCommand.href === command.href)
      )
    ];
    const normalizedQuery = normalizedCommandQuery.toLowerCase();

    if (!normalizedQuery) {
      return mergedCommands;
    }

    const matchingShellCommands = mergedCommands.filter((command) =>
      [command.label, command.hint, ...command.keywords].some((value) => value.toLowerCase().includes(normalizedQuery))
    );

    return [
      ...liveCommandResults,
      ...matchingShellCommands.filter(
        (command) => !liveCommandResults.some((result) => result.href === command.href)
      )
    ];
  }, [contextualCommands, liveCommandResults, normalizedCommandQuery, operatorRole]);
  const hasCommandQuery = normalizedCommandQuery.length > 0;
  const hasLiveRecordQuery = normalizedCommandQuery.length >= 2;
  const firstControlCommandIndex = hasCommandQuery
    ? -1
    : filteredCommands.findIndex((command) => command.tier === "control");

  function openCommandPalette() {
    setCommandQuery("");
    setActiveCommandIndex(0);
    setIsCommandPaletteOpen(true);
  }

  function closeCommandPalette() {
    setIsCommandPaletteOpen(false);
    setCommandQuery("");
    setActiveCommandIndex(0);
  }

  function runShellCommand(command: ShellCommand) {
    closeCommandPalette();
    router.push(command.href);
  }

  function handleTogglePinnedHotThread() {
    if (!hotThreadTarget) {
      setPinnedHotThread(null);
      return;
    }

    setPinnedHotThread((current) =>
      areHotThreadTargetsEqual(current, hotThreadTarget) ? null : hotThreadTarget
    );
  }

  async function runHotThreadMutation(
    mutation: NonNullable<HotThreadPayload["mutations"]>[number]
  ) {
    setHotThreadFeedback(null);
    setPendingHotThreadMutationId(mutation.id);

    try {
      const response = await fetch(mutation.endpoint, {
        body: JSON.stringify(mutation.body),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            ok?: boolean;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Hot thread action failed.");
      }

      setHotThreadFeedback({
        message: mutation.successMessage,
        tone: "success"
      });
      setHotThreadReloadNonce((current) => current + 1);
      router.refresh();
    } catch (error) {
      setHotThreadFeedback({
        message: error instanceof Error ? error.message : "Hot thread action failed.",
        tone: "danger"
      });
    } finally {
      setPendingHotThreadMutationId(null);
    }
  }

  useEffect(() => {
    setIsSidebarOpen(false);
    setIsCommandPaletteOpen(false);
  }, [pathname]);

  useEffect(() => {
    setHotThreadFeedback(null);
    setPendingHotThreadMutationId(null);
  }, [effectiveHotThreadTarget]);

  useEffect(() => {
    try {
      setIsDesktopSidebarCollapsed(window.localStorage.getItem(desktopSidebarStorageKey) === "true");
    } catch {
      setIsDesktopSidebarCollapsed(false);
    } finally {
      setHasLoadedDesktopSidebarPreference(true);
    }
  }, []);

  useEffect(() => {
    try {
      setPinnedHotThread(readPinnedHotThread(window.localStorage));
    } catch {
      // Ignore corrupt local storage and fall back to live target resolution.
      setPinnedHotThread(null);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedDesktopSidebarPreference) {
      return;
    }

    try {
      window.localStorage.setItem(desktopSidebarStorageKey, isDesktopSidebarCollapsed ? "true" : "false");
    } catch {
      // Ignore storage failures so the shell still works in restricted contexts.
    }
  }, [hasLoadedDesktopSidebarPreference, isDesktopSidebarCollapsed]);

  useEffect(() => {
    try {
      writePinnedHotThread(window.localStorage, pinnedHotThread);
    } catch {
      // Ignore persistence failures so the shell still works.
    }
  }, [pinnedHotThread]);

  useEffect(() => {
    const handleHotThreadTarget = (event: Event) => {
      const detail = (event as CustomEvent<HotThreadTargetEventDetail>).detail;

      if (!detail?.pin) {
        return;
      }

      setPinnedHotThread(isHotThreadTarget(detail.target) ? detail.target : null);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== pinnedHotThreadStorageKey) {
        return;
      }

      try {
        setPinnedHotThread(readPinnedHotThread(window.localStorage));
      } catch {
        setPinnedHotThread(null);
      }
    };

    window.addEventListener(hotThreadTargetEventName, handleHotThreadTarget as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(hotThreadTargetEventName, handleHotThreadTarget as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 981px)");

    const handleChange = (matches: boolean) => {
      if (matches) {
        setIsSidebarOpen(false);
      }
    };

    handleChange(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      handleChange(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);

      return () => {
        mediaQuery.removeEventListener("change", onChange);
      };
    }

    mediaQuery.addListener(onChange);

    return () => {
      mediaQuery.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1181px)");

    const handleChange = (matches: boolean) => {
      setCanCollapseDesktopSidebar(matches);
    };

    handleChange(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      handleChange(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);

      return () => {
        mediaQuery.removeEventListener("change", onChange);
      };
    }

    mediaQuery.addListener(onChange);

    return () => {
      mediaQuery.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCommandPalette();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return;
    }

    commandInputRef.current?.focus();
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    setActiveCommandIndex((current) => {
      if (!filteredCommands.length) {
        return 0;
      }

      return Math.min(current, filteredCommands.length - 1);
    });
  }, [filteredCommands]);

  useEffect(() => {
    if (normalizedCommandQuery.length < 2) {
      setLiveCommandResults([]);
      setIsLiveCommandSearchPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLiveCommandSearchPending(true);

      try {
        const response = await fetch(`/api/internal/command-search?q=${encodeURIComponent(normalizedCommandQuery)}`, {
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              results?: ShellCommand[];
            }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Live command search failed.");
        }

        setLiveCommandResults(payload?.results ?? []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Live command search failed", error);
        setLiveCommandResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLiveCommandSearchPending(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [normalizedCommandQuery]);

  useEffect(() => {
    if (!effectiveHotThreadTarget) {
      setHotThreadPayload(null);
      setIsHotThreadPending(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsHotThreadPending(true);

      try {
        const params = new URLSearchParams({
          id: effectiveHotThreadTarget.id,
          kind: effectiveHotThreadTarget.kind
        });

        if (effectiveHotThreadTarget.siteId) {
          params.set("siteId", effectiveHotThreadTarget.siteId);
        }

        const response = await fetch(`/api/internal/hot-thread?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              thread?: HotThreadPayload;
            }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Hot thread could not be loaded.");
        }

        setHotThreadPayload(payload?.thread ?? null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Hot thread load failed", error);
        setHotThreadPayload(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsHotThreadPending(false);
        }
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [effectiveHotThreadTarget, hotThreadReloadNonce]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (isTextEntryTarget(event.target)) {
        return;
      }

      if (event.altKey && event.shiftKey) {
        if (key === "p" && effectiveHotThreadTarget) {
          event.preventDefault();
          if (hotThreadTarget) {
            handleTogglePinnedHotThread();
          } else if (hasPinnedHotThread) {
            setPinnedHotThread(null);
          } else {
            setPinnedHotThread(effectiveHotThreadTarget);
          }
          return;
        }

        const hotThreadShortcutHref = hotThreadShortcutCommands.get(key);

        if (hotThreadShortcutHref) {
          event.preventDefault();
          router.push(hotThreadShortcutHref);
          return;
        }

        const quickCommand =
          key === "o" && focusModeCommand
            ? focusModeCommand
            : key === "t"
            ? shellCommands.find((command) => command.href === "/dashboard")
            : key === "d"
              ? shellCommands.find((command) => command.href === "/dashboard/dispatch")
              : key === "v"
                ? shellCommands.find((command) => command.href === "/dashboard/visits")
                : key === "c"
                  ? shellCommands.find((command) => command.href === "/dashboard/customers")
                  : key === "f"
                    ? shellCommands.find((command) => command.href === "/dashboard/fleet")
                    : key === "s"
                      ? shellCommands.find((command) => command.href === "/dashboard/supply")
                      : key === "m"
                        ? shellCommands.find((command) => command.href === "/dashboard/finance")
                        : key === "n"
                          ? shellCommands.find((command) => command.label === "New visit")
                          : null;

        if (quickCommand) {
          event.preventDefault();
          runShellCommand(quickCommand);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    effectiveHotThreadTarget,
    focusModeCommand,
    hasPinnedHotThread,
    hotThreadShortcutCommands,
    hotThreadTarget,
    router
  ]);

  return (
    <div
      className={cx(
        "ui-admin-shell",
        isDetailRoute && "ui-admin-shell--detail-route",
        isFleetRoute && "ui-admin-shell--fleet-focus",
        isSidebarOpen && "ui-admin-shell--sidebar-open",
        canCollapseDesktopSidebar &&
          isDesktopSidebarCollapsed &&
          "ui-admin-shell--sidebar-collapsed"
      )}
    >
      <button
        aria-label="Close navigation"
        className="ui-admin-shell__backdrop"
        onClick={() => setIsSidebarOpen(false)}
        type="button"
      />
      {isCommandPaletteOpen ? (
        <div className="ui-admin-command-palette" role="dialog" aria-modal="true" aria-labelledby={adminCommandPaletteInputId}>
          <button
            aria-label="Close command palette"
            className="ui-admin-command-palette__backdrop"
            onClick={closeCommandPalette}
            type="button"
          />
          <div className="ui-admin-command-palette__panel">
            <div className="ui-admin-command-palette__header">
              <div>
                <p className="ui-admin-context-bar__eyebrow">Command palette</p>
                <strong className="ui-admin-context-bar__title">Jump and act faster</strong>
                <p className="ui-admin-context-bar__description">{roleCommandHeading}</p>
              </div>
              <button
                className={buttonClassName({ size: "sm", tone: "ghost" })}
                onClick={closeCommandPalette}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="ui-admin-command-palette__search">
              <input
                autoComplete="off"
                className="ui-input"
                id={adminCommandPaletteInputId}
                onChange={(event) => {
                  setCommandQuery(event.currentTarget.value);
                  setActiveCommandIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveCommandIndex((current) =>
                      filteredCommands.length ? Math.min(current + 1, filteredCommands.length - 1) : 0
                    );
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveCommandIndex((current) => Math.max(current - 1, 0));
                  }

                  if (event.key === "Enter" && filteredCommands[activeCommandIndex]) {
                    event.preventDefault();
                    runShellCommand(filteredCommands[activeCommandIndex]);
                  }
                }}
                placeholder="Go to a visit, customer, VIN, plate, service site, invoice, or desk..."
                ref={commandInputRef}
                type="search"
                value={commandQuery}
              />
            </div>
            <div className="ui-admin-command-palette__list" role="listbox" aria-label="Command results">
              {hasLiveRecordQuery && isLiveCommandSearchPending ? (
                <p className="ui-admin-nav__section-label">Searching live records...</p>
              ) : null}
              {filteredCommands.length ? (
                filteredCommands.map((command, index) => (
                  <div key={`${command.label}:${command.href}`}>
                    {!hasCommandQuery && index === firstControlCommandIndex ? (
                      <p className="ui-admin-nav__section-label">Desks</p>
                    ) : null}
                    <button
                      aria-selected={index === activeCommandIndex}
                      className={cx(
                        "ui-admin-command-palette__item",
                        index === activeCommandIndex && "ui-admin-command-palette__item--active"
                      )}
                      onClick={() => runShellCommand(command)}
                      onMouseEnter={() => setActiveCommandIndex(index)}
                      role="option"
                      type="button"
                    >
                      <span className="ui-admin-command-palette__item-icon">
                        <AppIcon name={command.icon} />
                      </span>
                      <span className="ui-admin-command-palette__item-copy">
                        <strong className="ui-admin-command-palette__item-title">{command.label}</strong>
                        <span className="ui-admin-command-palette__item-hint">{command.hint}</span>
                      </span>
                      <span className="ui-admin-command-palette__item-shortcut">
                        {command.shortcut ?? (command.tier === "control" ? "Control" : command.tier === "support" ? "Support" : "")}
                      </span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="ui-admin-command-palette__empty">
                  <strong>{hasLiveRecordQuery ? "No matching records or commands" : "No matching commands"}</strong>
                  <span>
                    {hasLiveRecordQuery
                      ? "Try a phone, VIN, plate, customer, service site, visit title, or invoice number."
                      : "Try `dispatch`, `visits`, `customers`, `finance`, or `new visit`."}
                  </span>
                </div>
              )}
            </div>
            <div className="ui-admin-command-palette__footer">
              <span>Open: Ctrl/Cmd + K</span>
              <span>Navigate: Alt + Shift + D / V / C / F / S / M / N / O</span>
              <span>Case file: Alt + Shift + 1 / 2 / 3 / 4 / 5 / P</span>
            </div>
          </div>
        </div>
      ) : null}

      <aside className="ui-admin-sidebar" id={adminSidebarId}>
        <div className="ui-admin-sidebar__desktop-actions">
          <button
            className={buttonClassName({
              className: "ui-admin-sidebar__desktop-toggle",
              size: "sm",
              tone: "ghost"
            })}
            onClick={openCommandPalette}
            title="Open command palette"
            type="button"
          >
            <span aria-hidden className="ui-admin-sidebar__desktop-toggle-icon">
              ⌘
            </span>
            <span className="ui-admin-sidebar__desktop-toggle-label">Command</span>
          </button>
          <button
            aria-label={isDesktopSidebarCollapsed ? "Expand navigation rail" : "Collapse navigation rail"}
            aria-pressed={isDesktopSidebarCollapsed}
            className={buttonClassName({
              className: "ui-admin-sidebar__desktop-toggle",
              size: "sm",
              tone: "ghost"
            })}
            onClick={() => setIsDesktopSidebarCollapsed((current) => !current)}
            title={isDesktopSidebarCollapsed ? "Expand navigation rail" : "Collapse navigation rail"}
            type="button"
          >
            <span aria-hidden className="ui-admin-sidebar__desktop-toggle-icon">
              {isDesktopSidebarCollapsed ? "›" : "‹"}
            </span>
            <span className="ui-admin-sidebar__desktop-toggle-label">
              {isDesktopSidebarCollapsed ? "Expand" : "Collapse"}
            </span>
          </button>
        </div>
        <div className="ui-admin-sidebar__mobile-actions">
          <button
            className={buttonClassName({ size: "sm", tone: "ghost" })}
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          >
            Close menu
          </button>
        </div>
        {sidebar}
      </aside>

      <main className="ui-admin-content">
        <div className="ui-admin-mobile-bar">
          <div className="ui-admin-mobile-bar__actions">
            <button
              className={buttonClassName({ size: "sm", tone: "ghost" })}
              onClick={openCommandPalette}
              type="button"
            >
              Command
            </button>
          </div>
          <button
            aria-controls={adminSidebarId}
            aria-expanded={isSidebarOpen}
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            onClick={() => setIsSidebarOpen((current) => !current)}
            type="button"
          >
            {isSidebarOpen ? "Close menu" : "Menu"}
          </button>
        </div>
        {serviceThreadContext && !effectiveHotThreadTarget ? (
          <div className="ui-admin-thread-dock">
            <div className="ui-admin-thread-dock__copy">
              <p className="ui-admin-thread-dock__eyebrow">Carried case file</p>
              <div className="ui-admin-thread-dock__title-row">
                <strong className="ui-admin-thread-dock__title">{serviceThreadContext.title}</strong>
                <span className="ui-admin-thread-dock__description">{serviceThreadContext.description}</span>
              </div>
            </div>
            <div className="ui-admin-thread-dock__actions">
              {serviceThreadContext.links.map((link) => (
                <Link
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {effectiveHotThreadTarget ? (
          <section
            aria-live="polite"
            className={cx(
              "ui-admin-hot-thread",
              isHotThreadPending && "ui-admin-hot-thread--pending"
            )}
          >
            {hotThreadPayload ? (
              <>
                <div className="ui-admin-hot-thread__header">
                  <div className="ui-admin-hot-thread__copy">
                    <p className="ui-admin-hot-thread__eyebrow">{hotThreadPayload.eyebrow}</p>
                    <div className="ui-admin-hot-thread__title-row">
                      <strong className="ui-admin-hot-thread__title">{hotThreadPayload.title}</strong>
                      <span className="ui-admin-hot-thread__subtitle">{hotThreadPayload.subtitle}</span>
                      {!hotThreadTarget && hasPinnedHotThread ? (
                        <span className="ui-admin-hot-thread__pin-state">Pinned case file</span>
                      ) : null}
                    </div>
                    <p className="ui-admin-hot-thread__description">{hotThreadPayload.description}</p>
                    <div className="ui-admin-hot-thread__workspace-actions">
                      {hotThreadWorkspaceActions.map((action) => (
                        <Link
                          className={buttonClassName({ size: "sm", tone: action.tone })}
                          href={action.href}
                          key={action.href}
                          title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="ui-admin-hot-thread__header-actions">
                    {hotThreadTarget ? (
                      <button
                        className={buttonClassName({ size: "sm", tone: isPinnedHotThread ? "secondary" : "ghost" })}
                        onClick={handleTogglePinnedHotThread}
                        type="button"
                      >
                        {isPinnedHotThread ? "Unpin case file" : "Pin case file"}
                      </button>
                    ) : hasPinnedHotThread ? (
                      <button
                        className={buttonClassName({ size: "sm", tone: "ghost" })}
                        onClick={() => setPinnedHotThread(null)}
                        type="button"
                      >
                        Clear case file
                      </button>
                    ) : null}
                    <div className="ui-admin-hot-thread__badges">
                      {hotThreadPayload.badges.map((badge) => (
                        <span
                          className={cx(
                            "ui-admin-hot-thread__badge",
                            `ui-admin-hot-thread__badge--${badge.tone}`
                          )}
                          key={`${badge.label}:${badge.tone}`}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {hotThreadFeedback ? (
                  <div
                    className={cx(
                      "ui-admin-hot-thread__feedback",
                      `ui-admin-hot-thread__feedback--${hotThreadFeedback.tone}`
                    )}
                  >
                    {hotThreadFeedback.message}
                  </div>
                ) : null}

                <div className="ui-admin-hot-thread__body">
                  <div className="ui-admin-hot-thread__case-column">
                    <article className="ui-admin-hot-thread__section">
                      <div className="ui-admin-hot-thread__section-header">
                        <strong className="ui-admin-hot-thread__section-title">Active thread</strong>
                        <p className="ui-admin-hot-thread__section-description">
                          Carry one service thread, one site thread, and one continuity signal across desks.
                        </p>
                      </div>
                      <div className="ui-admin-hot-thread__section-items">
                        {hotThreadPayload.activeThread.continuity.promiseConfidence ? (
                          <div className="ui-admin-hot-thread__item">
                            <span className="ui-admin-hot-thread__item-label">Promise confidence</span>
                            <strong className="ui-admin-hot-thread__item-value">
                              {hotThreadPayload.activeThread.continuity.promiseConfidence.label} ·{" "}
                              {hotThreadPayload.activeThread.continuity.promiseConfidence.confidencePercent}%
                            </strong>
                            <span className="ui-admin-hot-thread__item-copy">
                              {hotThreadPayload.activeThread.continuity.promiseConfidence.copy}
                            </span>
                          </div>
                        ) : null}
                        {hotThreadPayload.activeThread.continuity.routeConfidence ? (
                          <div className="ui-admin-hot-thread__item">
                            <span className="ui-admin-hot-thread__item-label">Route confidence</span>
                            <strong className="ui-admin-hot-thread__item-value">
                              {hotThreadPayload.activeThread.continuity.routeConfidence.label} ·{" "}
                              {hotThreadPayload.activeThread.continuity.routeConfidence.confidencePercent}%
                            </strong>
                            <span className="ui-admin-hot-thread__item-copy">
                              {hotThreadPayload.activeThread.continuity.routeConfidence.copy}
                            </span>
                          </div>
                        ) : null}
                        <div className="ui-admin-hot-thread__item">
                          <span className="ui-admin-hot-thread__item-label">Primary desk</span>
                          <strong className="ui-admin-hot-thread__item-value">
                            {hotThreadPayload.activeThread.primaryDesk.label}
                          </strong>
                          <span className="ui-admin-hot-thread__item-copy">
                            Keep the carried thread anchored to the desk that owns the next committed move.
                          </span>
                        </div>
                        {hotThreadPayload.activeThread.continuity.releaseRunway ? (
                          <div className="ui-admin-hot-thread__item">
                            <span className="ui-admin-hot-thread__item-label">Release runway</span>
                            <strong className="ui-admin-hot-thread__item-value">
                              {hotThreadPayload.activeThread.continuity.releaseRunway.label}
                            </strong>
                            <span className="ui-admin-hot-thread__item-copy">
                              {hotThreadPayload.activeThread.continuity.releaseRunway.copy}
                            </span>
                          </div>
                        ) : null}
                        {hotThreadPayload.activeThread.continuity.serviceSiteThread ? (
                          <div className="ui-admin-hot-thread__item">
                            <span className="ui-admin-hot-thread__item-label">Site thread</span>
                            <strong className="ui-admin-hot-thread__item-value">
                              {hotThreadPayload.activeThread.continuity.serviceSiteThread.label}
                            </strong>
                            <span className="ui-admin-hot-thread__item-copy">
                              {hotThreadPayload.activeThread.continuity.serviceSiteThread.copy}
                              {hotThreadPayload.activeThread.continuity.serviceSiteThread.facts.length
                                ? ` ${hotThreadPayload.activeThread.continuity.serviceSiteThread.facts.slice(0, 2).join(" · ")}.`
                                : ""}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </article>

                    {hotThreadPayload.caseItems.length ? (
                      <article className="ui-admin-hot-thread__case-file">
                        <div className="ui-admin-hot-thread__section-header">
                          <strong className="ui-admin-hot-thread__section-title">Case file</strong>
                          <p className="ui-admin-hot-thread__section-description">
                            Carry the same who, where, and ownership context across desks.
                          </p>
                        </div>
                        <div className="ui-admin-hot-thread__case-items">
                          {hotThreadPayload.caseItems.map((item) => (
                            <div className="ui-admin-hot-thread__case-item" key={`case:${item.label}`}>
                              <span className="ui-admin-hot-thread__item-label">{item.label}</span>
                              <strong className="ui-admin-hot-thread__item-value">{item.value}</strong>
                              {item.copy ? (
                                <span className="ui-admin-hot-thread__item-copy">{item.copy}</span>
                              ) : null}
                              {item.href ? (
                                <Link className="ui-admin-hot-thread__item-link" href={item.href}>
                                  Open
                                </Link>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </article>
                    ) : null}

                    {hotThreadPayload.ledger.length ? (
                      <article className="ui-admin-hot-thread__ledger">
                        <div className="ui-admin-hot-thread__section-header">
                          <strong className="ui-admin-hot-thread__section-title">Continuity ledger</strong>
                          <p className="ui-admin-hot-thread__section-description">
                            Keep promise, trust, site memory, and closeout drag visible as one carried signal.
                          </p>
                        </div>
                        <div className="ui-admin-hot-thread__ledger-items">
                          {hotThreadPayload.ledger.map((item) => (
                            <div
                              className={cx(
                                "ui-admin-hot-thread__ledger-item",
                                `ui-admin-hot-thread__ledger-item--${item.tone}`
                              )}
                              key={`ledger:${item.label}`}
                            >
                              <span className="ui-admin-hot-thread__item-label">{item.label}</span>
                              <strong className="ui-admin-hot-thread__item-value">{item.value}</strong>
                              <span className="ui-admin-hot-thread__item-copy">{item.copy}</span>
                            </div>
                          ))}
                        </div>
                      </article>
                    ) : null}

                    {(hotThreadPayload.activeThread.nextMove ?? hotThreadPayload.nextMove) ? (
                      <div className="ui-admin-hot-thread__next-move">
                        <p className="ui-admin-hot-thread__next-move-label">Next move</p>
                        <strong className="ui-admin-hot-thread__next-move-title">
                          {(hotThreadPayload.activeThread.nextMove ?? hotThreadPayload.nextMove)?.label}
                        </strong>
                        <p className="ui-admin-hot-thread__next-move-copy">
                          {(hotThreadPayload.activeThread.nextMove ?? hotThreadPayload.nextMove)?.copy}
                        </p>
                        <Link
                          className={buttonClassName({ size: "sm", tone: "primary" })}
                          href={(hotThreadPayload.activeThread.nextMove ?? hotThreadPayload.nextMove)!.href}
                        >
                          Open next move
                        </Link>
                        {hotThreadPayload.activeThread.drawerTargets.length ? (
                          <div className="ui-admin-hot-thread__workspace-actions">
                            {hotThreadPayload.activeThread.drawerTargets.slice(0, 3).map((target) => (
                              <Link
                                className={buttonClassName({ size: "sm", tone: "ghost" })}
                                href={target.href}
                                key={`drawer:${target.id}`}
                              >
                                {target.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {hotThreadPayload.mutations.length ? (
                      <article className="ui-admin-hot-thread__section ui-admin-hot-thread__section--actions">
                        <div className="ui-admin-hot-thread__section-header">
                          <strong className="ui-admin-hot-thread__section-title">Run from case file</strong>
                          <p className="ui-admin-hot-thread__section-description">
                            Run the next customer-facing move without leaving the carried thread.
                          </p>
                        </div>
                        <div className="ui-admin-hot-thread__mutation-actions">
                          {hotThreadPayload.mutations.map((mutation) => (
                            <button
                              className={buttonClassName({ size: "sm", tone: mutation.tone })}
                              disabled={pendingHotThreadMutationId === mutation.id}
                              key={mutation.id}
                              onClick={() => {
                                void runHotThreadMutation(mutation);
                              }}
                              type="button"
                            >
                              {pendingHotThreadMutationId === mutation.id ? mutation.pendingLabel : mutation.label}
                            </button>
                          ))}
                        </div>
                      </article>
                    ) : null}
                  </div>
                  <div className="ui-admin-hot-thread__sections">
                    {hotThreadPayload.sections.map((section) => (
                      <article className="ui-admin-hot-thread__section" key={section.id}>
                        <div className="ui-admin-hot-thread__section-header">
                          <strong className="ui-admin-hot-thread__section-title">{section.label}</strong>
                          {section.description ? (
                            <p className="ui-admin-hot-thread__section-description">
                              {section.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="ui-admin-hot-thread__section-items">
                          {section.items.map((item) => (
                            <div className="ui-admin-hot-thread__item" key={`${section.id}:${item.label}`}>
                              <span className="ui-admin-hot-thread__item-label">{item.label}</span>
                              <strong className="ui-admin-hot-thread__item-value">{item.value}</strong>
                              {item.copy ? (
                                <span className="ui-admin-hot-thread__item-copy">{item.copy}</span>
                              ) : null}
                              {item.href ? (
                                <Link className="ui-admin-hot-thread__item-link" href={item.href}>
                                  Open
                                </Link>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="ui-admin-hot-thread__empty">
                <p className="ui-admin-hot-thread__eyebrow">Carried case file</p>
                <strong className="ui-admin-hot-thread__title">Loading active case file</strong>
                <p className="ui-admin-hot-thread__description">
                  Pulling the live service thread into the shell so it stays carried while you move across desks.
                </p>
              </div>
            )}
          </section>
        ) : null}
        <div className="ui-admin-content__viewport">{children}</div>
        {mobileNav ? <div className="ui-admin-bottom-nav-wrap">{mobileNav}</div> : null}
      </main>
    </div>
  );
}
