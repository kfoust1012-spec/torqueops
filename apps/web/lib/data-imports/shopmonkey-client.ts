import type { Json, MigrationSourceCapabilities } from "@mobile-mechanic/types";

const SHOPMONKEY_API_BASE_URL = "https://api.shopmonkey.cloud";

type ShopmonkeyEnvelope<T> = {
  code?: string | null | undefined;
  data?: T | null | undefined;
  documentation_url?: string | null | undefined;
  message?: string | null | undefined;
  meta?: Record<string, unknown> | null | undefined;
  success?: boolean | null | undefined;
};

type ShopmonkeyRequestOptions = {
  body?: Json | undefined;
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | null | undefined>;
};

type ShopmonkeyPageResult<T> = {
  hasMore: boolean;
  records: T[];
  total: number | null;
};

export type ShopmonkeyVerificationResult = {
  capabilities: MigrationSourceCapabilities;
  lastErrorMessage: string | null;
  message: string;
  status: "connected" | "error";
};

export type ShopmonkeyExportRequestResult = {
  exportFileName: string;
  exportReadyAt: string;
  requestedTables: string[];
};

export interface ShopmonkeyCustomerRecord {
  id: string;
  createdDate: string;
  updatedDate: string | null;
  deleted?: boolean | null;
  deletedDate?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  publicId?: string | null;
  note?: string | null;
  emails?: Array<{
    email?: string | null;
    primary?: boolean | null;
  }> | null;
  phoneNumbers?: Array<{
    number?: string | null;
    primary?: boolean | null;
  }> | null;
}

export interface ShopmonkeyVehicleRecord {
  id: string;
  createdDate: string;
  updatedDate: string | null;
  deleted?: boolean | null;
  deletedDate?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  submodel?: string | null;
  engine?: string | null;
  vin?: string | null;
  color?: string | null;
  mileage?: number | null;
  licensePlate?: string | null;
  licensePlateState?: string | null;
  note?: string | null;
  name?: string | null;
  type?: string | null;
}

export interface ShopmonkeyOrderRecord {
  id: string;
  createdDate: string;
  updatedDate: string | null;
  publicId?: string | null;
  number?: number | null;
  status?: string | null;
  vehicleId?: string | null;
  name?: string | null;
  generatedName?: string | null;
  coalescedName?: string | null;
  complaint?: string | null;
  recommendation?: string | null;
  purchaseOrderNumber?: string | null;
  orderCreatedDate?: string | null;
  archived?: boolean | null;
  authorized?: boolean | null;
  authorizedDate?: string | null;
  invoiced?: boolean | null;
  invoicedDate?: string | null;
  paid?: boolean | null;
  appointmentDates?: string | string[] | null;
  totalCostCents?: number | null;
  paidCostCents?: number | null;
  remainingCostCents?: number | null;
  taxCents?: number | null;
  partsCents?: number | null;
  tiresCents?: number | null;
  laborCents?: number | null;
  shopSuppliesCents?: number | null;
  subcontractsCents?: number | null;
  transactionalFeeSubtotalCents?: number | null;
  transactionalFeeTotalCents?: number | null;
  completedDate?: string | null;
  fullyPaidDate?: string | null;
  paymentDueDate?: string | null;
  deleted?: boolean | null;
  deletedDate?: string | null;
  mileageIn?: number | null;
  mileageOut?: number | null;
}

export interface ShopmonkeyInspectionFileRecord {
  id: string;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  thumbnailUrl?: string | null;
  url?: string | null;
}

export interface ShopmonkeyInspectionItemRecord {
  id: string;
  createdDate: string;
  updatedDate: string | null;
  inspectionId: string;
  status?: string | null;
  name?: string | null;
  message?: string | null;
  ordinal?: number | null;
  approved?: boolean | null;
  authorizationStatus?: string | null;
  files?: ShopmonkeyInspectionFileRecord[] | null;
}

export interface ShopmonkeyInspectionRecord {
  id: string;
  createdDate: string;
  updatedDate: string | null;
  companyId?: string | null;
  locationId?: string | null;
  orderId?: string | null;
  name?: string | null;
  createdById?: string | null;
  templateId?: string | null;
  completed?: boolean | null;
  completedDate?: string | null;
  completedById?: string | null;
  ordinal?: number | null;
  items?: ShopmonkeyInspectionItemRecord[] | null;
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getProviderMessage(payload: unknown) {
  const root = getObject(payload);
  const message = root?.message;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  const data = getObject(root?.data);
  const dataMessage = data?.message;

  if (typeof dataMessage === "string" && dataMessage.trim()) {
    return dataMessage.trim();
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Shopmonkey request failed.";
}

function buildShopmonkeyCapabilities(): MigrationSourceCapabilities {
  return {
    supportsCustomerImport: true,
    supportsVehicleImport: true,
    supportsOrderImport: true,
    supportsInspectionImport: true,
    supportsExportApi: true,
    supportsWebhooks: true
  };
}

async function requestShopmonkeyEnvelope<T>(
  apiKey: string,
  path: string,
  options: ShopmonkeyRequestOptions = {}
) {
  const url = new URL(path, `${SHOPMONKEY_API_BASE_URL}/`);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as ShopmonkeyEnvelope<T> | null;
  const message = getProviderMessage(payload) ?? `Shopmonkey request failed with status ${response.status}.`;

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(message);
  }

  return payload;
}

async function requestShopmonkey<T>(
  apiKey: string,
  path: string,
  options: ShopmonkeyRequestOptions = {}
) {
  const payload = await requestShopmonkeyEnvelope<T>(apiKey, path, options);
  return payload.data as T;
}

async function requestShopmonkeyPage<T>(
  apiKey: string,
  path: string,
  options: ShopmonkeyRequestOptions & {
    limit?: number;
  } = {}
): Promise<ShopmonkeyPageResult<T>> {
  const payload = await requestShopmonkeyEnvelope<T[]>(apiKey, path, options);
  const records = Array.isArray(payload.data) ? payload.data : [];
  const meta = getObject(payload.meta);
  const total = typeof meta?.total === "number" ? meta.total : null;
  const hasMore =
    typeof meta?.hasMore === "boolean"
      ? meta.hasMore
      : options.limit
        ? records.length >= options.limit
        : false;

  return {
    hasMore,
    records,
    total
  };
}

export async function searchShopmonkeyCustomers(
  apiKey: string,
  input: {
    limit?: number;
    skip?: number;
  } = {}
) {
  const limit = input.limit ?? 100;

  return requestShopmonkeyPage<ShopmonkeyCustomerRecord>(apiKey, "/v3/customer/search", {
    method: "POST",
    body: {
      limit,
      skip: input.skip ?? 0
    },
    limit
  });
}

export async function getShopmonkeyCustomerById(apiKey: string, customerId: string) {
  return requestShopmonkey<ShopmonkeyCustomerRecord>(apiKey, `/v3/customer/${customerId}`);
}

export async function listShopmonkeyCustomerVehicles(
  apiKey: string,
  customerId: string,
  input: {
    limit?: number;
    skip?: number;
  } = {}
) {
  const limit = input.limit ?? 100;

  return requestShopmonkeyPage<ShopmonkeyVehicleRecord>(
    apiKey,
    `/v3/customer/${customerId}/vehicle`,
    {
      query: {
        limit,
        skip: input.skip ?? 0
      },
      limit
    }
  );
}

export async function listShopmonkeyCustomerOrders(
  apiKey: string,
  customerId: string,
  input: {
    limit?: number;
    skip?: number;
  } = {}
) {
  const limit = input.limit ?? 100;

  return requestShopmonkeyPage<ShopmonkeyOrderRecord>(
    apiKey,
    `/v3/customer/${customerId}/order`,
    {
      query: {
        limit,
        skip: input.skip ?? 0
      },
      limit
    }
  );
}

export async function listShopmonkeyOrderSharedInspections(
  apiKey: string,
  publicId: string
) {
  return requestShopmonkey<ShopmonkeyInspectionRecord[]>(
    apiKey,
    `/v3/order_shared/${publicId}/inspection`
  );
}

export async function verifyShopmonkeyConnection(
  apiKey: string
): Promise<ShopmonkeyVerificationResult> {
  try {
    await requestShopmonkey(apiKey, "/v3/customer/search", {
      method: "POST",
      body: {}
    });

    return {
      capabilities: buildShopmonkeyCapabilities(),
      lastErrorMessage: null,
      message: "Verified Shopmonkey access by calling the customer search endpoint.",
      status: "connected"
    };
  } catch (error) {
    return {
      capabilities: buildShopmonkeyCapabilities(),
      lastErrorMessage: getErrorMessage(error),
      message: "Shopmonkey verification failed.",
      status: "error"
    };
  }
}

export async function requestShopmonkeyCompanyExport(
  apiKey: string,
  tables: string[]
): Promise<ShopmonkeyExportRequestResult> {
  const exportRequest = await requestShopmonkey<{ fileName: string }>(apiKey, "/v3/export", {
    method: "POST",
    body: {
      tables
    }
  });

  await requestShopmonkey<{ url: string }>(apiKey, "/v3/export/presigned_url", {
    method: "POST",
    body: {
      fileName: exportRequest.fileName
    }
  });

  return {
    exportFileName: exportRequest.fileName,
    exportReadyAt: new Date().toISOString(),
    requestedTables: tables
  };
}
