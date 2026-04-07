import type { CarfaxReportSummary, CarfaxSummaryStatus } from "@mobile-mechanic/types";
import {
  carfaxReportSummarySchema,
  carfaxSummaryStatusSchema
} from "@mobile-mechanic/validation";

export type CarfaxProviderConfig = {
  apiKey: string;
  baseUrl: string;
};

export type FetchCarfaxSummaryResult = {
  status: CarfaxSummaryStatus;
  summary: CarfaxReportSummary | null;
  lastErrorMessage: string | null;
};

export function buildCarfaxProviderRequest(vin: string, config: CarfaxProviderConfig) {
  return {
    url: config.baseUrl,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "x-api-key": config.apiKey
      },
      body: JSON.stringify({ vin }),
      cache: "no-store" as const
    }
  };
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getSummaryCandidates(payload: unknown): unknown[] {
  const root = getObject(payload);
  const data = getObject(root?.data);

  return [
    root?.summary,
    root?.reportSummary,
    data?.summary,
    data?.reportSummary,
    payload
  ];
}

function getProviderMessage(payload: unknown): string | null {
  const root = getObject(payload);
  const message = root?.message;
  const error = root?.error;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  const data = getObject(root?.data);

  if (!data) {
    return null;
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }

  return null;
}

function getProviderStatus(payload: unknown): CarfaxSummaryStatus | null {
  const root = getObject(payload);
  const data = getObject(root?.data);
  const parsed = carfaxSummaryStatusSchema.safeParse(root?.status ?? data?.status);

  return parsed.success ? parsed.data : null;
}

export function normalizeCarfaxProviderPayload(payload: unknown): FetchCarfaxSummaryResult {
  for (const candidate of getSummaryCandidates(payload)) {
    const parsed = carfaxReportSummarySchema.safeParse(candidate);

    if (parsed.success) {
      return {
        status: "ready",
        summary: parsed.data,
        lastErrorMessage: null
      };
    }
  }

  const status = getProviderStatus(payload);
  const message = getProviderMessage(payload);

  if (status === "not_available") {
    return {
      status,
      summary: null,
      lastErrorMessage: message
    };
  }

  return {
    status: status === "provider_error" ? status : "provider_error",
    summary: null,
    lastErrorMessage: message ?? "Carfax summary could not be normalized from the provider response."
  };
}
