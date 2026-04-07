import type { ProcurementProvider } from "@mobile-mechanic/types";

import type { ProcurementProviderAdapter } from "./types";
import { amazonBusinessAdapter } from "./amazon-business/adapter";
import { partsTechAdapter } from "./partstech/adapter";
import { repairLinkAdapter } from "./repairlink/adapter";

const providerRegistry: Record<ProcurementProvider, ProcurementProviderAdapter> = {
  amazon_business: amazonBusinessAdapter,
  partstech: partsTechAdapter,
  repairlink: repairLinkAdapter
};

export function getProcurementProviderAdapter(provider: ProcurementProvider) {
  return providerRegistry[provider];
}
