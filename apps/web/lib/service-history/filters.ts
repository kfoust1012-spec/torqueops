import type { ServiceHistoryQuery } from "@mobile-mechanic/types";
import {
  customerServiceHistoryQuerySchema,
  vehicleServiceHistoryQuerySchema
} from "@mobile-mechanic/validation";

type SearchParamValue = string | string[] | undefined;

export type ServiceHistorySearchParams = Record<string, SearchParamValue>;

function getSearchParam(value: SearchParamValue): string {
  return typeof value === "string" ? value : "";
}

function getSearchParamValues(value: SearchParamValue): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

function appendMany(searchParams: URLSearchParams, key: string, values: string[] | undefined) {
  for (const value of values ?? []) {
    if (value.trim()) {
      searchParams.append(key, value);
    }
  }
}

export function parseCustomerServiceHistorySearchParams(
  searchParams: ServiceHistorySearchParams
): ServiceHistoryQuery {
  return customerServiceHistoryQuerySchema.parse({
    dateFrom: getSearchParam(searchParams.dateFrom).trim() || undefined,
    dateTo: getSearchParam(searchParams.dateTo).trim() || undefined,
    vehicleId: getSearchParam(searchParams.vehicleId).trim() || undefined,
    jobStatuses: getSearchParamValues(searchParams.jobStatuses),
    inspectionStatuses: getSearchParamValues(searchParams.inspectionStatuses),
    estimateStatuses: getSearchParamValues(searchParams.estimateStatuses),
    invoiceStatuses: getSearchParamValues(searchParams.invoiceStatuses),
    paymentStatuses: getSearchParamValues(searchParams.paymentStatuses),
    sort: getSearchParam(searchParams.sort).trim() || undefined
  });
}

export function parseVehicleServiceHistorySearchParams(
  searchParams: ServiceHistorySearchParams
): Omit<ServiceHistoryQuery, "vehicleId"> {
  return vehicleServiceHistoryQuerySchema.parse({
    dateFrom: getSearchParam(searchParams.dateFrom).trim() || undefined,
    dateTo: getSearchParam(searchParams.dateTo).trim() || undefined,
    jobStatuses: getSearchParamValues(searchParams.jobStatuses),
    inspectionStatuses: getSearchParamValues(searchParams.inspectionStatuses),
    estimateStatuses: getSearchParamValues(searchParams.estimateStatuses),
    invoiceStatuses: getSearchParamValues(searchParams.invoiceStatuses),
    paymentStatuses: getSearchParamValues(searchParams.paymentStatuses),
    sort: getSearchParam(searchParams.sort).trim() || undefined
  });
}

export function parseCustomerServiceHistoryUrlSearchParams(searchParams: URLSearchParams) {
  return customerServiceHistoryQuerySchema.parse({
    dateFrom: searchParams.get("dateFrom")?.trim() || undefined,
    dateTo: searchParams.get("dateTo")?.trim() || undefined,
    vehicleId: searchParams.get("vehicleId")?.trim() || undefined,
    jobStatuses: searchParams.getAll("jobStatuses").map((value) => value.trim()).filter(Boolean),
    inspectionStatuses: searchParams
      .getAll("inspectionStatuses")
      .map((value) => value.trim())
      .filter(Boolean),
    estimateStatuses: searchParams.getAll("estimateStatuses").map((value) => value.trim()).filter(Boolean),
    invoiceStatuses: searchParams.getAll("invoiceStatuses").map((value) => value.trim()).filter(Boolean),
    paymentStatuses: searchParams.getAll("paymentStatuses").map((value) => value.trim()).filter(Boolean),
    sort: searchParams.get("sort")?.trim() || undefined
  });
}

export function parseVehicleServiceHistoryUrlSearchParams(searchParams: URLSearchParams) {
  return vehicleServiceHistoryQuerySchema.parse({
    dateFrom: searchParams.get("dateFrom")?.trim() || undefined,
    dateTo: searchParams.get("dateTo")?.trim() || undefined,
    jobStatuses: searchParams.getAll("jobStatuses").map((value) => value.trim()).filter(Boolean),
    inspectionStatuses: searchParams
      .getAll("inspectionStatuses")
      .map((value) => value.trim())
      .filter(Boolean),
    estimateStatuses: searchParams.getAll("estimateStatuses").map((value) => value.trim()).filter(Boolean),
    invoiceStatuses: searchParams.getAll("invoiceStatuses").map((value) => value.trim()).filter(Boolean),
    paymentStatuses: searchParams.getAll("paymentStatuses").map((value) => value.trim()).filter(Boolean),
    sort: searchParams.get("sort")?.trim() || undefined
  });
}

export function buildServiceHistoryHref(basePath: string, query: ServiceHistoryQuery) {
  const searchParams = new URLSearchParams();

  if (query.dateFrom) {
    searchParams.set("dateFrom", query.dateFrom);
  }

  if (query.dateTo) {
    searchParams.set("dateTo", query.dateTo);
  }

  if (query.vehicleId) {
    searchParams.set("vehicleId", query.vehicleId);
  }

  appendMany(searchParams, "jobStatuses", query.jobStatuses);
  appendMany(searchParams, "inspectionStatuses", query.inspectionStatuses);
  appendMany(searchParams, "estimateStatuses", query.estimateStatuses);
  appendMany(searchParams, "invoiceStatuses", query.invoiceStatuses);
  appendMany(searchParams, "paymentStatuses", query.paymentStatuses);

  if (query.sort) {
    searchParams.set("sort", query.sort);
  }

  const serialized = searchParams.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}

export function formatDateFilterValue(value: string | undefined) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}