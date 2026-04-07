import type { Customer } from "./customer";
import type { EstimateStatus } from "./estimate";
import type { InspectionStatus } from "./inspection";
import type { InvoiceStatus } from "./invoice";
import type { JobStatus } from "./job";
import type { PaymentStatus } from "./payment";
import type { UUID } from "./common";
import type { Vehicle } from "./vehicle";

export const serviceHistorySortFields = ["service_date", "created_at"] as const;

export type ServiceHistorySortField = (typeof serviceHistorySortFields)[number];

export interface ServiceHistoryVehicleOption {
  vehicleId: UUID;
  displayName: string;
  isActive: boolean;
}

export interface ServiceHistoryInspectionSummary {
  inspectionId: UUID;
  status: InspectionStatus;
  startedAt: string;
  completedAt: string | null;
  criticalCount: number;
  highCount: number;
  recommendationCount: number;
}

export interface ServiceHistoryEstimateSummary {
  estimateId: UUID;
  status: EstimateStatus;
  estimateNumber: string;
  title: string;
  sentAt: string | null;
  acceptedAt: string | null;
  totalCents: number;
}

export interface ServiceHistoryInvoiceSummary {
  invoiceId: UUID;
  status: InvoiceStatus;
  invoiceNumber: string;
  title: string;
  issuedAt: string | null;
  paidAt: string | null;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
}

export interface ServiceHistoryPaymentSummary {
  paymentId: UUID;
  status: PaymentStatus;
  amountCents: number;
  paidAt: string;
  receiptUrl: string | null;
}

export interface ServiceHistoryVisit {
  jobId: UUID;
  customerId: UUID;
  vehicleId: UUID;
  jobTitle: string;
  jobStatus: JobStatus;
  scheduledStartAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  sortAt: string;
  vehicleDisplayName: string;
  inspection: ServiceHistoryInspectionSummary | null;
  estimate: ServiceHistoryEstimateSummary | null;
  invoice: ServiceHistoryInvoiceSummary | null;
  payments: ServiceHistoryPaymentSummary[];
}

export interface ServiceHistorySummary {
  totalJobs: number;
  completedJobs: number;
  totalInvoicedCents: number;
  totalPaidCents: number;
  openBalanceCents: number;
  lastServiceAt: string | null;
}

export interface ServiceHistoryQuery {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  vehicleId?: UUID | undefined;
  jobStatuses?: JobStatus[] | undefined;
  inspectionStatuses?: InspectionStatus[] | undefined;
  estimateStatuses?: EstimateStatus[] | undefined;
  invoiceStatuses?: InvoiceStatus[] | undefined;
  paymentStatuses?: PaymentStatus[] | undefined;
  sort?: ServiceHistorySortField | undefined;
}

export interface CustomerServiceHistory {
  customer: Customer;
  vehicleOptions: ServiceHistoryVehicleOption[];
  filters: ServiceHistoryQuery;
  summary: ServiceHistorySummary;
  visits: ServiceHistoryVisit[];
}

export interface VehicleServiceHistory {
  customer: Customer;
  vehicle: Vehicle;
  filters: Omit<ServiceHistoryQuery, "vehicleId">;
  summary: ServiceHistorySummary;
  visits: ServiceHistoryVisit[];
}