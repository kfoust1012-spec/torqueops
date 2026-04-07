import type { ServiceHistoryQuery } from "@mobile-mechanic/types";

export const customerWorkspaceTabs = [
  "summary",
  "vehicles",
  "history",
  "activity",
  "addresses"
] as const;

export type CustomerWorkspaceTab = (typeof customerWorkspaceTabs)[number];

export const customerVehicleTabs = ["overview", "history"] as const;

export type CustomerVehicleTab = (typeof customerVehicleTabs)[number];

export const customerWorkspaceModes = ["database", "workspace"] as const;

export type CustomerWorkspaceMode = (typeof customerWorkspaceModes)[number];

export const customerRegistrySegments = [
  "all",
  "needs-contact",
  "needs-address",
  "no-vehicle",
  "multi-vehicle",
  "inactive",
  "recent"
] as const;

export type CustomerRegistrySegment = (typeof customerRegistrySegments)[number];

type SearchParamValue = string | string[] | undefined;

type CustomerRouteOptions = {
  mode?: CustomerWorkspaceMode | undefined;
  query?: string | undefined;
  segment?: CustomerRegistrySegment | undefined;
  newCustomer?: boolean | undefined;
  selectedVehicleId?: string | undefined;
  editCustomer?: boolean | undefined;
  newAddress?: boolean | undefined;
  editAddressId?: string | undefined;
  newVehicle?: boolean | undefined;
  editVehicleId?: string | undefined;
  customerId?: string | undefined;
};

type CustomerWorkspaceHrefOptions = CustomerRouteOptions & {
  tab?: CustomerWorkspaceTab | undefined;
} & Partial<ServiceHistoryQuery>;

type CustomerVehicleHrefOptions = CustomerRouteOptions & {
  edit?: boolean | undefined;
  tab?: CustomerVehicleTab | undefined;
} & Partial<Omit<ServiceHistoryQuery, "vehicleId">>;

function appendMany(
  searchParams: URLSearchParams,
  key: string,
  values: string[] | undefined
) {
  for (const value of values ?? []) {
    if (value.trim()) {
      searchParams.append(key, value);
    }
  }
}

export function readSingleSearchParam(value: SearchParamValue) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}

export function readBooleanSearchParam(value: SearchParamValue) {
  const resolved = readSingleSearchParam(value);

  if (!resolved) {
    return false;
  }

  return !["0", "false", "off"].includes(resolved.toLowerCase());
}

export function readCustomerWorkspaceCustomerId(value: SearchParamValue) {
  return readSingleSearchParam(value);
}

export function readSelectedVehicleIdSearchParam(value: SearchParamValue) {
  return readSingleSearchParam(value);
}

export function normalizeCustomerWorkspaceMode(
  value: SearchParamValue,
  fallback: CustomerWorkspaceMode = "workspace"
): CustomerWorkspaceMode {
  const resolved = readSingleSearchParam(value);
  return resolved === "workspace" ? "workspace" : fallback;
}

export function normalizeCustomerRegistrySegment(
  value: SearchParamValue
): CustomerRegistrySegment {
  const resolved = readSingleSearchParam(value);
  return customerRegistrySegments.includes(resolved as CustomerRegistrySegment)
    ? (resolved as CustomerRegistrySegment)
    : "all";
}

export function normalizeCustomerWorkspaceTab(
  value: SearchParamValue
): CustomerWorkspaceTab {
  const resolved = readSingleSearchParam(value);
  return customerWorkspaceTabs.includes(resolved as CustomerWorkspaceTab)
    ? (resolved as CustomerWorkspaceTab)
    : "summary";
}

export function normalizeCustomerVehicleTab(
  value: SearchParamValue
): CustomerVehicleTab {
  const resolved = readSingleSearchParam(value);
  return customerVehicleTabs.includes(resolved as CustomerVehicleTab)
    ? (resolved as CustomerVehicleTab)
    : "overview";
}

export function buildCustomerWorkspaceHref(
  customerId: string,
  options: CustomerWorkspaceHrefOptions = {}
) {
  return buildCustomersHref({
    ...options,
    customerId
  });
}

export function buildCustomersHref(options: CustomerWorkspaceHrefOptions = {}) {
  const searchParams = new URLSearchParams();

  if (options.query?.trim()) {
    searchParams.set("query", options.query.trim());
  }

  if (options.segment && options.segment !== "all") {
    searchParams.set("segment", options.segment);
  }

  if (options.customerId) {
    searchParams.set("customerId", options.customerId);
  }

  if (options.tab && options.tab !== "summary") {
    searchParams.set("tab", options.tab);
  }

  if (options.newCustomer) {
    searchParams.set("newCustomer", "1");
  }

  if (options.selectedVehicleId) {
    searchParams.set("selectedVehicleId", options.selectedVehicleId);
  }

  if (options.editCustomer) {
    searchParams.set("editCustomer", "1");
  }

  if (options.newAddress) {
    searchParams.set("newAddress", "1");
  }

  if (options.editAddressId) {
    searchParams.set("editAddressId", options.editAddressId);
  }

  if (options.newVehicle) {
    searchParams.set("newVehicle", "1");
  }

  if (options.editVehicleId) {
    searchParams.set("editVehicleId", options.editVehicleId);
  }

  if (options.dateFrom) {
    searchParams.set("dateFrom", options.dateFrom);
  }

  if (options.dateTo) {
    searchParams.set("dateTo", options.dateTo);
  }

  if (options.vehicleId) {
    searchParams.set("vehicleId", options.vehicleId);
  }

  appendMany(searchParams, "jobStatuses", options.jobStatuses);
  appendMany(searchParams, "inspectionStatuses", options.inspectionStatuses);
  appendMany(searchParams, "estimateStatuses", options.estimateStatuses);
  appendMany(searchParams, "invoiceStatuses", options.invoiceStatuses);
  appendMany(searchParams, "paymentStatuses", options.paymentStatuses);

  if (options.sort) {
    searchParams.set("sort", options.sort);
  }

  const serialized = searchParams.toString();
  const basePath = "/dashboard/customers";

  return serialized ? `${basePath}?${serialized}` : basePath;
}

export function buildCustomerVehicleHref(
  customerId: string,
  vehicleId: string,
  options: CustomerVehicleHrefOptions = {}
) {
  return buildCustomersHref({
    mode: options.mode ?? "workspace",
    query: options.query,
    segment: options.segment,
    customerId,
    selectedVehicleId: vehicleId,
    editVehicleId: options.edit ? vehicleId : undefined,
    tab: options.tab === "history" ? "history" : "vehicles",
    vehicleId: options.tab === "history" ? vehicleId : undefined,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    jobStatuses: options.jobStatuses,
    inspectionStatuses: options.inspectionStatuses,
    estimateStatuses: options.estimateStatuses,
    invoiceStatuses: options.invoiceStatuses,
    paymentStatuses: options.paymentStatuses,
    sort: options.sort
  });
}
