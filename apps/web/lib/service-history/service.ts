import {
  getCustomerById,
  getVehicleById,
  listServiceHistoryEstimatesByJobIds,
  listServiceHistoryInspectionsByJobIds,
  listServiceHistoryInvoicesByJobIds,
  listServiceHistoryJobsForCustomer,
  listServiceHistoryJobsForVehicle,
  listServiceHistoryPaymentsByInvoiceIds,
  listVehiclesByCustomer,
  type ServiceHistoryInspectionRecord
} from "@mobile-mechanic/api-client";
import type {
  CustomerServiceHistory,
  Estimate,
  Invoice,
  Job,
  Payment,
  ServiceHistoryQuery,
  ServiceHistorySummary,
  ServiceHistoryVisit,
  VehicleServiceHistory
} from "@mobile-mechanic/types";

import type { AppSupabaseClient } from "@mobile-mechanic/api-client";

import { toServerError } from "../server-error";

function getVehicleDisplayName(vehicle: { year: number | null; make: string; model: string }) {
  return [vehicle.year ? String(vehicle.year) : null, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function getVisitSortAt(job: Job) {
  return job.completedAt ?? job.canceledAt ?? job.startedAt ?? job.scheduledStartAt ?? job.createdAt;
}

function getLowerBound(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Date.parse(`${value}T00:00:00.000Z`);
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getUpperBound(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Date.parse(`${value}T23:59:59.999Z`);
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function matchesDateRange(sortAt: string, query: ServiceHistoryQuery) {
  const timestamp = Date.parse(sortAt);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  const lowerBound = getLowerBound(query.dateFrom);
  const upperBound = getUpperBound(query.dateTo);

  if (lowerBound !== null && timestamp < lowerBound) {
    return false;
  }

  if (upperBound !== null && timestamp > upperBound) {
    return false;
  }

  return true;
}

function sortVisits(visits: ServiceHistoryVisit[], sort: ServiceHistoryQuery["sort"]) {
  const field = sort === "created_at" ? "createdAt" : "sortAt";
  return [...visits].sort((left, right) => Date.parse(right[field]) - Date.parse(left[field]));
}

function matchesRelatedFilters(visit: ServiceHistoryVisit, query: ServiceHistoryQuery) {
  if (query.inspectionStatuses?.length && !visit.inspection) {
    return false;
  }

  if (query.estimateStatuses?.length && !visit.estimate) {
    return false;
  }

  if (query.invoiceStatuses?.length && !visit.invoice) {
    return false;
  }

  if (query.paymentStatuses?.length && visit.payments.length === 0) {
    return false;
  }

  return true;
}

export function summarizeServiceHistory(visits: ServiceHistoryVisit[]): ServiceHistorySummary {
  const lastServiceAt = visits.reduce<string | null>((latest, visit) => {
    if (!latest) {
      return visit.sortAt;
    }

    return Date.parse(visit.sortAt) > Date.parse(latest) ? visit.sortAt : latest;
  }, null);

  return {
    totalJobs: visits.length,
    completedJobs: visits.filter((visit) => visit.jobStatus === "completed").length,
    totalInvoicedCents: visits.reduce((total, visit) => total + (visit.invoice?.totalCents ?? 0), 0),
    totalPaidCents: visits.reduce(
      (total, visit) => total + visit.payments.reduce((paymentTotal, payment) => paymentTotal + payment.amountCents, 0),
      0
    ),
    openBalanceCents: visits.reduce((total, visit) => total + (visit.invoice?.balanceDueCents ?? 0), 0),
    lastServiceAt
  };
}

export function buildServiceHistoryVisits(args: {
  jobs: Job[];
  estimates: Estimate[];
  invoices: Invoice[];
  inspections: ServiceHistoryInspectionRecord[];
  payments: Payment[];
  vehicleDisplayNamesById: Map<string, string>;
  query: ServiceHistoryQuery;
}) {
  const estimateByJobId = new Map(args.estimates.map((estimate) => [estimate.jobId, estimate]));
  const invoiceByJobId = new Map(args.invoices.map((invoice) => [invoice.jobId, invoice]));
  const inspectionByJobId = new Map(
    args.inspections.map((inspectionRecord) => [inspectionRecord.inspection.jobId, inspectionRecord.summary])
  );
  const paymentsByInvoiceId = new Map<string, Payment[]>();

  for (const payment of args.payments) {
    const current = paymentsByInvoiceId.get(payment.invoiceId) ?? [];
    current.push(payment);
    paymentsByInvoiceId.set(payment.invoiceId, current);
  }

  const visits = args.jobs
    .map<ServiceHistoryVisit>((job) => {
      const estimate = estimateByJobId.get(job.id) ?? null;
      const invoice = invoiceByJobId.get(job.id) ?? null;
      const inspection = inspectionByJobId.get(job.id) ?? null;
      const payments = invoice ? paymentsByInvoiceId.get(invoice.id) ?? [] : [];
      const sortAt = getVisitSortAt(job);

      return {
        jobId: job.id,
        customerId: job.customerId,
        vehicleId: job.vehicleId,
        jobTitle: job.title,
        jobStatus: job.status,
        scheduledStartAt: job.scheduledStartAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        canceledAt: job.canceledAt,
        createdAt: job.createdAt,
        sortAt,
        vehicleDisplayName: args.vehicleDisplayNamesById.get(job.vehicleId) ?? "Unknown vehicle",
        inspection,
        estimate: estimate
          ? {
              estimateId: estimate.id,
              status: estimate.status,
              estimateNumber: estimate.estimateNumber,
              title: estimate.title,
              sentAt: estimate.sentAt,
              acceptedAt: estimate.acceptedAt,
              totalCents: estimate.totalCents
            }
          : null,
        invoice: invoice
          ? {
              invoiceId: invoice.id,
              status: invoice.status,
              invoiceNumber: invoice.invoiceNumber,
              title: invoice.title,
              issuedAt: invoice.issuedAt,
              paidAt: invoice.paidAt,
              totalCents: invoice.totalCents,
              amountPaidCents: invoice.amountPaidCents,
              balanceDueCents: invoice.balanceDueCents
            }
          : null,
        payments: payments.map((payment) => ({
          paymentId: payment.id,
          status: payment.status,
          amountCents: payment.amountCents,
          paidAt: payment.paidAt,
          receiptUrl: payment.receiptUrl
        }))
      };
    })
    .filter((visit) => matchesDateRange(visit.sortAt, args.query))
    .filter((visit) => matchesRelatedFilters(visit, args.query));

  return sortVisits(visits, args.query.sort);
}

export async function getCustomerServiceHistory(
  supabase: AppSupabaseClient,
  companyId: string,
  customerId: string,
  query: ServiceHistoryQuery
): Promise<CustomerServiceHistory | null> {
  const [customerResult, vehiclesResult] = await Promise.all([
    getCustomerById(supabase, customerId),
    listVehiclesByCustomer(supabase, customerId)
  ]);

  if (customerResult.error) {
    throw toServerError(customerResult.error, "Customer service history could not load.");
  }

  if (!customerResult.data || customerResult.data.companyId !== companyId) {
    return null;
  }

  if (vehiclesResult.error) {
    throw toServerError(vehiclesResult.error, "Customer vehicles could not load.");
  }

  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({
    vehicleId: vehicle.id,
    displayName: vehicle.displayName,
    isActive: vehicle.isActive
  }));

  if (query.vehicleId && !vehicleOptions.some((vehicle) => vehicle.vehicleId === query.vehicleId)) {
    return {
      customer: customerResult.data,
      vehicleOptions,
      filters: query,
      summary: summarizeServiceHistory([]),
      visits: []
    };
  }

  const jobsResult = await listServiceHistoryJobsForCustomer(supabase, companyId, customerId, query);

  if (jobsResult.error) {
    throw toServerError(jobsResult.error, "Customer visit history could not load.");
  }

  const jobs = jobsResult.data ?? [];
  const jobIds = jobs.map((job) => job.id);
  const [estimatesResult, invoicesResult, inspectionsResult] = await Promise.all([
    listServiceHistoryEstimatesByJobIds(supabase, companyId, jobIds, query),
    listServiceHistoryInvoicesByJobIds(supabase, companyId, jobIds, query),
    listServiceHistoryInspectionsByJobIds(supabase, companyId, jobIds, query)
  ]);

  if (estimatesResult.error) {
    throw toServerError(estimatesResult.error, "Customer estimate history could not load.");
  }

  if (invoicesResult.error) {
    throw toServerError(invoicesResult.error, "Customer invoice history could not load.");
  }

  if (inspectionsResult.error) {
    throw toServerError(inspectionsResult.error, "Customer inspection history could not load.");
  }

  const invoiceIds = (invoicesResult.data ?? []).map((invoice) => invoice.id);
  const paymentsResult = await listServiceHistoryPaymentsByInvoiceIds(supabase, companyId, invoiceIds, query);

  if (paymentsResult.error) {
    throw toServerError(paymentsResult.error, "Customer payment history could not load.");
  }

  const vehicleDisplayNamesById = new Map(vehicleOptions.map((vehicle) => [vehicle.vehicleId, vehicle.displayName]));
  const visits = buildServiceHistoryVisits({
    jobs,
    estimates: estimatesResult.data ?? [],
    invoices: invoicesResult.data ?? [],
    inspections: inspectionsResult.data ?? [],
    payments: paymentsResult.data ?? [],
    vehicleDisplayNamesById,
    query
  });

  return {
    customer: customerResult.data,
    vehicleOptions,
    filters: query,
    summary: summarizeServiceHistory(visits),
    visits
  };
}

export async function getVehicleServiceHistory(
  supabase: AppSupabaseClient,
  companyId: string,
  vehicleId: string,
  query: Omit<ServiceHistoryQuery, "vehicleId">
): Promise<VehicleServiceHistory | null> {
  const vehicleResult = await getVehicleById(supabase, vehicleId);

  if (vehicleResult.error) {
    throw toServerError(vehicleResult.error, "Vehicle service history could not load.");
  }

  if (!vehicleResult.data || vehicleResult.data.companyId !== companyId) {
    return null;
  }

  const customerResult = await getCustomerById(supabase, vehicleResult.data.customerId);

  if (customerResult.error) {
    throw toServerError(customerResult.error, "Vehicle customer context could not load.");
  }

  if (!customerResult.data || customerResult.data.companyId !== companyId) {
    return null;
  }

  const jobsResult = await listServiceHistoryJobsForVehicle(supabase, companyId, vehicleId, query);

  if (jobsResult.error) {
    throw toServerError(jobsResult.error, "Vehicle visit history could not load.");
  }

  const jobs = jobsResult.data ?? [];
  const jobIds = jobs.map((job) => job.id);
  const [estimatesResult, invoicesResult, inspectionsResult] = await Promise.all([
    listServiceHistoryEstimatesByJobIds(supabase, companyId, jobIds, query),
    listServiceHistoryInvoicesByJobIds(supabase, companyId, jobIds, query),
    listServiceHistoryInspectionsByJobIds(supabase, companyId, jobIds, query)
  ]);

  if (estimatesResult.error) {
    throw toServerError(estimatesResult.error, "Vehicle estimate history could not load.");
  }

  if (invoicesResult.error) {
    throw toServerError(invoicesResult.error, "Vehicle invoice history could not load.");
  }

  if (inspectionsResult.error) {
    throw toServerError(inspectionsResult.error, "Vehicle inspection history could not load.");
  }

  const invoiceIds = (invoicesResult.data ?? []).map((invoice) => invoice.id);
  const paymentsResult = await listServiceHistoryPaymentsByInvoiceIds(supabase, companyId, invoiceIds, query);

  if (paymentsResult.error) {
    throw toServerError(paymentsResult.error, "Vehicle payment history could not load.");
  }

  const visits = buildServiceHistoryVisits({
    jobs,
    estimates: estimatesResult.data ?? [],
    invoices: invoicesResult.data ?? [],
    inspections: inspectionsResult.data ?? [],
    payments: paymentsResult.data ?? [],
    vehicleDisplayNamesById: new Map([
      [
        vehicleResult.data.id,
        getVehicleDisplayName({
          year: vehicleResult.data.year,
          make: vehicleResult.data.make,
          model: vehicleResult.data.model
        })
      ]
    ]),
    query
  });

  return {
    customer: customerResult.data,
    vehicle: vehicleResult.data,
    filters: query,
    summary: summarizeServiceHistory(visits),
    visits
  };
}
