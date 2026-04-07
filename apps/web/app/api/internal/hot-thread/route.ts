import {
  getCustomerById,
  getEstimateByJobId,
  getInspectionByJobId,
  getInvoiceDetailById,
  getInvoiceByJobId,
  getJobById,
  getVehicleById,
  listAddressesByCustomer,
  listAttachmentsByJob,
  listCustomerCommunications,
  listJobCommunications,
  listJobNotesByJob,
  listServiceHistoryJobsForCustomer,
  listVehiclesByCustomer
} from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  formatDateTime,
  formatServiceAddressSummary,
  getCustomerDisplayName,
  getVehicleDisplayName
} from "@mobile-mechanic/core";
import type { CustomerAddress, Database } from "@mobile-mechanic/types";
import { NextResponse } from "next/server";

import { getCompanyContextResult, requireCompanyContext } from "../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import {
  getCustomerPromiseSummary,
  getCustomerTrustSummary,
  getVisitPromiseSummary,
  getVisitReadinessSummary,
  getVisitTrustSummary
} from "../../../../lib/jobs/operational-health";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveVisitRouteConfidenceSnapshot,
  deriveReleaseRunwayState,
  hasServiceSitePlaybook,
  type ActiveServiceThread
} from "../../../../lib/service-thread/continuity";
import {
  buildVisitDetailHref,
  buildVisitEstimateHref,
  buildVisitInventoryHref,
  buildVisitInvoiceEditHref,
  buildVisitInvoiceHref,
  buildVisitThreadHref
} from "../../../../lib/visits/workspace";

export const runtime = "nodejs";

type HotThreadTone = "brand" | "danger" | "neutral" | "success" | "warning";
type HotThreadActionTone = "ghost" | "primary" | "secondary" | "tertiary";
type HotThreadJumpId = "customer" | "dispatch" | "finance" | "site" | "visit";

type HotThreadBadge = {
  label: string;
  tone: HotThreadTone;
};

type HotThreadAction = {
  href: string;
  label: string;
  tone: HotThreadActionTone;
};

type HotThreadMutation = {
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
};

type HotThreadItem = {
  copy?: string;
  href?: string;
  label: string;
  value: string;
};

type HotThreadLedgerItem = {
  copy: string;
  label: string;
  tone: HotThreadTone;
  value: string;
};

type HotThreadSection = {
  description?: string;
  id: string;
  items: HotThreadItem[];
  label: string;
};

type HotThreadPayload = {
  activeThread: ActiveServiceThread;
  actions: HotThreadAction[];
  badges: HotThreadBadge[];
  caseItems: HotThreadItem[];
  description: string;
  eyebrow: string;
  jumps: Array<{
    href: string;
    id: HotThreadJumpId;
    label: string;
  }>;
  kind: "customer" | "invoice" | "visit";
  ledger: HotThreadLedgerItem[];
  mutations: HotThreadMutation[];
  nextMove: {
    copy: string;
    href: string;
    label: string;
    tone: HotThreadTone;
  } | null;
  sections: HotThreadSection[];
  subtitle: string;
  title: string;
};

type ThreadEstimateRow = Pick<
  Database["public"]["Tables"]["estimates"]["Row"],
  "status"
>;

type ThreadInventoryIssueRow = Pick<
  Database["public"]["Tables"]["job_inventory_issues"]["Row"],
  "job_id" | "status"
>;

type ThreadInvoiceRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  "balance_due_cents" | "job_id" | "status"
>;

type ThreadPartRequestRow = Pick<
  Database["public"]["Tables"]["part_requests"]["Row"],
  "job_id" | "status"
>;

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function isClosedJobStatus(status: string) {
  return status === "completed" || status === "canceled";
}

function formatThreadDate(value: string | null | undefined, timeZone: string, fallback: string) {
  return formatDateTime(value ?? null, {
    fallback,
    timeZone
  });
}

function formatSiteName(
  address:
    | Pick<
        CustomerAddress,
        | "accessWindowNotes"
        | "city"
        | "gateCode"
        | "id"
        | "isPrimary"
        | "label"
        | "line1"
        | "line2"
        | "parkingNotes"
        | "postalCode"
        | "serviceContactName"
        | "serviceContactPhone"
        | "siteName"
        | "state"
      >
    | null
    | undefined
) {
  if (!address) {
    return "No service site";
  }

  return address.siteName ?? address.label ?? address.line1 ?? "Service site";
}

function formatSiteAddress(
  address:
    | Pick<CustomerAddress, "city" | "line1" | "line2" | "postalCode" | "state">
    | null
    | undefined
) {
  return formatServiceAddressSummary(
    address
      ? {
          city: address.city,
          line1: address.line1,
          line2: address.line2,
          postalCode: address.postalCode,
          state: address.state
        }
      : null
  );
}

function buildVisitsSearchHref(query: string) {
  return `/dashboard/visits?query=${encodeURIComponent(query)}`;
}

function buildFinanceSearchHref(query: string) {
  return `/dashboard/finance?query=${encodeURIComponent(query)}`;
}

function buildThreadPrimaryDesk(input: {
  fallbackHref: string;
  fallbackLabel: string;
  nextMoveHref?: string | null;
}) {
  const href = input.nextMoveHref ?? input.fallbackHref;

  if (href.startsWith("/dashboard/dispatch")) {
    return {
      href,
      id: "dispatch" as const,
      label: "Dispatch"
    };
  }

  if (href.startsWith("/dashboard/finance")) {
    return {
      href,
      id: "finance" as const,
      label: "Finance"
    };
  }

  if (href.startsWith("/dashboard/customers")) {
    return {
      href,
      id: "customers" as const,
      label: "Customers"
    };
  }

  if (href.startsWith("/dashboard/fleet")) {
    return {
      href,
      id: "fleet" as const,
      label: "Fleet"
    };
  }

  if (href.startsWith("/dashboard/supply") || href.startsWith("/dashboard/parts")) {
    return {
      href,
      id: "supply" as const,
      label: "Supply"
    };
  }

  return {
    href,
    id: "visits" as const,
    label: input.fallbackLabel
  };
}

function getSiteLedgerItem(
  site:
    | Pick<
        CustomerAddress,
        | "accessWindowNotes"
        | "gateCode"
        | "parkingNotes"
        | "serviceContactName"
        | "serviceContactPhone"
        | "siteName"
      >
    | null
    | undefined
): HotThreadLedgerItem {
  const hasSitePlaybook = hasServiceSitePlaybook(site);

  return {
    copy: hasSitePlaybook
      ? site?.accessWindowNotes ??
        site?.parkingNotes ??
        site?.gateCode ??
        site?.serviceContactName ??
        "Site access memory is attached to this thread."
      : "Site access memory is still missing, so dispatch and field handoff are relying on thinner context than they should.",
    label: "Site thread",
    tone: hasSitePlaybook ? "success" : "warning",
    value: hasSitePlaybook ? "Playbook live" : "Needs site playbook"
  };
}

function getVisitCommercialLedgerItem(args: {
  estimate: ThreadEstimateRow | null;
  invoiceBalanceDueCents: number;
  invoiceStatus: string | null;
}): HotThreadLedgerItem {
  if (
    args.invoiceStatus &&
    args.invoiceStatus !== "paid" &&
    args.invoiceStatus !== "void" &&
    args.invoiceBalanceDueCents > 0
  ) {
    return {
      copy: `${formatCurrencyFromCents(args.invoiceBalanceDueCents)} is still open after field work, so the thread is not actually closed yet.`,
      label: "Closeout ledger",
      tone: "brand",
      value: "Balance open"
    };
  }

  if (args.estimate?.status === "sent") {
    return {
      copy: "Approval is still pending, so release is waiting on customer follow-through instead of routing.",
      label: "Approval ledger",
      tone: "warning",
      value: "Approval pending"
    };
  }

  if (args.estimate?.status === "accepted") {
    return {
      copy: "Commercial approval is done. Release to dispatch is the next thread move.",
      label: "Release ledger",
      tone: "brand",
      value: "Ready for dispatch"
    };
  }

  return {
    copy: "No approval or billing drag is dominating this visit thread right now.",
    label: "Commercial ledger",
    tone: "success",
    value: "Thread clear"
  };
}

function getCustomerCommercialLedgerItem(args: {
  openBalanceCents: number;
  pendingApprovalCount: number;
}): HotThreadLedgerItem {
  if (args.openBalanceCents > 0) {
    return {
      copy: `${formatCurrencyFromCents(args.openBalanceCents)} is still open across this relationship, so closeout drag is part of the live thread.`,
      label: "Closeout ledger",
      tone: "brand",
      value: "Balance open"
    };
  }

  if (args.pendingApprovalCount > 0) {
    return {
      copy: `${args.pendingApprovalCount} approval${args.pendingApprovalCount === 1 ? "" : "s"} are still waiting on customer follow-through.`,
      label: "Approval ledger",
      tone: "warning",
      value: `${args.pendingApprovalCount} pending`
    };
  }

  return {
    copy: "No approval or billing drag is outranking routine relationship support right now.",
    label: "Commercial ledger",
    tone: "success",
    value: "Relationship clear"
  };
}

function getInvoiceContinuityLedgerItem(args: {
  balanceDueCents: number;
  invoiceStatus: string;
}): HotThreadLedgerItem {
  if (args.balanceDueCents > 0 && args.invoiceStatus !== "paid" && args.invoiceStatus !== "void") {
    return {
      copy: `${formatCurrencyFromCents(args.balanceDueCents)} is still open, so collections remain part of the active service thread.`,
      label: "Closeout ledger",
      tone: "brand",
      value: "Balance open"
    };
  }

  if (args.invoiceStatus === "draft") {
    return {
      copy: "Billing is still being assembled, so the closeout file is not ready to be treated as finished.",
      label: "Closeout ledger",
      tone: "warning",
      value: "Draft closeout"
    };
  }

  return {
    copy: "The billing file is no longer the continuity problem on this service thread.",
    label: "Closeout ledger",
    tone: "success",
    value: "Closed"
  };
}

type HotThreadContext = Awaited<ReturnType<typeof requireCompanyContext>>;

async function buildVisitPayload(_input: {
  context: HotThreadContext;
  jobId: string;
}) {
  const input = _input;
  const jobResult = await getJobById(input.context.supabase, input.jobId);

  if (jobResult.error || !jobResult.data) {
    return NextResponse.json({ error: "Visit not found." }, { status: 404 });
  }

  if (jobResult.data.companyId !== input.context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = jobResult.data;
  const [
    customerResult,
    vehicleResult,
    addressesResult,
    estimateResult,
    invoiceResult,
    inspectionResult,
    attachmentsResult,
    notesResult,
    communicationsResult,
    openPartRequestsResult,
    inventoryIssuesResult
  ] = await Promise.all([
    getCustomerById(input.context.supabase, job.customerId),
    getVehicleById(input.context.supabase, job.vehicleId),
    listAddressesByCustomer(input.context.supabase, job.customerId),
    getEstimateByJobId(input.context.supabase, job.id),
    getInvoiceByJobId(input.context.supabase, job.id),
    getInspectionByJobId(input.context.supabase, job.id),
    listAttachmentsByJob(input.context.supabase, job.id),
    listJobNotesByJob(input.context.supabase, job.id),
    listJobCommunications(input.context.supabase, job.id, { limit: 6 }),
    input.context.supabase
      .from("part_requests")
      .select("job_id, status")
      .eq("company_id", input.context.companyId)
      .eq("status", "open")
      .eq("job_id", job.id)
      .returns<ThreadPartRequestRow[]>(),
    input.context.supabase
      .from("job_inventory_issues")
      .select("job_id, status")
      .eq("company_id", input.context.companyId)
      .eq("job_id", job.id)
      .returns<ThreadInventoryIssueRow[]>()
  ]);

  if (customerResult.error || !customerResult.data) {
    return NextResponse.json(
      { error: customerResult.error?.message ?? "Customer not found." },
      { status: 400 }
    );
  }

  if (vehicleResult.error || !vehicleResult.data) {
    return NextResponse.json(
      { error: vehicleResult.error?.message ?? "Vehicle not found." },
      { status: 400 }
    );
  }

  if (addressesResult.error) {
    return NextResponse.json({ error: addressesResult.error.message }, { status: 400 });
  }

  if (estimateResult.error) {
    return NextResponse.json({ error: estimateResult.error.message }, { status: 400 });
  }

  if (invoiceResult.error) {
    return NextResponse.json({ error: invoiceResult.error.message }, { status: 400 });
  }

  if (inspectionResult.error) {
    return NextResponse.json({ error: inspectionResult.error.message }, { status: 400 });
  }

  if (attachmentsResult.error) {
    return NextResponse.json({ error: attachmentsResult.error.message }, { status: 400 });
  }

  if (notesResult.error) {
    return NextResponse.json({ error: notesResult.error.message }, { status: 400 });
  }

  if (communicationsResult.error) {
    return NextResponse.json({ error: communicationsResult.error.message }, { status: 400 });
  }

  if (openPartRequestsResult.error) {
    return NextResponse.json({ error: openPartRequestsResult.error.message }, { status: 400 });
  }

  if (inventoryIssuesResult.error) {
    return NextResponse.json({ error: inventoryIssuesResult.error.message }, { status: 400 });
  }

  const invoiceDetailResult = invoiceResult.data
    ? await getInvoiceDetailById(input.context.supabase, invoiceResult.data.id)
    : null;

  if (invoiceDetailResult?.error) {
    return NextResponse.json({ error: invoiceDetailResult.error.message }, { status: 400 });
  }

  const serviceSite =
    (job.serviceSiteId
      ? (addressesResult.data ?? []).find((address) => address.id === job.serviceSiteId) ?? null
      : null) ??
    (addressesResult.data ?? []).find((address) => address.isPrimary) ??
    (addressesResult.data ?? [])[0] ??
    null;
  const customerName = getCustomerDisplayName(customerResult.data);
  const vehicleName = getVehicleDisplayName(vehicleResult.data);
  const communications = communicationsResult.data ?? [];
  const estimate = estimateResult.data;
  const invoice = invoiceResult.data;
  const invoiceBalanceDueCents =
    invoiceDetailResult?.data?.totals.balanceDueCents ?? invoice?.balanceDueCents ?? 0;
  const promiseSummary = getVisitPromiseSummary({
    communications,
    job: {
      arrivalWindowStartAt: job.arrivalWindowStartAt,
      assignedTechnicianUserId: job.assignedTechnicianUserId,
      scheduledStartAt: job.scheduledStartAt,
      status: job.status
    }
  });
  const readinessSummary = getVisitReadinessSummary({
    communications,
    estimate,
    inspectionStatus: inspectionResult.data?.status ?? null,
    inventoryIssueCount: inventoryIssuesResult.data?.length ?? 0,
    invoice,
    job: {
      arrivalWindowStartAt: job.arrivalWindowStartAt,
      assignedTechnicianUserId: job.assignedTechnicianUserId,
      scheduledStartAt: job.scheduledStartAt,
      status: job.status
    },
    noteCount: notesResult.data?.length ?? 0,
    openPartRequestCount: openPartRequestsResult.data?.length ?? 0,
    photoCount: attachmentsResult.data?.length ?? 0
  });
  const trustSummary = getVisitTrustSummary({
    communications,
    estimate,
    invoice: invoice
      ? {
          balanceDueCents: invoiceBalanceDueCents,
          status: invoice.status
        }
      : null,
    job: {
      arrivalWindowStartAt: job.arrivalWindowStartAt,
      assignedTechnicianUserId: job.assignedTechnicianUserId,
      scheduledStartAt: job.scheduledStartAt,
      status: job.status
    }
  });
  const dispatchHref = `/dashboard/dispatch?jobId=${job.id}`;
  const visitHref = buildVisitThreadHref(job.id);
  const customerHref = buildCustomerWorkspaceHref(customerResult.data.id);
  const communicationsEndpoint = `/api/internal/jobs/${job.id}/communications`;
  const commercialHref = invoice
    ? invoice.status === "draft"
      ? buildVisitInvoiceEditHref(job.id)
      : buildVisitInvoiceHref(job.id)
    : buildVisitEstimateHref(job.id, {
        autostart: !estimate,
        workspace: true
      });
  const nextMove =
    promiseSummary.breachRisk === "high" || promiseSummary.recommendedAction === "set_promise"
      ? {
          copy: promiseSummary.copy,
          href: dispatchHref,
          label: promiseSummary.label,
          tone: promiseSummary.tone
        }
      : invoice && invoiceBalanceDueCents > 0 && invoice.status !== "paid" && invoice.status !== "void"
        ? {
            copy:
              "Field execution is done, but money is still open. Keep the closeout thread attached to this visit.",
            href: commercialHref,
            label: "Collect and close out",
            tone: "brand" as const
          }
        : estimate?.status === "sent"
          ? {
              copy:
                "Approval is still out, so the quote thread is the next best action instead of adding more routing noise.",
              href: buildVisitEstimateHref(job.id, { workspace: true }),
              label: "Push approval forward",
              tone: "warning" as const
            }
          : {
              copy: trustSummary.copy,
              href: visitHref,
              label: trustSummary.nextActionLabel,
          tone: trustSummary.tone
            };
  const mutations: HotThreadMutation[] = [];

  if (promiseSummary.recommendedAction === "appointment_confirmation") {
    mutations.push({
      body: { action: "appointment_confirmation" },
      endpoint: communicationsEndpoint,
      id: "appointment_confirmation",
      label: "Send appointment confirmation",
      pendingLabel: "Sending appointment confirmation",
      successMessage: "Appointment confirmation queued from the hot thread.",
      tone: "secondary"
    });
  }

  if (
    promiseSummary.recommendedAction === "dispatched" ||
    promiseSummary.recommendedAction === "en_route"
  ) {
    mutations.push({
      body: {
        action: "dispatch_update",
        updateType: promiseSummary.recommendedAction
      },
      endpoint: communicationsEndpoint,
      id: `dispatch_update:${promiseSummary.recommendedAction}`,
      label:
        promiseSummary.recommendedAction === "en_route"
          ? "Send en-route update"
          : "Send dispatch update",
      pendingLabel:
        promiseSummary.recommendedAction === "en_route"
          ? "Sending en-route update"
          : "Sending dispatch update",
      successMessage:
        promiseSummary.recommendedAction === "en_route"
          ? "En-route update queued from the hot thread."
          : "Dispatch update queued from the hot thread.",
      tone: "secondary"
    });
  }

  if (estimate?.status === "sent") {
    mutations.push({
      body: { action: "estimate_notification" },
      endpoint: communicationsEndpoint,
      id: "estimate_notification",
      label: "Resend estimate",
      pendingLabel: "Resending estimate",
      successMessage: "Estimate notification queued from the hot thread.",
      tone: "tertiary"
    });
  }

  if (
    invoice &&
    invoiceBalanceDueCents > 0 &&
    invoice.status !== "paid" &&
    invoice.status !== "void"
  ) {
    mutations.push({
      body: { action: "payment_reminder" },
      endpoint: communicationsEndpoint,
      id: "payment_reminder",
      label: "Send payment reminder",
      pendingLabel: "Sending payment reminder",
      successMessage: "Payment reminder queued from the hot thread.",
      tone: "tertiary"
    });
  }

  const siteThreadHref = buildCustomerWorkspaceHref(customerResult.data.id, {
    editAddressId: serviceSite?.id,
    tab: "addresses"
  });
  const commercialAccountMode =
    customerResult.data.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer";
  const releaseRunwayState = deriveReleaseRunwayState({
    estimateStatus: estimate?.status,
    hasBlockingIssues:
      Boolean((openPartRequestsResult.data?.length ?? 0) || (inventoryIssuesResult.data?.length ?? 0)),
    hasOwner: Boolean(job.assignedTechnicianUserId),
    hasPromise: Boolean(job.arrivalWindowStartAt ?? job.scheduledStartAt),
    readinessReadyCount: readinessSummary.readyCount,
    readinessTotalCount: readinessSummary.totalCount,
    visitStatus: job.status
  });
  const hasSupplyRisk = Boolean((openPartRequestsResult.data?.length ?? 0) || (inventoryIssuesResult.data?.length ?? 0));
  const promiseConfidence = derivePromiseConfidenceSnapshot({
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk,
    promiseSummary,
    readinessSummary,
    releaseRunwayState,
    trustSummary
  });
  const routeConfidence = deriveVisitRouteConfidenceSnapshot({
    assignedTechnicianUserId: job.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: job.status
  });
  const serviceSiteThread = buildServiceSiteThreadSummary({
    activeVisitCount: job.status === "completed" || job.status === "canceled" ? 0 : 1,
    commercialAccountMode,
    linkedAssetCount: 1,
    linkedVisitCount: 1,
    siteFailureCount: 0,
    site: serviceSite
  });
  const primaryDesk = buildThreadPrimaryDesk({
    fallbackHref: visitHref,
    fallbackLabel: "Visits",
    nextMoveHref: nextMove.href
  });
  const activeThread: ActiveServiceThread = {
    actions: [
      { href: visitHref, id: "visit", label: "Open visit thread" },
      { href: dispatchHref, id: "dispatch", label: "Open dispatch" },
      { href: siteThreadHref, id: "site", label: "Open site thread" },
      {
        href: estimate?.status === "accepted" ? buildVisitEstimateHref(job.id, { workspace: true }) : commercialHref,
        id: "release_runway",
        label: estimate?.status === "accepted" ? "Open release runway" : "Open estimate file"
      },
      {
        href: invoice ? `/dashboard/finance?invoiceId=${invoice.id}` : buildFinanceSearchHref(customerName),
        id: "closeout",
        label: invoice ? "Open closeout file" : "Open finance desk"
      },
      { href: customerHref, id: "customer", label: "Open customer" }
    ],
    commercialAccountMode,
    drawerTargets: [
      { href: visitHref, id: "visit_file", label: "Open visit file" },
      {
        href: buildVisitEstimateHref(job.id, {
          autostart: !estimate,
          workspace: true
        }),
        id: "estimate_file",
        label: estimate ? "Open estimate file" : "Start estimate file"
      },
      ...(invoice
        ? [
            {
              href: invoice.status === "draft" ? buildVisitInvoiceEditHref(job.id) : buildVisitInvoiceHref(job.id),
              id: "invoice_file" as const,
              label: "Open invoice file"
            }
          ]
        : []),
      { href: siteThreadHref, id: "site_context", label: "Open site context" },
      {
        href: buildVisitInventoryHref(job.id),
        id: "supply_blocker",
        label: hasSupplyRisk ? "Open supply blocker" : "Open stock context"
      }
    ],
    continuity: {
      promiseConfidence,
      releaseRunway: releaseRunwayState,
      routeConfidence,
      serviceSiteThread,
      trust: {
        copy: trustSummary.copy,
        label: trustSummary.label,
        nextActionLabel: trustSummary.nextActionLabel,
        tone: trustSummary.tone
      }
    },
    customer: {
      href: customerHref,
      id: customerResult.data.id,
      label: customerName
    },
    estimate: estimate
      ? {
          href: buildVisitEstimateHref(job.id, { workspace: true }),
          id: estimate.id,
          label: estimate.estimateNumber ?? "Estimate",
          status: estimate.status
        }
      : null,
    invoice: invoice
      ? {
          balanceLabel: formatCurrencyFromCents(invoiceBalanceDueCents),
          href: `/dashboard/finance?invoiceId=${invoice.id}`,
          id: invoice.id,
          label: invoice.invoiceNumber ?? "Invoice",
          status: invoice.status
        }
      : null,
    jobId: job.id,
    kind: "visit",
    nextMove,
    primaryDesk,
    site: {
      href: siteThreadHref,
      id: serviceSite?.id ?? null,
      label: serviceSiteThread.siteLabel
    },
    title: job.title,
    vehicleOrUnit: {
      href: buildCustomerWorkspaceHref(customerResult.data.id, { selectedVehicleId: vehicleResult.data.id, tab: "vehicles" }),
      id: vehicleResult.data.id,
      kind: "customer_vehicle",
      label: vehicleName
    }
  };

  const payload: HotThreadPayload = {
    activeThread,
    actions: [
      { href: visitHref, label: "Open visit thread", tone: "primary" },
      { href: dispatchHref, label: "Open dispatch", tone: "secondary" },
      { href: siteThreadHref, label: "Open site thread", tone: "secondary" },
      { href: commercialHref, label: invoice ? "Open billing" : "Open estimate", tone: "tertiary" },
      { href: customerHref, label: "Open customer", tone: "ghost" }
    ],
    badges: [
      { label: job.status.replaceAll("_", " "), tone: "neutral" },
      { label: promiseConfidence.label, tone: promiseConfidence.tone },
      { label: trustSummary.label, tone: trustSummary.tone }
    ],
    caseItems: [
      {
        href: customerHref,
        label: "Customer",
        value: customerName
      },
      {
        label: "Vehicle",
        value: vehicleName
      },
      {
        href: buildCustomerWorkspaceHref(customerResult.data.id, { tab: "addresses" }),
        label: "Service site",
        value: serviceSite
          ? [formatSiteName(serviceSite), formatSiteAddress(serviceSite)].filter(Boolean).join(" · ")
          : "No active service site",
        ...(serviceSite?.accessWindowNotes
          ? { copy: serviceSite.accessWindowNotes }
          : serviceSite?.parkingNotes
            ? { copy: serviceSite.parkingNotes }
            : {})
      },
      {
        label: "Owner",
        value: job.assignedTechnicianUserId ? promiseSummary.owner : "Needs technician owner"
      }
    ],
    description:
      serviceSite && formatSiteAddress(serviceSite)
        ? `Anchored at ${formatSiteName(serviceSite)} · ${formatSiteAddress(serviceSite)}`
        : "The visit thread needs clearer service-site context.",
    eyebrow: "Carried case file",
    jumps: [
      { href: visitHref, id: "visit", label: "Open visit" },
      { href: dispatchHref, id: "dispatch", label: "Open dispatch" },
      { href: siteThreadHref, id: "site", label: "Open site thread" },
      {
        href: invoice ? `/dashboard/finance?invoiceId=${invoice.id}` : buildFinanceSearchHref(customerName),
        id: "finance",
        label: "Open finance"
      },
      { href: customerHref, id: "customer", label: "Open customer" }
    ],
    kind: "visit",
    ledger: [
      {
        copy: promiseConfidence.copy,
        label: "Promise ledger",
        tone: promiseConfidence.tone,
        value: `${promiseConfidence.label} · ${promiseSummary.nextUpdateLabel}`
      },
      {
        copy: routeConfidence.copy,
        label: "Route ledger",
        tone: routeConfidence.tone,
        value: `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`
      },
      {
        copy: trustSummary.copy,
        label: "Trust ledger",
        tone: trustSummary.tone,
        value: `${trustSummary.label} · ${trustSummary.nextActionLabel}`
      },
      getSiteLedgerItem(serviceSite),
      getVisitCommercialLedgerItem({
        estimate,
        invoiceBalanceDueCents,
        invoiceStatus: invoice?.status ?? null
      })
    ],
    mutations,
    nextMove,
    sections: [
      {
        description:
          "Keep timing, readiness, and trust visible without reopening the desk-specific drawer.",
        id: "operational",
        items: [
          {
            copy: promiseConfidence.copy,
            label: "Promise confidence",
            value: `${promiseConfidence.label} · ${promiseConfidence.confidencePercent}%`
          },
          {
            copy: routeConfidence.copy,
            label: "Route confidence",
            value: `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`
          },
          {
            copy: promiseSummary.lastCustomerUpdateLabel,
            label: "Next update",
            value: promiseSummary.nextUpdateLabel
          },
          {
            copy: readinessSummary.copy,
            label: "Readiness",
            value: `${readinessSummary.readyCount}/${readinessSummary.totalCount} ready`
          },
          {
            copy: trustSummary.copy,
            label: "Trust thread",
            value: `${trustSummary.label} · ${trustSummary.nextActionLabel}`
          }
        ],
        label: "Operational"
      },
      {
        description:
          "Preserve who this visit is for, where it happens, and who owns the next move.",
        id: "service",
        items: [
          {
            href: customerHref,
            label: "Customer",
            value: customerName
          },
          {
            label: "Vehicle",
            value: vehicleName
          },
          {
            href: siteThreadHref,
            label: "Service site",
            value: serviceSite
              ? [formatSiteName(serviceSite), formatSiteAddress(serviceSite)].filter(Boolean).join(" · ")
              : "No active service site",
            ...(serviceSiteThread.primaryContact
              ? { copy: serviceSiteThread.primaryContact }
              : serviceSite?.accessWindowNotes
                ? { copy: serviceSite.accessWindowNotes }
                : serviceSite?.parkingNotes
                  ? { copy: serviceSite.parkingNotes }
                  : {})
          },
          {
            label: "Owner",
            value: job.assignedTechnicianUserId ? promiseSummary.owner : "Needs technician owner"
          }
        ],
        label: "Service"
      },
      {
        description: "Keep estimate, billing, and field evidence on the same service thread.",
        id: "commercial",
        items: [
          {
            href: buildVisitEstimateHref(job.id, { workspace: true }),
            label: "Estimate",
            value: estimate
              ? `${estimate.estimateNumber} · ${estimate.status.replaceAll("_", " ")}`
              : "Not started"
          },
          {
            href: commercialHref,
            label: "Invoice",
            value: invoice
              ? `${invoice.invoiceNumber} · ${formatCurrencyFromCents(invoiceBalanceDueCents)} due`
              : "Not started"
          },
          {
            href: buildVisitDetailHref(job.id),
            label: "Field evidence",
            value: `${attachmentsResult.data?.length ?? 0} photos · ${notesResult.data?.length ?? 0} notes`,
            copy:
              inspectionResult.data?.status
                ? `Inspection ${inspectionResult.data.status.replaceAll("_", " ")}`
                : "Inspection not started"
          },
          {
            label: "Last customer touch",
            value: communications[0]
              ? formatThreadDate(
                  communications[0].createdAt,
                  input.context.company.timezone,
                  "No customer updates"
                )
              : "No customer updates"
          }
        ],
        label: "Commercial"
      }
    ],
    subtitle: `${customerName} · ${vehicleName}`,
    title: job.title
  };

  return NextResponse.json({ ok: true, thread: payload });
}

async function buildCustomerPayload(_input: {
  context: HotThreadContext;
  customerId: string;
  siteId: string | null;
}) {
  const input = _input;
  const customerResult = await getCustomerById(input.context.supabase, input.customerId);

  if (customerResult.error || !customerResult.data) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  if (customerResult.data.companyId !== input.context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customer = customerResult.data;
  const [addressesResult, vehiclesResult, jobsResult, communicationsResult] = await Promise.all([
    listAddressesByCustomer(input.context.supabase, customer.id),
    listVehiclesByCustomer(input.context.supabase, customer.id),
    listServiceHistoryJobsForCustomer(input.context.supabase, input.context.companyId, customer.id, {}),
    listCustomerCommunications(input.context.supabase, customer.id, { limit: 6 })
  ]);

  if (addressesResult.error) {
    return NextResponse.json({ error: addressesResult.error.message }, { status: 400 });
  }

  if (vehiclesResult.error) {
    return NextResponse.json({ error: vehiclesResult.error.message }, { status: 400 });
  }

  if (jobsResult.error) {
    return NextResponse.json({ error: jobsResult.error.message }, { status: 400 });
  }

  if (communicationsResult.error) {
    return NextResponse.json({ error: communicationsResult.error.message }, { status: 400 });
  }

  const jobs = jobsResult.data ?? [];
  const jobIds = jobs.map((job) => job.id);
  const [estimateRowsResult, invoiceRowsResult] = jobIds.length
    ? await Promise.all([
        input.context.supabase
          .from("estimates")
          .select("job_id, status")
          .eq("company_id", input.context.companyId)
          .in("job_id", jobIds)
          .returns<ThreadEstimateRow[]>(),
        input.context.supabase
          .from("invoices")
          .select("job_id, status, balance_due_cents")
          .eq("company_id", input.context.companyId)
          .in("job_id", jobIds)
          .returns<ThreadInvoiceRow[]>()
      ])
    : [
        { data: [] as ThreadEstimateRow[], error: null },
        { data: [] as ThreadInvoiceRow[], error: null }
      ];

  if (estimateRowsResult.error) {
    return NextResponse.json({ error: estimateRowsResult.error.message }, { status: 400 });
  }

  if (invoiceRowsResult.error) {
    return NextResponse.json({ error: invoiceRowsResult.error.message }, { status: 400 });
  }

  const activeVisits = jobs.filter((job) => !isClosedJobStatus(job.status));
  const addresses = addressesResult.data ?? [];
  const selectedSite =
    input.siteId && isUuid(input.siteId)
      ? addresses.find((address) => address.id === input.siteId) ?? null
      : null;
  const activeSiteVisitCounts = new Map<string, number>();

  for (const job of activeVisits) {
    if (!job.serviceSiteId) {
      continue;
    }

    activeSiteVisitCounts.set(job.serviceSiteId, (activeSiteVisitCounts.get(job.serviceSiteId) ?? 0) + 1);
  }

  const dominantSite =
    selectedSite ??
    [...addresses].sort((left, right) => {
      const activeCountDelta =
        (activeSiteVisitCounts.get(right.id) ?? 0) - (activeSiteVisitCounts.get(left.id) ?? 0);

      if (activeCountDelta !== 0) {
        return activeCountDelta;
      }

      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    })[0] ??
    null;
  const displayName = getCustomerDisplayName(customer);
  const latestCommunicationAt = communicationsResult.data?.[0]?.createdAt ?? null;
  const promiseSummary = getCustomerPromiseSummary({
    activeVisits: activeVisits.map((job) => ({
      jobStatus: job.status,
      scheduledStartAt: job.arrivalWindowStartAt ?? job.scheduledStartAt
    })),
    latestCommunicationAt
  });
  const pendingApprovalCount = (estimateRowsResult.data ?? []).filter((estimate) => estimate.status === "sent").length;
  const openBalanceCents = (invoiceRowsResult.data ?? []).reduce((sum, invoice) => {
    if (invoice.status === "paid" || invoice.status === "void") {
      return sum;
    }

    return sum + Math.max(invoice.balance_due_cents ?? 0, 0);
  }, 0);
  const trustSummary = getCustomerTrustSummary({
    activeFollowUpVisitCount: 0,
    activeVisitCount: activeVisits.length,
    latestCommunicationAt,
    latestPromiseAt: promiseSummary.promisedAt,
    openBalanceCents,
    pendingApprovalCount,
    promiseRisk: promiseSummary.breachRisk
  });
  const customerHref = buildCustomerWorkspaceHref(customer.id);
  const sitesHref = buildCustomerWorkspaceHref(customer.id, { tab: "addresses" });
  const visitsHref = buildVisitsSearchHref(displayName);
  const financeHref = buildFinanceSearchHref(displayName);
  const newVisitHref = `/dashboard/visits/new?customerId=${customer.id}`;
  const siteThreadHref = buildCustomerWorkspaceHref(customer.id, {
    editAddressId: dominantSite?.id,
    tab: "addresses"
  });
  const commercialAccountMode =
    customer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer";
  const promiseConfidence = derivePromiseConfidenceSnapshot({
    hasServiceSitePlaybook: hasServiceSitePlaybook(dominantSite),
    hasSupplyRisk: false,
    promiseSummary: {
      confidencePercent: promiseSummary.confidencePercent,
      copy: promiseSummary.copy,
      recommendedAction: promiseSummary.breachRisk === "none" ? null : "set_promise"
    },
    readinessSummary: {
      readyCount: dominantSite ? 1 : 0,
      score: dominantSite ? 100 : 0,
      totalCount: 1
    },
    releaseRunwayState: null,
    trustSummary
  });
  const routeConfidence = activeVisits[0]
    ? deriveVisitRouteConfidenceSnapshot({
        assignedTechnicianUserId: activeVisits[0].assignedTechnicianUserId,
        hasServiceSitePlaybook: hasServiceSitePlaybook(dominantSite),
        hasSupplyRisk: false,
        promiseConfidencePercent: promiseConfidence.confidencePercent,
        visitStatus: activeVisits[0].status
      })
    : null;
  const serviceSiteThread = buildServiceSiteThreadSummary({
    activeVisitCount: activeVisits.length,
    commercialAccountMode,
    linkedAssetCount: vehiclesResult.data?.length ?? 0,
    linkedVisitCount: jobsResult.data?.length ?? 0,
    siteFailureCount: Math.max((jobsResult.data?.length ?? 0) - activeVisits.length - 1, 0),
    site: dominantSite
  });
  const nextMove =
    promiseSummary.breachRisk === "high" || promiseSummary.breachRisk === "watch"
      ? {
          copy: promiseSummary.copy,
          href: visitsHref,
          label: promiseSummary.label,
          tone: promiseSummary.tone
        }
      : pendingApprovalCount > 0
        ? {
            copy:
              "Quotes are still waiting on this relationship, so the next move is follow-through rather than more intake.",
            href: visitsHref,
            label: "Push pending approvals",
            tone: "warning" as const
          }
        : openBalanceCents > 0
          ? {
              copy:
                "Money is still open on this relationship. Keep collections context tied to the same customer thread.",
              href: financeHref,
              label: "Collect open balance",
              tone: "brand" as const
        }
      : {
          copy: trustSummary.copy,
          href: customerHref,
          label: trustSummary.nextActionLabel,
          tone: trustSummary.tone
        };
  const primaryDesk = buildThreadPrimaryDesk({
    fallbackHref: visitsHref,
    fallbackLabel: "Visits",
    nextMoveHref: nextMove.href
  });
  const activeThread: ActiveServiceThread = {
    actions: [
      { href: customerHref, id: "customer", label: "Open customer thread" },
      { href: siteThreadHref, id: "site", label: "Open site thread" },
      { href: visitsHref, id: "visit", label: "Open visit thread" },
      {
        href: activeVisits[0] ? `/dashboard/dispatch?jobId=${activeVisits[0].id}` : "/dashboard/dispatch",
        id: "dispatch",
        label: "Open dispatch"
      },
      {
        href: pendingApprovalCount ? `${visitsHref}${visitsHref.includes("?") ? "&" : "?"}scope=stale_approval` : visitsHref,
        id: "release_runway",
        label: pendingApprovalCount ? "Open release runway" : "Open visits queue"
      },
      { href: financeHref, id: "closeout", label: "Open closeout file" }
    ],
    commercialAccountMode,
    drawerTargets: [
      {
        href: activeVisits[0] ? buildVisitThreadHref(activeVisits[0].id) : visitsHref,
        id: "visit_file",
        label: activeVisits[0] ? "Open hottest visit file" : "Open visit queue"
      },
      { href: siteThreadHref, id: "site_context", label: "Open site context" },
      {
        href: pendingApprovalCount ? `${visitsHref}${visitsHref.includes("?") ? "&" : "?"}scope=stale_approval` : visitsHref,
        id: "estimate_file",
        label: pendingApprovalCount ? "Open approval file" : "Open estimate support"
      },
      {
        href: financeHref,
        id: "invoice_file",
        label: openBalanceCents > 0 ? "Open balance file" : "Open closeout file"
      }
    ],
    continuity: {
      promiseConfidence,
      releaseRunway: null,
      routeConfidence,
      serviceSiteThread,
      trust: {
        copy: trustSummary.copy,
        label: trustSummary.label,
        nextActionLabel: trustSummary.nextActionLabel,
        tone: trustSummary.tone
      }
    },
    customer: {
      href: customerHref,
      id: customer.id,
      label: displayName
    },
    estimate: null,
    invoice: null,
    jobId: activeVisits[0]?.id ?? null,
    kind: "customer",
    nextMove,
    primaryDesk,
    site: {
      href: siteThreadHref,
      id: dominantSite?.id ?? null,
      label: serviceSiteThread.siteLabel
    },
    title: displayName,
    vehicleOrUnit: null
  };

  const payload: HotThreadPayload = {
    activeThread,
    actions: [
      { href: customerHref, label: "Open customer", tone: "primary" },
      { href: siteThreadHref, label: "Open site thread", tone: "secondary" },
      { href: visitsHref, label: "Open visits", tone: "tertiary" },
      { href: newVisitHref, label: "New visit", tone: "ghost" }
    ],
    badges: [
      {
        label: customer.relationshipType === "fleet_account" ? "Fleet account" : "Retail customer",
        tone: "neutral"
      },
      { label: promiseConfidence.label, tone: promiseConfidence.tone },
      { label: trustSummary.label, tone: trustSummary.tone }
    ],
    caseItems: [
      {
        label: "Relationship",
        value: customer.relationshipType === "fleet_account" ? "Fleet account" : "Retail customer"
      },
      {
        href: siteThreadHref,
        label: "Primary site",
        value: dominantSite
          ? [formatSiteName(dominantSite), formatSiteAddress(dominantSite)].filter(Boolean).join(" · ")
          : "No service site"
      },
      {
        href: visitsHref,
        label: "Live visits",
        value: `${activeVisits.length} active`
      },
      {
        label: "Open exposure",
        value: openBalanceCents ? formatCurrencyFromCents(openBalanceCents) : "No open balance",
        ...(openBalanceCents ? { href: financeHref } : {})
      }
    ],
    description:
      dominantSite && formatSiteAddress(dominantSite)
        ? `Primary operating site: ${formatSiteName(dominantSite)} · ${formatSiteAddress(dominantSite)}`
        : "No active service site is anchored to this relationship yet.",
    eyebrow: "Carried case file",
    jumps: [
      { href: visitsHref, id: "visit", label: "Open visits" },
      { href: siteThreadHref, id: "site", label: "Open site thread" },
      {
        href: activeVisits[0] ? `/dashboard/dispatch?jobId=${activeVisits[0].id}` : "/dashboard/dispatch",
        id: "dispatch",
        label: "Open dispatch"
      },
      { href: financeHref, id: "finance", label: "Open finance" },
      { href: customerHref, id: "customer", label: "Open customer" }
    ],
    kind: "customer",
    ledger: [
      {
        copy: promiseConfidence.copy,
        label: "Promise ledger",
        tone: promiseConfidence.tone,
        value: `${promiseConfidence.label} · ${promiseSummary.nextUpdateLabel}`
      },
      ...(routeConfidence
        ? [
            {
              copy: routeConfidence.copy,
              label: "Route ledger",
              tone: routeConfidence.tone,
              value: `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`
            } satisfies HotThreadLedgerItem
          ]
        : []),
      {
        copy: trustSummary.copy,
        label: "Trust ledger",
        tone: trustSummary.tone,
        value: `${trustSummary.label} · ${trustSummary.nextActionLabel}`
      },
      getSiteLedgerItem(dominantSite),
      getCustomerCommercialLedgerItem({
        openBalanceCents,
        pendingApprovalCount
      })
    ],
    mutations: [],
    nextMove,
    sections: [
      {
        description:
          "Relationship signal should tell the office what is active, exposed, and likely to break next.",
        id: "relationship",
        items: [
          {
            label: "Active visits",
            value: `${activeVisits.length} live ${activeVisits.length === 1 ? "thread" : "threads"}`
          },
          {
            label: "Vehicles",
            value: `${vehiclesResult.data?.length ?? 0} on file`
          },
          {
            label: "Approvals waiting",
            value: pendingApprovalCount ? `${pendingApprovalCount} pending` : "Clear"
          },
          {
            label: "Open exposure",
            value: openBalanceCents ? formatCurrencyFromCents(openBalanceCents) : "No open balance",
            ...(openBalanceCents ? { href: financeHref } : {})
          }
        ],
        label: "Relationship"
      },
      {
        description:
          "Promise confidence and trust should travel with the customer, not disappear into separate desks.",
        id: "operational",
        items: [
          {
            copy: promiseConfidence.copy,
            label: "Promise confidence",
            value: `${promiseConfidence.label} · ${promiseConfidence.confidencePercent}%`
          },
          ...(routeConfidence
            ? [
                {
                  copy: routeConfidence.copy,
                  label: "Route confidence",
                  value: `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`
                } satisfies HotThreadItem
              ]
            : []),
          {
            label: "Next update",
            value: promiseSummary.nextUpdateLabel
          },
          {
            copy: trustSummary.copy,
            label: "Trust thread",
            value: `${trustSummary.label} · ${trustSummary.nextActionLabel}`
          },
          {
            label: "Last customer touch",
            value: latestCommunicationAt
              ? formatThreadDate(latestCommunicationAt, input.context.company.timezone, "No recent communication")
              : "No recent communication"
          }
        ],
        label: "Operational"
      },
      {
        description:
          "Service sites should hold the recurring access memory that dispatch and technicians need daily.",
        id: "site",
        items: [
          {
            href: siteThreadHref,
            label: "Service site",
            value: dominantSite
              ? [formatSiteName(dominantSite), formatSiteAddress(dominantSite)].filter(Boolean).join(" · ")
              : "No service site"
          },
          {
            label: "Site contact",
            value:
              dominantSite?.serviceContactName ??
              dominantSite?.serviceContactPhone ??
              "No service contact saved"
          },
          {
            label: "Access notes",
            value:
              dominantSite?.accessWindowNotes ??
              dominantSite?.gateCode ??
              "No access notes recorded",
            ...(dominantSite?.parkingNotes ? { copy: dominantSite.parkingNotes } : {})
          },
          {
            label: "Site activity",
            value:
              dominantSite && activeSiteVisitCounts.get(dominantSite.id)
                ? `${activeSiteVisitCounts.get(dominantSite.id)} active visit${activeSiteVisitCounts.get(dominantSite.id) === 1 ? "" : "s"}`
                : "No active visits anchored here"
          }
        ],
        label: "Site memory"
      }
    ],
    subtitle: [customer.email, customer.phone].filter(Boolean).join(" · ") || "Customer thread",
    title: displayName
  };

  return NextResponse.json({ ok: true, thread: payload });
}

async function buildInvoicePayload(_input: {
  context: HotThreadContext;
  invoiceId: string;
}) {
  const input = _input;
  const detailResult = await getInvoiceDetailById(input.context.supabase, input.invoiceId);

  if (detailResult.error || !detailResult.data) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (detailResult.data.invoice.companyId !== input.context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const detail = detailResult.data;
  const [communicationsResult, addressesResult] = await Promise.all([
    listJobCommunications(input.context.supabase, detail.job.id, { limit: 6 }),
    listAddressesByCustomer(input.context.supabase, detail.customer.id)
  ]);

  if (communicationsResult.error) {
    return NextResponse.json({ error: communicationsResult.error.message }, { status: 400 });
  }

  if (addressesResult.error) {
    return NextResponse.json({ error: addressesResult.error.message }, { status: 400 });
  }

  const serviceSite =
    (detail.job.serviceSiteId
      ? (addressesResult.data ?? []).find((address) => address.id === detail.job.serviceSiteId) ?? null
      : null) ??
    (addressesResult.data ?? []).find((address) => address.isPrimary) ??
    (addressesResult.data ?? [])[0] ??
    null;
  const customerName = getCustomerDisplayName(detail.customer);
  const vehicleName = getVehicleDisplayName(detail.vehicle);
  const communications = communicationsResult.data ?? [];
  const promiseSummary = getVisitPromiseSummary({
    communications,
    job: {
      arrivalWindowStartAt: detail.job.arrivalWindowStartAt,
      assignedTechnicianUserId: detail.job.assignedTechnicianUserId,
      scheduledStartAt: detail.job.scheduledStartAt,
      status: detail.job.status
    }
  });
  const trustSummary = getVisitTrustSummary({
    communications,
    estimate: detail.estimate,
    invoice: {
      balanceDueCents: detail.totals.balanceDueCents,
      status: detail.invoice.status
    },
    job: {
      arrivalWindowStartAt: detail.job.arrivalWindowStartAt,
      assignedTechnicianUserId: detail.job.assignedTechnicianUserId,
      scheduledStartAt: detail.job.scheduledStartAt,
      status: detail.job.status
    }
  });
  const invoiceHref =
    detail.invoice.status === "draft"
      ? buildVisitInvoiceEditHref(detail.job.id)
      : buildVisitInvoiceHref(detail.job.id);
  const siteThreadHref = buildCustomerWorkspaceHref(detail.customer.id, {
    editAddressId: serviceSite?.id,
    tab: "addresses"
  });
  const communicationsEndpoint = `/api/internal/jobs/${detail.job.id}/communications`;
  const commercialAccountMode =
    detail.customer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer";
  const promiseConfidence = derivePromiseConfidenceSnapshot({
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk: false,
    promiseSummary,
    readinessSummary: {
      readyCount: serviceSite ? 1 : 0,
      score: serviceSite ? 100 : 0,
      totalCount: 1
    },
    releaseRunwayState: null,
    trustSummary
  });
  const routeConfidence = deriveVisitRouteConfidenceSnapshot({
    assignedTechnicianUserId: detail.job.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(serviceSite),
    hasSupplyRisk: false,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: detail.job.status
  });
  const serviceSiteThread = buildServiceSiteThreadSummary({
    activeVisitCount: detail.job.status === "completed" || detail.job.status === "canceled" ? 0 : 1,
    commercialAccountMode,
    linkedAssetCount: 1,
    linkedVisitCount: 1,
    site: serviceSite
  });
  const nextMove =
    detail.totals.balanceDueCents > 0 &&
    detail.invoice.status !== "paid" &&
    detail.invoice.status !== "void"
      ? {
          copy:
            "Collections are still active on this visit, so Finance should stay tied to the same thread.",
          href: `/dashboard/finance?invoiceId=${detail.invoice.id}`,
          label: "Collect balance",
          tone: "brand" as const
        }
      : detail.invoice.status === "draft"
        ? {
            copy:
              "The invoice is still being assembled, so finish the billing artifact before pushing more follow-through elsewhere.",
            href: invoiceHref,
            label: "Finish invoice",
            tone: "warning" as const
          }
        : {
            copy: trustSummary.copy,
            href: buildVisitThreadHref(detail.job.id),
            label: trustSummary.nextActionLabel,
            tone: trustSummary.tone
          };
  const mutations: HotThreadMutation[] = [];

  if (["issued", "partially_paid"].includes(detail.invoice.status)) {
    mutations.push({
      body: { action: "invoice_notification" },
      endpoint: communicationsEndpoint,
      id: "invoice_notification",
      label: "Resend invoice",
      pendingLabel: "Resending invoice",
      successMessage: "Invoice notification queued from the hot thread.",
      tone: "secondary"
    });
  }

  if (
    detail.totals.balanceDueCents > 0 &&
    detail.invoice.status !== "paid" &&
    detail.invoice.status !== "void"
  ) {
    mutations.push({
      body: { action: "payment_reminder" },
      endpoint: communicationsEndpoint,
      id: "payment_reminder",
      label: "Send payment reminder",
      pendingLabel: "Sending payment reminder",
      successMessage: "Payment reminder queued from the hot thread.",
      tone: "tertiary"
    });
  }

  const activeThread: ActiveServiceThread = {
    actions: [
      { href: `/dashboard/finance?invoiceId=${detail.invoice.id}`, id: "finance", label: "Open finance" },
      { href: invoiceHref, id: "closeout", label: "Open closeout file" },
      { href: buildVisitThreadHref(detail.job.id), id: "visit", label: "Open visit thread" },
      { href: `/dashboard/dispatch?jobId=${detail.job.id}`, id: "dispatch", label: "Open dispatch" },
      { href: siteThreadHref, id: "site", label: "Open site thread" },
      { href: buildCustomerWorkspaceHref(detail.customer.id), id: "customer", label: "Open customer thread" }
    ],
    commercialAccountMode,
    drawerTargets: [
      { href: invoiceHref, id: "invoice_file", label: "Open invoice file" },
      { href: buildVisitThreadHref(detail.job.id), id: "visit_file", label: "Open visit file" },
      {
        href: detail.estimate ? buildVisitEstimateHref(detail.job.id, { workspace: true }) : buildVisitEstimateHref(detail.job.id, { autostart: true, workspace: true }),
        id: "estimate_file",
        label: detail.estimate ? "Open estimate file" : "Start estimate file"
      },
      { href: siteThreadHref, id: "site_context", label: "Open site context" }
    ],
    continuity: {
      promiseConfidence,
      releaseRunway: null,
      routeConfidence,
      serviceSiteThread,
      trust: {
        copy: trustSummary.copy,
        label: trustSummary.label,
        nextActionLabel: trustSummary.nextActionLabel,
        tone: trustSummary.tone
      }
    },
    customer: {
      href: buildCustomerWorkspaceHref(detail.customer.id),
      id: detail.customer.id,
      label: customerName
    },
    estimate: detail.estimate
      ? {
          href: buildVisitEstimateHref(detail.job.id, { workspace: true }),
          id: detail.estimate.id,
          label: detail.estimate.estimateNumber ?? "Estimate",
          status: detail.estimate.status
        }
      : null,
    invoice: {
      balanceLabel: formatCurrencyFromCents(detail.totals.balanceDueCents),
      href: `/dashboard/finance?invoiceId=${detail.invoice.id}`,
      id: detail.invoice.id,
      label: detail.invoice.invoiceNumber,
      status: detail.invoice.status
    },
    jobId: detail.job.id,
    kind: "invoice",
    nextMove,
    primaryDesk: buildThreadPrimaryDesk({
      fallbackHref: `/dashboard/finance?invoiceId=${detail.invoice.id}`,
      fallbackLabel: "Finance",
      nextMoveHref: nextMove.href
    }),
    site: {
      href: siteThreadHref,
      id: serviceSite?.id ?? null,
      label: serviceSiteThread.siteLabel
    },
    title: detail.invoice.invoiceNumber,
    vehicleOrUnit: {
      href: buildCustomerWorkspaceHref(detail.customer.id, {
        selectedVehicleId: detail.vehicle.id,
        tab: "vehicles"
      }),
      id: detail.vehicle.id,
      kind: "customer_vehicle",
      label: vehicleName
    }
  };

  const payload: HotThreadPayload = {
    activeThread,
    actions: [
      { href: `/dashboard/finance?invoiceId=${detail.invoice.id}`, label: "Open finance", tone: "primary" },
      { href: invoiceHref, label: "Open invoice", tone: "secondary" },
      { href: siteThreadHref, label: "Open site thread", tone: "secondary" },
      { href: buildVisitThreadHref(detail.job.id), label: "Open visit", tone: "tertiary" },
      { href: buildCustomerWorkspaceHref(detail.customer.id), label: "Open customer", tone: "ghost" }
    ],
    badges: [
      { label: detail.invoice.status.replaceAll("_", " "), tone: "neutral" },
      {
        label:
          detail.totals.balanceDueCents > 0
            ? `${formatCurrencyFromCents(detail.totals.balanceDueCents)} due`
            : "Paid",
        tone: detail.totals.balanceDueCents > 0 ? "brand" : "success"
      },
      { label: promiseConfidence.label, tone: promiseConfidence.tone }
    ],
    caseItems: [
      {
        href: buildCustomerWorkspaceHref(detail.customer.id),
        label: "Customer",
        value: customerName
      },
      {
        href: buildVisitThreadHref(detail.job.id),
        label: "Visit",
        value: detail.job.title
      },
      {
        href: siteThreadHref,
        label: "Service site",
        value: serviceSite
          ? [formatSiteName(serviceSite), formatSiteAddress(serviceSite)].filter(Boolean).join(" · ")
          : "No service site"
      },
      {
        label: "Balance due",
        value: formatCurrencyFromCents(detail.totals.balanceDueCents)
      }
    ],
    description:
      serviceSite && formatSiteAddress(serviceSite)
        ? `${customerName} · ${vehicleName} · ${formatSiteName(serviceSite)}`
        : `${customerName} · ${vehicleName}`,
    eyebrow: "Carried case file",
    jumps: [
      { href: buildVisitThreadHref(detail.job.id), id: "visit", label: "Open visit" },
      { href: `/dashboard/dispatch?jobId=${detail.job.id}`, id: "dispatch", label: "Open dispatch" },
      { href: `/dashboard/finance?invoiceId=${detail.invoice.id}`, id: "finance", label: "Open finance" },
      { href: siteThreadHref, id: "site", label: "Open site thread" },
      { href: buildCustomerWorkspaceHref(detail.customer.id), id: "customer", label: "Open customer" }
    ],
    kind: "invoice",
    ledger: [
      {
        copy: promiseConfidence.copy,
        label: "Promise ledger",
        tone: promiseConfidence.tone,
        value: `${promiseConfidence.label} · ${promiseSummary.nextUpdateLabel}`
      },
      {
        copy: routeConfidence.copy,
        label: "Route ledger",
        tone: routeConfidence.tone,
        value: `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`
      },
      {
        copy: trustSummary.copy,
        label: "Trust ledger",
        tone: trustSummary.tone,
        value: `${trustSummary.label} · ${trustSummary.nextActionLabel}`
      },
      getSiteLedgerItem(serviceSite),
      getInvoiceContinuityLedgerItem({
        balanceDueCents: detail.totals.balanceDueCents,
        invoiceStatus: detail.invoice.status
      })
    ],
    mutations,
    nextMove,
    sections: [
      {
        description:
          "Closeout should preserve money state, due timing, and the next follow-through action together.",
        id: "closeout",
        items: [
          {
            label: "Invoice",
            value: detail.invoice.invoiceNumber
          },
          {
            label: "Total",
            value: formatCurrencyFromCents(detail.totals.totalCents)
          },
          {
            label: "Balance due",
            value: formatCurrencyFromCents(detail.totals.balanceDueCents)
          },
          {
            label: "Due",
            value: formatThreadDate(detail.invoice.dueAt, input.context.company.timezone, "No due date")
          }
        ],
        label: "Closeout"
      },
      {
        description: "The invoice still belongs to a live service thread, not a detached finance record.",
        id: "visit",
        items: [
          {
            href: buildVisitThreadHref(detail.job.id),
            label: "Visit",
            value: detail.job.title
          },
          {
            label: "Promise",
            value: `${promiseConfidence.label} · ${promiseSummary.nextUpdateLabel}`
          },
          {
            copy: routeConfidence.copy,
            label: "Route confidence",
            value: `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`
          },
          {
            copy: trustSummary.copy,
            label: "Trust thread",
            value: trustSummary.label
          },
          {
            href: siteThreadHref,
            label: "Service site",
            value: serviceSite
              ? [formatSiteName(serviceSite), formatSiteAddress(serviceSite)].filter(Boolean).join(" · ")
              : "No service site"
          }
        ],
        label: "Linked visit"
      },
      {
        description:
          "Customer and vehicle context should still be available while collecting or editing.",
        id: "customer",
        items: [
          {
            href: buildCustomerWorkspaceHref(detail.customer.id),
            label: "Customer",
            value: customerName
          },
          {
            label: "Vehicle",
            value: vehicleName
          },
          {
            label: "Estimate",
            value: detail.estimate
              ? `${detail.estimate.estimateNumber} · ${detail.estimate.status.replaceAll("_", " ")}`
              : "No estimate linked"
          },
          {
            label: "Last customer touch",
            value: communications[0]
              ? formatThreadDate(
                  communications[0].createdAt,
                  input.context.company.timezone,
                  "No customer updates"
                )
              : "No customer updates"
          }
        ],
        label: "Customer context"
      }
    ],
    subtitle: `${customerName} · ${vehicleName}`,
    title: detail.invoice.invoiceNumber
  };

  return NextResponse.json({ ok: true, thread: payload });
}

export async function GET(request: Request) {
  const contextResult = await getCompanyContextResult({ requireOfficeAccess: true });

  if (contextResult.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (contextResult.status === "no-company" || contextResult.status === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const kind = searchParams.get("kind")?.trim();
  const id = searchParams.get("id")?.trim() ?? "";
  const siteId = searchParams.get("siteId")?.trim() ?? null;

  if (!kind || !isUuid(id)) {
    return NextResponse.json({ error: "A valid hot-thread target is required." }, { status: 400 });
  }

  if (kind === "visit") {
    return buildVisitPayload({
      context: contextResult.context,
      jobId: id
    });
  }

  if (kind === "customer") {
    return buildCustomerPayload({
      context: contextResult.context,
      customerId: id,
      siteId: isUuid(siteId) ? siteId : null
    });
  }

  if (kind === "invoice") {
    return buildInvoicePayload({
      context: contextResult.context,
      invoiceId: id
    });
  }

  return NextResponse.json({ error: "Unsupported hot-thread target." }, { status: 400 });
}
