import {
  archiveCustomer,
  archiveVehicle,
  createCustomer,
  createCustomerAddress,
  createVehicle,
  deleteCustomerAddress,
  getCustomerById,
  getVehicleById,
  listAddressesByCustomer,
  listCustomerCommunications,
  listCustomersByCompany,
  listVehiclesByCustomer,
  setPrimaryCustomerAddress,
  updateCustomer,
  updateCustomerAddress,
  updateVehicle
} from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  formatDateTime,
  getCustomerDisplayName,
  getVehicleDisplayName,
  isTechnicianActiveFieldJobStatus
} from "@mobile-mechanic/core";
import type { Database } from "@mobile-mechanic/types";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import {
  Badge,
  Button,
  Cell,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Form,
  FormField,
  HeaderCell,
  Input,
  RegistryHero,
  RegistryMetric,
  RegistryPage,
  RegistryToolbar,
  StatusBadge,
  Table,
  TableWrap,
  buttonClassName,
  cx
} from "../../../../components/ui";
import { CarfaxSummaryCard } from "../../_components/carfax-summary-card";
import {
  type OperationalFocusBadge,
  type OperationalFocusItem
} from "../../_components/operational-focus-panel";
import { ServiceHistoryPanel } from "../../_components/service-history-panel";
import {
  readVehicleCarfaxSummaryForVehicle,
  refreshVehicleCarfaxSummary
} from "../../../../lib/carfax/service";
import { requireCompanyContext } from "../../../../lib/company-context";
import {
  buildCustomersHref,
  buildCustomerWorkspaceHref,
  buildCustomerVehicleHref,
  normalizeCustomerRegistrySegment,
  normalizeCustomerWorkspaceMode,
  normalizeCustomerWorkspaceTab,
  type CustomerRegistrySegment,
  type CustomerWorkspaceMode,
  readBooleanSearchParam,
  readCustomerWorkspaceCustomerId,
  readSelectedVehicleIdSearchParam,
  readSingleSearchParam
} from "../../../../lib/customers/workspace";
import { buildVisitThreadHref } from "../../../../lib/visits/workspace";
import {
  getCustomerApprovalRiskSummary,
  getCustomerBalanceRiskSummary,
  getCustomerFollowUpRiskSummary,
  getCustomerNextMove,
  getCustomerRecordHealth,
  getCustomerRiskAction,
  getCustomerThreadActionTarget
} from "../../../../lib/customers/support";
import {
  parseCustomerServiceHistorySearchParams,
  parseVehicleServiceHistorySearchParams
} from "../../../../lib/service-history/filters";
import {
  getCustomerServiceHistory,
  getVehicleServiceHistory
} from "../../../../lib/service-history/service";
import {
  getCustomerPromiseSummary,
  getCustomerTrustSummary
} from "../../../../lib/jobs/operational-health";
import {
  countOpenTechnicianPaymentHandoffsByJobId,
  listTechnicianPaymentHandoffsByInvoiceIds,
  summarizeOpenTechnicianPaymentHandoffsByJobId
} from "../../../../lib/invoices/payment-handoffs";
import { buildWorkspaceBlockerSummary } from "../../../../lib/jobs/workspace-blockers";
import {
  getServiceThreadActionIntent,
  getServiceThreadPressureScore,
  getServiceThreadSummary
} from "../../../../lib/jobs/service-thread";
import {
  getCustomerActionLabels,
  getCustomerInspectorRoleFocus,
  getCustomerRoleFocus
} from "../../../../lib/office-workspace-focus";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveRouteConfidenceSnapshot
} from "../../../../lib/service-thread/continuity";
import { toServerError } from "../../../../lib/server-error";
import { getCarfaxConfig } from "../../../../lib/server-env";
import { isFollowUpVisitTitle } from "../../../../lib/jobs/follow-up";
import { enrichVehicleInputWithVinDecode } from "../../../../lib/vehicles/enrichment";
import { AddressForm } from "./address-form";
import { CustomerActivityTimeline } from "./customer-activity-timeline";
import { CustomerForm } from "./customer-form";
import { CustomerVehicleForm } from "./customer-vehicle-form";

type CustomersWorkspaceShellProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | undefined;
};

type CustomerWorkspaceSearchParams = Record<string, string | string[] | undefined>;

type AddressRow = Database["public"]["Tables"]["customer_addresses"]["Row"];
type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type CustomerCommunicationRow = Database["public"]["Tables"]["customer_communications"]["Row"];

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string): string | null {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function getNullableNumber(formData: FormData, key: string): number | null {
  const value = getString(formData, key).trim();
  return value ? Number(value) : null;
}

function getLatestJobTimestamp(job: JobRow) {
  return (
    job.completed_at ??
    job.canceled_at ??
    job.started_at ??
    job.scheduled_start_at ??
    job.created_at
  );
}

function buildEstimateIntakeHref(customerId: string, vehicleId?: string | null) {
  const searchParams = new URLSearchParams({
    customerId,
    mode: "estimate"
  });

  if (vehicleId) {
    searchParams.set("vehicleId", vehicleId);
  }

  return `/dashboard/visits/new?${searchParams.toString()}`;
}

function formatRegistryAddress(row: AddressRow | null | undefined) {
  if (!row) {
    return "No service location";
  }

  return [row.line1, row.city, row.state, row.postal_code].filter(Boolean).join(", ");
}

function getVehicleSummary(row: VehicleRow) {
  return {
    displayName: getVehicleDisplayName({
      year: row.year,
      make: row.make,
      model: row.model
    }),
    vinLabel: row.vin ? `VIN ${row.vin}` : "VIN not recorded"
  };
}

function formatAddressLine(
  line1: string,
  line2: string | null,
  city: string,
  state: string,
  postalCode: string,
  country: string
) {
  return [line1, line2, `${city}, ${state} ${postalCode}`, country]
    .filter(Boolean)
    .join(", ");
}

function getPrimaryAddress<
  T extends {
    isPrimary: boolean;
  }
>(addresses: T[]) {
  return addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null;
}

function getLatestVehicleServiceMap(visits: Array<{ sortAt: string; vehicleId: string }>) {
  const latestVisitByVehicleId = new Map<string, string>();

  for (const visit of visits) {
    const current = latestVisitByVehicleId.get(visit.vehicleId);

    if (!current || Date.parse(visit.sortAt) > Date.parse(current)) {
      latestVisitByVehicleId.set(visit.vehicleId, visit.sortAt);
    }
  }

  return latestVisitByVehicleId;
}

function hasRecentActivity(timestamp: string | null | undefined) {
  if (!timestamp) {
    return false;
  }

  const recentWindowMs = 1000 * 60 * 60 * 24 * 30;
  return Date.now() - Date.parse(timestamp) <= recentWindowMs;
}

function isActiveVisitStatus(status: string) {
  return status !== "completed" && status !== "canceled";
}

function matchesCustomerRegistrySegment(
  customer: {
    email: string | null;
    isActive: boolean;
    phone: string | null;
  },
  addresses: AddressRow[],
  vehicles: VehicleRow[],
  latestJob: JobRow | null,
  segment: CustomerRegistrySegment
) {
  switch (segment) {
    case "needs-contact":
      return !customer.email && !customer.phone;
    case "needs-address":
      return addresses.length === 0;
    case "no-vehicle":
      return vehicles.length === 0;
    case "multi-vehicle":
      return vehicles.length > 1;
    case "inactive":
      return !customer.isActive;
    case "recent":
      return hasRecentActivity(latestJob ? getLatestJobTimestamp(latestJob) : null);
    case "all":
    default:
      return true;
  }
}

function getTrustRiskRank(risk: "high" | "none" | "watch") {
  switch (risk) {
    case "high":
      return 3;
    case "watch":
      return 2;
    default:
      return 1;
  }
}

function formatVehiclePlate(row: VehicleRow) {
  return [row.license_plate, row.license_state].filter(Boolean).join(" / ") || "No plate";
}

function formatVehicleOdometer(row: VehicleRow) {
  return row.odometer !== null && row.odometer !== undefined
    ? `${row.odometer.toLocaleString()} mi`
    : "No odometer";
}

function getRelationshipContactName(customer: {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  const contactName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
  return contactName || customer.companyName || "No contact on file";
}

function getRelationshipContactChannel(customer: {
  email: string | null;
  phone: string | null;
}) {
  return [customer.email, customer.phone].filter(Boolean).join(" · ") || "No phone or email on file.";
}

export async function CustomersWorkspaceShell({
  searchParams
}: CustomersWorkspaceShellProps) {
  const context = await requireCompanyContext();
  const resolvedSearchParams = searchParams
    ? await searchParams
    : ({} as CustomerWorkspaceSearchParams);

  const query =
    typeof resolvedSearchParams.query === "string" ? resolvedSearchParams.query.trim() : "";
  const customerActionLabels = getCustomerActionLabels(context.membership.role);
  const customerRoleFocus = getCustomerRoleFocus(context.membership.role);
  const customerInspectorRoleFocus = getCustomerInspectorRoleFocus(context.membership.role);
  const requestedCustomerId =
    readCustomerWorkspaceCustomerId(resolvedSearchParams.customerId) ?? null;
  const requestedMode = normalizeCustomerWorkspaceMode(
    resolvedSearchParams.mode,
    "workspace"
  );
  const rawSegment = readSingleSearchParam(resolvedSearchParams.segment) ?? "";
  const requestedSegment = normalizeCustomerRegistrySegment(rawSegment);
  const useRoleDefaultSegment = Boolean(!rawSegment && !query);
  const currentSegment = useRoleDefaultSegment ? customerRoleFocus.defaultValue : requestedSegment;
  const currentTab = normalizeCustomerWorkspaceTab(resolvedSearchParams.tab);
  const newCustomer = readBooleanSearchParam(resolvedSearchParams.newCustomer);
  const editCustomer = readBooleanSearchParam(resolvedSearchParams.editCustomer);
  const newAddress = readBooleanSearchParam(resolvedSearchParams.newAddress);
  const editAddressId = readSingleSearchParam(resolvedSearchParams.editAddressId) ?? null;
  const newVehicle = readBooleanSearchParam(resolvedSearchParams.newVehicle);
  const editVehicleId = readSingleSearchParam(resolvedSearchParams.editVehicleId) ?? null;
  const requestedSelectedVehicleId =
    readSelectedVehicleIdSearchParam(resolvedSearchParams.selectedVehicleId) ?? null;
  const historyFilters = parseCustomerServiceHistorySearchParams(resolvedSearchParams);
  const vehicleHistoryFilters = parseVehicleServiceHistorySearchParams(resolvedSearchParams);

  const customersResult = await listCustomersByCompany(context.supabase, context.companyId, {
    includeInactive: true,
    ...(query ? { query } : {})
  });

  if (customersResult.error) {
    throw toServerError(customersResult.error, "Customers could not load customers.");
  }

  const customers = customersResult.data ?? [];
  const activeCount = customers.filter((customer) => customer.isActive).length;
  const customerIds = customers.map((customer) => customer.id);
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  const [registryAddressesResult, registryVehiclesResult, jobsResult] = customerIds.length
    ? await Promise.all([
        context.supabase
          .from("customer_addresses")
          .select("*")
          .in("customer_id", customerIds)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true })
          .returns<AddressRow[]>(),
        context.supabase
          .from("vehicles")
          .select("*")
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .returns<VehicleRow[]>(),
        context.supabase
          .from("jobs")
          .select("*")
          .in("customer_id", customerIds)
          .order("created_at", { ascending: false })
          .returns<JobRow[]>()
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];

  if (registryAddressesResult.error) {
    throw toServerError(
      registryAddressesResult.error,
      "Customers could not load service sites."
    );
  }

  if (registryVehiclesResult.error) {
    throw toServerError(
      registryVehiclesResult.error,
      "Customers could not load customer vehicles."
    );
  }

  if (jobsResult.error) {
    throw toServerError(jobsResult.error, "Customers could not load visits.");
  }

  const vehiclesById = new Map((registryVehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]));

  const registryJobIds = (jobsResult.data ?? []).map((job) => job.id);
  const [
    registryEstimatesResult,
    registryInvoicesResult,
    registryCommunicationsResult,
    registryOpenPartRequestsResult,
    registryInventoryIssuesResult
  ] =
    registryJobIds.length || customerIds.length
      ? await Promise.all([
          registryJobIds.length
            ? context.supabase
                .from("estimates")
                .select("*")
                .in("job_id", registryJobIds)
                .returns<EstimateRow[]>()
            : Promise.resolve({ data: [], error: null }),
          registryJobIds.length
            ? context.supabase
                .from("invoices")
                .select("*")
                .in("job_id", registryJobIds)
                .returns<InvoiceRow[]>()
            : Promise.resolve({ data: [], error: null }),
          customerIds.length
            ? context.supabase
                .from("customer_communications")
                .select("*")
                .in("customer_id", customerIds)
                .order("created_at", { ascending: false })
                .returns<CustomerCommunicationRow[]>()
            : Promise.resolve({ data: [], error: null }),
          registryJobIds.length
            ? context.supabase
                .from("part_requests")
                .select("job_id, status")
                .eq("company_id", context.companyId)
                .eq("status", "open")
                .in("job_id", registryJobIds)
                .returns<Array<Pick<Database["public"]["Tables"]["part_requests"]["Row"], "job_id" | "status">>>()
            : Promise.resolve({ data: [], error: null }),
          registryJobIds.length
            ? context.supabase
                .from("job_inventory_issues")
                .select("job_id, status")
                .eq("company_id", context.companyId)
                .in("job_id", registryJobIds)
                .returns<
                  Array<
                    Pick<Database["public"]["Tables"]["job_inventory_issues"]["Row"], "job_id" | "status">
                  >
                >()
            : Promise.resolve({ data: [], error: null })
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null }
        ];

  if (registryEstimatesResult.error) {
    throw toServerError(
      registryEstimatesResult.error,
      "Customers could not load estimates."
    );
  }

  if (registryInvoicesResult.error) {
    throw toServerError(
      registryInvoicesResult.error,
      "Customers could not load invoices."
    );
  }

  if (registryCommunicationsResult.error) {
    throw toServerError(
      registryCommunicationsResult.error,
      "Customers could not load communications."
    );
  }

  if (registryOpenPartRequestsResult.error) {
    throw toServerError(
      registryOpenPartRequestsResult.error,
      "Customers could not load open part requests."
    );
  }

  if (registryInventoryIssuesResult.error) {
    throw toServerError(
      registryInventoryIssuesResult.error,
      "Customers could not load inventory issues."
    );
  }

  const addressesByCustomerId = new Map<string, AddressRow[]>();
  for (const row of registryAddressesResult.data ?? []) {
    const current = addressesByCustomerId.get(row.customer_id) ?? [];
    current.push(row);
    addressesByCustomerId.set(row.customer_id, current);
  }

  const vehiclesByCustomerId = new Map<string, VehicleRow[]>();
  for (const row of registryVehiclesResult.data ?? []) {
    const current = vehiclesByCustomerId.get(row.customer_id) ?? [];
    current.push(row);
    vehiclesByCustomerId.set(row.customer_id, current);
  }

  const latestJobByCustomerId = new Map<string, JobRow>();
  const latestJobByVehicleId = new Map<string, JobRow>();
  const jobsByCustomerId = new Map<string, JobRow[]>();
  for (const row of jobsResult.data ?? []) {
    const customerJobs = jobsByCustomerId.get(row.customer_id) ?? [];
    customerJobs.push(row);
    jobsByCustomerId.set(row.customer_id, customerJobs);

    const current = latestJobByCustomerId.get(row.customer_id);

    if (!current || Date.parse(getLatestJobTimestamp(row)) > Date.parse(getLatestJobTimestamp(current))) {
      latestJobByCustomerId.set(row.customer_id, row);
    }

    const vehicleCurrent = latestJobByVehicleId.get(row.vehicle_id);

    if (
      !vehicleCurrent ||
      Date.parse(getLatestJobTimestamp(row)) > Date.parse(getLatestJobTimestamp(vehicleCurrent))
    ) {
      latestJobByVehicleId.set(row.vehicle_id, row);
    }
  }

  const latestEstimateByJobId = new Map<string, EstimateRow>();
  for (const estimate of registryEstimatesResult.data ?? []) {
    const current = latestEstimateByJobId.get(estimate.job_id);

    if (!current || Date.parse(estimate.updated_at) >= Date.parse(current.updated_at)) {
      latestEstimateByJobId.set(estimate.job_id, estimate);
    }
  }

  const latestInvoiceByJobId = new Map<string, InvoiceRow>();
  for (const invoice of registryInvoicesResult.data ?? []) {
    const current = latestInvoiceByJobId.get(invoice.job_id);

    if (!current || Date.parse(invoice.updated_at) >= Date.parse(current.updated_at)) {
      latestInvoiceByJobId.set(invoice.job_id, invoice);
    }
  }
  const invoiceIdToJobId = new Map(
    (registryInvoicesResult.data ?? []).map((invoice) => [invoice.id, invoice.job_id])
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
  const openPartRequestsByJobId = (registryOpenPartRequestsResult.data ?? []).reduce<Map<string, number>>(
    (counts, request) => {
      counts.set(request.job_id, (counts.get(request.job_id) ?? 0) + 1);
      return counts;
    },
    new Map()
  );
  const inventoryIssuesByJobId = (registryInventoryIssuesResult.data ?? []).reduce<Map<string, number>>(
    (counts, issue) => {
      if (issue.status === "returned" || issue.status === "consumed") {
        return counts;
      }

      counts.set(issue.job_id, (counts.get(issue.job_id) ?? 0) + 1);
      return counts;
    },
    new Map()
  );
  const blockerEstimatesByJobId = new Map(
    [...latestEstimateByJobId.entries()].map(([jobId, estimate]) => [
      jobId,
      {
        sentAt: estimate.sent_at,
        status: estimate.status
      }
    ])
  );
  const blockerInvoicesByJobId = new Map(
    [...latestInvoiceByJobId.entries()].map(([jobId, invoice]) => [
      jobId,
      {
        balanceDueCents: invoice.balance_due_cents,
        status: invoice.status,
        updatedAt: invoice.updated_at
      }
    ])
  );
  const registryWorkspaceBlockers = buildWorkspaceBlockerSummary({
    estimatesByJobId: blockerEstimatesByJobId,
    inventoryIssuesByJobId,
    invoicesByJobId: blockerInvoicesByJobId,
    jobs: (jobsResult.data ?? [])
      .filter((job) => {
        if (isActiveVisitStatus(job.status)) {
          return true;
        }

        if ((openPaymentHandoffCountByJobId.get(job.id) ?? 0) > 0) {
          return true;
        }

        const invoice = latestInvoiceByJobId.get(job.id);
        return Boolean(invoice && invoice.balance_due_cents > 0 && invoice.status !== "paid" && invoice.status !== "void");
      })
      .map((job) => ({
        customerDisplayName: customersById.get(job.customer_id)
          ? customersById.get(job.customer_id)!.displayName
          : "Customer",
        id: job.id,
        status: job.status,
        title: job.title,
        vehicleDisplayName: vehiclesById.get(job.vehicle_id)
          ? getVehicleSummary(vehiclesById.get(job.vehicle_id)!).displayName
          : "Vehicle"
      })),
    paymentHandoffSummaryByJobId,
    openPaymentHandoffCountByJobId,
    openPartRequestsByJobId
  });

  const latestCommunicationAtByCustomerId = new Map<string, string>();
  for (const communication of registryCommunicationsResult.data ?? []) {
    if (!latestCommunicationAtByCustomerId.has(communication.customer_id)) {
      latestCommunicationAtByCustomerId.set(communication.customer_id, communication.created_at);
    }
  }

  const registryPromiseSummaryByCustomerId = new Map<string, ReturnType<typeof getCustomerPromiseSummary>>();
  const registryTrustSummaryByCustomerId = new Map<string, ReturnType<typeof getCustomerTrustSummary>>();
  const registryServiceThreadSummaryByCustomerId = new Map<
    string,
    ReturnType<typeof getServiceThreadSummary>
  >();

  for (const customer of customers) {
    const customerJobs = jobsByCustomerId.get(customer.id) ?? [];
    const activeCustomerJobs = customerJobs.filter((job) => isActiveVisitStatus(job.status));
    const activeFollowUpJobs = activeCustomerJobs.filter((job) => isFollowUpVisitTitle(job.title));
    const leadThreadJob = activeCustomerJobs[0] ?? customerJobs[0] ?? null;
    const latestPromiseAtForCustomer = activeCustomerJobs.reduce<string | null>((latest, job) => {
      const promisedAt = job.scheduled_start_at;

      if (!promisedAt) {
        return latest;
      }

      if (!latest) {
        return promisedAt;
      }

      return Date.parse(promisedAt) < Date.parse(latest) ? promisedAt : latest;
    }, null);
    const pendingApprovalCountForCustomer = activeCustomerJobs.filter(
      (job) => latestEstimateByJobId.get(job.id)?.status === "sent"
    ).length;
    const openBalanceCentsForCustomer = activeCustomerJobs.reduce((sum, job) => {
      const invoice = latestInvoiceByJobId.get(job.id);

      if (!invoice || invoice.status === "paid" || invoice.status === "void") {
        return sum;
      }

      return sum + Math.max(invoice.balance_due_cents ?? 0, 0);
    }, 0);
    const promiseSummary = getCustomerPromiseSummary({
      activeVisits: activeCustomerJobs.map((job) => ({
        jobStatus: job.status,
        scheduledStartAt: job.scheduled_start_at
      })),
      latestCommunicationAt: latestCommunicationAtByCustomerId.get(customer.id) ?? null
    });
    const trustSummary = getCustomerTrustSummary({
      activeFollowUpVisitCount: activeFollowUpJobs.length,
      activeVisitCount: activeCustomerJobs.length,
      latestCommunicationAt: latestCommunicationAtByCustomerId.get(customer.id) ?? null,
      latestPromiseAt: latestPromiseAtForCustomer,
      openBalanceCents: openBalanceCentsForCustomer,
      pendingApprovalCount: pendingApprovalCountForCustomer,
      promiseRisk: promiseSummary.breachRisk
    });

    registryPromiseSummaryByCustomerId.set(customer.id, promiseSummary);
    registryTrustSummaryByCustomerId.set(customer.id, trustSummary);
    if (leadThreadJob) {
      registryServiceThreadSummaryByCustomerId.set(
        customer.id,
        getServiceThreadSummary({
          estimate: (latestEstimateByJobId.get(leadThreadJob.id) ?? null)
            ? {
                estimateNumber: latestEstimateByJobId.get(leadThreadJob.id)?.estimate_number ?? null,
                status: latestEstimateByJobId.get(leadThreadJob.id)?.status ?? "draft",
                totalCents: latestEstimateByJobId.get(leadThreadJob.id)?.total_cents ?? null
              }
            : null,
          followUpSummary: activeFollowUpJobs.length
            ? {
                copy: "Return-work context is still active on this relationship.",
                hasChainContext: true,
                label:
                  activeFollowUpJobs.length === 1
                    ? "Return visit active"
                    : `${activeFollowUpJobs.length} return visits active`,
                shouldCreateReturnVisit: false,
                staleFollowUp: activeFollowUpJobs.some((job) =>
                  isActiveVisitStatus(job.status) && !job.scheduled_start_at
                ),
                tone: "brand"
              }
            : null,
          invoice: (latestInvoiceByJobId.get(leadThreadJob.id) ?? null)
            ? {
                balanceDueCents: latestInvoiceByJobId.get(leadThreadJob.id)?.balance_due_cents ?? null,
                invoiceNumber: latestInvoiceByJobId.get(leadThreadJob.id)?.invoice_number ?? null,
                status: latestInvoiceByJobId.get(leadThreadJob.id)?.status ?? "draft",
                totalCents: latestInvoiceByJobId.get(leadThreadJob.id)?.total_cents ?? null
              }
            : null,
          job: {
            status: leadThreadJob.status
          }
        })
      );
    }
  }

  const registryCustomers = customers
    .filter((customer) =>
      matchesCustomerRegistrySegment(
        customer,
        addressesByCustomerId.get(customer.id) ?? [],
        vehiclesByCustomerId.get(customer.id) ?? [],
        latestJobByCustomerId.get(customer.id) ?? null,
        currentSegment
      )
    )
    .sort((left, right) => {
      const leftTrust = registryTrustSummaryByCustomerId.get(left.id);
      const rightTrust = registryTrustSummaryByCustomerId.get(right.id);
      const trustRiskDelta =
        getTrustRiskRank(rightTrust?.risk ?? "none") - getTrustRiskRank(leftTrust?.risk ?? "none");

      if (trustRiskDelta !== 0) {
        return trustRiskDelta;
      }

      const trustScoreDelta = (leftTrust?.score ?? 100) - (rightTrust?.score ?? 100);

      if (trustScoreDelta !== 0) {
        return trustScoreDelta;
      }

      const leftThreadPressure = getServiceThreadPressureScore(
        registryServiceThreadSummaryByCustomerId.get(left.id) ?? {
          copy: "",
          label: "Thread visible",
          nextActionLabel: "Monitor only",
          segments: [],
          tone: "neutral"
        }
      );
      const rightThreadPressure = getServiceThreadPressureScore(
        registryServiceThreadSummaryByCustomerId.get(right.id) ?? {
          copy: "",
          label: "Thread visible",
          nextActionLabel: "Monitor only",
          segments: [],
          tone: "neutral"
        }
      );

      if (leftThreadPressure !== rightThreadPressure) {
        return rightThreadPressure - leftThreadPressure;
      }

      const leftLatestJob = latestJobByCustomerId.get(left.id);
      const rightLatestJob = latestJobByCustomerId.get(right.id);
      const leftLatestTimestamp = leftLatestJob ? Date.parse(getLatestJobTimestamp(leftLatestJob)) : 0;
      const rightLatestTimestamp = rightLatestJob ? Date.parse(getLatestJobTimestamp(rightLatestJob)) : 0;

      if (leftLatestTimestamp !== rightLatestTimestamp) {
        return rightLatestTimestamp - leftLatestTimestamp;
      }

      return left.displayName.localeCompare(right.displayName);
    });
  let currentMode: CustomerWorkspaceMode = requestedMode;

  if (currentMode === "database") {
    currentMode = "workspace";
  }

  const selectedCustomerSummary =
    currentMode === "workspace"
      ? registryCustomers.find((customer) => customer.id === requestedCustomerId) ??
        registryCustomers[0] ??
        null
      : customers.find((customer) => customer.id === requestedCustomerId) ?? null;
  const selectedCustomerId = selectedCustomerSummary?.id ?? null;

  const [
    customerResult,
    selectedAddressesResult,
    selectedVehiclesResult,
    communicationsResult,
    history
  ] = selectedCustomerId
    ? await Promise.all([
        getCustomerById(context.supabase, selectedCustomerId),
        listAddressesByCustomer(context.supabase, selectedCustomerId),
        listVehiclesByCustomer(context.supabase, selectedCustomerId),
        listCustomerCommunications(context.supabase, selectedCustomerId, { limit: 18 }),
        getCustomerServiceHistory(
          context.supabase,
          context.companyId,
          selectedCustomerId,
          historyFilters
        )
      ])
    : [null, null, null, null, null];

  if (customerResult?.error) {
    throw toServerError(
      customerResult.error,
      "Customers could not load the selected customer."
    );
  }

  if (selectedAddressesResult?.error) {
    throw toServerError(
      selectedAddressesResult.error,
      "Customers could not load service sites for the selected customer."
    );
  }

  if (selectedVehiclesResult?.error) {
    throw toServerError(
      selectedVehiclesResult.error,
      "Customers could not load vehicles for the selected customer."
    );
  }

  if (communicationsResult?.error) {
    throw toServerError(
      communicationsResult.error,
      "Customers could not load communications for the selected customer."
    );
  }

  const customer = customerResult?.data ?? null;
  const addresses = selectedAddressesResult?.data ?? [];
  const vehicles = selectedVehiclesResult?.data ?? [];
  const communications = communicationsResult?.data ?? [];
  const primaryAddress = getPrimaryAddress(addresses);
  const billingAddresses = addresses.filter((address) => address.label === "billing");
  const primaryBillingAddress = getPrimaryAddress(billingAddresses);
  const fleetUnits = vehicles.filter((vehicle) => vehicle.ownershipType === "fleet_account_asset");
  const activeFleetUnits = fleetUnits.filter((vehicle) => vehicle.isActive);
  const customerOwnedVehicles = vehicles.filter(
    (vehicle) => vehicle.ownershipType !== "fleet_account_asset"
  );
  const selectedCustomerRecordHealth = customer
    ? getCustomerRecordHealth(customer, addresses, vehicles)
    : null;
  const customerReadinessIssues = customer
    ? [
        !customer.email && !customer.phone ? "Add contact details" : null,
        addresses.length === 0 ? "Add a service location" : null,
        vehicles.length === 0 ? "Attach a vehicle" : null,
        communications.length === 0 ? "Log the first customer update" : null
      ].filter((item): item is string => Boolean(item))
    : [];
  const canMutateCustomer = Boolean(customer && context.canEditRecords && customer.isActive);
  const latestVehicleServiceMap = getLatestVehicleServiceMap(history?.visits ?? []);
  const activeVisits = (history?.visits ?? []).filter((visit) => isActiveVisitStatus(visit.jobStatus));
  const followUpVisits = (history?.visits ?? []).filter((visit) =>
    isFollowUpVisitTitle(visit.jobTitle)
  );
  const activeFollowUpVisits = followUpVisits.filter(
    (visit) => visit.jobStatus !== "completed" && visit.jobStatus !== "canceled"
  );
  const latestFollowUpVisit = activeFollowUpVisits[0] ?? followUpVisits[0] ?? null;
  const pendingApprovalCount = activeVisits.filter((visit) => visit.estimate?.status === "sent").length;
  const openBalanceCents = history?.summary.openBalanceCents ?? 0;
  const followUpRecoveryOwner = activeFollowUpVisits.length
    ? activeFollowUpVisits.some((visit) => visit.jobStatus === "completed")
      ? "Finance / service advisor"
      : "Dispatch / service advisor"
    : "No return-work owner";
  const selectedCustomerJobs = selectedCustomerId ? jobsByCustomerId.get(selectedCustomerId) ?? [] : [];
  const siteOperationalRows = addresses
    .map((address) => {
      const siteJobs = selectedCustomerJobs.filter(
        (job) =>
          job.service_site_id === address.id ||
          (!job.service_site_id && primaryAddress?.id === address.id)
      );
      const activeSiteJobs = siteJobs.filter((job) => isActiveVisitStatus(job.status));
      const latestSiteJob =
        [...siteJobs].sort(
          (left, right) =>
            Date.parse(getLatestJobTimestamp(right)) - Date.parse(getLatestJobTimestamp(left))
        )[0] ?? null;
      const pendingApprovals = activeSiteJobs.filter(
        (job) => latestEstimateByJobId.get(job.id)?.status === "sent"
      ).length;
      const supplyBlockedCount = siteJobs.reduce(
        (sum, job) => sum + (openPartRequestsByJobId.get(job.id) ?? 0),
        0
      );
      const openBalanceAtSite = siteJobs.reduce((sum, job) => {
        const invoice = latestInvoiceByJobId.get(job.id);

        if (!invoice || invoice.status === "paid" || invoice.status === "void") {
          return sum;
        }

        return sum + Math.max(invoice.balance_due_cents ?? 0, 0);
      }, 0);
      const hasPlaybook = Boolean(
        address.serviceContactName ||
          address.serviceContactPhone ||
          address.accessWindowNotes ||
          address.gateCode ||
          address.parkingNotes
      );

      return {
        activeVisitCount: activeSiteJobs.length,
        address,
        hasPlaybook,
        latestSiteJob,
        openBalanceAtSite,
        pendingApprovals,
        supplyBlockedCount,
        totalVisitCount: siteJobs.length
      };
    })
    .sort((left, right) => {
      if (left.address.isPrimary !== right.address.isPrimary) {
        return left.address.isPrimary ? -1 : 1;
      }

      if (left.activeVisitCount !== right.activeVisitCount) {
        return right.activeVisitCount - left.activeVisitCount;
      }

      return right.totalVisitCount - left.totalVisitCount;
    });
  const activeSiteCount = siteOperationalRows.filter((site) => site.address.isActive).length;
  const activeSiteVisitCount = siteOperationalRows.reduce(
    (sum, site) => sum + site.activeVisitCount,
    0
  );
  const sitesMissingPlaybookCount = siteOperationalRows.filter(
    (site) => site.address.isActive && !site.hasPlaybook
  ).length;
  const dominantSite = siteOperationalRows[0] ?? null;
  const selectedCustomerWorkspaceBlockers = selectedCustomerId
    ? buildWorkspaceBlockerSummary({
        estimatesByJobId: blockerEstimatesByJobId,
        inventoryIssuesByJobId,
        invoicesByJobId: blockerInvoicesByJobId,
        jobs: selectedCustomerJobs
          .filter((job) => {
            if (isActiveVisitStatus(job.status)) {
              return true;
            }

            if ((openPaymentHandoffCountByJobId.get(job.id) ?? 0) > 0) {
              return true;
            }

            const invoice = latestInvoiceByJobId.get(job.id);
            return Boolean(
              invoice && invoice.balance_due_cents > 0 && invoice.status !== "paid" && invoice.status !== "void"
            );
          })
          .map((job) => ({
            customerDisplayName: customer ? getCustomerDisplayName(customer) : "Customer",
            id: job.id,
            status: job.status,
            title: job.title,
            vehicleDisplayName: vehiclesById.get(job.vehicle_id)
              ? getVehicleSummary(vehiclesById.get(job.vehicle_id)!).displayName
              : "Vehicle"
          })),
        paymentHandoffSummaryByJobId,
        openPaymentHandoffCountByJobId,
        openPartRequestsByJobId
      })
    : null;
  const selectedCustomerSupplyBlocker = selectedCustomerWorkspaceBlockers?.supplyBlockedItems[0] ?? null;
  const selectedCustomerFinanceBlocker = selectedCustomerWorkspaceBlockers?.financeBlockedItems[0] ?? null;
  const selectedCustomerReleaseBlockerCount = selectedCustomerWorkspaceBlockers?.approvedReleaseCount ?? 0;
  const selectedCustomerSupplyBlockerCount = selectedCustomerWorkspaceBlockers?.supplyBlockedCount ?? 0;
  const selectedCustomerFinanceBlockerCount = selectedCustomerWorkspaceBlockers?.financeBlockedCount ?? 0;
  const selectedCustomerBlockerCard = selectedCustomerWorkspaceBlockers
    ? selectedCustomerSupplyBlockerCount > 0
      ? {
          copy: `${selectedCustomerSupplyBlockerCount} visit${selectedCustomerSupplyBlockerCount === 1 ? " is" : "s are"} waiting on parts or inventory recovery before the relationship can move cleanly again.`,
          label: "Supply blocked",
          tone: "warning" as const,
          value: `${selectedCustomerSupplyBlockerCount} blocked`
        }
      : selectedCustomerFinanceBlockerCount > 0
        ? {
            copy:
              (selectedCustomerFinanceBlocker?.openPaymentHandoffCount ?? 0) > 0
                ? `${selectedCustomerFinanceBlockerCount} visit${selectedCustomerFinanceBlockerCount === 1 ? " has" : "s have"} technician billing handoffs that office still needs to reconcile before this relationship is actually closed.`
                : `${selectedCustomerFinanceBlockerCount} visit${selectedCustomerFinanceBlockerCount === 1 ? " still needs" : "s still need"} finance follow-through before the customer thread is actually closed.`,
            label: "Closeout pressure",
            tone: "brand" as const,
            value: `${selectedCustomerFinanceBlockerCount} active`
          }
        : selectedCustomerReleaseBlockerCount > 0
          ? {
              copy: `${selectedCustomerReleaseBlockerCount} approved visit${selectedCustomerReleaseBlockerCount === 1 ? " is" : "s are"} ready for dispatch handoff from this customer thread.`,
              label: "Release handoff",
              tone: "accent" as const,
              value: `${selectedCustomerReleaseBlockerCount} ready`
            }
          : {
              copy: "No shared workflow blocker is currently interrupting this customer relationship.",
              label: "Workflow blockers",
              tone: "success" as const,
              value: "Clear"
            }
    : null;
  const latestPromiseAt = activeVisits.reduce<string | null>((latest, visit) => {
    if (!visit.scheduledStartAt) {
      return latest;
    }

    if (!latest) {
      return visit.scheduledStartAt;
    }

    return Date.parse(visit.scheduledStartAt) < Date.parse(latest) ? visit.scheduledStartAt : latest;
  }, null);
  const customerPromiseSummary = getCustomerPromiseSummary({
    activeVisits: activeVisits.map((visit) => ({
      jobStatus: visit.jobStatus,
      scheduledStartAt: visit.scheduledStartAt
    })),
    latestCommunicationAt: communications[0]?.createdAt ?? null
  });
  const trustSummary = getCustomerTrustSummary({
    activeFollowUpVisitCount: activeFollowUpVisits.length,
    activeVisitCount: activeVisits.length,
    latestCommunicationAt: communications[0]?.createdAt ?? null,
    latestPromiseAt,
    openBalanceCents,
    pendingApprovalCount,
    promiseRisk: customerPromiseSummary.breachRisk
  });
  const approvalRiskSummary = getCustomerApprovalRiskSummary({
    activeVisitCount: activeVisits.length,
    pendingApprovalCount
  });
  const leadServiceVisit = activeVisits[0] ?? activeFollowUpVisits[0] ?? history?.visits[0] ?? null;
  const customerServiceThreadSummary = leadServiceVisit
    ? getServiceThreadSummary({
        estimate: leadServiceVisit.estimate
          ? {
              estimateNumber: leadServiceVisit.estimate.estimateNumber,
              status: leadServiceVisit.estimate.status,
              totalCents: leadServiceVisit.estimate.totalCents
            }
          : null,
        followUpSummary: activeFollowUpVisits.length
          ? {
              copy: latestFollowUpVisit
                ? `Latest linked return visit is ${latestFollowUpVisit.jobTitle}.`
                : "Return-work context is still active on this customer thread.",
              hasChainContext: true,
              label:
                activeFollowUpVisits.length === 1
                  ? "Return visit active"
                  : `${activeFollowUpVisits.length} return visits active`,
              shouldCreateReturnVisit: false,
              staleFollowUp: false,
              tone: "brand"
            }
          : null,
        invoice: leadServiceVisit.invoice
          ? {
              amountPaidCents: leadServiceVisit.invoice.amountPaidCents,
              balanceDueCents: leadServiceVisit.invoice.balanceDueCents,
              invoiceNumber: leadServiceVisit.invoice.invoiceNumber,
              status: leadServiceVisit.invoice.status,
              totalCents: leadServiceVisit.invoice.totalCents
            }
          : null,
        job: {
          status: leadServiceVisit.jobStatus
        }
      })
    : null;
  const balanceRiskSummary = getCustomerBalanceRiskSummary(openBalanceCents);
  const followUpRiskSummary = getCustomerFollowUpRiskSummary({
    activeFollowUpVisitCount: activeFollowUpVisits.length,
    followUpRecoveryOwner
  });
  const customerNextMove = customer
    ? getCustomerNextMove({
        activeFollowUpVisits,
        activeVisits,
        customerId: customer.id,
        customerName: getCustomerDisplayName(customer),
        openBalanceCents
      })
    : null;
  const customerDisplayName = customer ? getCustomerDisplayName(customer) : "";
  const customerThreadAction = customer && leadServiceVisit && customerServiceThreadSummary
    ? getCustomerThreadActionTarget({
        customerName: customerDisplayName,
        leadVisit: {
          jobId: leadServiceVisit.jobId,
          vehicleId: leadServiceVisit.vehicleId
        },
        summary: customerServiceThreadSummary,
        threadIntent: getServiceThreadActionIntent(customerServiceThreadSummary)
      })
    : null;
  const customerRiskAction = customer
    ? getCustomerRiskAction({
        activeFollowUpVisitCount: activeFollowUpVisits.length,
        customerDisplayName,
        customerNextMove,
        openBalanceCents,
        pendingApprovalCount,
        promiseRisk: customerPromiseSummary.breachRisk,
        selectedCustomerFinanceBlocker,
        selectedCustomerSupplyBlocker,
        trustRisk: trustSummary.risk
      })
    : null;
  const customerActionTarget = customerRiskAction ?? customerThreadAction ?? customerNextMove;
  const relationshipTypeLabel = customer
    ? customer.relationshipType === "fleet_account"
      ? "Fleet account"
      : "Retail customer"
    : "Customer";
  const isFleetAccount = customer?.relationshipType === "fleet_account";
  const customerServiceSiteThreadSummary = buildServiceSiteThreadSummary({
    activeVisitCount: activeSiteVisitCount,
    commercialAccountMode: isFleetAccount ? "fleet_account" : "retail_customer",
    linkedAssetCount: isFleetAccount ? fleetUnits.length : vehicles.length,
    linkedVisitCount: siteOperationalRows.reduce((sum, site) => sum + site.totalVisitCount, 0),
    site: dominantSite?.address ?? primaryAddress ?? null
  });
  const customerHasServiceSitePlaybook = customerServiceSiteThreadSummary.playbookState === "ready";
  const customerContinuityThreadCount = Math.max(activeVisits.length + activeFollowUpVisits.length, 1);
  const customerReadyThreadCount = Math.max(
    activeVisits.length + activeFollowUpVisits.length - selectedCustomerSupplyBlockerCount - pendingApprovalCount,
    0
  );
  const customerPromiseConfidence = derivePromiseConfidenceSnapshot({
    hasServiceSitePlaybook: customerHasServiceSitePlaybook,
    hasSupplyRisk: selectedCustomerSupplyBlockerCount > 0,
    promiseSummary: {
      confidencePercent: customerPromiseSummary.confidencePercent,
      copy: customerPromiseSummary.copy,
      recommendedAction: customerPromiseSummary.breachRisk === "none" ? null : "set_promise"
    },
    readinessSummary: {
      readyCount: customerReadyThreadCount,
      score: customerContinuityThreadCount
        ? Math.round((customerReadyThreadCount / customerContinuityThreadCount) * 100)
        : customerHasServiceSitePlaybook
          ? 100
          : 0,
      totalCount: customerContinuityThreadCount
    },
    releaseRunwayState: null,
    trustSummary
  });
  const customerHasLiveRoute = leadServiceVisit
    ? isTechnicianActiveFieldJobStatus(leadServiceVisit.jobStatus)
    : false;
  const customerRouteConfidence =
    leadServiceVisit &&
    leadServiceVisit.jobStatus !== "completed" &&
    leadServiceVisit.jobStatus !== "canceled"
      ? deriveRouteConfidenceSnapshot({
          hasLiveGps: true,
          hasPartsConfidence: selectedCustomerSupplyBlockerCount === 0,
          hasServiceSitePlaybook: customerHasServiceSitePlaybook,
          hasTechnicianReadiness: leadServiceVisit.jobStatus !== "new",
          laneSlackMinutes:
            leadServiceVisit.jobStatus === "new"
              ? 15
              : leadServiceVisit.jobStatus === "scheduled"
                ? 45
                : customerHasLiveRoute
                  ? 30
                  : 60,
          promiseConfidencePercent: customerPromiseConfidence.confidencePercent,
          routeIssueCount:
            Number(!customerHasServiceSitePlaybook) +
            Number(selectedCustomerSupplyBlockerCount > 0) +
            Number(leadServiceVisit.jobStatus === "new")
        })
      : null;
  const relationshipContactName = customer ? getRelationshipContactName(customer) : "No contact on file";
  const relationshipContactChannel = customer
    ? getRelationshipContactChannel(customer)
    : "No phone or email on file.";
  const billingAnchorValue = primaryBillingAddress
    ? primaryBillingAddress.siteName ?? primaryBillingAddress.label
    : openBalanceCents > 0
      ? `${formatCurrencyFromCents(openBalanceCents)} open`
      : "No billing anchor";
  const billingAnchorCopy = primaryBillingAddress
    ? formatAddressLine(
        primaryBillingAddress.line1,
        primaryBillingAddress.line2,
        primaryBillingAddress.city,
        primaryBillingAddress.state,
        primaryBillingAddress.postalCode,
        primaryBillingAddress.country
      )
    : openBalanceCents > 0
      ? "Finance still has open balance on this account, but no dedicated billing site or contact is attached yet."
      : "Add a billing site or billing contact so commercial closeout does not rely on freeform notes.";
  const accountUnitValue = activeFleetUnits.length
    ? `${activeFleetUnits.length} active unit${activeFleetUnits.length === 1 ? "" : "s"}`
    : fleetUnits.length
      ? `${fleetUnits.length} unit${fleetUnits.length === 1 ? "" : "s"}`
      : customerOwnedVehicles.length
        ? `${customerOwnedVehicles.length} customer vehicle${
            customerOwnedVehicles.length === 1 ? "" : "s"
          }`
        : "No units on file";
  const accountUnitCopy = fleetUnits.length
    ? `${customerOwnedVehicles.length ? `${customerOwnedVehicles.length} customer vehicle${customerOwnedVehicles.length === 1 ? "" : "s"} also stay attached to the account thread.` : "Fleet-managed units stay attached to the service-site and billing thread instead of living as a separate desk."}`
    : "Add the first account unit or parked asset so repeat service context belongs to the relationship, not a disconnected vehicle list.";
  const relationshipThreadEyebrow =
    customer?.relationshipType === "fleet_account" ? "Active account thread" : "Active relationship thread";
  const customerVehiclesHref = customer
    ? buildCustomerWorkspaceHref(customer.id, { query, tab: "vehicles" })
    : "/dashboard/customers";
  const customerActivityHref = customer
    ? buildCustomerWorkspaceHref(customer.id, { query, tab: "activity" })
    : "/dashboard/customers";
  const customerSupplyDeskHref = selectedCustomerSupplyBlocker
    ? `/dashboard/visits/${selectedCustomerSupplyBlocker.jobId}/inventory`
    : "/dashboard/supply";
  const customerFinanceDeskHref = customerDisplayName
    ? `/dashboard/finance?query=${encodeURIComponent(customerDisplayName)}`
    : "/dashboard/finance";
  const customerCloseoutHref = selectedCustomerFinanceBlocker
    ? `/dashboard/visits/${selectedCustomerFinanceBlocker.jobId}/invoice`
    : customerFinanceDeskHref;
  const customerOperationalBadges: OperationalFocusBadge[] = customer
    ? [
        { label: customerPromiseConfidence.label, tone: customerPromiseConfidence.tone },
        customerRouteConfidence
          ? {
              label: customerRouteConfidence.label,
              tone: customerRouteConfidence.tone
            }
          : null,
        customerServiceSiteThreadSummary
          ? {
              label: customerServiceSiteThreadSummary.label,
              tone: customerServiceSiteThreadSummary.tone
            }
          : null
      ].filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  const customerOperationalBlockers: OperationalFocusItem[] = customer
    ? [
        pendingApprovalCount
          ? {
              detail: `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? " is" : "s are"} still unresolved on this relationship and blocking real work movement.`,
              label: "Approval",
              tone: "warning" as const,
              value: `${pendingApprovalCount} waiting`
            }
          : null,
        selectedCustomerSupplyBlockerCount
          ? {
              detail: `${selectedCustomerSupplyBlockerCount} active visit${selectedCustomerSupplyBlockerCount === 1 ? " is" : "s are"} waiting on supply resolution before the relationship can move cleanly.`,
              label: "Supply",
              tone: "warning" as const,
              value: `${selectedCustomerSupplyBlockerCount} blocked`
            }
          : null,
        activeFollowUpVisits.length
          ? {
              detail: `${activeFollowUpVisits.length} follow-up visit${activeFollowUpVisits.length === 1 ? " is" : "s are"} still open and need a clear recovery owner before this customer thread feels stable.`,
              label: "Return work",
              tone: "brand" as const,
              value: `${activeFollowUpVisits.length} active`
            }
          : null,
        openBalanceCents > 0
          ? {
              detail: `${formatCurrencyFromCents(openBalanceCents)} is still open on this relationship and should be treated as part of the customer thread, not detached back-office cleanup.`,
              label: "Closeout",
              tone: "brand" as const,
              value: formatCurrencyFromCents(openBalanceCents)
            }
          : null
      ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 4)
    : [];
  const customerOperationalFollowThrough: OperationalFocusItem[] = customer
    ? [
        {
          detail: `${customerPromiseSummary.nextUpdateLabel} · ${customerPromiseConfidence.label}`,
          label: "Promise owner",
          value: customerPromiseSummary.owner
        },
        {
          detail: trustSummary.copy,
          label: "Trust state",
          value: trustSummary.label
        },
        customerServiceThreadSummary
          ? {
              detail: customerServiceThreadSummary.segments
                .map((segment) => `${segment.label}: ${segment.value}`)
                .join(" · "),
              label: "Service thread",
              value: customerServiceThreadSummary.nextActionLabel
            }
          : null
       ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3)
    : [];
  const customerBillingThreadSignal: OperationalFocusItem | null = isFleetAccount
    ? {
        detail: billingAnchorCopy,
        label: "Billing anchor",
        tone: primaryBillingAddress
          ? ("neutral" as const)
          : openBalanceCents > 0
            ? ("warning" as const)
            : ("brand" as const),
        value: billingAnchorValue
      }
    : null;
  const customerUnitsThreadSignal: OperationalFocusItem | null = isFleetAccount
    ? {
        detail: accountUnitCopy,
        label: "Recurring units",
        tone: activeFleetUnits.length ? ("brand" as const) : ("neutral" as const),
        value: accountUnitValue
        }
      : null;
  const customerRouteThreadSignal: OperationalFocusItem | null = customerRouteConfidence
    ? {
        detail: customerRouteConfidence.copy,
        label: "Route confidence",
        tone: customerRouteConfidence.tone,
        value: `${customerRouteConfidence.confidencePercent}%`
      }
    : null;
  const customerSiteThreadSignal: OperationalFocusItem | null = dominantSite
    ? {
        detail: customerServiceSiteThreadSummary.copy,
        label: customer?.relationshipType === "fleet_account" ? "Account site" : "Site thread",
        tone: sitesMissingPlaybookCount
          ? ("warning" as const)
          : dominantSite.activeVisitCount
            ? ("brand" as const)
            : ("neutral" as const),
        value: customerServiceSiteThreadSummary.siteLabel
      }
    : activeSiteCount
      ? {
          detail: customerServiceSiteThreadSummary.copy,
          label: customerServiceSiteThreadSummary.label,
          tone: sitesMissingPlaybookCount ? ("warning" as const) : ("brand" as const),
          value: customerServiceSiteThreadSummary.siteLabel
        }
      : null;
  const customerThreadSignals: OperationalFocusItem[] = (
    isFleetAccount
      ? [
          customerRouteThreadSignal,
          customerSiteThreadSignal,
          customerBillingThreadSignal,
          customerUnitsThreadSignal
        ]
      : [
          customerRouteThreadSignal,
          customerSiteThreadSignal,
          customerOperationalBlockers[0] ?? null,
          customerOperationalFollowThrough[0] ?? null
        ]
  )
    .filter((item): item is OperationalFocusItem => Boolean(item))
    .slice(0, 3);

  const selectedVehicleId =
    editVehicleId ??
    requestedSelectedVehicleId ??
    historyFilters.vehicleId ??
    (currentTab === "vehicles" && !newVehicle ? vehicles[0]?.id ?? null : null);
  const selectedVehicle = selectedVehicleId
    ? vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null
    : null;
  const orderedRelationshipVehicles = isFleetAccount
    ? [...vehicles].sort((left, right) => {
        const ownershipRank = (vehicle: (typeof vehicles)[number]) =>
          vehicle.ownershipType === "fleet_account_asset" ? 0 : 1;

        if (ownershipRank(left) !== ownershipRank(right)) {
          return ownershipRank(left) - ownershipRank(right);
        }

        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }

        return left.displayName.localeCompare(right.displayName);
      })
    : vehicles;
  const customerActiveVisitHref = leadServiceVisit
    ? `/dashboard/visits/${leadServiceVisit.jobId}`
    : customer
      ? buildEstimateIntakeHref(customer.id, selectedVehicle?.id ?? vehicles[0]?.id)
      : "/dashboard/visits";
  const customerHeroDescription = customer
    ? activeVisits.length
      ? customer.relationshipType === "fleet_account"
        ? `${activeVisits.length} active visit${
            activeVisits.length === 1 ? "" : "s"
          } are moving across ${activeSiteCount || 1} service site${
            activeSiteCount === 1 ? "" : "s"
          }. Keep site memory, timing, and closeout in one account thread.`
        : `${activeVisits.length} active visit${
            activeVisits.length === 1 ? "" : "s"
          } are attached to this customer thread right now. Keep promise, vehicle, service, and money context in one place.`
      : customer.relationshipType === "fleet_account"
        ? activeSiteCount
          ? `${activeSiteCount} service site${activeSiteCount === 1 ? "" : "s"} are on file. Keep access notes, billing context, and repeat-work memory attached to the account instead of scattered across addresses.`
          : "Add the first service site, account vehicle, or billing contact here without losing the account thread."
        : primaryAddress
          ? `Primary service location on file. ${formatAddressLine(
              primaryAddress.line1,
              primaryAddress.line2,
              primaryAddress.city,
              primaryAddress.state,
              primaryAddress.postalCode,
              primaryAddress.country
            )}`
          : "Add a service location, customer vehicle, or notes here without losing customer context."
    : "";
  const siteOperationsValue = dominantSite
    ? dominantSite.address.siteName ?? dominantSite.address.label
    : activeSiteCount
      ? `${activeSiteCount} active site${activeSiteCount === 1 ? "" : "s"}`
      : "No service site on file";
  const siteOperationsCopy = dominantSite?.latestSiteJob
    ? `${dominantSite.activeVisitCount ? `${dominantSite.activeVisitCount} live visit${dominantSite.activeVisitCount === 1 ? "" : "s"} · ` : ""}${dominantSite.latestSiteJob.title}`
    : sitesMissingPlaybookCount
      ? `${sitesMissingPlaybookCount} site${sitesMissingPlaybookCount === 1 ? "" : "s"} still missing access notes, contacts, or arrival guidance.`
      : customer?.relationshipType === "fleet_account"
        ? "Run service locations like operational assets with access memory, site contacts, and repeat-work context."
        : "Keep service locations attached to the customer thread so the next visit does not restart from scratch.";
  const siteWorkspaceHref = customer
    ? buildCustomerWorkspaceHref(customer.id, {
        query,
        tab: "addresses"
      })
    : "/dashboard/customers";
  const siteOperationsPrimaryHref = dominantSite?.latestSiteJob
    ? buildVisitThreadHref(dominantSite.latestSiteJob.id, {
        returnLabel: "Back to customer sites",
        returnTo: siteWorkspaceHref
      })
    : siteWorkspaceHref;
  const siteOperationsPrimaryLabel = dominantSite?.latestSiteJob
    ? dominantSite.activeVisitCount
      ? "Open live site visit"
      : "Open latest site visit"
    : "Open service sites";
  const customerStructureActionHref =
    canMutateCustomer && customer
      ? customer.relationshipType === "fleet_account"
        ? buildCustomerWorkspaceHref(customer.id, {
            query,
            newAddress: true,
            tab: "addresses"
          })
        : buildCustomerWorkspaceHref(customer.id, {
            query,
            newVehicle: true,
            tab: "vehicles"
          })
      : null;
  const customerStructureActionLabel =
    customer?.relationshipType === "fleet_account"
      ? customerActionLabels.addAddress
      : customerActionLabels.addVehicle;

  const [selectedVehicleDetailResult, selectedVehicleHistory, carfaxSummary] = await Promise.all([
    selectedVehicle ? getVehicleById(context.supabase, selectedVehicle.id) : Promise.resolve(null),
    selectedVehicle
      ? getVehicleServiceHistory(
          context.supabase,
          context.companyId,
          selectedVehicle.id,
          vehicleHistoryFilters
        )
      : Promise.resolve(null),
    selectedVehicle
      ? readVehicleCarfaxSummaryForVehicle(context.supabase, selectedVehicle)
      : Promise.resolve(null)
  ]);

  const selectedVehicleDetail =
    selectedVehicleDetailResult?.data &&
    selectedVehicleDetailResult.data.companyId === context.companyId &&
    selectedVehicleDetailResult.data.customerId === selectedCustomerId
      ? selectedVehicleDetailResult.data
      : null;
  const editableVehicle = editVehicleId === selectedVehicleDetail?.id ? selectedVehicleDetail : null;
  const editableAddress = addresses.find((address) => address.id === editAddressId) ?? null;
  const isCarfaxConfigured = Boolean(getCarfaxConfig());
  const withPrimaryAddressCount = [...addressesByCustomerId.values()].filter((rows) =>
    rows.some((row) => row.is_primary)
  ).length;
  const routeState = {
    query: query || undefined,
    segment: currentSegment === "all" ? undefined : currentSegment
  };
  const newCustomerHref = buildCustomersHref({
    ...routeState,
    mode: currentMode,
    newCustomer: true
  });
  const clearQueryHref = buildCustomersHref({
    mode: currentMode,
    segment: currentSegment === "all" ? undefined : currentSegment
  });
  const databaseModeHref = buildCustomersHref({
    ...routeState,
    mode: "database",
    customerId: selectedCustomerId ?? undefined,
    selectedVehicleId: selectedVehicle?.id ?? undefined
  });
  const workspaceModeHref = selectedCustomerId
    ? buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: "workspace",
        selectedVehicleId: selectedVehicle?.id ?? undefined,
        tab: currentTab,
        ...(currentTab === "history" ? historyFilters : {})
      })
    : buildCustomersHref({
        ...routeState,
        mode: "workspace"
      });

  async function createCustomerAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createCustomer(actionContext.supabase, {
      companyId: actionContext.companyId,
      relationshipType: getString(formData, "relationshipType") as "retail_customer" | "fleet_account",
      companyName: getNullableString(formData, "companyName"),
      firstName: getString(formData, "firstName"),
      lastName: getString(formData, "lastName"),
      email: getNullableString(formData, "email"),
      phone: getNullableString(formData, "phone"),
      notes: getNullableString(formData, "notes"),
      isActive: formData.get("isActive") === "on"
    });

    if (result.error || !result.data) {
      throw toServerError(result.error, "Customer could not be created.");
    }

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard");
    redirect(
      buildCustomerWorkspaceHref(result.data.id, {
        ...routeState,
        mode: currentMode
      })
    );
  }

  async function assertCustomerIsMutable() {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before editing this thread.");
    }

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const latestCustomer = await getCustomerById(actionContext.supabase, selectedCustomerId);

    if (
      latestCustomer.error ||
      !latestCustomer.data ||
      latestCustomer.data.companyId !== actionContext.companyId ||
      !latestCustomer.data.isActive
    ) {
      throw new Error("Archived customers cannot be modified.");
    }

    return actionContext;
  }

  async function updateCustomerAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before editing.");
    }

    const actionContext = await assertCustomerIsMutable();
    const result = await updateCustomer(actionContext.supabase, selectedCustomerId, {
      relationshipType: getString(formData, "relationshipType") as "retail_customer" | "fleet_account",
      companyName: getNullableString(formData, "companyName"),
      firstName: getString(formData, "firstName"),
      lastName: getString(formData, "lastName"),
      email: getNullableString(formData, "email"),
      phone: getNullableString(formData, "phone"),
      notes: getNullableString(formData, "notes"),
      isActive: formData.get("isActive") === "on"
    });

    if (result.error || !result.data) {
      throw toServerError(result.error, "Customer could not be updated.");
    }

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode
      })
    );
  }

  async function createAddressAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before adding an address.");
    }

    const actionContext = await assertCustomerIsMutable();
    const result = await createCustomerAddress(actionContext.supabase, {
      customerId: selectedCustomerId,
      companyId: actionContext.companyId,
      label: getString(formData, "label") as "service" | "billing" | "home" | "work" | "other",
      siteName: getNullableString(formData, "siteName"),
      serviceContactName: getNullableString(formData, "serviceContactName"),
      serviceContactPhone: getNullableString(formData, "serviceContactPhone"),
      accessWindowNotes: getNullableString(formData, "accessWindowNotes"),
      line1: getString(formData, "line1"),
      line2: getNullableString(formData, "line2"),
      city: getString(formData, "city"),
      state: getString(formData, "state"),
      postalCode: getString(formData, "postalCode"),
      country: getString(formData, "country") || "US",
      gateCode: getNullableString(formData, "gateCode"),
      parkingNotes: getNullableString(formData, "parkingNotes"),
      isPrimary: formData.get("isPrimary") === "on",
      isActive: formData.get("isActive") === "on"
    });

    if (result.error) {
      throw toServerError(result.error, "Service site could not be created.");
    }

    revalidatePath("/dashboard/customers");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        tab: "addresses"
      })
    );
  }

  async function updateAddressAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before editing an address.");
    }

    const actionContext = await assertCustomerIsMutable();
    const addressId = getString(formData, "addressId");
    const result = await updateCustomerAddress(actionContext.supabase, addressId, {
      label: getString(formData, "label") as "service" | "billing" | "home" | "work" | "other",
      siteName: getNullableString(formData, "siteName"),
      serviceContactName: getNullableString(formData, "serviceContactName"),
      serviceContactPhone: getNullableString(formData, "serviceContactPhone"),
      accessWindowNotes: getNullableString(formData, "accessWindowNotes"),
      line1: getString(formData, "line1"),
      line2: getNullableString(formData, "line2"),
      city: getString(formData, "city"),
      state: getString(formData, "state"),
      postalCode: getString(formData, "postalCode"),
      country: getString(formData, "country") || "US",
      gateCode: getNullableString(formData, "gateCode"),
      parkingNotes: getNullableString(formData, "parkingNotes"),
      isPrimary: formData.get("isPrimary") === "on",
      isActive: formData.get("isActive") === "on"
    });

    if (result.error) {
      throw toServerError(result.error, "Service site could not be updated.");
    }

    revalidatePath("/dashboard/customers");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        tab: "addresses"
      })
    );
  }

  async function setPrimaryAddressAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before updating an address.");
    }

    const actionContext = await assertCustomerIsMutable();
    const addressId = getString(formData, "addressId");
    const result = await setPrimaryCustomerAddress(
      actionContext.supabase,
      selectedCustomerId,
      addressId
    );

    if (result.error) {
      throw toServerError(result.error, "Primary service site could not be updated.");
    }

    revalidatePath("/dashboard/customers");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        tab: "addresses"
      })
    );
  }

  async function deleteAddressAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before removing an address.");
    }

    const actionContext = await assertCustomerIsMutable();
    const addressId = getString(formData, "addressId");
    const result = await deleteCustomerAddress(actionContext.supabase, addressId);

    if (result.error) {
      throw toServerError(result.error, "Service site could not be removed.");
    }

    revalidatePath("/dashboard/customers");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        tab: "addresses"
      })
    );
  }

  async function createVehicleAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before adding a vehicle.");
    }

    const actionContext = await assertCustomerIsMutable();
    const enriched = await enrichVehicleInputWithVinDecode({
      companyId: actionContext.companyId,
      customerId: selectedCustomerId,
      ownershipType: getString(formData, "ownershipType") as "customer_owned" | "fleet_account_asset",
      year: getNullableNumber(formData, "year"),
      make: getString(formData, "make"),
      model: getString(formData, "model"),
      trim: getNullableString(formData, "trim"),
      engine: getNullableString(formData, "engine"),
      licensePlate: getNullableString(formData, "licensePlate"),
      licenseState: getNullableString(formData, "licenseState"),
      vin: getNullableString(formData, "vin"),
      color: getNullableString(formData, "color"),
      odometer: getNullableNumber(formData, "odometer"),
      notes: getNullableString(formData, "notes"),
      isActive: formData.get("isActive") === "on"
    });
    const result = await createVehicle(actionContext.supabase, enriched.input);

    if (result.error || !result.data) {
      throw toServerError(result.error, "Vehicle could not be created.");
    }

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        selectedVehicleId: result.data.id,
        tab: "vehicles"
      })
    );
  }

  async function updateVehicleAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before editing a vehicle.");
    }

    const actionContext = await assertCustomerIsMutable();
    const vehicleId = getString(formData, "vehicleId");
    const existingVehicleResult = await getVehicleById(actionContext.supabase, vehicleId);

    if (
      existingVehicleResult.error ||
      !existingVehicleResult.data ||
      existingVehicleResult.data.companyId !== actionContext.companyId ||
      existingVehicleResult.data.customerId !== selectedCustomerId
    ) {
      throw new Error("Vehicle not found for this customer.");
    }

    const enriched = await enrichVehicleInputWithVinDecode(
      {
        customerId: selectedCustomerId,
        ownershipType: getString(formData, "ownershipType") as "customer_owned" | "fleet_account_asset",
        year: getNullableNumber(formData, "year"),
        make: getString(formData, "make"),
        model: getString(formData, "model"),
        trim: getNullableString(formData, "trim"),
        engine: getNullableString(formData, "engine"),
        licensePlate: getNullableString(formData, "licensePlate"),
        licenseState: getNullableString(formData, "licenseState"),
        vin: getNullableString(formData, "vin"),
        color: getNullableString(formData, "color"),
        odometer: getNullableNumber(formData, "odometer"),
        notes: getNullableString(formData, "notes"),
        isActive: formData.get("isActive") === "on"
      },
      {
        baseline: {
          year: existingVehicleResult.data.year,
          make: existingVehicleResult.data.make,
          model: existingVehicleResult.data.model,
          trim: existingVehicleResult.data.trim,
          engine: existingVehicleResult.data.engine
        }
      }
    );
    const result = await updateVehicle(actionContext.supabase, vehicleId, enriched.input);

    if (result.error || !result.data) {
      throw toServerError(result.error, "Vehicle could not be updated.");
    }

    revalidatePath("/dashboard/customers");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        selectedVehicleId: vehicleId,
        tab: "vehicles"
      })
    );
  }

  async function archiveVehicleAction(formData: FormData) {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before archiving a vehicle.");
    }

    const actionContext = await assertCustomerIsMutable();
    const vehicleId = getString(formData, "vehicleId");
    const existingVehicleResult = await getVehicleById(actionContext.supabase, vehicleId);

    if (
      existingVehicleResult.error ||
      !existingVehicleResult.data ||
      existingVehicleResult.data.companyId !== actionContext.companyId ||
      existingVehicleResult.data.customerId !== selectedCustomerId
    ) {
      throw new Error("Vehicle not found for this customer.");
    }

    const result = await archiveVehicle(actionContext.supabase, vehicleId);

    if (result.error) {
      throw toServerError(result.error, "Vehicle could not be archived.");
    }

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        tab: "vehicles"
      })
    );
  }

  async function archiveCustomerAction() {
    "use server";

    if (!selectedCustomerId) {
      throw new Error("Select a customer before archiving.");
    }

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await archiveCustomer(actionContext.supabase, selectedCustomerId);

    if (result.error) {
      throw toServerError(result.error, "Customer could not be archived.");
    }

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard");
    redirect(
      buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode
      })
    );
  }

  async function refreshCarfaxSummaryAction() {
    "use server";

    if (!selectedVehicle) {
      throw new Error("Select a vehicle before refreshing Carfax.");
    }

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await refreshVehicleCarfaxSummary(
      actionContext.supabase,
      actionContext.companyId,
      selectedVehicle.id
    );

    revalidatePath("/dashboard/customers");
    redirect(
      buildCustomerWorkspaceHref(selectedVehicle.customerId, {
        ...routeState,
        mode: currentMode,
        selectedVehicleId: selectedVehicle.id,
        tab: "vehicles"
      })
    );
  }

  const activeLogTab =
    currentTab === "history"
      ? "history"
      : currentTab === "activity"
        ? "activity"
        : currentTab === "addresses"
          ? "addresses"
          : "summary";
  const customerWorkspaceHref = selectedCustomerId
    ? buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode
      })
    : buildCustomersHref({
        ...routeState,
        mode: currentMode
      });
  const vehiclesTabHref = selectedCustomerId
    ? buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        selectedVehicleId: selectedVehicle?.id ?? undefined,
        tab: "vehicles"
      })
    : buildCustomersHref({
        ...routeState,
        mode: currentMode
      });
  const summaryTabHref = selectedCustomerId
    ? buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        selectedVehicleId: selectedVehicle?.id ?? undefined,
        tab: "summary"
      })
    : buildCustomersHref({
        ...routeState,
        mode: currentMode
      });
  const activityTabHref = selectedCustomerId
    ? buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        selectedVehicleId: selectedVehicle?.id ?? undefined,
        tab: "activity"
      })
    : buildCustomersHref({
        ...routeState,
        mode: currentMode
      });
  const historyTabHref = selectedCustomerId
    ? buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        selectedVehicleId: selectedVehicle?.id ?? undefined,
        tab: "history",
        ...historyFilters
      })
    : buildCustomersHref({
        ...routeState,
        mode: currentMode
      });
  const addressesTabHref = selectedCustomerId
    ? buildCustomerWorkspaceHref(selectedCustomerId, {
        ...routeState,
        mode: currentMode,
        tab: "addresses"
      })
    : buildCustomersHref({
        ...routeState,
        mode: currentMode
      });
  const relationshipTimelineCount = communications.length + (history?.visits.length ?? 0);

  let inspectorContent = newCustomer ? (
    <Card padding="spacious" tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>New customer</CardEyebrow>
          <CardTitle>Create a customer in the thread</CardTitle>
          <CardDescription>
            Stay anchored in the registry while you add the owner record that the rest of the
            workflow depends on.
          </CardDescription>
        </CardHeaderContent>
      </CardHeader>
      <CardContent>
        <CustomerForm
          action={createCustomerAction}
          cancelHref={buildCustomersHref({
            ...routeState,
            mode: currentMode
          })}
          cancelLabel="Close"
          mode="inline"
          submitLabel="Create customer"
        />
      </CardContent>
    </Card>
  ) : null;

  if (!inspectorContent && editCustomer && customer) {
    inspectorContent = (
      <Card padding="spacious" tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Edit customer</CardEyebrow>
            <CardTitle>Update the owner record</CardTitle>
            <CardDescription>
              Keep contact, billing, and service notes current without leaving the active
              thread.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <CustomerForm
            action={updateCustomerAction}
            cancelHref={customerWorkspaceHref}
            cancelLabel="Close"
            initialValues={customer}
            mode="inline"
            submitLabel="Save customer"
          />
        </CardContent>
      </Card>
    );
  }

  if (!inspectorContent && customer && (newVehicle || selectedVehicle)) {
    inspectorContent = (
      <>
        <Card padding="spacious" tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>{newVehicle ? "New vehicle" : "Vehicle inspector"}</CardEyebrow>
              <CardTitle>
                {newVehicle
                  ? "Add a customer vehicle"
                  : selectedVehicle?.displayName ?? "Select a vehicle"}
              </CardTitle>
              <CardDescription>
                Keep vehicle details, service history, and Carfax context attached to the
                customer instead of peeling into a separate page.
              </CardDescription>
            </CardHeaderContent>
            <div className="ui-inline-meta">
              {selectedVehicle ? (
                <Badge tone={selectedVehicle.isActive ? "success" : "neutral"}>
                  {selectedVehicle.isActive ? "Active" : "Archived"}
                </Badge>
              ) : null}
              {!newVehicle && selectedVehicle ? (
                <Link
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={vehiclesTabHref}
                >
                  Close inspector
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="ui-action-grid">
            {newVehicle ? (
              <CustomerVehicleForm
                action={createVehicleAction}
                customer={{
                  displayName: getCustomerDisplayName(customer),
                  id: customer.id,
                  relationshipType: customer.relationshipType
                }}
                submitLabel="Save vehicle"
              />
            ) : selectedVehicle && editVehicleId === selectedVehicle.id && editableVehicle ? (
              <CustomerVehicleForm
                action={updateVehicleAction}
                customer={{
                  displayName: getCustomerDisplayName(customer),
                  id: customer.id,
                  relationshipType: customer.relationshipType
                }}
                hiddenFields={[{ name: "vehicleId", value: selectedVehicle.id }]}
                initialValues={editableVehicle}
                submitLabel="Save vehicle"
              />
            ) : selectedVehicle ? (
              <>
                <div className="ui-detail-grid">
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">VIN</p>
                    <p className="ui-detail-value">{selectedVehicle.vin ?? "Not recorded"}</p>
                  </div>
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">Plate</p>
                    <p className="ui-detail-value">
                      {[selectedVehicle.licensePlate, selectedVehicleDetail?.licenseState]
                        .filter(Boolean)
                        .join(" / ") || "Not recorded"}
                    </p>
                  </div>
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">Odometer</p>
                    <p className="ui-detail-value">
                      {selectedVehicleDetail?.odometer !== null &&
                      selectedVehicleDetail?.odometer !== undefined
                        ? selectedVehicleDetail.odometer.toLocaleString()
                        : "Not provided"}
                    </p>
                  </div>
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">Last service</p>
                    <p className="ui-detail-value">
                      {formatDateTime(selectedVehicleHistory?.summary.lastServiceAt, {
                        fallback: "No history",
                        timeZone: context.company.timezone
                      })}
                    </p>
                  </div>
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">Trim</p>
                    <p className="ui-detail-value">
                      {selectedVehicleDetail?.trim ?? "Not provided"}
                    </p>
                  </div>
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">Engine</p>
                    <p className="ui-detail-value">
                      {selectedVehicleDetail?.engine ?? "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="ui-detail-item">
                  <p className="ui-detail-label">Notes</p>
                  <p className="ui-detail-value">
                    {selectedVehicleDetail?.notes ?? "No notes yet."}
                  </p>
                </div>

                <div className="ui-table-actions">
                  {canMutateCustomer && selectedVehicle.isActive ? (
                    <Link
                      href={buildCustomerWorkspaceHref(customer.id, {
                        query,
                        selectedVehicleId: selectedVehicle.id,
                        editVehicleId: selectedVehicle.id,
                        tab: "vehicles"
                      })}
                    >
                      Edit vehicle
                    </Link>
                  ) : null}
                  <Link
                    href={buildCustomerWorkspaceHref(customer.id, {
                      query,
                      selectedVehicleId: selectedVehicle.id,
                      tab: "history",
                      vehicleId: selectedVehicle.id
                    })}
                  >
                    Filter service log
                  </Link>
                  <Link href={buildEstimateIntakeHref(customer.id, selectedVehicle.id)}>
                    New estimate
                  </Link>
                  <Link href={`/dashboard/visits/new?customerId=${customer.id}`}>New visit</Link>
                </div>

                {canMutateCustomer && selectedVehicle.isActive ? (
                  <form action={archiveVehicleAction}>
                    <input name="vehicleId" type="hidden" value={selectedVehicle.id} />
                    <button
                      className={buttonClassName({ size: "sm", tone: "ghost" })}
                      type="submit"
                    >
                      Archive vehicle
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <EmptyState
                description="Select a vehicle from the center list to inspect it here."
                eyebrow="Vehicle inspector"
                title="Choose a vehicle"
              />
            )}
          </CardContent>
        </Card>

        {!newVehicle && selectedVehicle ? (
          <>
            <CarfaxSummaryCard
              action={
                context.canEditRecords && selectedVehicle.vin && isCarfaxConfigured ? (
                  <form action={refreshCarfaxSummaryAction}>
                    <button className={buttonClassName({ tone: "secondary" })} type="submit">
                      {carfaxSummary ? "Refresh Carfax summary" : "Fetch Carfax summary"}
                    </button>
                  </form>
                ) : null
              }
              isConfigured={isCarfaxConfigured}
              summary={carfaxSummary}
              vin={selectedVehicle.vin}
            />

            {selectedVehicleHistory ? (
              <ServiceHistoryPanel
                baseHref={buildCustomerVehicleHref(customer.id, selectedVehicle.id, {
                  tab: "history",
                  ...vehicleHistoryFilters
                })}
                clearHref={buildCustomerWorkspaceHref(customer.id, {
                  query,
                  selectedVehicleId: selectedVehicle.id,
                  tab: "vehicles"
                })}
                currentVehicleId={selectedVehicle.id}
                description="Vehicle-specific history stays in the inspector so you do not lose the customer thread."
                filters={selectedVehicleHistory.filters}
                showFilters={false}
                summary={selectedVehicleHistory.summary}
                timeZone={context.company.timezone}
                title="Vehicle history"
                visitLinkOptions={{
                  returnLabel: "Back to customer",
                  returnTo: vehiclesTabHref
                }}
                visits={selectedVehicleHistory.visits.slice(0, 4)}
              />
            ) : null}
          </>
        ) : null}
      </>
    );
  }

  if (
    !inspectorContent &&
    customer &&
    (newAddress || editAddressId || currentTab === "addresses" || !primaryAddress)
  ) {
    inspectorContent = (
      <Card padding="spacious" tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>{newAddress ? "New location" : "Service locations"}</CardEyebrow>
            <CardTitle>
              {editAddressId ? "Edit service location" : "Locations and access notes"}
            </CardTitle>
            <CardDescription>
              Service locations are operational context. Keep site access, service notes,
              and billing details editable beside the live customer thread.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent className="ui-action-grid">
          {newAddress ? (
            <AddressForm action={createAddressAction} submitLabel="Save service location" />
          ) : editAddressId && editableAddress ? (
            <AddressForm
              action={updateAddressAction}
              hiddenFields={[{ name: "addressId", value: editableAddress.id }]}
              initialValues={editableAddress}
              submitLabel="Save changes"
            />
          ) : addresses.length ? (
            <div className="customer-workspace__address-stack">
              {addresses.map((address) => (
                <article className="customer-workspace__address-card" key={address.id}>
                  <div className="customer-workspace__address-card-header">
                    <div>
                      <p className="customer-workspace__address-title">
                        <span>{address.siteName ?? address.label}</span>
                        {address.isPrimary ? <Badge tone="brand">Primary</Badge> : null}
                        {!address.isActive ? <Badge tone="warning">Inactive</Badge> : null}
                      </p>
                      <p className="customer-workspace__address-meta">
                        {formatAddressLine(
                          address.line1,
                          address.line2,
                          address.city,
                          address.state,
                          address.postalCode,
                          address.country
                        )}
                      </p>
                    </div>

                    <div className="ui-inline-meta">
                      {!address.isPrimary && canMutateCustomer ? (
                        <form action={setPrimaryAddressAction}>
                          <input name="addressId" type="hidden" value={address.id} />
                          <button
                            className={buttonClassName({ size: "sm", tone: "ghost" })}
                            type="submit"
                          >
                            Make primary
                          </button>
                        </form>
                      ) : null}
                      {canMutateCustomer ? (
                        <Link
                          href={buildCustomerWorkspaceHref(customer.id, {
                            query,
                            editAddressId: address.id,
                            tab: "addresses"
                          })}
                        >
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="ui-detail-grid">
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Site contact</p>
                      <p className="ui-detail-value">
                        {address.serviceContactName ?? address.serviceContactPhone ?? "Not provided"}
                      </p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Access window</p>
                      <p className="ui-detail-value">{address.accessWindowNotes ?? "Not provided"}</p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Gate code</p>
                      <p className="ui-detail-value">{address.gateCode ?? "Not provided"}</p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Access notes</p>
                      <p className="ui-detail-value">{address.parkingNotes ?? "Not provided"}</p>
                    </div>
                  </div>

                  {canMutateCustomer ? (
                    <form action={deleteAddressAction}>
                      <input name="addressId" type="hidden" value={address.id} />
                      <button
                        className={buttonClassName({ size: "sm", tone: "ghost" })}
                        type="submit"
                      >
                        Delete service location
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="No service locations have been recorded for this customer yet."
              eyebrow="Locations"
              title="Add the first service location"
            />
          )}
        </CardContent>
      </Card>
    );
  }

  if (!inspectorContent && customer) {
    const primaryThreadAction = customerNextMove ?? {
      href: buildEstimateIntakeHref(customer.id, selectedVehicle?.id ?? vehicles[0]?.id),
      label: customerActionLabels.estimate
    };
    const showSecondaryEstimateAction =
      primaryThreadAction.href !== buildEstimateIntakeHref(customer.id, selectedVehicle?.id ?? vehicles[0]?.id) &&
      primaryThreadAction.label !== customerActionLabels.estimate;
    const customerInspectorSections = {
      quick_actions: selectedCustomerId ? null : (
        <Card padding="spacious" tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Thread move</CardEyebrow>
              <CardTitle>Move the active thread</CardTitle>
              <CardDescription>Keep one dominant move visible and push the rest behind utility.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent className="ui-action-grid customer-inspector__action-stack">
            <div className="ui-button-grid customer-inspector__action-stack-primary">
              <Link className={buttonClassName({ size: "sm" })} href={primaryThreadAction.href}>
                {primaryThreadAction.label}
              </Link>
            </div>
            <details className="customer-inspector__action-overflow">
              <summary className={buttonClassName({ size: "sm", tone: "ghost" })}>More</summary>
              <div className="ui-table-actions customer-inspector__action-overflow-actions">
                {showSecondaryEstimateAction ? (
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href={buildEstimateIntakeHref(customer.id, selectedVehicle?.id ?? vehicles[0]?.id)}
                  >
                    {customerActionLabels.estimate}
                  </Link>
                ) : null}
                <Link
                  className={buttonClassName({ size: "sm", tone: "secondary" })}
                  href={`/dashboard/visits/new?customerId=${customer.id}`}
                >
                  {customerActionLabels.visit}
                </Link>
                {canMutateCustomer ? (
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href={buildCustomerWorkspaceHref(customer.id, {
                      query,
                      newVehicle: true,
                      tab: "vehicles"
                    })}
                  >
                    {customerActionLabels.addVehicle}
                  </Link>
                ) : null}
                <Link
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={buildCustomerWorkspaceHref(customer.id, { query, editCustomer: true })}
                >
                  {customerActionLabels.editCustomer}
                </Link>
                <Link
                  className={buttonClassName({ size: "sm", tone: "ghost" })}
                  href={buildCustomerWorkspaceHref(customer.id, {
                    query,
                    newAddress: true,
                    tab: "addresses"
                  })}
                >
                  {customerActionLabels.addAddress}
                </Link>
                {canMutateCustomer ? (
                  <form action={archiveCustomerAction}>
                    <button className={buttonClassName({ size: "sm", tone: "ghost" })} type="submit">
                      Archive customer
                    </button>
                  </form>
                ) : null}
              </div>
            </details>
          </CardContent>
        </Card>
      ),
      service_location: selectedCustomerId ? null : (
        <Card padding="spacious">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Site continuity</CardEyebrow>
              <CardTitle>Primary service site</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {primaryAddress ? (
                <div className="ui-action-grid customer-inspector__site-card">
                  <div className="ui-detail-item">
                    <p className="ui-detail-label">Site</p>
                    <p className="ui-detail-value">{primaryAddress.siteName ?? primaryAddress.label}</p>
                    <p className="ui-detail-copy">
                      {formatAddressLine(
                        primaryAddress.line1,
                        primaryAddress.line2,
                        primaryAddress.city,
                        primaryAddress.state,
                        primaryAddress.postalCode,
                        primaryAddress.country
                      )}
                    </p>
                  </div>
                  <div className="customer-inspector__site-facts">
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Access</p>
                      <p className="ui-detail-value">
                        {primaryAddress.accessWindowNotes ?? primaryAddress.gateCode ?? "No access notes"}
                      </p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Parking</p>
                      <p className="ui-detail-value">{primaryAddress.parkingNotes ?? "No parking guidance"}</p>
                    </div>
                    <div className="ui-detail-item">
                      <p className="ui-detail-label">Contact pattern</p>
                      <p className="ui-detail-value">
                        {primaryAddress.serviceContactName ??
                          getCustomerDisplayName(customer)}
                      </p>
                    </div>
                  </div>
                  <div className="ui-table-actions">
                    <Link href={siteOperationsPrimaryHref}>{siteOperationsPrimaryLabel}</Link>
                    <details className="customer-inspector__action-overflow">
                      <summary className={buttonClassName({ size: "sm", tone: "ghost" })}>More</summary>
                      <div className="ui-table-actions customer-inspector__action-overflow-actions">
                        <Link
                          className={buttonClassName({ size: "sm", tone: "secondary" })}
                          href={addressesTabHref}
                        >
                          Open site thread
                        </Link>
                      </div>
                    </details>
                  </div>
                </div>
            ) : (
              <EmptyState
                description="No service location is on file yet."
                eyebrow="Locations"
                title="Add a service location"
              />
            )}
          </CardContent>
        </Card>
      ),
      record_health: customerReadinessIssues.length ? (
        <Card padding="spacious">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Thread readiness</CardEyebrow>
              <CardTitle>What still weakens this relationship</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <div className="ui-detail-grid">
              <div className="ui-detail-item">
                <p className="ui-detail-label">Relationship state</p>
                <p className="ui-detail-value">
                  {selectedCustomerRecordHealth?.label ?? "Ready"}
                </p>
                <p className="ui-detail-copy">
                  {selectedCustomerRecordHealth?.detail ?? "All core thread fields are present."}
                </p>
              </div>
              {customerReadinessIssues.map((issue) => (
                <div className="ui-detail-item" key={issue}>
                  <p className="ui-detail-label">Fix now</p>
                  <p className="ui-detail-value">{issue}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null,
      lifecycle: null
    };

    inspectorContent = (
      <>
        {customerInspectorRoleFocus.sectionOrder.map((sectionKey) => (
          <Fragment key={sectionKey}>{customerInspectorSections[sectionKey]}</Fragment>
        ))}
      </>
    );
  }

  if (!inspectorContent) {
    inspectorContent = (
        <Card padding="spacious" tone="raised">
          <CardHeader>
            <CardHeaderContent>
            <CardEyebrow>Utilities</CardEyebrow>
            <CardTitle>Select a customer or vehicle</CardTitle>
            <CardDescription>
              Keep the relationship thread open while you inspect the selected record,
              fix gaps, or jump into the active thread.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <EmptyState
            actions={
              context.canEditRecords ? (
                <Link className={buttonClassName()} href={newCustomerHref}>
                  Create customer
                </Link>
              ) : null
            }
            description="Select a customer row to preview the owner record, or pick a vehicle row to inspect it without leaving the registry."
            eyebrow="Database"
            title="Nothing selected yet"
          />
        </CardContent>
      </Card>
    );
  }

  const segmentLinks: Array<{
    count: number;
    description: string;
    id: CustomerRegistrySegment;
    label: string;
  }> = [
    {
      id: "all",
      label: "All",
      count: customers.length,
      description: "Every visible customer in this search set."
    },
    {
      id: "needs-contact",
      label: "Needs contact",
      count: customers.filter((customerItem) => !customerItem.email && !customerItem.phone).length,
      description: "No phone and no email on file."
    },
    {
      id: "needs-address",
      label: "Needs location",
      count: customers.filter(
        (customerItem) => (addressesByCustomerId.get(customerItem.id) ?? []).length === 0
      ).length,
      description: "Missing a service location."
    },
    {
      id: "no-vehicle",
      label: "No vehicle",
      count: customers.filter(
        (customerItem) => (vehiclesByCustomerId.get(customerItem.id) ?? []).length === 0
      ).length,
      description: "Customer exists but no vehicle is attached."
    },
    {
      id: "multi-vehicle",
      label: "Multi-vehicle",
      count: customers.filter(
        (customerItem) => (vehiclesByCustomerId.get(customerItem.id) ?? []).length > 1
      ).length,
      description: "Owners with more than one active record in play."
    },
    {
      id: "recent",
      label: "Recent",
      count: customers.filter((customerItem) => {
        const latestJob = latestJobByCustomerId.get(customerItem.id) ?? null;
        return hasRecentActivity(latestJob ? getLatestJobTimestamp(latestJob) : null);
      }).length,
      description: "Touched by service activity in the last 30 days."
    },
    {
      id: "inactive",
      label: "Inactive",
      count: customers.filter((customerItem) => !customerItem.isActive).length,
      description: "Archived customers kept for history."
    }
  ];

  const registryResultLabel =
    registryCustomers.length === 1
      ? "1 customer"
      : `${registryCustomers.length.toLocaleString()} customers`;
  const needsContactCount = segmentLinks.find((segment) => segment.id === "needs-contact")?.count ?? 0;
  const needsAddressCount = segmentLinks.find((segment) => segment.id === "needs-address")?.count ?? 0;
  const noVehicleCount = segmentLinks.find((segment) => segment.id === "no-vehicle")?.count ?? 0;
  const registrySupplyBlockedCount = registryWorkspaceBlockers.supplyBlockedCount;
  const registryFinanceBlockedCount = registryWorkspaceBlockers.financeBlockedCount;
  const focusedWorkspaceActive = currentMode === "workspace" && Boolean(customer);
  const activeRegistryCustomer = selectedCustomerId
    ? registryCustomers.find((customerItem) => customerItem.id === selectedCustomerId) ?? null
    : null;
  const inactiveRegistryCustomers = selectedCustomerId
    ? registryCustomers.filter((customerItem) => customerItem.id !== selectedCustomerId)
    : registryCustomers;
  const threadRegistryPreviewCount = 4;
  const visibleInactiveRegistryCustomers = selectedCustomerId
    ? inactiveRegistryCustomers.slice(0, threadRegistryPreviewCount)
    : inactiveRegistryCustomers;
  const overflowInactiveRegistryCustomers = selectedCustomerId
    ? inactiveRegistryCustomers.slice(threadRegistryPreviewCount)
    : [];
  const renderWorkspaceRegistryRow = (customerItem: (typeof registryCustomers)[number]) => {
    const workspaceHref = buildCustomerWorkspaceHref(customerItem.id, {
      ...routeState,
      mode: "workspace"
    });
    const customerVehicles = vehiclesByCustomerId.get(customerItem.id) ?? [];
    const latestJob = latestJobByCustomerId.get(customerItem.id) ?? null;
    const primaryRegistryAddress =
      (addressesByCustomerId.get(customerItem.id) ?? []).find((row) => row.is_primary) ??
      addressesByCustomerId.get(customerItem.id)?.[0] ??
      null;
    const isActiveSelection = customerItem.id === selectedCustomerId;
    const registryTrustSummary = registryTrustSummaryByCustomerId.get(customerItem.id) ?? null;
    const registryPromiseSummary = registryPromiseSummaryByCustomerId.get(customerItem.id) ?? null;
    const registryServiceThreadSummary =
      registryServiceThreadSummaryByCustomerId.get(customerItem.id) ?? null;
    const compactRegistryStatus =
      registryServiceThreadSummary ?? registryPromiseSummary ?? registryTrustSummary;
    const compactRegistryMeta =
      registryServiceThreadSummary?.nextActionLabel ??
      registryPromiseSummary?.label ??
      registryTrustSummary?.nextActionLabel ??
      (latestJob
        ? `Latest ${formatDateTime(getLatestJobTimestamp(latestJob), {
            timeZone: context.company.timezone
          })}`
        : customerVehicles.length
          ? `${customerVehicles.length} vehicle${customerVehicles.length === 1 ? "" : "s"} on file`
          : "No customer vehicles on file");
    const compactThreadRegistryRow = Boolean(selectedCustomerId && !isActiveSelection);

    return (
      <Link
        className={cx(
          "customer-workspace-shell__list-item",
          isActiveSelection && "customer-workspace-shell__list-item--active"
        )}
        href={workspaceHref}
        key={customerItem.id}
      >
        <div className="customer-workspace-shell__list-item-header">
          <div>
            <p className="customer-workspace-shell__list-title">{customerItem.displayName}</p>
            {!compactThreadRegistryRow ? (
              <p className="customer-workspace-shell__list-meta">
                {customerItem.email ?? "No email"} · {customerItem.phone ?? "No phone"}
              </p>
            ) : null}
          </div>
          <div className="customer-workspace-shell__list-statuses">
            {selectedCustomerId ? (
              compactRegistryStatus ? (
                <Badge tone={compactRegistryStatus.tone}>{compactRegistryStatus.label}</Badge>
              ) : null
            ) : (
              <>
                {registryServiceThreadSummary ? (
                  <Badge tone={registryServiceThreadSummary.tone}>
                    {registryServiceThreadSummary.label}
                  </Badge>
                ) : null}
                {registryTrustSummary ? (
                  <Badge tone={registryTrustSummary.tone}>{registryTrustSummary.label}</Badge>
                ) : null}
              </>
            )}
            {!selectedCustomerId || !compactRegistryStatus ? (
              <StatusBadge status={customerItem.isActive ? "active" : "archived"} />
            ) : null}
          </div>
        </div>

        <div
          className={cx(
            "customer-workspace-shell__list-facts",
            selectedCustomerId && "customer-workspace-shell__list-facts--compact"
          )}
        >
          {selectedCustomerId ? (
            <>
              {isActiveSelection ? <span>{formatRegistryAddress(primaryRegistryAddress)}</span> : null}
              <span>{compactRegistryMeta}</span>
            </>
          ) : (
            <>
              <span>{formatRegistryAddress(primaryRegistryAddress)}</span>
              <span>
                {customerVehicles.length} vehicle{customerVehicles.length === 1 ? "" : "s"}
              </span>
              <span>
                {latestJob
                  ? `Latest ${formatDateTime(getLatestJobTimestamp(latestJob), {
                      timeZone: context.company.timezone
                    })}`
                  : "No service history yet"}
              </span>
            </>
          )}
        </div>

        {!selectedCustomerId &&
        (registryPromiseSummary || registryTrustSummary || registryServiceThreadSummary) ? (
          <p className="customer-workspace-shell__list-meta">
            {registryServiceThreadSummary?.nextActionLabel ??
              registryPromiseSummary?.label ??
              "No active promise"}{" "}
            ·{" "}
            {registryTrustSummary?.nextActionLabel ??
              registryServiceThreadSummary?.label ??
              "Monitor relationship"}
          </p>
        ) : null}

        {selectedCustomerId ? null : customerVehicles.length ? (
          <div className="customer-registry__vehicle-stack">
            {customerVehicles.slice(0, 2).map((row) => {
              const summary = getVehicleSummary(row);

              return (
                <div className="customer-registry__vehicle-summary" key={row.id}>
                  <p className="customer-registry__vehicle-model">{summary.displayName}</p>
                  <p className="customer-registry__vehicle-vin">{summary.vinLabel}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="customer-workspace-shell__list-meta">No customer vehicles on file</p>
        )}
      </Link>
    );
  };

  return (
    <RegistryPage>
      <RegistryHero
        actions={
          context.canEditRecords ? (
            <Link className={buttonClassName()} href={newCustomerHref}>
              New customer
            </Link>
          ) : null
        }
        compact
        description={
          focusedWorkspaceActive ? null : (
            <>
              Keep relationship memory, service sites, blockers, and active work in one customer desk for{" "}
              <strong>{context.company.name}</strong>.
            </>
          )
        }
        eyebrow={null}
        metrics={
          focusedWorkspaceActive ? null : (
            <>
              <RegistryMetric
                label="Visible customers"
                meta={query ? "Current filtered result set." : "All customer threads in view."}
                tone="accent"
                value={customers.length}
              />
              <RegistryMetric
                label="Active customers"
                meta="Customers available for new service work."
                value={activeCount}
              />
              <RegistryMetric
                label="Customer vehicles"
                meta="Vehicle profiles attached to customer records."
                tone="highlight"
                value={(registryVehiclesResult.data ?? []).length}
              />
              <RegistryMetric
                label="Service locations"
                meta="Customers with a primary service location on file."
                value={withPrimaryAddressCount}
              />
            </>
          )
        }
        title="Customers"
      />

      {!focusedWorkspaceActive ? (
      <section className="customer-command-band">
        <div className="customer-command-band__header">
          <div>
            <h2 className="customer-command-band__title">Keep customer, site, and vehicle continuity in one thread</h2>
            <p className="customer-command-band__copy">
              Scan the directory from the left rail and keep field-relevant context attached as you move across service, follow-through, and finance.
            </p>
            <div className="ui-button-grid">
              {customerRoleFocus.entries.map((entry, index) => (
                <Link
                  className={buttonClassName({
                    size: "sm",
                    tone: index === 0 ? "secondary" : "ghost"
                  })}
                  href={buildCustomersHref({
                    customerId: requestedCustomerId ?? undefined,
                    mode: currentMode,
                    query: query || undefined,
                    segment: entry.value,
                    selectedVehicleId: requestedSelectedVehicleId ?? undefined
                  })}
                  key={entry.value}
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="customer-command-band__strip">
            <div className="customer-command-band__chip">
              <span>Visible</span>
              <strong>{registryCustomers.length}</strong>
            </div>
            <div className="customer-command-band__chip">
              <span>Needs contact</span>
              <strong>{needsContactCount}</strong>
            </div>
            <div className="customer-command-band__chip">
              <span>Needs location</span>
              <strong>{needsAddressCount}</strong>
            </div>
            <div className="customer-command-band__chip">
              <span>No vehicle</span>
              <strong>{noVehicleCount}</strong>
            </div>
            <div className="customer-command-band__chip">
              <span>Supply blocked</span>
              <strong>{registrySupplyBlockedCount}</strong>
            </div>
            <div className="customer-command-band__chip">
              <span>Closeout active</span>
              <strong>{registryFinanceBlockedCount}</strong>
            </div>
            <div className="customer-command-band__chip">
              <span>Role focus</span>
              <strong>{customerRoleFocus.title}</strong>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {!focusedWorkspaceActive ? (
      <RegistryToolbar
        actions={
          <div className="ui-registry-toolbar__cluster">
            <div aria-label="Relationship slices" className="ui-registry-scope-switch" role="tablist">
              {segmentLinks.map((segmentLink) => (
                <Link
                  aria-current={currentSegment === segmentLink.id ? "page" : undefined}
                  className={cx(
                    "ui-registry-scope-switch__item",
                    currentSegment === segmentLink.id && "ui-registry-scope-switch__item--active"
                  )}
                  href={buildCustomersHref({
                    query: query || undefined,
                    segment: segmentLink.id,
                    customerId: requestedCustomerId ?? undefined,
                    selectedVehicleId: requestedSelectedVehicleId ?? undefined
                  })}
                  key={segmentLink.id}
                >
                  {segmentLink.label}
                </Link>
              ))}
            </div>
          </div>
        }
        className="customer-registry-toolbar--compact"
        description={null}
        eyebrow={null}
        title=""
      >
        <Form className="ui-registry-toolbar__form" method="get">
          {currentSegment !== "all" ? (
            <input name="segment" type="hidden" value={currentSegment} />
          ) : null}
          <div className="ui-registry-search">
            <FormField className="ui-registry-search__field" label="Customer search">
              <Input
                className="ui-registry-search__input"
                defaultValue={query}
                name="query"
                placeholder="Search by name, email, phone, or VIN"
                type="search"
              />
            </FormField>

            <div className="ui-registry-search__actions">
              <Button type="submit">Search</Button>
              {query ? (
                <Link className={buttonClassName({ tone: "ghost" })} href={clearQueryHref}>
                  Clear
                </Link>
              ) : null}
            </div>
          </div>
        </Form>
      </RegistryToolbar>
      ) : null}

      {requestedMode === "database" && false ? (
        <section className="customer-database-shell">
          <div className="customer-database-shell__main">
            <div className="customer-shell-region-header">
              <div className="customer-shell-region-header__copy">
                <p className="customer-shell-region-header__eyebrow">Database canvas</p>
                <h2 className="customer-shell-region-header__title">Filtered registry and record cleanup</h2>
                <p className="customer-shell-region-header__description">
                  Keep the table open while you narrow the result set, compare customer records,
                  and jump into the focused thread only when needed.
                </p>
              </div>
            </div>
            <Card padding="compact" tone="raised">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Saved views</CardEyebrow>
                  <CardTitle>Relationship filters</CardTitle>
                  <CardDescription>
                    Narrow the directory by record health, owner completeness, and service context.
                  </CardDescription>
                </CardHeaderContent>
              </CardHeader>
              <CardContent className="customer-database-shell__filters">
                {segmentLinks.map((segmentLink) => (
                  <Link
                    className={cx(
                      "customer-database-shell__filter",
                      currentSegment === segmentLink.id &&
                        "customer-database-shell__filter--active"
                    )}
                    href={buildCustomersHref({
                      mode: "database",
                      query: query || undefined,
                      segment: segmentLink.id,
                      customerId: requestedCustomerId ?? undefined,
                      selectedVehicleId: requestedSelectedVehicleId ?? undefined
                    })}
                    key={segmentLink.id}
                  >
                    <span className="customer-database-shell__filter-label">{segmentLink.label}</span>
                    <span className="customer-database-shell__filter-value">
                      {segmentLink.count.toLocaleString()}
                    </span>
                    <span className="customer-database-shell__filter-copy">
                      {segmentLink.description}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card padding="compact" tone="raised">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Customer database</CardEyebrow>
                  <CardTitle>Relationship registry</CardTitle>
                  <CardDescription>
                    {registryCustomers.length
                      ? `Showing ${registryResultLabel} with owner, service location, customer vehicle, and service context combined into one row.`
                      : "No customer records match the current search and filter combination."}
                  </CardDescription>
                </CardHeaderContent>
              </CardHeader>
              <CardContent>
                {registryCustomers.length ? (
                  <TableWrap>
                    <Table className="customer-database-shell__table">
                      <thead>
                        <tr>
                          <HeaderCell scope="col">Customer</HeaderCell>
                          <HeaderCell scope="col">Service context</HeaderCell>
                          <HeaderCell scope="col">Vehicle detail</HeaderCell>
                          <HeaderCell scope="col">Latest activity</HeaderCell>
                          <HeaderCell scope="col">Record health</HeaderCell>
                          <HeaderCell scope="col">Actions</HeaderCell>
                        </tr>
                      </thead>
                      <tbody>
                        {registryCustomers.map((customerItem) => {
                          const customerAddresses = addressesByCustomerId.get(customerItem.id) ?? [];
                          const customerVehicles = vehiclesByCustomerId.get(customerItem.id) ?? [];
                          const latestJob = latestJobByCustomerId.get(customerItem.id) ?? null;
                          const primaryRegistryAddress = getPrimaryAddress(
                            customerAddresses.map((address) => ({
                              ...address,
                              isPrimary: address.is_primary
                            }))
                          );
                          const recordHealth = getCustomerRecordHealth(
                            customerItem,
                            customerAddresses,
                            customerVehicles
                          );
                          const inspectHref = buildCustomerWorkspaceHref(customerItem.id, {
                            ...routeState,
                            mode: "database"
                          });
                          const rowWorkspaceHref = buildCustomerWorkspaceHref(customerItem.id, {
                            ...routeState,
                            mode: "workspace"
                          });
                          const defaultEstimateHref = buildEstimateIntakeHref(
                            customerItem.id,
                            customerVehicles[0]?.id
                          );

                          return (
                            <tr
                              aria-selected={selectedCustomerId === customerItem.id}
                              data-selected={selectedCustomerId === customerItem.id || undefined}
                              key={customerItem.id}
                            >
                              <Cell>
                                <div className="ui-table-cell-title">
                                  <Link className="ui-table__row-link" href={inspectHref}>
                                    {customerItem.displayName}
                                  </Link>
                                  <p className="ui-table-cell-meta">
                                    {customerItem.email ?? "No email"} · {customerItem.phone ?? "No phone"}
                                  </p>
                                </div>
                              </Cell>
                              <Cell>
                                <div className="ui-table-cell-title">
                                  <strong>{formatRegistryAddress(primaryRegistryAddress)}</strong>
                                  <p className="ui-table-cell-meta">
                                    {customerAddresses.length
                                      ? `${customerAddresses.length} service location${customerAddresses.length === 1 ? "" : "s"} on file`
                                      : "No service location on file"}
                                  </p>
                                </div>
                              </Cell>
                              <Cell>
                                {customerVehicles.length ? (
                                  <div className="customer-database-shell__vehicle-details">
                                    {customerVehicles.slice(0, 2).map((vehicleRow) => {
                                      const vehicleSummary = getVehicleSummary(vehicleRow);
                                      const latestVehicleJob =
                                        latestJobByVehicleId.get(vehicleRow.id) ?? null;

                                      return (
                                        <article
                                          className="customer-database-shell__vehicle-item"
                                          key={vehicleRow.id}
                                        >
                                          <div className="customer-database-shell__vehicle-topline">
                                            <strong>{vehicleSummary.displayName}</strong>
                                            <Badge tone={vehicleRow.is_active ? "success" : "neutral"}>
                                              {vehicleRow.is_active ? "Active" : "Archived"}
                                            </Badge>
                                          </div>
                                          <p className="customer-database-shell__vehicle-copy customer-database-shell__vin-value">
                                            {vehicleRow.vin ?? "VIN not recorded"}
                                          </p>
                                          <p className="customer-database-shell__vehicle-copy">
                                            {[
                                              formatVehiclePlate(vehicleRow),
                                              formatVehicleOdometer(vehicleRow),
                                              latestVehicleJob
                                                ? `Serviced ${formatDateTime(
                                                    getLatestJobTimestamp(latestVehicleJob),
                                                    {
                                                      timeZone: context.company.timezone
                                                    }
                                                  )}`
                                                : null
                                            ]
                                              .filter(Boolean)
                                              .join(" · ")}
                                          </p>
                                        </article>
                                      );
                                    })}

                                    {customerVehicles.length > 2 ? (
                                      <p className="ui-table-cell-meta">
                                        +{customerVehicles.length - 2} more vehicle
                                        {customerVehicles.length - 2 === 1 ? "" : "s"}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="ui-table-cell-title">
                                    <strong>No vehicles attached</strong>
                                    <p className="ui-table-cell-meta">
                                      Add the first customer vehicle to complete the operating record.
                                    </p>
                                  </div>
                                )}
                              </Cell>
                              <Cell>
                                <div className="ui-table-cell-title">
                                  <strong>
                                    {formatDateTime(latestJob ? getLatestJobTimestamp(latestJob) : null, {
                                      fallback: "No activity yet",
                                      timeZone: context.company.timezone
                                    })}
                                  </strong>
                                  <p className="ui-table-cell-meta">
                                    {latestJob ? "Most recent service touchpoint." : "No service history logged yet."}
                                  </p>
                                </div>
                              </Cell>
                              <Cell>
                                <div className="ui-table-cell-title">
                                  <Badge tone={recordHealth.tone}>{recordHealth.label}</Badge>
                                  <p className="ui-table-cell-meta customer-database-shell__health-copy">
                                    {recordHealth.detail}
                                  </p>
                                </div>
                              </Cell>
                              <Cell>
                                <div className="ui-table-actions customer-database-shell__actions">
                                  <Link href={inspectHref}>Inspect</Link>
                                  <Link href={rowWorkspaceHref}>Open thread</Link>
                                  <Link href={defaultEstimateHref}>New estimate</Link>
                                </div>
                              </Cell>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </TableWrap>
                ) : (
                  <EmptyState
                    actions={
                      context.canEditRecords ? (
                        <Link className={buttonClassName()} href={newCustomerHref}>
                          Create customer
                        </Link>
                      ) : null
                    }
                    description={
                      query
                        ? "Clear the search or switch to another saved view."
                        : "Try another saved view or create the first customer record."
                    }
                    eyebrow="Customer database"
                    title="No matching customers"
                    tone={query ? "info" : "default"}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="customer-database-shell__inspector">
            <div className="customer-shell-region-header customer-shell-region-header--rail">
              <div className="customer-shell-region-header__copy">
                <p className="customer-shell-region-header__eyebrow">Selection</p>
                <h2 className="customer-shell-region-header__title">Selected customer context</h2>
                <p className="customer-shell-region-header__description">
                  Preview the active customer and owned vehicles without losing the filtered directory.
                </p>
              </div>
            </div>
            <div className="ui-sidebar-stack ui-sticky customer-workspace-shell__inspector-stack">
              {inspectorContent}
            </div>
          </aside>
        </section>
      ) : (
        <section
          className={cx(
            "customer-workspace-shell",
            selectedCustomerId && "customer-workspace-shell--thread-active",
            focusedWorkspaceActive && "customer-workspace-shell--workspace-focus"
          )}
        >
          {!focusedWorkspaceActive ? (
            <aside
              className={cx(
                "customer-workspace-shell__sidebar",
                selectedCustomerId && "customer-workspace-shell__sidebar--thread-active"
              )}
            >
              <Card
                className={cx(
                  "ui-sticky customer-workspace-shell__sidebar-card",
                  selectedCustomerId && "customer-workspace-shell__sidebar-card--thread-active",
                  focusedWorkspaceActive && "customer-workspace-shell__sidebar-card--utility"
                )}
                padding={selectedCustomerId ? "compact" : "spacious"}
                tone="raised"
              >
                {!selectedCustomerId ? (
                  <CardHeader>
                    <CardHeaderContent>
                      <CardEyebrow>Customer list</CardEyebrow>
                      <CardTitle>Customer threads</CardTitle>
                      <CardDescription>
                        {registryCustomers.length
                          ? `Showing ${registryResultLabel}. Select a row to keep working without route changes.`
                          : query
                            ? "No customer threads match the current search."
                            : "Create the first customer to start the registry."}
                      </CardDescription>
                    </CardHeaderContent>
                  </CardHeader>
                ) : null}
                <CardContent className="customer-workspace-shell__list-body customer-workspace-shell__list-body--scroll">
                  {registryCustomers.length ? (
                    <>
                      {selectedCustomerId && activeRegistryCustomer && !focusedWorkspaceActive
                        ? renderWorkspaceRegistryRow(activeRegistryCustomer)
                        : null}
                      {(selectedCustomerId ? visibleInactiveRegistryCustomers : registryCustomers).map(
                        renderWorkspaceRegistryRow
                      )}
                      {selectedCustomerId && overflowInactiveRegistryCustomers.length && !focusedWorkspaceActive ? (
                        <details className="customer-workspace-shell__list-overflow">
                          <summary className="customer-workspace-shell__list-overflow-summary">
                            Show {overflowInactiveRegistryCustomers.length} more customer thread
                            {overflowInactiveRegistryCustomers.length === 1 ? "" : "s"}
                          </summary>
                          <div className="customer-workspace-shell__list-overflow-body">
                            {overflowInactiveRegistryCustomers.map(renderWorkspaceRegistryRow)}
                          </div>
                        </details>
                      ) : null}
                    </>
                  ) : (
                    <EmptyState
                      actions={
                        context.canEditRecords ? (
                          <Link className={buttonClassName()} href={newCustomerHref}>
                            Create customer
                          </Link>
                        ) : null
                      }
                      description={
                        query
                          ? "Clear the current search or broaden the terms."
                          : "Create the first customer profile to establish the owner record every vehicle and visit will inherit."
                      }
                      eyebrow={query ? "Search result" : "Registry empty"}
                      title={query ? "No matching customer threads" : "Create the first customer"}
                      tone={query ? "info" : "default"}
                    />
                  )}
                </CardContent>
              </Card>
            </aside>
          ) : null}

        <div className="customer-workspace-shell__main">
          {customer ? (
            <>
              {!selectedCustomerId ? (
              <section className="customer-workspace-shell__thread-bar" aria-label="Customer thread focus">
                <div className="customer-workspace-shell__thread-bar-copy">
                  {customerOperationalBadges.length ? (
                    <div className="customer-workspace-shell__thread-bar-badges">
                      {customerOperationalBadges.slice(0, 1).map((badge) => (
                        <Badge key={`${customer.id}:${badge.label}:${badge.tone}`} tone={badge.tone}>
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="customer-workspace-shell__thread-bar-heading">
                    <strong>
                      {customerActionTarget?.label ??
                        `${getCustomerDisplayName(customer)} is in a stable operating state`}
                    </strong>
                    {!selectedCustomerId ? (
                      <span>
                        {customerActionTarget?.copy ??
                          "No active relationship blocker is outranking routine customer support work right now."}
                      </span>
                    ) : null}
                  </div>
                  {!selectedCustomerId && customerThreadSignals.length ? (
                    <div className="customer-workspace-shell__thread-bar-signals">
                      {customerThreadSignals.slice(0, 1).map((item) => (
                        <div
                          className={cx(
                            "customer-workspace-shell__thread-bar-signal",
                            item.tone === "danger"
                              ? "customer-workspace-shell__thread-bar-signal--danger"
                              : item.tone === "warning"
                                ? "customer-workspace-shell__thread-bar-signal--warning"
                                : item.tone === "success"
                                  ? "customer-workspace-shell__thread-bar-signal--success"
                                  : "customer-workspace-shell__thread-bar-signal--neutral"
                          )}
                          key={`${customer.id}:${item.label}:${item.value}`}
                        >
                          <span className="customer-workspace-shell__thread-bar-signal-label">
                            {item.label}
                          </span>
                          <strong className="customer-workspace-shell__thread-bar-signal-value">
                            {item.value}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="customer-workspace-shell__thread-bar-actions">
                  {customerActionTarget ? (
                    <Link className={buttonClassName()} href={customerActionTarget.href}>
                      {isFleetAccount ? "Work this account thread" : "Work this customer thread"}
                    </Link>
                  ) : (
                    <Link className={buttonClassName()} href={siteOperationsPrimaryHref}>
                      {dominantSite ? "Work site thread" : siteOperationsPrimaryLabel}
                    </Link>
                  )}
                  {customerActionTarget ? (
                    <Link className={buttonClassName({ tone: "secondary" })} href={siteOperationsPrimaryHref}>
                      {dominantSite ? "Work site thread" : siteOperationsPrimaryLabel}
                    </Link>
                  ) : orderedRelationshipVehicles.length ? (
                    <Link className={buttonClassName({ tone: "secondary" })} href={vehiclesTabHref}>
                      {isFleetAccount ? "Open account units" : "Open vehicle thread"}
                    </Link>
                  ) : null}
                </div>
              </section>
              ) : null}

              <Card className="customer-workspace-shell__hero" padding="compact">
                <CardHeader className="customer-workspace-shell__hero-header">
                  <CardHeaderContent>
                    <CardEyebrow>{relationshipThreadEyebrow}</CardEyebrow>
                    <CardTitle>{getCustomerDisplayName(customer)}</CardTitle>
                    {!selectedCustomerId ? (
                      <CardDescription>{customerHeroDescription}</CardDescription>
                    ) : null}
                  </CardHeaderContent>
                  <div className="ui-inline-meta">
                    <StatusBadge status={customer.isActive ? "active" : "archived"} />
                  </div>
                </CardHeader>
                <CardContent className="ui-action-grid">
                  <div className="customer-workspace__relationship-strip customer-workspace__relationship-strip--unified">
                    {isFleetAccount ? (
                      <>
                        <article className="ui-detail-item customer-workspace__thread-summary">
                          <p className="ui-detail-label">Account thread</p>
                          <p className="ui-detail-value">{relationshipContactName}</p>
                          <p className="ui-detail-copy">{relationshipContactChannel}</p>
                          <p className="ui-detail-copy">{siteOperationsValue}</p>
                          <div className="ui-table-actions">
                            <Link href={customerActionTarget?.href ?? customerActivityHref}>
                              {customerActionTarget ? "Work account thread" : "Open account thread"}
                            </Link>
                            <Link href={vehiclesTabHref}>Open account units</Link>
                          </div>
                        </article>

                        <article className="ui-detail-item customer-workspace__site-summary">
                          <p className="ui-detail-label">Service-site continuity</p>
                          <p className="ui-detail-value">
                            {dominantSite?.address.siteName ?? dominantSite?.address.label ?? "No active site"}
                          </p>
                          <p className="ui-detail-copy">{siteOperationsCopy}</p>
                          <div className="customer-workspace__site-facts">
                            <span>
                              Access: {dominantSite?.address.accessWindowNotes ?? dominantSite?.address.gateCode ?? "No access notes"}
                            </span>
                            <span>
                              Parking: {dominantSite?.address.parkingNotes ?? "No parking guidance"}
                            </span>
                            <span>
                              Contact: {dominantSite?.address.serviceContactName ?? relationshipContactName}
                            </span>
                          </div>
                          <div className="ui-table-actions">
                            <Link href={siteOperationsPrimaryHref}>{siteOperationsPrimaryLabel}</Link>
                            <Link href={addressesTabHref}>Account sites</Link>
                          </div>
                        </article>
                      </>
                    ) : (
                      <>
                        <article className="ui-detail-item customer-workspace__thread-summary">
                          <p className="ui-detail-label">Relationship thread</p>
                          <p className="ui-detail-value">
                            {leadServiceVisit ? leadServiceVisit.jobTitle : "No active visit thread"}
                          </p>
                          <p className="ui-detail-copy">
                            {leadServiceVisit
                              ? customerServiceThreadSummary?.nextActionLabel ??
                                "Open the live visit without losing this customer context."
                              : "Start the next visit directly from the relationship thread."}
                          </p>
                          {selectedCustomerSupplyBlocker || selectedCustomerFinanceBlocker || openBalanceCents ? (
                            <p className="ui-detail-copy">
                              {selectedCustomerSupplyBlocker
                                ? `${selectedCustomerSupplyBlocker.supplyBlockerCount} supply blocker${selectedCustomerSupplyBlocker.supplyBlockerCount === 1 ? "" : "s"} still need clearing.`
                                : selectedCustomerFinanceBlocker
                                  ? selectedCustomerFinanceBlocker.financeHandoffSummary?.copy ??
                                    `${selectedCustomerFinanceBlocker.title} still needs closeout follow-through.`
                                  : `${formatCurrencyFromCents(openBalanceCents)} still open on this relationship.`}
                            </p>
                          ) : null}
                          <div className="ui-table-actions">
                            <Link href={customerActiveVisitHref}>
                              {leadServiceVisit ? "Open live visit" : customerActionLabels.estimate}
                            </Link>
                            <Link href={customerSupplyDeskHref}>
                              {selectedCustomerSupplyBlocker ? "Unblock supply" : "Open supply"}
                            </Link>
                          </div>
                        </article>

                        <article className="ui-detail-item customer-workspace__site-summary">
                          <p className="ui-detail-label">Service-site continuity</p>
                          <p className="ui-detail-value">
                            {dominantSite?.address.siteName ?? dominantSite?.address.label ?? siteOperationsValue}
                          </p>
                          <p className="ui-detail-copy">{siteOperationsCopy}</p>
                          <div className="customer-workspace__site-facts">
                            <span>
                              Access: {dominantSite?.address.accessWindowNotes ?? dominantSite?.address.gateCode ?? "No access notes"}
                            </span>
                            <span>
                              Parking: {dominantSite?.address.parkingNotes ?? "No parking guidance"}
                            </span>
                            <span>
                              Contact: {dominantSite?.address.serviceContactName ?? relationshipContactName}
                            </span>
                          </div>
                          <div className="ui-table-actions">
                            <Link href={siteOperationsPrimaryHref}>{siteOperationsPrimaryLabel}</Link>
                            <Link href={addressesTabHref}>Service sites</Link>
                          </div>
                        </article>
                      </>
                    )}
                  </div>

                  <div className="customer-workspace__cockpit">
                    <article className="customer-workspace__cockpit-card customer-workspace__cockpit-card--accent">
                      <p className="customer-workspace__cockpit-label">Next move</p>
                      <p className="customer-workspace__cockpit-value">
                        {customerActionTarget ? (
                          <Link href={customerActionTarget.href}>
                            {customerActionTarget.label}
                          </Link>
                        ) : (
                          "No next move"
                        )}
                      </p>
                      <p className="customer-workspace__cockpit-copy">
                        {customerActionTarget?.copy ??
                          "No active relationship prompt."}
                      </p>
                    </article>
                    {selectedCustomerBlockerCard ? (
                      <article
                        className={cx(
                          "customer-workspace__cockpit-card",
                          `customer-workspace__cockpit-card--${selectedCustomerBlockerCard.tone}`
                        )}
                      >
                        <p className="customer-workspace__cockpit-label">{selectedCustomerBlockerCard.label}</p>
                        <p className="customer-workspace__cockpit-value">{selectedCustomerBlockerCard.value}</p>
                        <p className="customer-workspace__cockpit-copy">{selectedCustomerBlockerCard.copy}</p>
                      </article>
                    ) : customerPromiseConfidence ? (
                      <article
                        className={cx(
                          "customer-workspace__cockpit-card",
                          `customer-workspace__cockpit-card--${customerPromiseConfidence.tone}`
                        )}
                      >
                        <p className="customer-workspace__cockpit-label">Promise confidence</p>
                        <p className="customer-workspace__cockpit-value">{customerPromiseConfidence.label}</p>
                        <p className="customer-workspace__cockpit-copy">
                          {customerPromiseSummary.owner} · {customerPromiseSummary.nextUpdateLabel}
                        </p>
                      </article>
                    ) : (
                      <article
                        className={cx(
                          "customer-workspace__cockpit-card",
                          `customer-workspace__cockpit-card--${trustSummary.tone}`
                        )}
                      >
                        <p className="customer-workspace__cockpit-label">Trust risk</p>
                        <p className="customer-workspace__cockpit-value">{trustSummary.label}</p>
                        <p className="customer-workspace__cockpit-copy">{trustSummary.copy}</p>
                      </article>
                    )}
                  </div>

                </CardContent>
              </Card>

              <Card className="customer-workspace__vehicle-shell" padding="spacious">
                <CardHeader>
                  <CardHeaderContent>
                    {!selectedCustomerId ? (
                      <CardEyebrow>
                        {isFleetAccount ? "Account unit thread" : "Customer vehicle thread"}
                      </CardEyebrow>
                    ) : null}
                    <CardTitle>
                      {selectedCustomerId
                        ? isFleetAccount
                          ? "Units on this thread"
                          : "Vehicles on this thread"
                        : isFleetAccount
                          ? "Fleet units and parked assets on this account"
                          : "Customer vehicles on this relationship"}
                    </CardTitle>
                    {!selectedCustomerId ? (
                      <CardDescription>
                        {isFleetAccount
                          ? "Run recurring units from the account thread so sites, billing, and repeat-service memory stay attached to the same commercial record."
                          : "Inspect customer-owned vehicles and act on service context here without leaving the active customer thread."}
                      </CardDescription>
                    ) : null}
                  </CardHeaderContent>
                  {!selectedCustomerId ? (
                    <div className="ui-inline-meta">
                      <Link
                        className={buttonClassName({ size: "sm", tone: "ghost" })}
                        href={vehiclesTabHref}
                      >
                        Reset inspector
                      </Link>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="ui-action-grid">
                  {orderedRelationshipVehicles.length ? (
                    <div className="customer-workspace__vehicle-stack">
                      {orderedRelationshipVehicles.map((vehicle) => {
                        const isSelected = selectedVehicle?.id === vehicle.id;

                        return (
                          <article
                            className={cx(
                              "customer-workspace__vehicle-sheet",
                              isSelected && "customer-workspace__vehicle-sheet--selected"
                            )}
                            key={vehicle.id}
                          >
                            <div className="customer-workspace__vehicle-sheet-header">
                              <div>
                                <p className="customer-workspace__vehicle-title">
                                  {vehicle.displayName}
                                </p>
                                <p className="customer-workspace__vehicle-meta">
                                  {[
                                    vehicle.licensePlate,
                                    vehicle.vin,
                                    latestVehicleServiceMap.get(vehicle.id)
                                      ? `Last service ${formatDateTime(
                                          latestVehicleServiceMap.get(vehicle.id),
                                          {
                                            timeZone: context.company.timezone
                                          }
                                        )}`
                                      : null
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "No VIN, plate, or service history on file"}
                                </p>
                              </div>

                              <div className="ui-inline-meta">
                                {isFleetAccount ? (
                                  <Badge
                                    tone={
                                      vehicle.ownershipType === "fleet_account_asset"
                                        ? "brand"
                                        : "neutral"
                                    }
                                  >
                                    {vehicle.ownershipType === "fleet_account_asset"
                                      ? "Fleet unit"
                                      : "Customer vehicle"}
                                  </Badge>
                                ) : null}
                                <Badge tone={vehicle.isActive ? "success" : "neutral"}>
                                  {vehicle.isActive ? "Active" : "Archived"}
                                </Badge>
                              </div>
                            </div>

                            <div className="ui-table-actions customer-workspace__vehicle-actions">
                              <Link
                                href={buildCustomerWorkspaceHref(customer.id, {
                                  query,
                                  selectedVehicleId: vehicle.id,
                                  tab: "vehicles"
                                })}
                              >
                                {isFleetAccount && vehicle.ownershipType === "fleet_account_asset"
                                  ? "Inspect unit"
                                  : "Inspect"}
                              </Link>
                              <Link
                                href={buildCustomerWorkspaceHref(customer.id, {
                                  query,
                                  selectedVehicleId: vehicle.id,
                                  tab: "history",
                                  vehicleId: vehicle.id
                                })}
                              >
                                Service log
                              </Link>
                              {canMutateCustomer && vehicle.isActive ? (
                                <Link
                                  href={buildCustomerWorkspaceHref(customer.id, {
                                    query,
                                    selectedVehicleId: vehicle.id,
                                    editVehicleId: vehicle.id,
                                    tab: "vehicles"
                                  })}
                                >
                                  Edit
                                </Link>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      actions={
                        canMutateCustomer ? (
                          <Link
                            className={buttonClassName()}
                            href={buildCustomerWorkspaceHref(customer.id, {
                              query,
                              newVehicle: true,
                              tab: "vehicles"
                            })}
                          >
                            Add customer vehicle
                          </Link>
                        ) : null
                      }
                      description="No customer-owned vehicles are attached to this customer yet."
                      eyebrow="Customer vehicles"
                      title="Add the first customer vehicle"
                    />
                  )}
                </CardContent>
              </Card>

              <div className="customer-workspace-shell__log-region">
                <div
                  aria-label="Customer log views"
                  className="customer-workspace__tabs"
                  role="tablist"
                >
                  <Link
                    aria-current={activeLogTab === "summary" ? "page" : undefined}
                    className={cx(
                      "customer-workspace__tab",
                      activeLogTab === "summary" && "customer-workspace__tab--active"
                    )}
                    href={summaryTabHref}
                  >
                    Summary
                  </Link>
                  <Link
                    aria-current={activeLogTab === "activity" ? "page" : undefined}
                    className={cx(
                      "customer-workspace__tab",
                      activeLogTab === "activity" && "customer-workspace__tab--active"
                    )}
                    href={activityTabHref}
                  >
                    Timeline
                  </Link>
                  <Link
                    aria-current={activeLogTab === "history" ? "page" : undefined}
                    className={cx(
                      "customer-workspace__tab",
                      activeLogTab === "history" && "customer-workspace__tab--active"
                    )}
                    href={historyTabHref}
                  >
                    Service history
                  </Link>
                  <Link
                    aria-current={activeLogTab === "addresses" ? "page" : undefined}
                    className={cx(
                      "customer-workspace__tab",
                      activeLogTab === "addresses" && "customer-workspace__tab--active"
                    )}
                    href={addressesTabHref}
                  >
                    Sites
                  </Link>
                </div>

                {activeLogTab === "summary" ? (
                  <div className="customer-workspace__log-preview">
                    <CustomerActivityTimeline
                      communications={communications}
                      description="Recent communications and field events stay visible here until you need the full chronology."
                      footer={
                        <div className="ui-table-actions">
                          <Link href={activityTabHref}>
                            Open full timeline
                            {relationshipTimelineCount
                              ? ` (${relationshipTimelineCount})`
                              : ""}
                          </Link>
                          {leadServiceVisit ? <Link href={customerActiveVisitHref}>Open live visit</Link> : null}
                        </div>
                      }
                      maxItems={3}
                      timeZone={context.company.timezone}
                      title="Recent timeline"
                      vehicleLinkBuilder={(vehicleId) =>
                        buildCustomerWorkspaceHref(customer.id, {
                          query,
                          selectedVehicleId: vehicleId,
                          tab: "vehicles"
                        })
                      }
                      visits={history?.visits ?? []}
                    />

                    <ServiceHistoryPanel
                      baseHref={historyTabHref}
                      clearHref={historyTabHref}
                      currentVehicleId={history?.filters.vehicleId}
                      description="Completed and in-flight visit records stay tucked into a compact snapshot until you open the full archive."
                      filters={history?.filters ?? {}}
                      footer={
                        <div className="ui-table-actions">
                          <Link href={historyTabHref}>
                            Open full history
                            {history?.summary.totalJobs ? ` (${history.summary.totalJobs})` : ""}
                          </Link>
                          <Link href={vehiclesTabHref}>Open customer vehicles</Link>
                        </div>
                      }
                      maxVisits={2}
                      showFilters={false}
                      showSummary={false}
                      summary={
                        history?.summary ?? {
                          completedJobs: 0,
                          lastServiceAt: null,
                          openBalanceCents: 0,
                          totalInvoicedCents: 0,
                          totalJobs: 0,
                          totalPaidCents: 0
                        }
                      }
                      timeZone={context.company.timezone}
                      title="History snapshot"
                      visitLinkOptions={{
                        returnLabel: "Back to customer",
                        returnTo: summaryTabHref
                      }}
                      vehicleLinkBuilder={(vehicleId) =>
                        buildCustomerWorkspaceHref(customer.id, {
                          query,
                          selectedVehicleId: vehicleId,
                          tab: "vehicles"
                        })
                      }
                      vehicleOptions={history?.vehicleOptions ?? []}
                      visits={history?.visits ?? []}
                    />
                  </div>
                ) : activeLogTab === "addresses" ? (
                  <div className="customer-workspace__log-preview">
                    <Card padding="spacious">
                      <CardHeader>
                        <CardHeaderContent>
                          <CardEyebrow>
                            {customer.relationshipType === "fleet_account"
                              ? "Account site operations"
                              : "Service-site operating slice"}
                          </CardEyebrow>
                          <CardTitle>
                            {customer.relationshipType === "fleet_account"
                              ? "Run account sites like operating assets"
                              : "Run recurring sites like operational assets"}
                          </CardTitle>
                          <CardDescription>
                            {customer.relationshipType === "fleet_account"
                              ? "Commercial site memory belongs in the working canvas. Keep live pressure, access rules, site contacts, and the next account thread visible without falling back to a static address list."
                              : "Site memory belongs in the working canvas. Keep live pressure, access notes, and the next site thread visible without falling back to a static address list."}
                          </CardDescription>
                        </CardHeaderContent>
                        <div className="ui-inline-meta">
                          {canMutateCustomer ? (
                            <Link
                              className={buttonClassName({ size: "sm", tone: "secondary" })}
                              href={buildCustomerWorkspaceHref(customer.id, {
                                query,
                                newAddress: true,
                                tab: "addresses"
                              })}
                            >
                              Add service site
                            </Link>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="customer-workspace__cockpit">
                        <article className="customer-workspace__cockpit-card customer-workspace__cockpit-card--accent">
                          <p className="customer-workspace__cockpit-label">Active sites</p>
                          <p className="customer-workspace__cockpit-value">{activeSiteCount}</p>
                          <p className="customer-workspace__cockpit-copy">
                            Service locations ready for future visits on this relationship.
                          </p>
                        </article>
                        <article className="customer-workspace__cockpit-card customer-workspace__cockpit-card--brand">
                          <p className="customer-workspace__cockpit-label">Live site visits</p>
                          <p className="customer-workspace__cockpit-value">{activeSiteVisitCount}</p>
                          <p className="customer-workspace__cockpit-copy">
                            Current execution pressure tied to explicit service sites.
                          </p>
                        </article>
                        <article
                          className={cx(
                            "customer-workspace__cockpit-card",
                            sitesMissingPlaybookCount
                              ? "customer-workspace__cockpit-card--warning"
                              : "customer-workspace__cockpit-card--success"
                          )}
                        >
                          <p className="customer-workspace__cockpit-label">Access playbook gaps</p>
                          <p className="customer-workspace__cockpit-value">{sitesMissingPlaybookCount}</p>
                          <p className="customer-workspace__cockpit-copy">
                            Active sites still missing access notes, contact details, or arrival guidance.
                          </p>
                        </article>
                        <article className="customer-workspace__cockpit-card customer-workspace__cockpit-card--neutral">
                          <p className="customer-workspace__cockpit-label">Dominant site</p>
                          <p className="customer-workspace__cockpit-value">
                            {dominantSite
                              ? dominantSite.address.siteName ?? dominantSite.address.label
                              : "No site on file"}
                          </p>
                          <p className="customer-workspace__cockpit-copy">
                            {dominantSite?.latestSiteJob
                              ? `Latest linked visit: ${dominantSite.latestSiteJob.title}`
                              : "No visits have been explicitly anchored to a service site yet."}
                          </p>
                        </article>
                      </CardContent>
                    </Card>

                    <Card padding="spacious">
                      <CardHeader>
                        <CardHeaderContent>
                          <CardEyebrow>
                            {customer.relationshipType === "fleet_account"
                              ? "Account site roster"
                              : "Site roster"}
                          </CardEyebrow>
                          <CardTitle>
                            {customer.relationshipType === "fleet_account"
                              ? "Memory, access, and live work by account site"
                              : "Memory, access, and live work by site"}
                          </CardTitle>
                          <CardDescription>
                            {customer.relationshipType === "fleet_account"
                              ? "Each commercial site should tell the office what is happening there now, what could block arrival, and which account thread to reopen next."
                              : "Each service site should tell the office what is happening there now, what could block arrival, and which visit thread to reopen next."}
                          </CardDescription>
                        </CardHeaderContent>
                      </CardHeader>
                      <CardContent className="customer-workspace__address-stack">
                        {siteOperationalRows.length ? (
                          siteOperationalRows.map((site) => (
                            <article className="customer-workspace__address-card" key={site.address.id}>
                              <div className="customer-workspace__address-card-header">
                                <div>
                                  <p className="customer-workspace__address-title">
                                    <span>{site.address.siteName ?? site.address.label}</span>
                                    {site.address.isPrimary ? <Badge tone="brand">Primary</Badge> : null}
                                    {!site.address.isActive ? <Badge tone="warning">Inactive</Badge> : null}
                                    {site.activeVisitCount ? <Badge tone="warning">{site.activeVisitCount} active</Badge> : null}
                                  </p>
                                  <p className="customer-workspace__address-meta">
                                    {formatAddressLine(
                                      site.address.line1,
                                      site.address.line2,
                                      site.address.city,
                                      site.address.state,
                                      site.address.postalCode,
                                      site.address.country
                                    )}
                                  </p>
                                </div>

                                <div className="ui-inline-meta">
                                  {site.latestSiteJob ? (
                                    <Link
                                      href={buildVisitThreadHref(site.latestSiteJob.id, {
                                        returnLabel: "Back to sites",
                                        returnTo: addressesTabHref
                                      })}
                                    >
                                      {site.activeVisitCount ? "Open live visit" : "Open latest visit"}
                                    </Link>
                                  ) : null}
                                  {canMutateCustomer ? (
                                    <Link
                                      href={buildCustomerWorkspaceHref(customer.id, {
                                        query,
                                        editAddressId: site.address.id,
                                        tab: "addresses"
                                      })}
                                    >
                                      Edit site
                                    </Link>
                                  ) : null}
                                </div>
                              </div>

                              <div className="ui-detail-grid">
                                <div className="ui-detail-item">
                                  <p className="ui-detail-label">Linked visits</p>
                                  <p className="ui-detail-value">
                                    {site.totalVisitCount
                                      ? `${site.totalVisitCount} visit${site.totalVisitCount === 1 ? "" : "s"}`
                                      : "No linked visits"}
                                  </p>
                                </div>
                                <div className="ui-detail-item">
                                  <p className="ui-detail-label">Approvals waiting</p>
                                  <p className="ui-detail-value">
                                    {site.pendingApprovals
                                      ? `${site.pendingApprovals} waiting`
                                      : "No approval risk"}
                                  </p>
                                </div>
                                <div className="ui-detail-item">
                                  <p className="ui-detail-label">Supply blockers</p>
                                  <p className="ui-detail-value">
                                    {site.supplyBlockedCount
                                      ? `${site.supplyBlockedCount} blocker${site.supplyBlockedCount === 1 ? "" : "s"}`
                                      : "No blocker"}
                                  </p>
                                </div>
                                <div className="ui-detail-item">
                                  <p className="ui-detail-label">Open balance</p>
                                  <p className="ui-detail-value">
                                    {site.openBalanceAtSite
                                      ? formatCurrencyFromCents(site.openBalanceAtSite)
                                      : "No open balance"}
                                  </p>
                                </div>
                                <div className="ui-detail-item">
                                  <p className="ui-detail-label">Site contact</p>
                                  <p className="ui-detail-value">
                                    {site.address.serviceContactName ??
                                      site.address.serviceContactPhone ??
                                      "Not provided"}
                                  </p>
                                </div>
                                <div className="ui-detail-item">
                                  <p className="ui-detail-label">Access playbook</p>
                                  <p className="ui-detail-value">
                                    {site.hasPlaybook
                                      ? [
                                          site.address.accessWindowNotes,
                                          site.address.gateCode,
                                          site.address.parkingNotes
                                        ]
                                          .filter(Boolean)
                                          .join(" · ") || "Contact details on file"
                                      : "Needs access notes"}
                                  </p>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <EmptyState
                            actions={
                              canMutateCustomer ? (
                                <Link
                                  className={buttonClassName()}
                                  href={buildCustomerWorkspaceHref(customer.id, {
                                    query,
                                    newAddress: true,
                                    tab: "addresses"
                                  })}
                                >
                                  Add service site
                                </Link>
                              ) : null
                            }
                            description="No service sites are attached to this customer yet."
                            eyebrow="Service sites"
                            title="Add the first service site"
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : activeLogTab === "history" && history ? (
                  <ServiceHistoryPanel
                    baseHref={buildCustomerWorkspaceHref(customer.id, {
                      query,
                      selectedVehicleId: selectedVehicle?.id ?? undefined,
                      tab: "history"
                    })}
                    clearHref={buildCustomerWorkspaceHref(customer.id, {
                      query,
                      selectedVehicleId: selectedVehicle?.id ?? undefined,
                      tab: "history"
                    })}
                    currentVehicleId={history.filters.vehicleId}
                    description="Filter completed visit history without leaving the active customer thread."
                    filters={history.filters}
                    summary={history.summary}
                    timeZone={context.company.timezone}
                    title="Relationship history"
                    visitLinkOptions={{
                      returnLabel: "Back to customer",
                      returnTo: historyTabHref
                    }}
                    vehicleLinkBuilder={(vehicleId) =>
                      buildCustomerWorkspaceHref(customer.id, {
                        query,
                        selectedVehicleId: vehicleId,
                        tab: "vehicles"
                      })
                    }
                    vehicleOptions={history.vehicleOptions}
                    visits={history.visits}
                  />
                ) : (
                  <CustomerActivityTimeline
                    communications={communications}
                    description="Communications and service visits now share one chronological relationship record instead of competing for separate pages."
                    timeZone={context.company.timezone}
                    title="Relationship timeline"
                    vehicleLinkBuilder={(vehicleId) =>
                      buildCustomerWorkspaceHref(customer.id, {
                        query,
                        selectedVehicleId: vehicleId,
                        tab: "vehicles"
                      })
                    }
                    visits={history?.visits ?? []}
                  />
                )}
              </div>
            </>
          ) : (
            <Card padding="spacious" tone="raised">
              <CardContent>
                <EmptyState
                  actions={
                    context.canEditRecords ? (
                      <Link className={buttonClassName()} href={newCustomerHref}>
                        Create customer
                      </Link>
                    ) : null
                  }
                  description={
                    query
                      ? "No customer threads match the current search. Clear the filter or create a new customer."
                      : "Select a customer from the left rail or create the first customer to begin."
                  }
                  eyebrow="Customer thread"
                  title={query ? "No matching customer" : "Choose a customer"}
                  tone={query ? "info" : "default"}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="customer-workspace-shell__inspector">
          {!selectedCustomerId ? (
            <div className="customer-shell-region-header customer-shell-region-header--rail">
              <div className="customer-shell-region-header__copy">
                <p className="customer-shell-region-header__eyebrow">Utilities</p>
                <h2 className="customer-shell-region-header__title">{customerInspectorRoleFocus.title}</h2>
                <p className="customer-shell-region-header__description">
                  Record cleanup, address fixes, and quick thread actions stay here.
                </p>
              </div>
            </div>
          ) : null}
          <div className="ui-sidebar-stack ui-sticky customer-workspace-shell__inspector-stack">
            {inspectorContent}
          </div>
        </aside>
        </section>
      )}
    </RegistryPage>
  );
}
