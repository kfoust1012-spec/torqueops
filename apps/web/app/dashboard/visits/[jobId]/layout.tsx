import {
  getEstimateByJobId,
  getInspectionByJobId,
  getInvoiceByJobId,
  listAttachmentsByJob,
  getCustomerById,
  getJobById,
  getVehicleById
} from "@mobile-mechanic/api-client";
import {
  formatDesignLabel,
  getCustomerDisplayName,
  getVehicleDisplayName,
  isTechnicianActiveFieldJobStatus
} from "@mobile-mechanic/core";
import type { JobStatus } from "@mobile-mechanic/types";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import { requireCompanyContext } from "../../../../lib/company-context";
import { buildVisitThreadHref } from "../../../../lib/visits/workspace";
import { VisitWorkspaceShell } from "./_components/visit-workspace-shell";

type VisitWorkspaceLayoutProps = {
  children: ReactNode;
  params: Promise<{
    jobId: string;
  }>;
};

function getStatusTone(status: string): "brand" | "danger" | "neutral" | "success" | "warning" {
  switch (status) {
    case "completed":
      return "success";
    case "canceled":
      return "danger";
    case "scheduled":
      return "warning";
    default:
      return isTechnicianActiveFieldJobStatus(status as JobStatus) ? "brand" : "neutral";
  }
}

export default async function VisitWorkspaceLayout({ children, params }: VisitWorkspaceLayoutProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { jobId } = await params;
  const jobResult = await getJobById(context.supabase, jobId);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  const job = jobResult.data;
  const [customerResult, vehicleResult, estimateResult, inspectionResult, invoiceResult, attachmentsResult] = await Promise.all([
    getCustomerById(context.supabase, job.customerId),
    getVehicleById(context.supabase, job.vehicleId),
    getEstimateByJobId(context.supabase, jobId),
    getInspectionByJobId(context.supabase, jobId),
    getInvoiceByJobId(context.supabase, jobId),
    listAttachmentsByJob(context.supabase, jobId)
  ]);

  if (customerResult.error || !customerResult.data || vehicleResult.error || !vehicleResult.data) {
    throw customerResult.error ?? vehicleResult.error ?? new Error("Visit workspace context could not be loaded.");
  }

  if (estimateResult.error || inspectionResult.error || invoiceResult.error || attachmentsResult.error) {
    throw (
      estimateResult.error ??
      inspectionResult.error ??
      invoiceResult.error ??
      attachmentsResult.error ??
      new Error("Visit workflow signals could not be loaded.")
    );
  }

  const signals = [
    {
      label: "Estimate",
      tone: estimateResult.data
        ? getStatusTone(estimateResult.data.status === "accepted" ? "completed" : estimateResult.data.status === "sent" ? "scheduled" : "new")
        : "warning",
      value: estimateResult.data ? formatDesignLabel(estimateResult.data.status) : "Missing"
    },
    {
      label: "Inspection",
      tone: inspectionResult.data
        ? getStatusTone(inspectionResult.data.status === "completed" ? "completed" : "scheduled")
        : "neutral",
      value: inspectionResult.data ? formatDesignLabel(inspectionResult.data.status) : "Not started"
    },
    {
      label: "Invoice",
      tone: invoiceResult.data
        ? getStatusTone(invoiceResult.data.status === "paid" ? "completed" : invoiceResult.data.status === "issued" ? "scheduled" : "new")
        : "neutral",
      value: invoiceResult.data ? formatDesignLabel(invoiceResult.data.status) : "Not started"
    },
    {
      label: "Photos",
      tone: attachmentsResult.data?.length ? "brand" : "neutral",
      value: attachmentsResult.data?.length ? `${attachmentsResult.data.length} attached` : "None"
    }
  ] as const;

  return (
    <>
      <VisitWorkspaceShell
        customerHref={buildCustomerWorkspaceHref(customerResult.data.id, {
          mode: "workspace",
          selectedVehicleId: vehicleResult.data.id,
          tab: "vehicles"
        })}
        customerName={getCustomerDisplayName(customerResult.data)}
        dispatchHref={`/dashboard/dispatch?jobId=${jobId}`}
        jobId={jobId}
        visitsHref={buildVisitThreadHref(jobId)}
        signals={[...signals]}
        statusLabel={formatDesignLabel(job.status)}
        statusTone={getStatusTone(job.status)}
        vehicleLabel={getVehicleDisplayName({
          make: vehicleResult.data.make,
          model: vehicleResult.data.model,
          year: vehicleResult.data.year
        })}
      />
      {children}
    </>
  );
}
