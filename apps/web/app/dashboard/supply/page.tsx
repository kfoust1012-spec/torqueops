import {
  formatCurrencyFromCents,
  formatDateTime,
  formatDesignLabel
} from "@mobile-mechanic/core";
import {
  listJobsByCompany,
  listServiceHistoryEstimatesByJobIds,
  listServiceHistoryInvoicesByJobIds
} from "@mobile-mechanic/api-client";
import type { Database } from "@mobile-mechanic/types";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Page,
  StatusBadge,
  buttonClassName
} from "../../../components/ui";
import { requireCompanyContext } from "../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../lib/customers/workspace";
import {
  countOpenTechnicianPaymentHandoffsByJobId,
  listTechnicianPaymentHandoffsByInvoiceIds,
  summarizeOpenTechnicianPaymentHandoffsByJobId
} from "../../../lib/invoices/payment-handoffs";
import { buildWorkspaceBlockerSummary } from "../../../lib/jobs/workspace-blockers";
import { getProcurementIntegrationsWorkspace } from "../../../lib/procurement/providers/service";
import { getProcurementWorkspace } from "../../../lib/procurement/service";
import { getSupplyListsWorkspace } from "../../../lib/procurement/supplies/service";
import {
  buildSupplyInventoryHref,
  getProcurementDefaultView,
  getProcurementPriorityAction as getPriorityAction,
  getSupplyPriorityAction
} from "../../../lib/procurement/support";
import {
  buildProcurementWorkspaceHref,
  resolveProcurementWorkspaceView,
  type ProcurementWorkspaceView
} from "../../../lib/procurement/workspace";
import {
  buildVisitInventoryHref,
  buildVisitThreadHref,
  buildVisitInvoiceHref,
  type VisitWorkspaceLinkOptions
} from "../../../lib/visits/workspace";
import {
  getInventoryWorkspace
} from "../../../lib/inventory/service";
import {
  getInventoryOperationsWorkspace
} from "../../../lib/inventory-operations/service";
import { toServerError } from "../../../lib/server-error";

type PartsWorkspacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PartsWorkspaceSearchParams = Record<string, string | string[] | undefined>;

function formatReference(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function findAttentionItem(attentionItems: string[], keyword: string) {
  const normalizedKeyword = keyword.toLowerCase();

  return (
    attentionItems.find((item) => item.toLowerCase().includes(normalizedKeyword)) ?? null
  );
}

export async function SupplyWorkspacePageImpl({
  searchParams
}: PartsWorkspacePageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const [workspace, integrationsWorkspace, supplyListsWorkspace, inventoryWorkspace, inventoryOperations, resolvedSearchParams, jobsResult] =
    await Promise.all([
      getProcurementWorkspace(context.supabase, context.companyId),
      getProcurementIntegrationsWorkspace(context.supabase, context.companyId),
      getSupplyListsWorkspace(context.supabase, context.companyId),
      getInventoryWorkspace(context.supabase, context.companyId),
      getInventoryOperationsWorkspace(context.supabase, context.companyId),
      searchParams ?? Promise.resolve({} as PartsWorkspaceSearchParams),
      listJobsByCompany(context.supabase, context.companyId, { includeInactive: true })
    ]);

  if (jobsResult.error) {
    throw toServerError(jobsResult.error, "Supply desk could not load visits.");
  }

  const blockerJobs = (jobsResult.data ?? []).filter(
    (job) => job.isActive && !["completed", "canceled"].includes(job.status)
  );
  const blockerJobIds = blockerJobs.map((job) => job.id);
  const [estimatesResult, invoicesResult, openPartRequestsResult, inventoryIssuesResult, blockerThreadContextResult] = blockerJobIds.length
    ? await Promise.all([
        listServiceHistoryEstimatesByJobIds(context.supabase, context.companyId, blockerJobIds),
        listServiceHistoryInvoicesByJobIds(context.supabase, context.companyId, blockerJobIds),
        context.supabase
          .from("part_requests")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .eq("status", "open")
          .in("job_id", blockerJobIds)
          .returns<Array<Pick<Database["public"]["Tables"]["part_requests"]["Row"], "job_id" | "status">>>(),
        context.supabase
          .from("job_inventory_issues")
          .select("job_id, status")
          .eq("company_id", context.companyId)
          .in("job_id", blockerJobIds)
          .returns<
            Array<Pick<Database["public"]["Tables"]["job_inventory_issues"]["Row"], "job_id" | "status">>
          >(),
        context.supabase
          .from("jobs")
          .select("id, customer_id, service_site_id")
          .eq("company_id", context.companyId)
          .in("id", blockerJobIds)
          .returns<
            Array<
              Pick<
                Database["public"]["Tables"]["jobs"]["Row"],
                "customer_id" | "id" | "service_site_id"
              >
            >
          >()
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];

  if (estimatesResult.error) {
    throw toServerError(estimatesResult.error, "Supply desk could not load estimates.");
  }

  if (invoicesResult.error) {
    throw toServerError(invoicesResult.error, "Supply desk could not load invoices.");
  }

  if (openPartRequestsResult.error) {
    throw toServerError(
      openPartRequestsResult.error,
      "Supply desk could not load open part requests."
    );
  }

  if (inventoryIssuesResult.error) {
    throw toServerError(
      inventoryIssuesResult.error,
      "Supply desk could not load inventory issues."
    );
  }

  if (blockerThreadContextResult.error) {
    throw toServerError(
      blockerThreadContextResult.error,
      "Supply desk could not load thread continuity."
    );
  }

  const estimatesByJobId = new Map((estimatesResult.data ?? []).map((estimate) => [estimate.jobId, estimate]));
  const invoicesByJobId = new Map((invoicesResult.data ?? []).map((invoice) => [invoice.jobId, invoice]));
  const invoiceIdToJobId = new Map(
    (invoicesResult.data ?? []).map((invoice) => [invoice.id, invoice.jobId])
  );
  const paymentHandoffs = await listTechnicianPaymentHandoffsByInvoiceIds(
    context.supabase as any,
    [...invoiceIdToJobId.keys()]
  );
  const openPaymentHandoffCountByJobId = countOpenTechnicianPaymentHandoffsByJobId({
    handoffs: paymentHandoffs,
    invoiceIdToJobId
  });
  const paymentHandoffSummaryByJobId = summarizeOpenTechnicianPaymentHandoffsByJobId({
    handoffs: paymentHandoffs,
    invoiceIdToJobId
  });
  const openPartRequestsByJobId = (openPartRequestsResult.data ?? []).reduce<Map<string, number>>((counts, request) => {
    counts.set(request.job_id, (counts.get(request.job_id) ?? 0) + 1);
    return counts;
  }, new Map());
  const inventoryIssuesByJobId = (inventoryIssuesResult.data ?? []).reduce<Map<string, number>>((counts, issue) => {
    if (issue.status === "returned" || issue.status === "consumed") {
      return counts;
    }

    counts.set(issue.job_id, (counts.get(issue.job_id) ?? 0) + 1);
    return counts;
  }, new Map());
  const supplyDeskBlockers = buildWorkspaceBlockerSummary({
    estimatesByJobId,
    inventoryIssuesByJobId,
    invoicesByJobId,
    jobs: blockerJobs,
    paymentHandoffSummaryByJobId,
    openPaymentHandoffCountByJobId,
    openPartRequestsByJobId
  });

  const supplierAccounts = workspace.supplierAccounts ?? [];
  const supplierAccountsById = new Map(supplierAccounts.map((account) => [account.id, account]));
  const partstechAccount = integrationsWorkspace.partsTech.account;
  const repairLinkAccount = integrationsWorkspace.repairLink.account;
  const amazonBusinessAccount = integrationsWorkspace.amazonBusiness.account;
  const partstechMappings = integrationsWorkspace.partsTech.mappings ?? [];
  const repairLinkMappings = integrationsWorkspace.repairLink.mappings ?? [];
  const supplyLists = supplyListsWorkspace.lists ?? [];
  const connectedProviderCount = [
    partstechAccount,
    repairLinkAccount,
    amazonBusinessAccount
  ].filter((account) => account?.status === "connected").length;
  const providerAttentionCount = integrationsWorkspace.attentionItems.length;
  const manualAttentionByRequestId = new Map<string, number>();

  for (const line of workspace.manualAttentionLines) {
    manualAttentionByRequestId.set(
      line.part_request_id,
      (manualAttentionByRequestId.get(line.part_request_id) ?? 0) + 1
    );
  }

  const openRequestAttentionCount = workspace.openRequests.filter((request) =>
    manualAttentionByRequestId.has(request.id)
  ).length;
  const partstechActiveMappings = partstechMappings.filter(
    (mapping) => mapping.status === "active"
  ).length;
  const partstechReviewCount = partstechMappings.filter((mapping) =>
    ["pending_approval", "unmapped"].includes(mapping.status)
  ).length;
  const repairLinkActiveMappings = repairLinkMappings.filter(
    (mapping) => mapping.status === "active"
  ).length;
  const repairLinkPendingMappings = repairLinkMappings.filter(
    (mapping) => mapping.status === "pending_approval"
  ).length;
  const defaultView = getProcurementDefaultView({
    manualAttentionCount: workspace.summary.manualAttentionCount,
    openCarts: workspace.summary.openCarts,
    openPurchaseOrders: workspace.summary.openPurchaseOrders,
    openRequests: workspace.summary.openRequests,
    providerAttentionCount
  });
  const currentView = resolveProcurementWorkspaceView(
    resolvedSearchParams.view,
    defaultView
  );
  const priorityAction = getPriorityAction({
    manualAttentionCount: workspace.summary.manualAttentionCount,
    openCarts: workspace.summary.openCarts,
    openPurchaseOrders: workspace.summary.openPurchaseOrders,
    openRequests: workspace.summary.openRequests,
    providerAttentionCount
  });
  const priorityHref = buildProcurementWorkspaceHref({
    view: priorityAction.primaryView
  });
  const supplyDeskHref = buildProcurementWorkspaceHref({
    view: currentView
  });
  const supplyVisitLinkOptions: VisitWorkspaceLinkOptions = {
    returnLabel: "Back to supply",
    returnTo: supplyDeskHref
  };
  const lanes = [
    {
      count: workspace.summary.openRequests,
      helper: openRequestAttentionCount
        ? `${formatCount(openRequestAttentionCount, "request")} need a source path`
        : "New unblock intake",
      label: "Requests",
      value: "requests" as const
    },
    {
      count: workspace.summary.manualAttentionCount,
      helper: workspace.summary.manualAttentionCount ? "Need substitute or stock decision" : "No live gaps",
      label: "Attention",
      value: "attention" as const
    },
    {
      count: workspace.summary.openCarts,
      helper: workspace.summary.openCarts ? "Ready to commit for today" : "No staged orders",
      label: "Carts",
      value: "carts" as const
    },
    {
      count: workspace.summary.openPurchaseOrders,
      helper: workspace.summary.openPurchaseOrders ? "ETA risk in flight" : "No ETA drag",
      label: "Orders",
      value: "orders" as const
    },
    {
      count: providerAttentionCount,
      helper: providerAttentionCount ? "Setup to fix" : "Providers stable",
      label: "Setup",
      value: "setup" as const
    }
  ];
  const primaryLanes = lanes.filter((lane) => lane.value !== "setup");
  const setupLane = lanes.find((lane) => lane.value === "setup") ?? null;
  const primaryLaneCountTotal = primaryLanes.reduce((sum, lane) => sum + lane.count, 0);
  const substitutePathPressureCount =
    workspace.summary.manualAttentionCount + openRequestAttentionCount;
  const prioritySupplyThread = supplyDeskBlockers.supplyBlockedItems[0] ?? null;
  const priorityFinanceThread = supplyDeskBlockers.financeBlockedItems[0] ?? null;
  const priorityReleaseThread = supplyDeskBlockers.approvedReleaseItems[0] ?? null;
  const blockerJobsById = new Map(blockerJobs.map((job) => [job.id, job]));
  const blockerThreadContextByJobId = new Map(
    (blockerThreadContextResult.data ?? []).map((job) => [job.id, job])
  );
  const activeServiceThreadItem =
    prioritySupplyThread ?? priorityFinanceThread ?? priorityReleaseThread ?? null;
  const activeServiceThreadJob = activeServiceThreadItem
    ? {
        blockerJob: blockerJobsById.get(activeServiceThreadItem.jobId) ?? null,
        threadContext: blockerThreadContextByJobId.get(activeServiceThreadItem.jobId) ?? null
      }
    : null;
  const activeServiceThreadVisitHref = activeServiceThreadJob
    ? buildVisitThreadHref(activeServiceThreadJob.blockerJob?.id ?? activeServiceThreadItem?.jobId ?? "", supplyVisitLinkOptions)
    : null;
  const activeServiceThreadCustomerHref = activeServiceThreadJob
    ? activeServiceThreadJob.threadContext?.customer_id
      ? buildCustomerWorkspaceHref(activeServiceThreadJob.threadContext.customer_id)
      : null
    : null;
  const activeServiceThreadSiteHref = activeServiceThreadJob
    ? activeServiceThreadJob.threadContext?.customer_id
      ? buildCustomerWorkspaceHref(
          activeServiceThreadJob.threadContext.customer_id,
          activeServiceThreadJob.threadContext.service_site_id
            ? { editAddressId: activeServiceThreadJob.threadContext.service_site_id, tab: "addresses" }
            : { tab: "addresses" }
        )
      : null
    : activeServiceThreadCustomerHref;
  const hasHotThreadPressure = Boolean(
    prioritySupplyThread || priorityReleaseThread || priorityFinanceThread
  );
  const showProcurementThreadBar = hasHotThreadPressure || currentView !== "setup";
  const showCompactQueueClear =
    !hasHotThreadPressure &&
    currentView === "setup" &&
    primaryLaneCountTotal === 0;
  const serviceThreadCommand = prioritySupplyThread
    ? {
        badge: "Supply owned",
        copy: `${prioritySupplyThread.title} is the hottest blocked visit with ${prioritySupplyThread.supplyBlockerCount} open blocker${prioritySupplyThread.supplyBlockerCount === 1 ? "" : "s"}. ${
          substitutePathPressureCount
            ? `${formatCount(substitutePathPressureCount, "source-path gap")} still need supplier or substitute decisions.`
            : "Take the next unblock move there now."
        }`,
        primaryHref: buildVisitInventoryHref(prioritySupplyThread.jobId, supplyVisitLinkOptions),
        primaryLabel: "Unblock hottest thread",
        secondaryHref: "/dashboard/visits?scope=supply_blocked",
        secondaryLabel: "All blocked visits",
        title: "Blocked service thread",
        tone: "warning" as const
      }
    : priorityFinanceThread
      ? {
        badge: "Finance handoff",
        copy:
          priorityFinanceThread.financeHandoffSummary?.copy ??
          `${priorityFinanceThread.title} still has ${formatCurrencyFromCents(priorityFinanceThread.financeBalanceDueCents)} open after service. Supply is clear, but the thread still needs closeout.`,
        primaryHref: buildVisitInvoiceHref(priorityFinanceThread.jobId, supplyVisitLinkOptions),
        primaryLabel:
          priorityFinanceThread.openPaymentHandoffCount > 0 ? "Review field handoff" : "Open closeout thread",
        secondaryHref: "/dashboard/finance",
          secondaryLabel: "Finance desk",
          title: "Post-service follow-through",
          tone: "brand" as const
        }
      : priorityReleaseThread
        ? {
            badge: "Dispatch handoff",
            copy: `${priorityReleaseThread.title} is ready for field release. Supply is clear enough; move the release runway now before the promise softens.`,
            primaryHref: "/dashboard/visits?scope=ready_dispatch",
            primaryLabel: "Open release runway",
            secondaryHref: "/dashboard/dispatch",
            secondaryLabel: "Dispatch",
            title: "Release runway pressure",
            tone: "brand" as const
          }
        : {
            badge: "Threads aligned",
            copy: "Live unblock pressure is clear. Keep sourcing health tight without turning the desk into setup work.",
            primaryHref: "/dashboard/visits",
            primaryLabel: "Open visits",
            secondaryHref: "/dashboard/dispatch",
            secondaryLabel: "Dispatch",
            title: "Service-thread pressure",
            tone: "success" as const
          };
  const providerCards = [
    {
      badge:
        partstechAccount ? (
          <StatusBadge status={partstechAccount.status} />
        ) : (
          <Badge tone="warning">Not connected</Badge>
        ),
      description:
        findAttentionItem(integrationsWorkspace.attentionItems, "partstech") ??
        (partstechAccount?.status === "connected"
          ? "Connected and ready for aftermarket lookup."
          : "Connect PartsTech to keep aftermarket sourcing inside the desk."),
      href: "/dashboard/supply/integrations/partstech",
      label: partstechAccount?.displayName ?? "PartsTech",
      metric: `${formatCount(partstechActiveMappings, "live mapping")}`,
      secondaryMetric: partstechReviewCount
        ? `${formatCount(partstechReviewCount, "item")} need review`
        : "Mapping clear",
      title: "Aftermarket quotes"
    },
    {
      badge:
        repairLinkAccount ? (
          <StatusBadge status={repairLinkAccount.status} />
        ) : (
          <Badge tone="warning">Not connected</Badge>
        ),
      description:
        findAttentionItem(integrationsWorkspace.attentionItems, "repairlink") ??
        (repairLinkAccount?.status === "connected"
          ? "Connected and ready for dealer-backed OEM lookup."
          : "Connect RepairLink to keep OEM sourcing inside the same workflow."),
      href: "/dashboard/supply/integrations/repairlink",
      label: repairLinkAccount?.displayName ?? "RepairLink",
      metric: `${formatCount(repairLinkActiveMappings, "active mapping")}`,
      secondaryMetric: repairLinkPendingMappings
        ? `${formatCount(repairLinkPendingMappings, "mapping")} pending approval`
        : "Dealer coverage ready",
      title: "OEM quotes"
    },
    {
      badge:
        amazonBusinessAccount ? (
          <StatusBadge status={amazonBusinessAccount.status} />
        ) : (
          <Badge tone="warning">Not connected</Badge>
        ),
      description:
        findAttentionItem(integrationsWorkspace.attentionItems, "amazon business") ??
        (amazonBusinessAccount?.status === "connected"
          ? "Connected for tracked consumables and fallback sourcing."
          : "Connect Amazon Business to keep supply buying out of ad hoc re-entry."),
      href: "/dashboard/supply/integrations/amazon-business",
      label: amazonBusinessAccount?.displayName ?? "Amazon Business",
      metric: `${formatCount(supplyLists.length, "supply list")}`,
      secondaryMetric:
        amazonBusinessAccount?.status === "connected"
          ? "Fallback sourcing ready"
          : "Still relying on manual capture",
      title: "Supply sourcing"
    }
  ];
  const visibleProviderCards = providerCards;
  const hiddenProviderCards: typeof providerCards = [];
  const showPriorityReminder = currentView !== priorityAction.primaryView && !hasHotThreadPressure;
  const reorderDueCount = inventoryWorkspace.lowStockRows.filter(
    (row) => row.balance.reorderStatus === "reorder_due"
  ).length;
  const lowStockCount = inventoryWorkspace.summary.lowStockCount;
  const draftTransferCount = inventoryOperations.transferSummary.draftCount;
  const inTransitTransferCount = inventoryOperations.transferSummary.inTransitCount;
  const flaggedLocationCount = inventoryOperations.lowStockByLocation.filter(
    (location) => location.rowCount > 0
  ).length;
  const vanAttentionCount = inventoryOperations.vanSummaries.filter((summary) =>
    summary.balances.some((balance) => balance.reorderStatus !== "ok")
  ).length;
  const etaRiskCount = workspace.summary.openPurchaseOrders + reorderDueCount + draftTransferCount;
  const procurementThreadFacts = [
    {
      label: "Blocked now",
      value: supplyDeskBlockers.supplyBlockedCount
    },
    {
      label: "Source path",
      value: substitutePathPressureCount ? substitutePathPressureCount : "Covered"
    },
    {
      label: "ETA risk",
      value: etaRiskCount ? etaRiskCount : "Steady"
    },
    supplyDeskBlockers.approvedReleaseCount
      ? {
          label: "Release handoff",
          value: supplyDeskBlockers.approvedReleaseCount
        }
      : null,
    reorderDueCount + vanAttentionCount
      ? {
          label: "Stock pressure",
          value: reorderDueCount + vanAttentionCount
        }
      : null
  ].filter((fact): fact is { label: string; value: number | string } => Boolean(fact));
  const visibleProcurementThreadFacts =
    currentView === "setup"
      ? procurementThreadFacts.slice(0, 1)
      : procurementThreadFacts.slice(0, hasHotThreadPressure ? 2 : 1);
  const showInventoryBrief =
    reorderDueCount > 0 ||
    lowStockCount > 0 ||
    draftTransferCount > 0 ||
    inTransitTransferCount > 0 ||
    flaggedLocationCount > 0;
  const showSetupFoundationCard = currentView === "setup";
  const showSetupFoundationUtility =
    providerAttentionCount > 0 &&
    currentView !== "setup" &&
    !hasHotThreadPressure &&
    !prioritySupplyThread &&
    !priorityReleaseThread;
  const primarySupplySignal = substitutePathPressureCount
    ? {
        label: formatCount(substitutePathPressureCount, "source-path gap"),
        tone: "warning" as const
      }
    : etaRiskCount
      ? {
          label: formatCount(etaRiskCount, "ETA risk"),
          tone: "warning" as const
        }
      : providerAttentionCount
        ? {
            label: formatCount(providerAttentionCount, "setup issue"),
            tone: "warning" as const
          }
        : reorderDueCount
      ? {
          label: formatCount(reorderDueCount, "reorder-critical row"),
          tone: "warning" as const
        }
      : lowStockCount
        ? {
            label: formatCount(lowStockCount, "low-stock row"),
            tone: "neutral" as const
          }
        : null;
  const supplyPriorityAction = getSupplyPriorityAction({
    draftTransferCount,
    lowStockCount,
    manualAttentionCount: workspace.summary.manualAttentionCount,
    openCarts: workspace.summary.openCarts,
    openPurchaseOrders: workspace.summary.openPurchaseOrders,
    openRequests: workspace.summary.openRequests,
    providerAttentionCount,
    reorderDueCount,
    vanAttentionCount
  });
  const secondarySupplyAction = showInventoryBrief
    ? {
        href: buildSupplyInventoryHref({ view: "control" }),
        label: "Open stock control",
        tone: "secondary" as const
      }
    : currentView === "setup" || providerAttentionCount > 0
      ? {
          href: buildProcurementWorkspaceHref({ view: "setup" }),
          label: "Open sourcing setup",
          tone: "secondary" as const
        }
      : {
          href: serviceThreadCommand.secondaryHref,
          label: serviceThreadCommand.secondaryLabel,
          tone: "tertiary" as const
        };
  const setupProviderPanel = (
    <Card className="procurement-panel" tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Provider readiness</CardEyebrow>
          <CardTitle>Provider coverage</CardTitle>
          <CardDescription>
            Keep only the live provider gaps visible here. Everything else stays foundation-side.
          </CardDescription>
        </CardHeaderContent>
        <Badge tone={providerAttentionCount ? "warning" : "brand"}>
          {providerAttentionCount ? formatCount(providerAttentionCount, "issue") : "Stable"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="procurement-provider-stack">
          {visibleProviderCards.map((provider) => (
            <article className="procurement-provider-card" key={provider.title}>
              <div className="procurement-provider-card__header">
                <div>
                  <p className="procurement-provider-card__eyebrow">{provider.label}</p>
                  <h3 className="procurement-provider-card__title">{provider.title}</h3>
                </div>
                {provider.badge}
              </div>
              <p className="procurement-provider-card__description">{provider.description}</p>
              <div className="procurement-provider-card__metrics">
                <div>
                  <span>Readiness</span>
                  <strong>{provider.metric}</strong>
                </div>
                <div>
                  <span>Watch next</span>
                  <strong>{provider.secondaryMetric}</strong>
                </div>
              </div>
              <Link
                className={buttonClassName({ size: "sm", tone: "ghost" })}
                href={provider.href}
              >
                Open provider
              </Link>
            </article>
          ))}
        </div>
        {hiddenProviderCards.length ? (
          <div className="procurement-setup-health__grid">
            <div>
              <span>Fallback providers</span>
              <strong>{hiddenProviderCards.length}</strong>
            </div>
            <div>
              <span>Providers ready</span>
              <strong>{connectedProviderCount}/3</strong>
            </div>
            <div>
              <span>Setup issues</span>
              <strong>{providerAttentionCount}</strong>
            </div>
          </div>
        ) : null}
        {hiddenProviderCards.length ? (
          <div className="procurement-action-stack">
            <Link
              className={buttonClassName({ size: "sm", tone: "ghost" })}
              href="/dashboard/supply/integrations"
            >
              Open integrations
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const setupSupplyListsPanel = (
    <Card className="procurement-panel" tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Repeatable stock kits</CardEyebrow>
          <CardTitle>Supply lists</CardTitle>
          <CardDescription>
            Keep repeatable consumables ready so common work starts from structure instead of re-entry.
          </CardDescription>
        </CardHeaderContent>
        <Badge tone="neutral">{formatCount(supplyLists.length, "list")}</Badge>
      </CardHeader>
      <CardContent>
        {supplyLists.length ? (
          <div className="procurement-supply-list">
            {supplyLists.slice(0, 4).map((list) => (
              <article className="procurement-supply-list__item" key={list.id}>
                <div>
                  <p className="procurement-provider-card__eyebrow">
                    {list.isActive ? "Active list" : "Inactive list"}
                  </p>
                  <h3 className="procurement-provider-card__title">{list.name}</h3>
                  <p className="procurement-provider-card__description">
                    {list.description || "Reusable consumables ready to seed into a request."}
                  </p>
                </div>
                <Link
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={`/dashboard/supply/supplies/${list.id}`}
                >
                  Open list
                </Link>
              </article>
            ))}
            <Link
              className={buttonClassName({ size: "sm", tone: "secondary" })}
              href="/dashboard/supply/supplies"
            >
              Manage supply lists
            </Link>
          </div>
        ) : (
          <EmptyState
            className="procurement-empty-state"
            eyebrow="No supply lists"
            title="Reusable supply kits are not set up yet"
            description="Create supply lists for repeated consumables so common work starts from structure instead of manual re-entry."
            tone="info"
            actions={
              <Link
                className={buttonClassName({ tone: "secondary" })}
                href="/dashboard/supply/supplies"
              >
                Open supply lists
              </Link>
            }
          />
        )}
      </CardContent>
    </Card>
  );

  const setupRoutingPanel = (
    <Card className="procurement-panel procurement-panel--setup-summary" tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Routing foundation</CardEyebrow>
          <CardTitle>Keep sourcing fallback clean</CardTitle>
          <CardDescription>
            Only work setup when provider coverage, supplier routing, or repeat kits are slipping
            into today&apos;s unblock flow.
          </CardDescription>
        </CardHeaderContent>
        <Badge tone={providerAttentionCount ? "warning" : "neutral"}>
          {providerAttentionCount ? "Needs review" : "Stable"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="procurement-setup-health__grid procurement-setup-health__grid--compact">
          <div>
            <span>Providers ready</span>
            <strong>{connectedProviderCount}/3</strong>
          </div>
          <div>
            <span>Supplier accounts</span>
            <strong>{supplierAccounts.length}</strong>
          </div>
          <div>
            <span>Supply lists</span>
            <strong>{supplyLists.length}</strong>
          </div>
        </div>
        <div className="procurement-action-stack procurement-action-stack--compact">
          <Link
            className={buttonClassName({ size: "sm", tone: "secondary" })}
            href="/dashboard/supply/integrations"
          >
            Open integrations
          </Link>
          <Link
            className={buttonClassName({ size: "sm", tone: "ghost" })}
            href="/dashboard/supply/suppliers"
          >
            Supplier routing
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  const activeLaneContent =
    currentView === "requests" ? (
      <Card className="procurement-panel procurement-panel--queue procurement-panel--active-lane" tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Sourcing intake</CardEyebrow>
            <CardTitle>Visit unblock intake</CardTitle>
            <CardDescription>
              Work the newest visit blockers first. Requests stay here until a supplier path,
              substitute path, or ordering path is in place.
            </CardDescription>
          </CardHeaderContent>
          <Badge tone={workspace.summary.openRequests ? "brand" : "neutral"}>
            {formatCount(workspace.summary.openRequests, "open request")}
          </Badge>
        </CardHeader>
        <CardContent>
          {workspace.openRequests.length ? (
            <div className="procurement-list procurement-list--queue procurement-list--workspace">
              {workspace.openRequests.map((request) => {
                const uncoveredLines = manualAttentionByRequestId.get(request.id) ?? 0;

                return (
                  <article
                    className="procurement-list__item procurement-list__item--request"
                    key={request.id}
                  >
                    <div className="procurement-list__main">
                      <div className="procurement-list__identity">
                        <p className="procurement-list__eyebrow">
                          Request {formatReference(request.id)}
                        </p>
                        <h3 className="procurement-list__title">
                          {formatDesignLabel(request.origin)} request
                        </h3>
                        <p className="procurement-list__description">
                          Updated{" "}
                          {formatDateTime(request.updatedAt, {
                            timeZone: context.company.timezone
                          })}
                        </p>
                      </div>
                      <div className="procurement-list__meta">
                        <Badge tone="neutral">{formatDesignLabel(request.origin)}</Badge>
                        {uncoveredLines ? (
                          <Badge tone="warning">
                            {formatCount(uncoveredLines, "uncovered line")}
                          </Badge>
                        ) : (
                          <Badge tone="brand">Coverage moving</Badge>
                        )}
                        <StatusBadge status={request.status} />
                      </div>
                    </div>
                    <div className="procurement-list__actions">
                      <Link
                        className={buttonClassName({ size: "sm", tone: "secondary" })}
                        href={`/dashboard/supply/requests/${request.id}`}
                      >
                        Open request
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="procurement-empty-state"
              eyebrow="Requests clear"
              title="No sourcing intake is open"
              description="Start from the live visit thread when new parts demand appears."
              tone="success"
              actions={
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href="/dashboard/visits"
                >
                  Open visits
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>
    ) : currentView === "attention" ? (
      <Card
        className="procurement-panel procurement-panel--attention procurement-panel--active-lane"
        tone="raised"
      >
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Unblock now</CardEyebrow>
            <CardTitle>Substitute path and source gaps</CardTitle>
            <CardDescription>
              These lines still need a supplier, substitute, or stock decision before the visit can
              move.
            </CardDescription>
          </CardHeaderContent>
          <Badge tone={workspace.summary.manualAttentionCount ? "warning" : "neutral"}>
            {formatCount(workspace.summary.manualAttentionCount, "open line")}
          </Badge>
        </CardHeader>
        <CardContent>
          {workspace.manualAttentionLines.length ? (
            <div className="procurement-list procurement-list--attention procurement-list--workspace">
              {workspace.manualAttentionLines.map((line) => (
                <article
                  className="procurement-list__item procurement-list__item--attention"
                  key={line.id}
                >
                  <div className="procurement-list__main">
                    <div className="procurement-list__identity">
                      <p className="procurement-list__eyebrow">
                        Request {formatReference(line.part_request_id)}
                      </p>
                      <h3 className="procurement-list__title">{line.description}</h3>
                      <p className="procurement-list__description">
                        Visit {formatReference(line.job_id)} still needs a substitute or supplier path.
                      </p>
                    </div>
                    <div className="procurement-list__meta">
                      <Badge tone="warning">Manual routing</Badge>
                      <StatusBadge status={line.status} />
                    </div>
                  </div>
                  <div className="procurement-list__actions">
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={`/dashboard/supply/requests/${line.part_request_id}`}
                    >
                      Open request
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              className="procurement-empty-state"
              eyebrow="Attention clear"
              title="No source-path gap is open"
              description="Every visible line already has coverage or an ordering path."
              tone="success"
            />
          )}
        </CardContent>
      </Card>
    ) : currentView === "carts" ? (
      <Card className="procurement-panel procurement-panel--active-lane" tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Ordering handoff</CardEyebrow>
            <CardTitle>Supplier carts ready to release</CardTitle>
            <CardDescription>
              Routed demand is grouped here by supplier so ordering stays traceable and easier to work.
            </CardDescription>
          </CardHeaderContent>
          <Badge tone={workspace.summary.openCarts ? "brand" : "neutral"}>
            {formatCount(workspace.summary.openCarts, "open cart")}
          </Badge>
        </CardHeader>
        <CardContent>
          {workspace.openCarts.length ? (
            <div className="procurement-list procurement-list--workspace">
              {workspace.openCarts.map((cart) => (
                <article className="procurement-list__item" key={cart.id}>
                  <div className="procurement-list__main">
                    <div className="procurement-list__identity">
                      <p className="procurement-list__eyebrow">{cart.sourceBucketKey}</p>
                      <h3 className="procurement-list__title">
                        {supplierAccountsById.get(cart.supplierAccountId)?.name ?? "Unknown supplier"}
                      </h3>
                      <p className="procurement-list__description">
                        Cart {formatReference(cart.id)} grouped for supplier-side ordering.
                      </p>
                    </div>
                    <div className="procurement-list__meta">
                      <Badge tone="neutral">{cart.sourceBucketKey}</Badge>
                      <StatusBadge status={cart.status} />
                    </div>
                  </div>
                  <div className="procurement-list__actions">
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={`/dashboard/supply/carts/${cart.id}`}
                    >
                      Open cart
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              className="procurement-empty-state"
              eyebrow="Cart queue clear"
              title="No supplier cart is waiting"
              description="Grouped ordering work will reappear here once routed demand is ready to commit."
              tone="success"
            />
          )}
        </CardContent>
      </Card>
    ) : currentView === "orders" ? (
      <Card className="procurement-panel procurement-panel--active-lane" tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Receiving and returns</CardEyebrow>
            <CardTitle>Purchase orders in flight</CardTitle>
            <CardDescription>
              Track ordering, receiving, install handoff, and ETA risk here before promised work
              starts to soften.
            </CardDescription>
          </CardHeaderContent>
          <Badge tone={workspace.summary.openPurchaseOrders ? "brand" : "neutral"}>
            {formatCount(workspace.summary.openPurchaseOrders, "active order")}
          </Badge>
        </CardHeader>
        <CardContent>
          {workspace.openPurchaseOrders.length ? (
            <div className="procurement-list procurement-list--workspace">
              {workspace.openPurchaseOrders.map((purchaseOrder) => (
                <article className="procurement-list__item" key={purchaseOrder.id}>
                  <div className="procurement-list__main">
                    <div className="procurement-list__identity">
                      <p className="procurement-list__eyebrow">{purchaseOrder.poNumber}</p>
                      <h3 className="procurement-list__title">
                        PO {formatReference(purchaseOrder.id)}
                      </h3>
                      <p className="procurement-list__description">
                        Updated{" "}
                        {formatDateTime(purchaseOrder.updatedAt, {
                          timeZone: context.company.timezone
                        })}
                      </p>
                    </div>
                    <div className="procurement-list__meta">
                      <Badge tone="neutral">Receiving workflow</Badge>
                      <StatusBadge status={purchaseOrder.status} />
                    </div>
                  </div>
                  <div className="procurement-list__actions">
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={`/dashboard/supply/purchase-orders/${purchaseOrder.id}`}
                    >
                      Open order
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              className="procurement-empty-state"
              eyebrow="Orders clear"
              title="No purchase order is in flight"
              description="Open orders return here when ETA risk or receiving starts to affect a live visit."
              tone="success"
            />
          )}
        </CardContent>
      </Card>
    ) : (
      <div className="procurement-compact-stack procurement-compact-stack--setup">
        {setupProviderPanel}
        {setupSupplyListsPanel}
        {setupRoutingPanel}
      </div>
    );

  const showWorkspaceRail =
    showPriorityReminder ||
    (showInventoryBrief && !hasHotThreadPressure) ||
    (!showSetupFoundationCard && showSetupFoundationUtility);

  return (
    <Page
      className={`procurement-page${showSetupFoundationCard ? " procurement-page--setup" : ""}`}
      layout="command"
    >
      <div className="procurement-workspace">
        {showProcurementThreadBar ? (
        <section className="procurement-thread-bar">
          <div className="procurement-thread-bar__copy">
            <div className="procurement-thread-bar__heading">
              <p className="procurement-thread-bar__eyebrow">Unblock now</p>
              <div className="procurement-thread-bar__signals">
                <Badge tone={serviceThreadCommand.tone}>{serviceThreadCommand.badge}</Badge>
                {primarySupplySignal ? (
                  <Badge tone={primarySupplySignal.tone}>{primarySupplySignal.label}</Badge>
                ) : null}
              </div>
            </div>
            <p className="procurement-thread-bar__summary">
              <strong>{serviceThreadCommand.title}</strong> {serviceThreadCommand.copy}
            </p>
            <div className="procurement-thread-bar__facts">
              {visibleProcurementThreadFacts.map((fact) => (
                <div className="procurement-thread-bar__fact" key={fact.label}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="procurement-thread-bar__actions">
            <Link className={buttonClassName()} href={serviceThreadCommand.primaryHref}>
              {serviceThreadCommand.primaryLabel}
            </Link>
            {secondarySupplyAction.href !== serviceThreadCommand.primaryHref &&
            (hasHotThreadPressure || currentView === "setup") ? (
              <Link
                className={buttonClassName({ tone: secondarySupplyAction.tone })}
                href={secondarySupplyAction.href}
              >
                {secondarySupplyAction.label}
              </Link>
            ) : activeServiceThreadVisitHref ? (
              <Link className={buttonClassName({ tone: "secondary" })} href={activeServiceThreadVisitHref}>
                Open visit thread
              </Link>
            ) : activeServiceThreadCustomerHref ? (
              <Link className={buttonClassName({ tone: "secondary" })} href={activeServiceThreadCustomerHref}>
                Open customer thread
              </Link>
            ) : activeServiceThreadSiteHref ? (
              <Link className={buttonClassName({ tone: "secondary" })} href={activeServiceThreadSiteHref}>
                Open site thread
              </Link>
            ) : null}
          </div>
        </section>
        ) : null}

        {!(showCompactQueueClear || currentView === "setup") ? (
          <section className="procurement-focus procurement-focus--compact">
            <div aria-label="Procurement lanes" className="procurement-lane-strip">
              {primaryLanes.map((lane) => {
                const isActive = lane.value === currentView;

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`procurement-lane-card${isActive ? " procurement-lane-card--active" : ""}`}
                    href={buildProcurementWorkspaceHref({ view: lane.value })}
                    key={lane.value}
                  >
                    <span>{lane.label}</span>
                    <strong>{lane.count}</strong>
                    <p>{lane.helper}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className={`procurement-desk${showWorkspaceRail ? "" : " procurement-desk--rail-hidden"}`}>
          <div className="procurement-desk__primary procurement-desk__primary--workspace">
            {activeLaneContent}
          </div>

          {showWorkspaceRail ? (
          <aside className="procurement-desk__rail procurement-desk__rail--workspace">
            {showPriorityReminder ? (
              <div className="procurement-rail-utility procurement-rail-utility--attention">
                <div className="procurement-rail-utility__copy">
                  <p className="procurement-rail-utility__label">{priorityAction.eyebrow}</p>
                  <strong className="procurement-rail-utility__title">{priorityAction.title}</strong>
                  <p className="procurement-rail-utility__description">{priorityAction.description}</p>
                </div>
                <div className="procurement-rail-utility__actions">
                  <Link className={buttonClassName({ tone: "secondary" })} href={priorityHref}>
                    {priorityAction.primaryLabel}
                  </Link>
                </div>
              </div>
            ) : null}

            {showInventoryBrief && !hasHotThreadPressure ? (
              reorderDueCount ? (
                <div className="procurement-rail-utility">
                  <div className="procurement-rail-utility__copy">
                    <p className="procurement-rail-utility__label">Stock control</p>
                    <strong className="procurement-rail-utility__title">
                      Reorder pressure can still slip promised installs
                    </strong>
                    <p className="procurement-rail-utility__description">
                      Only leave unblock-now when stock pressure is materially changing today&apos;s
                      substitute-path or ETA-risk decisions.
                    </p>
                    <div className="procurement-rail-utility__facts">
                      <span>Reorder due {reorderDueCount}</span>
                      <span>Transfers {inTransitTransferCount + draftTransferCount}</span>
                      <span>Location alerts {flaggedLocationCount}</span>
                    </div>
                  </div>
                  <div className="procurement-rail-utility__actions">
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={buildSupplyInventoryHref({ lowStock: true, view: lowStockCount ? "catalog" : "control" })}
                    >
                      Review low stock
                    </Link>
                    <Link
                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                      href={buildSupplyInventoryHref({ view: "movement" })}
                    >
                      Transfers
                    </Link>
                  </div>
                </div>
              ) : (
                <details className="procurement-lane-utility procurement-lane-utility--compact">
                  <summary className="procurement-lane-utility__summary">
                    <strong>Stock control</strong>
                    <small>
                      {lowStockCount
                        ? "Low stock is visible but not owning the desk"
                        : "Transfers and location alerts stay utility-side"}
                    </small>
                  </summary>
                  <div className="procurement-lane-utility__body">
                    <Link
                      className="procurement-lane-utility__link"
                      href={buildSupplyInventoryHref({ lowStock: true, view: lowStockCount ? "catalog" : "control" })}
                    >
                      <strong>{lowStockCount ? "Review low stock" : "Open inventory"}</strong>
                      <span>
                        Transfers {inTransitTransferCount + draftTransferCount} · Alerts {flaggedLocationCount}
                      </span>
                    </Link>
                    <Link
                      className="procurement-lane-utility__link"
                      href={buildSupplyInventoryHref({ view: "movement" })}
                    >
                      <strong>Transfers</strong>
                      <span>Keep movement activity utility-side until live installs are at risk.</span>
                    </Link>
                  </div>
                </details>
              )
            ) : null}

            {!showSetupFoundationCard && showSetupFoundationUtility ? (
              <div className="procurement-rail-utility procurement-rail-utility--foundation">
                <div className="procurement-rail-utility__copy">
                  <p className="procurement-rail-utility__label">Routing foundation</p>
                  <strong className="procurement-rail-utility__title">Setup only when live sourcing is slipping</strong>
                  <p className="procurement-rail-utility__description">
                    Provider coverage, supplier routing, or repeat kits only belong in view when they are actively blocking today&apos;s unblock flow.
                  </p>
                </div>
                <div className="procurement-rail-utility__actions">
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href={buildProcurementWorkspaceHref({ view: "setup" })}
                  >
                    Open sourcing setup
                  </Link>
                </div>
              </div>
            ) : null}
          </aside>
          ) : null}
        </section>
      </div>
    </Page>
  );
}

export default SupplyWorkspacePageImpl;
