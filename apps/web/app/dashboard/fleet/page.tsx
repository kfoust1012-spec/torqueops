import { getDispatchLocalDate, getSafeTimeZone } from "@mobile-mechanic/core";
import { listServiceHistoryEstimatesByJobIds, listServiceHistoryInvoicesByJobIds } from "@mobile-mechanic/api-client";
import type { Database } from "@mobile-mechanic/types";
import Link from "next/link";

import { Badge, EmptyState, Page, buttonClassName } from "../../../components/ui";
import { FieldCommandShell } from "../_components/field-command-shell";
import { requireCompanyContext } from "../../../lib/company-context";
import { getFleetWorkspace } from "../../../lib/fleet/workspace";
import {
  countOpenTechnicianPaymentHandoffsByJobId,
  listTechnicianPaymentHandoffsByInvoiceIds,
  summarizeOpenTechnicianPaymentHandoffsByJobId
} from "../../../lib/invoices/payment-handoffs";
import { buildWorkspaceBlockerSummary } from "../../../lib/jobs/workspace-blockers";

import { FleetWorkspace } from "./_components/fleet-workspace";

type FleetPageProps = {
  searchParams?: Promise<{
    date?: string | string[];
    panel?: string | string[];
    technicianId?: string | string[];
  }>;
};

function formatFleetPageError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      details?: unknown;
      hint?: unknown;
      message?: unknown;
    };
    const parts = [
      typeof candidate.message === "string" ? candidate.message : null,
      typeof candidate.details === "string" ? candidate.details : null,
      typeof candidate.hint === "string" ? candidate.hint : null
    ].filter((part): part is string => Boolean(part));

    if (parts.length) {
      return parts.join(" ");
    }
  }

  return "Fleet could not load its current routes.";
}

function parseFleetDate(input: string | string[] | undefined, fallbackDate: string) {
  const candidate = Array.isArray(input) ? input[0] : input;

  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return fallbackDate;
  }

  return candidate;
}

export default async function FleetPage({ searchParams }: FleetPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const timeZone = getSafeTimeZone(context.company.timezone);
  const fallbackDate = getDispatchLocalDate(new Date(), timeZone);
  const date = parseFleetDate(resolvedSearchParams.date, fallbackDate);

  try {
    const workspace = await getFleetWorkspace(context, { date });

    const fleetJobs = [
      ...workspace.queueJobs,
      ...workspace.technicians.flatMap((technician) => technician.routeStops)
    ];
    const fleetJobById = new Map(fleetJobs.map((job) => [job.jobId, job]));
    const fleetJobIds = [...fleetJobById.keys()];
    const [estimatesResult, invoicesResult, openPartRequestsResult, inventoryIssuesResult] = fleetJobIds.length
      ? await Promise.all([
          listServiceHistoryEstimatesByJobIds(context.supabase, context.companyId, fleetJobIds),
          listServiceHistoryInvoicesByJobIds(context.supabase, context.companyId, fleetJobIds),
          context.supabase
            .from("part_requests")
            .select("job_id, status")
            .eq("company_id", context.companyId)
            .eq("status", "open")
            .in("job_id", fleetJobIds)
            .returns<Array<Pick<Database["public"]["Tables"]["part_requests"]["Row"], "job_id" | "status">>>(),
          context.supabase
            .from("job_inventory_issues")
            .select("job_id, status")
            .eq("company_id", context.companyId)
            .in("job_id", fleetJobIds)
            .returns<
              Array<Pick<Database["public"]["Tables"]["job_inventory_issues"]["Row"], "job_id" | "status">>
            >()
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null }
        ];

    if (estimatesResult.error) {
      throw estimatesResult.error;
    }

    if (invoicesResult.error) {
      throw invoicesResult.error;
    }

    if (openPartRequestsResult.error) {
      throw openPartRequestsResult.error;
    }

    if (inventoryIssuesResult.error) {
      throw inventoryIssuesResult.error;
    }

    const estimatesByJobId = new Map<string, NonNullable<typeof estimatesResult.data>[number]>();
    for (const estimate of estimatesResult.data ?? []) {
      const current = estimatesByJobId.get(estimate.jobId);

      if (!current || Date.parse(estimate.updatedAt) >= Date.parse(current.updatedAt)) {
        estimatesByJobId.set(estimate.jobId, estimate);
      }
    }

    const invoicesByJobId = new Map<string, NonNullable<typeof invoicesResult.data>[number]>();
    for (const invoice of invoicesResult.data ?? []) {
      const current = invoicesByJobId.get(invoice.jobId);

      if (!current || Date.parse(invoice.updatedAt) >= Date.parse(current.updatedAt)) {
        invoicesByJobId.set(invoice.jobId, invoice);
      }
    }
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
    const fleetBlockers = buildWorkspaceBlockerSummary({
      estimatesByJobId,
      inventoryIssuesByJobId,
      invoicesByJobId,
      jobs: fleetJobIds.map((jobId) => {
        const job = fleetJobById.get(jobId)!;

        return {
          customerDisplayName: job.customerName,
          id: jobId,
          status: job.status,
          title: job.title,
          vehicleDisplayName: job.vehicleDisplayName
        };
      }),
      paymentHandoffSummaryByJobId,
      openPaymentHandoffCountByJobId,
      openPartRequestsByJobId
    });

    return <FleetWorkspace initialBlockers={fleetBlockers} initialData={workspace} />;
  } catch (error) {
    const message = formatFleetPageError(error);

    console.error("Fleet workspace load failed", error);

    return (
      <Page className="fleet-page" layout="command">
        <FieldCommandShell
          actions={
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href="/dashboard/dispatch">
              Open dispatch
            </Link>
          }
          description="Support Dispatch with field visibility, service-unit readiness, and live route posture."
          mode="fleet"
          status={<Badge tone="neutral">Internal service units only</Badge>}
          title="Fleet"
        />

        <EmptyState
          actions={
            <Link className={buttonClassName({ size: "sm", tone: "primary" })} href="/dashboard/dispatch">
              Continue in dispatch
            </Link>
          }
          description={message}
          eyebrow="Fleet unavailable"
          title="Fleet readiness could not load right now"
          tone="warning"
        />
      </Page>
    );
  }
}
