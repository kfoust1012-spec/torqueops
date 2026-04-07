import type {
  EstimateLiveRetailerSearchProvider,
  EstimateSupplierConnector,
  EstimateSupplierConnectorId
} from "@mobile-mechanic/types";

const estimateSupplierConnectorRegistry: Record<EstimateSupplierConnectorId, EstimateSupplierConnector> = {
  fitment: {
    browserHost: null,
    browserLabel: null,
    id: "fitment",
    label: "Fitment catalog",
    primaryFlow: "seeded_fitment",
    provider: null,
    shortLabel: "Fitment",
    supportsBrowserHandoff: false,
    supportsDirectSearch: false,
    supportsManualCapture: false
  },
  manual: {
    browserHost: null,
    browserLabel: null,
    id: "manual",
    label: "Manual supplier capture",
    primaryFlow: "manual_capture",
    provider: null,
    shortLabel: "Manual / recent",
    supportsBrowserHandoff: false,
    supportsDirectSearch: false,
    supportsManualCapture: true
  },
  oreilly: {
    browserHost: "oreillyauto.com",
    browserLabel: "Open O'Reilly",
    id: "oreilly",
    label: "O'Reilly Auto Parts",
    primaryFlow: "integrated_lookup",
    provider: "oreilly",
    shortLabel: "Live O'Reilly",
    supportsBrowserHandoff: true,
    supportsDirectSearch: true,
    supportsManualCapture: true
  }
};

export function getEstimateSupplierConnector(id: EstimateSupplierConnectorId) {
  return estimateSupplierConnectorRegistry[id];
}

export function getEstimateLiveRetailerConnector(provider: EstimateLiveRetailerSearchProvider) {
  if (provider === "oreilly") {
    return estimateSupplierConnectorRegistry.oreilly;
  }

  return estimateSupplierConnectorRegistry.oreilly;
}

export function buildEstimateSupplierBrowserSearchUrl(input: {
  connectorId: EstimateSupplierConnectorId;
  query: string;
}) {
  const normalizedQuery = input.query.trim() || "auto parts";

  if (input.connectorId === "oreilly") {
    return `https://www.oreillyauto.com/search?q=${encodeURIComponent(normalizedQuery)}`;
  }

  return null;
}
