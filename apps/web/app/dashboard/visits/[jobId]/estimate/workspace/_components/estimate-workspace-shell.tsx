"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  calculateEstimateTotals,
  formatCurrencyFromCents,
  formatDateTime,
  getCustomerDisplayName,
  getEstimateLiveRetailerConnector
} from "@mobile-mechanic/core";
import type {
  EstimateCatalogPartOfferSummary,
  EstimateLiveRetailerPartOffer,
  EstimateManualPartOfferSummary,
  EstimatePartOfferSummary,
  EstimateSectionDetail,
  SearchEstimateLiveRetailerOffersResult,
  EstimateWorkspace,
  EstimateWorkspaceLineItem,
  LaborGuideSuggestionResult,
  SupplierAccount
} from "@mobile-mechanic/types";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  Input,
  Select,
  Textarea,
  buttonClassName
} from "../../../../../../../components/ui";
import { buildCustomerWorkspaceHref } from "../../../../../../../lib/customers/workspace";
import { buildVehicleAwareRetailerSearchQuery } from "../../../../../../../lib/estimates/workspace/retailer-search-helpers";
import {
  getVisitNextMove,
  getVisitWorkflowLabel,
  getVisitWorkflowState,
  getVisitWorkflowTone
} from "../../../../../../../lib/jobs/workflow";
import {
  launchOReillyRetailerSourcingSession,
  probeRetailerExtension,
  subscribeToRetailerExtensionEvents
} from "../../../../../../../lib/retailer-extension";
import {
  buildVisitEstimateHref,
  buildVisitEstimateThreadHref,
  buildVisitPartsHref,
  buildVisitReturnThreadHref
} from "../../../../../../../lib/visits/workspace";

type EstimateWorkspaceShellProps = {
  initialWorkspace: EstimateWorkspace;
  jobId: string;
  returnLabel?: string;
  returnScope?: string;
  returnTo?: string | null;
  timeZone: string;
};

type JsonResponse<T> = {
  error?: string;
  ok?: boolean;
} & T;

type EstimateLineMutationInput = {
  estimateSectionId?: string | null;
  itemType: "labor" | "part" | "fee";
  name: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: number;
  taxable?: boolean;
};

type EstimateLineDraft = {
  quantity: string;
  taxable: boolean;
  unitPrice: string;
};

type ManualOfferDraft = {
  availabilityText: string;
  notes: string;
  quotedCoreCharge: string;
  quotedUnitCost: string;
  supplierAccountId: string;
  supplierPartNumber: string;
  supplierUrl: string;
};

type InlineSupplierDraft = {
  externalUrl: string;
  name: string;
};

type QuickRepairPreset = {
  description: string;
  id: string;
  label: string;
  lines: EstimateLineMutationInput[];
  sectionTitle: string;
};

type LiveRetailerSearchState = SearchEstimateLiveRetailerOffersResult & {
  lineItemId: string;
};

type LiveRetailerSessionState = {
  lineItemId: string;
  query: string;
  retailerTabId: number | null;
  sessionId: string;
  stage: "captured" | "launched" | "launching" | "ready";
};

type EstimateSectionSummary = ReturnType<typeof calculateSectionSummary>;

type EstimateLineEditorProps = {
  currencyCode: string;
  lineItem: EstimateWorkspaceLineItem;
  onDelete: (lineItemId: string) => Promise<void>;
  onDraftChange: (lineItemId: string, draft: EstimateLineDraft) => void;
  onSave: (lineItemId: string, input: EstimateLineMutationInput) => Promise<void>;
  onSelect: (lineItemId: string) => void;
  selected: boolean;
};

type EstimateLineListProps = {
  currencyCode: string;
  lineItems: EstimateWorkspaceLineItem[];
  onDeleteLine: (lineItemId: string) => Promise<void>;
  onDraftChange: (lineItemId: string, draft: EstimateLineDraft) => void;
  onSaveLine: (lineItemId: string, input: EstimateLineMutationInput) => Promise<void>;
  onSelectLine: (lineItemId: string) => void;
  onSourceLine: (lineItemId: string) => void;
  selectedLineItemId: string | null;
};

type EstimateSectionCardProps = EstimateLineListProps & {
  onDeleteSection: (sectionId: string) => Promise<void>;
  onSaveSectionAsPackage: (section: EstimateSectionDetail["section"]) => Promise<void>;
  onUpdateSection: (
    sectionId: string,
    input: { description?: string | null; notes?: string | null; title: string }
  ) => Promise<void>;
  saveSectionAsPackageLoading: boolean;
  sectionDetail: EstimateSectionDetail;
  summary: EstimateSectionSummary;
};

const QUICK_ADD_NAME_INPUT_ID = "estimate-workspace-quick-add-name";
const QUICK_ADD_PRICE_INPUT_ID = "estimate-workspace-quick-add-price";
const NEW_SECTION_INPUT_ID = "estimate-workspace-new-section-title";
const LABOR_SEARCH_INPUT_ID = "estimate-workspace-labor-search";
const PART_SEARCH_INPUT_ID = "estimate-workspace-part-search";
const CONNECTED_PART_SEARCH_INPUT_ID = "estimate-workspace-connected-part-search";
const MANUAL_PART_PRICE_INPUT_ID = "estimate-workspace-manual-offer-price";
const INLINE_SUPPLIER_NAME_INPUT_ID = "estimate-workspace-inline-supplier-name";

async function requestJson<TResponse>(
  url: string,
  input?: {
    body?: object;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
  }
): Promise<JsonResponse<TResponse>> {
  const requestInit: RequestInit = {
    method: input?.method ?? "POST"
  };

  if (input?.body) {
    requestInit.body = JSON.stringify(input.body);
    requestInit.headers = { "Content-Type": "application/json" };
  }

  const response = await fetch(url, requestInit);
  const payload = (await response.json().catch(() => null)) as JsonResponse<TResponse> | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Estimate thread action could not be completed.");
  }

  if (!payload) {
    throw new Error("Estimate thread action returned no response payload.");
  }

  return payload;
}

function getAllWorkspaceLineItems(workspace: EstimateWorkspace) {
  return [
    ...workspace.ungroupedLineItems,
    ...workspace.sections.flatMap((section) => section.lineItems)
  ];
}

function getSelectedLineItem(workspace: EstimateWorkspace, selectedLineItemId: string | null) {
  if (!selectedLineItemId) {
    return null;
  }

  return getAllWorkspaceLineItems(workspace).find((lineItem) => lineItem.id === selectedLineItemId) ?? null;
}

function getDefaultSelectedLineItemId(workspace: EstimateWorkspace) {
  const allLineItems = getAllWorkspaceLineItems(workspace);
  const firstPartLine = allLineItems.find((lineItem) => lineItem.itemType === "part");
  return firstPartLine?.id ?? allLineItems[0]?.id ?? null;
}

function findNewMatchingLineItemId(input: {
  itemType: "labor" | "part" | "fee";
  name: string;
  nextWorkspace: EstimateWorkspace;
  previousLineItemIds: Set<string>;
}) {
  return (
    getAllWorkspaceLineItems(input.nextWorkspace)
      .filter((lineItem) => !input.previousLineItemIds.has(lineItem.id))
      .find((lineItem) => lineItem.itemType === input.itemType && lineItem.name === input.name)?.id ??
    null
  );
}

function parseDealerIds(settingsJson: unknown) {
  if (!settingsJson || typeof settingsJson !== "object" || Array.isArray(settingsJson)) {
    return [] as string[];
  }

  const preferredDealerMappingIds = (settingsJson as { preferredDealerMappingIds?: unknown })
    .preferredDealerMappingIds;

  if (!Array.isArray(preferredDealerMappingIds)) {
    return [];
  }

  return preferredDealerMappingIds.filter((value): value is string => typeof value === "string");
}

function formatCurrencyInput(valueCents: number) {
  const value = valueCents / 100;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function parseCurrencyInput(value: string) {
  const normalizedValue = value.trim().replace(/[$,\s]/g, "");

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) : 0;
}

function formatPercentInput(valueBasisPoints: number) {
  const value = valueBasisPoints / 100;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function parsePercentInput(value: string) {
  const normalizedValue = value.trim().replace(/[%,\s]/g, "");

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) : 0;
}

function parseNumberInput(value: string) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatWorkspaceLabel(value: string) {
  return value.replaceAll("_", " ");
}

function buildEstimateWorkspaceDispatchHref(workspace: EstimateWorkspace, timeZone: string) {
  const dateValue =
    workspace.job.scheduledStartAt ?? workspace.job.arrivalWindowStartAt ?? new Date().toISOString();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateValue));

  return `/dashboard/dispatch?view=day&date=${localDate}&jobId=${workspace.job.id}`;
}

function focusWorkspaceField(id: string) {
  if (typeof document === "undefined") {
    return false;
  }

  const element = document.getElementById(id);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.select();
    return true;
  }

  return false;
}

function formatQuantityInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");
}

function focusSourcingRail(focusFieldId = PART_SEARCH_INPUT_ID) {
  if (typeof document === "undefined") {
    return;
  }

  document.getElementById("estimate-workspace-parts-rail")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  window.setTimeout(() => {
    if (!focusWorkspaceField(focusFieldId) && focusFieldId !== PART_SEARCH_INPUT_ID) {
      focusWorkspaceField(PART_SEARCH_INPUT_ID);
    }
  }, 140);
}

function getQuickAddPlaceholder(itemType: EstimateLineMutationInput["itemType"]) {
  if (itemType === "labor") {
    return "Quick add labor line";
  }

  if (itemType === "part") {
    return "Quick add part line";
  }

  return "Quick add fee line";
}

function getQuickAddActionLabel(itemType: EstimateLineMutationInput["itemType"]) {
  if (itemType === "labor") {
    return "Add labor";
  }

  if (itemType === "part") {
    return "Add part";
  }

  return "Add fee";
}

function getLineUnitPriceInputValue(lineItem: EstimateWorkspaceLineItem) {
  if (
    lineItem.itemType === "part" &&
    lineItem.unitPriceCents <= 0 &&
    typeof lineItem.linkedPartRequestLine?.quotedUnitCostCents !== "number"
  ) {
    return "";
  }

  return formatCurrencyInput(lineItem.unitPriceCents);
}

function formatPartSellMultiplier(valueBasisPoints: number) {
  const multiplier = valueBasisPoints / 10_000;
  return multiplier.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function buildInlineSupplierDraft(): InlineSupplierDraft {
  return {
    externalUrl: "",
    name: ""
  };
}

function buildQuickRepairPresets(
  pricingDefaults: EstimateWorkspace["pricingDefaults"]
): QuickRepairPreset[] {
  return [
    {
      description: "Pads, rotors, and labor seeded together so pricing can move straight into sourcing.",
      id: "front-brakes",
      label: "Front brakes",
      lines: [
        {
          description: "Replace front pads and service or replace rotors as inspection confirms.",
          itemType: "labor",
          name: "Front brake pad and rotor replacement",
          quantity: 2,
          taxable: true,
          unitPriceCents: pricingDefaults.laborRateCents
        },
        {
          description: "Pads, rotors, and hardware as inspection confirms.",
          itemType: "part",
          name: "Front brake pad and rotor kit",
          quantity: 1,
          taxable: true,
          unitPriceCents: 0
        }
      ],
      sectionTitle: "Front brakes"
    },
    {
      description: "Routine oil service with a ready-to-source parts line.",
      id: "oil-service",
      label: "Oil service",
      lines: [
        {
          description: "Perform oil and filter service and reset service indicators if applicable.",
          itemType: "labor",
          name: "Oil and filter service",
          quantity: 0.5,
          taxable: true,
          unitPriceCents: pricingDefaults.laborRateCents
        },
        {
          description: "Engine oil and filter kit sized for the vehicle.",
          itemType: "part",
          name: "Oil and filter kit",
          quantity: 1,
          taxable: true,
          unitPriceCents: 0
        }
      ],
      sectionTitle: "Oil service"
    },
    {
      description: "A fast battery swap template with install labor and a ready-to-source battery line.",
      id: "battery-replacement",
      label: "Battery",
      lines: [
        {
          description: "Replace the failed battery, service the terminals, and verify charging system baseline after install.",
          itemType: "labor",
          name: "Battery replacement",
          quantity: 0.4,
          taxable: true,
          unitPriceCents: pricingDefaults.laborRateCents
        },
        {
          description: "Replacement battery matched to the vehicle group size and specification.",
          itemType: "part",
          name: "Battery",
          quantity: 1,
          taxable: true,
          unitPriceCents: 0
        }
      ],
      sectionTitle: "Battery replacement"
    },
    {
      description: "Common ignition service with the part placeholder already staged for retailer quotes.",
      id: "spark-plugs",
      label: "Spark plugs",
      lines: [
        {
          description: "Replace spark plugs and inspect related ignition components during service.",
          itemType: "labor",
          name: "Spark plug replacement",
          quantity: 1.2,
          taxable: true,
          unitPriceCents: pricingDefaults.laborRateCents
        },
        {
          description: "Spark plug set matched to this vehicle.",
          itemType: "part",
          name: "Spark plug set",
          quantity: 1,
          taxable: true,
          unitPriceCents: 0
        }
      ],
      sectionTitle: "Spark plugs"
    }
  ];
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

function calculateSectionSummary(lineItems: EstimateWorkspaceLineItem[]) {
  return lineItems.reduce(
    (summary, lineItem) => {
      summary.subtotalCents += lineItem.lineSubtotalCents;

      if (lineItem.itemType === "labor") {
        summary.laborCount += 1;
        summary.laborHours += lineItem.quantity;
      }

      if (lineItem.itemType === "part") {
        summary.partCount += 1;
      }

      if (lineItem.itemType === "fee") {
        summary.feeCount += 1;
      }

      return summary;
    },
    {
      feeCount: 0,
      laborCount: 0,
      laborHours: 0,
      partCount: 0,
      subtotalCents: 0
    }
  );
}

function getResolvedLineItem(
  lineItem: EstimateWorkspaceLineItem,
  lineDrafts: Record<string, EstimateLineDraft>
): EstimateWorkspaceLineItem {
  const draft = lineDrafts[lineItem.id];

  if (!draft) {
    return lineItem;
  }

  const quantity = parseNumberInput(draft.quantity);
  const unitPriceCents = parseCurrencyInput(draft.unitPrice);

  return {
    ...lineItem,
    quantity,
    unitPriceCents,
    lineSubtotalCents: Math.round(quantity * unitPriceCents),
    taxable: draft.taxable
  };
}

function calculateWorkspaceDraftSummary(lineItems: EstimateWorkspaceLineItem[]) {
  const summary = calculateSectionSummary(lineItems);

  return {
    feeLineCount: summary.feeCount,
    laborLineCount: summary.laborCount,
    lineItemCount: lineItems.length,
    partLineCount: summary.partCount,
    totalLaborHours: summary.laborHours
  };
}

function getOfferUnitPriceCents(offer: EstimatePartOfferSummary) {
  return offer.quoteLine.unitPriceCents ?? Number.MAX_SAFE_INTEGER;
}

function getManualOfferUnitPriceCents(offer: EstimateManualPartOfferSummary) {
  return offer.cartLine.quotedUnitCostCents ?? Number.MAX_SAFE_INTEGER;
}

function getCatalogOfferUnitPriceCents(offer: EstimateCatalogPartOfferSummary) {
  return offer.quotedUnitCostCents;
}

function buildCatalogOfferComparisonKey(offer: EstimateCatalogPartOfferSummary) {
  return `${offer.supplierLabel}:${offer.partNumber}`;
}

function buildLiveRetailerOfferComparisonKey(offer: EstimateLiveRetailerPartOffer) {
  return `${offer.provider}:${offer.supplierLabel}:${offer.partNumber}`;
}

function buildManualOfferComparisonKey(offer: EstimateManualPartOfferSummary) {
  return `${offer.supplierLabel}:${offer.cartLine.supplierPartNumber ?? offer.cartLine.id}`;
}

function buildProviderOfferComparisonKey(offer: EstimatePartOfferSummary) {
  return `${offer.provider}:${offer.supplierLabel}:${offer.quoteLine.partNumber ?? offer.quoteLine.id}`;
}

function countDistinctComparableOffers(input: {
  catalogOffers?: EstimateCatalogPartOfferSummary[] | undefined;
  liveRetailerOffers?: EstimateLiveRetailerPartOffer[] | undefined;
  manualOffers?: EstimateManualPartOfferSummary[] | undefined;
  providerOffers?: EstimatePartOfferSummary[] | undefined;
}) {
  const comparisonKeys = new Set<string>();

  input.providerOffers?.forEach((offer) => {
    comparisonKeys.add(buildProviderOfferComparisonKey(offer));
  });
  input.manualOffers?.forEach((offer) => {
    comparisonKeys.add(buildManualOfferComparisonKey(offer));
  });
  input.catalogOffers?.forEach((offer) => {
    comparisonKeys.add(buildCatalogOfferComparisonKey(offer));
  });
  input.liveRetailerOffers?.forEach((offer) => {
    comparisonKeys.add(buildLiveRetailerOfferComparisonKey(offer));
  });

  return comparisonKeys.size;
}

function buildManualOfferDraft(
  lineItem: EstimateWorkspaceLineItem | null,
  supplierAccounts: SupplierAccount[]
): ManualOfferDraft {
  const defaultSupplierAccount = supplierAccounts[0] ?? null;

  return {
    availabilityText: "",
    notes: "",
    quotedCoreCharge:
      lineItem?.linkedPartRequestLine?.coreChargeCents
        ? formatCurrencyInput(lineItem.linkedPartRequestLine.coreChargeCents)
        : "",
    quotedUnitCost: "",
    supplierAccountId: defaultSupplierAccount?.id ?? "",
    supplierPartNumber: lineItem?.linkedPartRequestLine?.partNumber ?? "",
    supplierUrl: defaultSupplierAccount?.externalUrl ?? ""
  };
}

function getManualOfferSourceUrl(offer: EstimateManualPartOfferSummary) {
  return offer.cartLine.supplierUrl ?? offer.supplierAccount.externalUrl ?? null;
}

function getNextSupplierAccount(
  supplierAccounts: SupplierAccount[],
  currentSupplierAccountId: string
) {
  if (supplierAccounts.length < 2) {
    return null;
  }

  const currentIndex = supplierAccounts.findIndex(
    (supplierAccount) => supplierAccount.id === currentSupplierAccountId
  );

  if (currentIndex === -1) {
    return supplierAccounts[0] ?? null;
  }

  return supplierAccounts[(currentIndex + 1) % supplierAccounts.length] ?? null;
}

function buildManualOfferDraftFromSavedOffer(input: {
  mode: "duplicate-next-supplier" | "reuse";
  offer: EstimateManualPartOfferSummary;
  supplierAccounts: SupplierAccount[];
}): ManualOfferDraft {
  const targetSupplierAccount =
    input.mode === "duplicate-next-supplier"
      ? getNextSupplierAccount(input.supplierAccounts, input.offer.supplierAccount.id)
      : input.offer.supplierAccount;

  if (!targetSupplierAccount) {
    throw new Error("Add another supplier before copying this quote to the next retailer.");
  }

  return {
    availabilityText:
      input.mode === "reuse" ? input.offer.cartLine.availabilityText ?? "" : "",
    notes: input.mode === "reuse" ? input.offer.cartLine.notes ?? "" : "",
    quotedCoreCharge:
      typeof input.offer.cartLine.quotedCoreChargeCents === "number" &&
      input.offer.cartLine.quotedCoreChargeCents > 0
        ? formatCurrencyInput(input.offer.cartLine.quotedCoreChargeCents)
        : "",
    quotedUnitCost:
      input.mode === "reuse" && typeof input.offer.cartLine.quotedUnitCostCents === "number"
        ? formatCurrencyInput(input.offer.cartLine.quotedUnitCostCents)
        : "",
    supplierAccountId: targetSupplierAccount.id,
    supplierPartNumber: input.offer.cartLine.supplierPartNumber ?? "",
    supplierUrl:
      targetSupplierAccount.externalUrl ??
      (input.mode === "reuse" ? getManualOfferSourceUrl(input.offer) ?? "" : "")
  };
}

function appendCapturedLiveRetailerOffer(
  current: LiveRetailerSearchState | null,
  input: {
    lineItemId: string;
    offer: EstimateLiveRetailerPartOffer;
  }
): LiveRetailerSearchState {
  const currentOffers =
    current?.lineItemId === input.lineItemId && current.provider === input.offer.provider
      ? current.offers.filter((offer) => offer.id !== input.offer.id)
      : [];

  return {
    connector: getEstimateLiveRetailerConnector(input.offer.provider),
    lineItemId: input.lineItemId,
    offers: [input.offer, ...currentOffers],
    provider: input.offer.provider,
    providerLabel: input.offer.supplierLabel,
    query: input.offer.searchQuery
  };
}

function EstimateLineEditor({
  currencyCode,
  lineItem,
  onDelete,
  onDraftChange,
  onSave,
  onSelect,
  selected
}: EstimateLineEditorProps) {
  const [description, setDescription] = useState(lineItem.description ?? "");
  const [name, setName] = useState(lineItem.name);
  const [quantity, setQuantity] = useState(formatQuantityInput(lineItem.quantity));
  const [taxable, setTaxable] = useState(lineItem.taxable);
  const [unitPrice, setUnitPrice] = useState(getLineUnitPriceInputValue(lineItem));
  const [isPending, startTransition] = useTransition();
  const normalizedDescription = description.trim() ? description.trim() : null;
  const normalizedName = name.trim();
  const parsedQuantity = parseNumberInput(quantity);
  const parsedUnitPriceCents = parseCurrencyInput(unitPrice);
  const lineSubtotalCents = Math.round(parsedQuantity * parsedUnitPriceCents);
  const isDirty =
    normalizedName !== lineItem.name ||
    normalizedDescription !== (lineItem.description ?? null) ||
    parsedQuantity !== lineItem.quantity ||
    parsedUnitPriceCents !== lineItem.unitPriceCents ||
    taxable !== lineItem.taxable;

  useEffect(() => {
    setDescription(lineItem.description ?? "");
    setName(lineItem.name);
    setQuantity(formatQuantityInput(lineItem.quantity));
    setTaxable(lineItem.taxable);
    setUnitPrice(getLineUnitPriceInputValue(lineItem));
  }, [lineItem]);

  return (
    <form
      className={`estimate-workspace__line-row${selected ? " estimate-workspace__line-row--selected" : ""}${isDirty ? " estimate-workspace__line-row--dirty" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => {
          void onSave(lineItem.id, {
            estimateSectionId: lineItem.estimateSectionId,
            itemType: lineItem.itemType,
            name: normalizedName,
            description: normalizedDescription,
            quantity: parsedQuantity,
            unitPriceCents: parsedUnitPriceCents,
            taxable
          });
        });
      }}
    >
      <button className="estimate-workspace__line-anchor" onClick={() => onSelect(lineItem.id)} type="button">
        <Badge
          tone={
            lineItem.itemType === "part"
              ? "warning"
              : lineItem.itemType === "labor"
                ? "info"
                : "neutral"
          }
        >
          {lineItem.itemType}
        </Badge>
      </button>

      <div className="estimate-workspace__line-fields">
        <Input aria-label={`${lineItem.itemType} name`} onChange={(event) => setName(event.target.value)} value={name} />
        <Input
          aria-label={`${lineItem.itemType} description`}
          className="estimate-workspace__line-description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </div>

      <div className="estimate-workspace__line-number">
        <Input
          aria-label={`${lineItem.itemType} quantity`}
          onChange={(event) => {
            const nextQuantity = event.target.value;
            setQuantity(nextQuantity);
            onDraftChange(lineItem.id, {
              quantity: nextQuantity,
              taxable,
              unitPrice
            });
          }}
          step="0.25"
          type="number"
          value={quantity}
        />
      </div>

      <div className="estimate-workspace__line-number">
        <Input
          aria-label={`${lineItem.itemType} sell price`}
          inputMode="decimal"
          onChange={(event) => {
            const nextUnitPrice = event.target.value;
            setUnitPrice(nextUnitPrice);
            onDraftChange(lineItem.id, {
              quantity,
              taxable,
              unitPrice: nextUnitPrice
            });
          }}
          placeholder={
            lineItem.itemType === "part" && !lineItem.linkedPartRequestLine?.quotedUnitCostCents
              ? "Auto after source"
              : "0.00"
          }
          type="text"
          value={unitPrice}
        />
      </div>

      <div className="estimate-workspace__line-meta">
        <strong>{formatCurrencyFromCents(lineSubtotalCents, currencyCode)}</strong>
        {isDirty ? <Badge tone="warning">Unsaved</Badge> : null}
        <span className="estimate-workspace__line-subcopy">
          {formatQuantityInput(parsedQuantity)} x {formatCurrencyFromCents(parsedUnitPriceCents, currencyCode)}
        </span>
        {lineItem.linkedPartRequestLine ? (
          <span className="estimate-workspace__line-subcopy">
            Cost {formatCurrencyFromCents(lineItem.linkedPartRequestLine.quotedUnitCostCents ?? 0, currencyCode)}
          </span>
        ) : null}
      </div>

      <label className="estimate-workspace__line-taxable">
        <input
          checked={taxable}
          onChange={(event) => {
            const nextTaxable = event.target.checked;
            setTaxable(nextTaxable);
            onDraftChange(lineItem.id, {
              quantity,
              taxable: nextTaxable,
              unitPrice
            });
          }}
          type="checkbox"
        />
        <span>Taxable</span>
      </label>

      <div className="estimate-workspace__line-actions">
        <Button disabled={!isDirty} loading={isPending} size="sm" tone={isDirty ? "primary" : "secondary"} type="submit">
          Save
        </Button>
        <Button
          onClick={() => {
            startTransition(() => {
              void onDelete(lineItem.id);
            });
          }}
          size="sm"
          tone="tertiary"
          type="button"
        >
          Remove
        </Button>
      </div>
    </form>
  );
}

function EstimateLineList({
  currencyCode,
  lineItems,
  onDeleteLine,
  onDraftChange,
  onSaveLine,
  onSelectLine,
  onSourceLine,
  selectedLineItemId
}: EstimateLineListProps) {
  return (
    <div className="estimate-workspace__line-list">
      {lineItems.map((lineItem) => (
        <div key={lineItem.id} className="estimate-workspace__line-stack">
          <EstimateLineEditor
            currencyCode={currencyCode}
            lineItem={lineItem}
            onDelete={onDeleteLine}
            onDraftChange={onDraftChange}
            onSave={onSaveLine}
            onSelect={onSelectLine}
            selected={selectedLineItemId === lineItem.id}
          />
          {lineItem.itemType === "part" ? (
            <div className="estimate-workspace__line-utility">
              <div className="estimate-workspace__line-utility-copy">
                {(() => {
                  const comparedOfferCount = countDistinctComparableOffers({
                    catalogOffers: lineItem.catalogPartOffers,
                    manualOffers: lineItem.manualPartOffers,
                    providerOffers: lineItem.partOffers
                  });
                  const selectedManualOffer =
                    lineItem.manualPartOffers.find((offer) => offer.isSelected) ?? null;
                  const selectedProviderOffer =
                    lineItem.partOffers.find((offer) => offer.isSelected) ?? null;
                  const selectedSupplierLabel =
                    selectedManualOffer?.supplierLabel ?? selectedProviderOffer?.supplierLabel ?? null;

                  return (
                    <>
                      <Badge tone={lineItem.linkedPartRequestLine?.partNumber ? "success" : "warning"}>
                        {lineItem.linkedPartRequestLine?.partNumber ? "Sourced" : "Needs source"}
                      </Badge>
                      <span className="estimate-workspace__line-subcopy">
                        {lineItem.linkedPartRequestLine?.partNumber
                          ? `Part ${lineItem.linkedPartRequestLine.partNumber}${selectedSupplierLabel ? ` · ${selectedSupplierLabel}` : ""}${comparedOfferCount ? ` · ${comparedOfferCount} in-app offer${comparedOfferCount === 1 ? "" : "s"}` : ""}`
                          : comparedOfferCount
                            ? `${comparedOfferCount} in-app offer${comparedOfferCount === 1 ? "" : "s"} ready to review`
                            : "No supplier part selected yet"}
                      </span>
                    </>
                  );
                })()}
              </div>
              <Button onClick={() => onSourceLine(lineItem.id)} size="sm" tone="secondary" type="button">
                {countDistinctComparableOffers({
                  catalogOffers: lineItem.catalogPartOffers,
                  manualOffers: lineItem.manualPartOffers,
                  providerOffers: lineItem.partOffers
                })
                  ? `View ${countDistinctComparableOffers({
                      catalogOffers: lineItem.catalogPartOffers,
                      manualOffers: lineItem.manualPartOffers,
                      providerOffers: lineItem.partOffers
                    })} offers`
                  : "Compare suppliers"}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EstimateSectionCard({
  currencyCode,
  onDeleteLine,
  onDraftChange,
  onDeleteSection,
  onSaveLine,
  onSaveSectionAsPackage,
  onSelectLine,
  onSourceLine,
  onUpdateSection,
  saveSectionAsPackageLoading,
  sectionDetail,
  selectedLineItemId,
  summary
}: EstimateSectionCardProps) {
  const [description, setDescription] = useState(sectionDetail.section.description ?? "");
  const [notes, setNotes] = useState(sectionDetail.section.notes ?? "");
  const [title, setTitle] = useState(sectionDetail.section.title);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDescription(sectionDetail.section.description ?? "");
    setNotes(sectionDetail.section.notes ?? "");
    setTitle(sectionDetail.section.title);
  }, [sectionDetail.section]);

  return (
    <Card className="estimate-workspace__section-card" tone="raised">
      <CardHeader className="estimate-workspace__section-header">
        <CardHeaderContent>
          <CardEyebrow>Operation</CardEyebrow>
          <div className="estimate-workspace__section-title-row">
            <Input onChange={(event) => setTitle(event.target.value)} value={title} />
            <Badge tone="brand">{sectionDetail.lineItems.length} line(s)</Badge>
          </div>
          <Input
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Section description"
            value={description}
          />
          <div className="estimate-workspace__section-metrics">
            {summary.laborCount ? <Badge tone="info">{summary.laborCount} labor</Badge> : null}
            {summary.partCount ? <Badge tone="warning">{summary.partCount} part</Badge> : null}
            {summary.feeCount ? <Badge tone="neutral">{summary.feeCount} fee</Badge> : null}
            {summary.laborHours ? (
              <Badge tone="brand">{formatQuantityInput(summary.laborHours)} hr</Badge>
            ) : null}
            <span className="estimate-workspace__section-total">
              {formatCurrencyFromCents(summary.subtotalCents, currencyCode)}
            </span>
          </div>
        </CardHeaderContent>
        <div className="estimate-workspace__section-actions">
          <Button
            loading={isPending}
            onClick={() => {
              startTransition(() => {
                void onUpdateSection(sectionDetail.section.id, {
                  title,
                  description: description.trim() ? description : null,
                  notes: notes.trim() ? notes : null
                });
              });
            }}
            size="sm"
            tone="secondary"
            type="button"
          >
            Save section
          </Button>
          <Button
            loading={saveSectionAsPackageLoading}
            onClick={() => {
              startTransition(() => {
                void onSaveSectionAsPackage(sectionDetail.section);
              });
            }}
            size="sm"
            tone="tertiary"
            type="button"
          >
            Save as package
          </Button>
          <Button
            onClick={() => {
              startTransition(() => {
                void onDeleteSection(sectionDetail.section.id);
              });
            }}
            size="sm"
            tone="tertiary"
            type="button"
          >
            Remove section
          </Button>
        </div>
      </CardHeader>

      <CardContent className="estimate-workspace__section-body">
        <Textarea
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Section notes for the shop team"
          rows={3}
          value={notes}
        />
        <EstimateLineList
          currencyCode={currencyCode}
          lineItems={sectionDetail.lineItems}
          onDeleteLine={onDeleteLine}
          onDraftChange={onDraftChange}
          onSaveLine={onSaveLine}
          onSelectLine={onSelectLine}
          onSourceLine={onSourceLine}
          selectedLineItemId={selectedLineItemId}
        />
      </CardContent>
    </Card>
  );
}

function EstimateUngroupedCard({
  currencyCode,
  lineItems,
  onDeleteLine,
  onDraftChange,
  onSaveLine,
  onSelectLine,
  onSourceLine,
  selectedLineItemId
}: EstimateLineListProps) {
  return (
    <Card className="estimate-workspace__section-card" tone="subtle">
      <CardHeader className="estimate-workspace__section-header">
        <CardHeaderContent>
          <CardEyebrow>Quick items</CardEyebrow>
          <div className="estimate-workspace__section-title-row">
            <CardTitle>Ungrouped lines</CardTitle>
            <Badge tone="neutral">{lineItems.length} line(s)</Badge>
          </div>
          <CardDescription>
            Keep one-off labor, parts, and fees here without creating a separate operation block.
          </CardDescription>
        </CardHeaderContent>
      </CardHeader>

      <CardContent className="estimate-workspace__section-body">
        <EstimateLineList
          currencyCode={currencyCode}
          lineItems={lineItems}
          onDeleteLine={onDeleteLine}
          onDraftChange={onDraftChange}
          onSaveLine={onSaveLine}
          onSelectLine={onSelectLine}
          onSourceLine={onSourceLine}
          selectedLineItemId={selectedLineItemId}
        />
      </CardContent>
    </Card>
  );
}

export function EstimateWorkspaceShell({
  initialWorkspace,
  jobId,
  returnLabel = "",
  returnScope = "",
  returnTo = null,
  timeZone
}: EstimateWorkspaceShellProps) {
  const initialSelectedLineItemId = getDefaultSelectedLineItemId(initialWorkspace);
  const initialSelectedLineItem = getSelectedLineItem(initialWorkspace, initialSelectedLineItemId);
  const initialActiveSupplierAccounts = initialWorkspace.supplierAccounts.filter(
    (supplierAccount) => supplierAccount.isActive
  );
  const [lineDrafts, setLineDrafts] = useState<Record<string, EstimateLineDraft>>({});
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [laborQuery, setLaborQuery] = useState("");
  const [laborResult, setLaborResult] = useState<LaborGuideSuggestionResult | null>(null);
  const [metaDraft, setMetaDraft] = useState({
    discountAmount: formatCurrencyInput(initialWorkspace.estimate.discountCents),
    estimateNumber: initialWorkspace.estimate.estimateNumber,
    notes: initialWorkspace.estimate.notes ?? "",
    taxRatePercent: formatPercentInput(initialWorkspace.estimate.taxRateBasisPoints),
    terms: initialWorkspace.estimate.terms ?? "",
    title: initialWorkspace.estimate.title
  });
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [manualOfferDraft, setManualOfferDraft] = useState<ManualOfferDraft>(() =>
    buildManualOfferDraft(
      initialSelectedLineItem?.itemType === "part" ? initialSelectedLineItem : null,
      initialActiveSupplierAccounts
    )
  );
  const [inlineSupplierDraft, setInlineSupplierDraft] = useState<InlineSupplierDraft>(() =>
    buildInlineSupplierDraft()
  );
  const [showInlineSupplierBuilder, setShowInlineSupplierBuilder] = useState(
    initialActiveSupplierAccounts.length === 0
  );
  const [showManualOfferDetails, setShowManualOfferDetails] = useState(false);
  const [partSearchTerm, setPartSearchTerm] = useState("");
  const [liveRetailerSearch, setLiveRetailerSearch] = useState<LiveRetailerSearchState | null>(
    null
  );
  const [liveRetailerSession, setLiveRetailerSession] = useState<LiveRetailerSessionState | null>(
    null
  );
  const [retailerExtensionState, setRetailerExtensionState] = useState<
    "checking" | "missing" | "ready"
  >("checking");
  const [quickAdd, setQuickAdd] = useState({
    estimateSectionId:
      initialWorkspace.sections[0]?.section.id ?? initialWorkspace.ungroupedLineItems[0]?.estimateSectionId ?? "",
    itemType: "labor" as "labor" | "part" | "fee",
    name: "",
    quantity: "1",
    unitPrice: formatCurrencyInput(initialWorkspace.pricingDefaults.laborRateCents)
  });
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(initialSelectedLineItemId);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [buildMode, setBuildMode] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isSearchingLabor, startLaborSearch] = useTransition();
  const currentEstimateIdRef = useRef(initialWorkspace.estimate.id);
  const selectedLineItem = getSelectedLineItem(workspace, selectedLineItemId);
  const previousManualDraftLineItemIdRef = useRef<string | null>(
    initialSelectedLineItem?.itemType === "part" ? initialSelectedLineItem.id : null
  );
  const activeSupplierAccounts = useMemo(
    () => workspace.supplierAccounts.filter((supplierAccount) => supplierAccount.isActive),
    [workspace.supplierAccounts]
  );
  const activeSupplierAccountIdsKey = activeSupplierAccounts
    .map((supplierAccount) => supplierAccount.id)
    .join(",");
  const partstechAccount = workspace.providerAccounts.find((account) => account.provider === "partstech");
  const repairLinkAccount = workspace.providerAccounts.find((account) => account.provider === "repairlink");
  const amazonBusinessAccount = workspace.providerAccounts.find(
    (account) => account.provider === "amazon_business"
  );
  const repairLinkDealerIds = parseDealerIds(repairLinkAccount?.settingsJson ?? null);
  const discountCents = useMemo(
    () => parseCurrencyInput(metaDraft.discountAmount),
    [metaDraft.discountAmount]
  );
  const taxRateBasisPoints = useMemo(
    () => parsePercentInput(metaDraft.taxRatePercent),
    [metaDraft.taxRatePercent]
  );
  const providerSearchActions = [
    {
      disabledReason:
        partstechAccount?.status === "connected"
          ? null
          : partstechAccount
            ? "Reconnect or verify the PartsTech account before searching."
            : "Connect PartsTech to search from the estimate rail.",
      label: "PartsTech",
      provider: "partstech" as const
    },
    {
      disabledReason:
        repairLinkAccount?.status !== "connected"
          ? repairLinkAccount
            ? "Reconnect or verify RepairLink before OEM search can run."
            : "Connect RepairLink to search OEM dealer offers."
          : repairLinkDealerIds.length
            ? null
            : "Pick preferred dealer mappings before OEM search can run.",
      label: "RepairLink",
      provider: "repairlink" as const
    },
    {
      disabledReason:
        amazonBusinessAccount?.status === "connected"
          ? null
          : amazonBusinessAccount
            ? "Reconnect or verify Amazon Business before searching."
            : "Connect Amazon Business to search from the estimate rail.",
      label: "Amazon",
      provider: "amazon_business" as const
    }
  ];
  const hasConnectedProviderSearch = providerSearchActions.some((action) => !action.disabledReason);
  const unavailableProviderMessages = providerSearchActions
    .filter((action) => action.disabledReason)
    .map((action) => `${action.label}: ${action.disabledReason}`);
  const allLineItems = useMemo(() => getAllWorkspaceLineItems(workspace), [workspace]);
  const liveLineItems = useMemo(
    () => allLineItems.map((lineItem) => getResolvedLineItem(lineItem, lineDrafts)),
    [allLineItems, lineDrafts]
  );
  const liveWorkspaceSummary = useMemo(
    () => calculateWorkspaceDraftSummary(liveLineItems),
    [liveLineItems]
  );
  const liveSectionSummaries = useMemo(
    () =>
      new Map(
        workspace.sections.map((sectionDetail) => [
          sectionDetail.section.id,
          calculateSectionSummary(
            sectionDetail.lineItems.map((lineItem) => getResolvedLineItem(lineItem, lineDrafts))
          )
        ])
      ),
    [lineDrafts, workspace.sections]
  );
  const quickPackages = workspace.servicePackages.slice(0, 3);
  const quickRepairPresets = useMemo(
    () => buildQuickRepairPresets(workspace.pricingDefaults),
    [workspace.pricingDefaults]
  );
  const visitWorkflowState = getVisitWorkflowState(workspace.job);
  const visitLinkOptions = {
    returnLabel,
    returnScope,
    returnTo
  };
  const visitThreadHref = returnScope || returnTo || returnLabel
    ? buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions)
    : buildVisitEstimateThreadHref(jobId);
  const dispatchHref = buildEstimateWorkspaceDispatchHref(workspace, timeZone);
  const customerThreadHref = buildCustomerWorkspaceHref(workspace.customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(workspace.customer.id, { tab: "addresses" });
  const partsWorkspaceHref = buildVisitPartsHref(jobId, visitLinkOptions);
  const reviewEstimateHref = buildVisitEstimateHref(jobId, visitLinkOptions);
  const visitPromiseLabel = workspace.job.scheduledStartAt
    ? formatDateTime(workspace.job.scheduledStartAt, { fallback: "No promise set", timeZone })
    : workspace.job.arrivalWindowStartAt
      ? formatDateTime(workspace.job.arrivalWindowStartAt, { fallback: "No promise set", timeZone })
      : "No promise set";
  const defaultProviderSearchAction =
    providerSearchActions.find((action) => !action.disabledReason) ?? null;
  const preferredSourcingFocusId = PART_SEARCH_INPUT_ID;
  const lineSectionTitleByLineItemId = useMemo(() => {
    const titles = new Map<string, string>();

    workspace.sections.forEach((sectionDetail) => {
      sectionDetail.lineItems.forEach((lineItem) => {
        titles.set(lineItem.id, sectionDetail.section.title);
      });
    });

    workspace.ungroupedLineItems.forEach((lineItem) => {
      titles.set(lineItem.id, "Ungrouped");
    });

    return titles;
  }, [workspace.sections, workspace.ungroupedLineItems]);
  const selectedPartLineContextKey =
    selectedLineItem?.itemType === "part"
      ? [
          selectedLineItem.id,
          selectedLineItem.linkedPartRequestLine?.partNumber ?? "",
          selectedLineItem.linkedPartRequestLine?.coreChargeCents ?? "",
          selectedLineItem.linkedPartRequestLine?.quotedUnitCostCents ?? ""
        ].join(":")
      : selectedLineItem?.id ?? "none";
  const pendingSourcePartCount = allLineItems.filter(
    (lineItem) => lineItem.itemType === "part" && !lineItem.linkedPartRequestLine?.partNumber
  ).length;
  const pendingPricingPartLines = useMemo(
    () =>
      allLineItems.filter(
        (lineItem) =>
          lineItem.itemType === "part" &&
          typeof lineItem.linkedPartRequestLine?.quotedUnitCostCents !== "number"
      ),
    [allLineItems]
  );
  const pendingPricingPartCount = pendingPricingPartLines.length;
  const pendingPricingPrimaryLine =
    (selectedLineItem?.itemType === "part" &&
    pendingPricingPartLines.some((lineItem) => lineItem.id === selectedLineItem.id)
      ? selectedLineItem
      : pendingPricingPartLines[0]) ?? null;
  const quickAddActionLabel = getQuickAddActionLabel(quickAdd.itemType);
  const quickAddPlaceholder = getQuickAddPlaceholder(quickAdd.itemType);
  const liveTotals = useMemo(
    () =>
      calculateEstimateTotals({
        lineItems: liveLineItems.map((lineItem) => ({
          lineSubtotalCents: lineItem.lineSubtotalCents,
          taxable: lineItem.taxable
        })),
        discountCents,
        taxRateBasisPoints
      }),
    [discountCents, liveLineItems, taxRateBasisPoints]
  );
  const hasCanvasContent = Boolean(workspace.sections.length || workspace.ungroupedLineItems.length);
  const documentSettingsReady = Boolean(
    metaDraft.estimateNumber.trim() && metaDraft.title.trim()
  );
  const documentSettingsDirty =
    metaDraft.estimateNumber !== workspace.estimate.estimateNumber ||
    metaDraft.title !== workspace.estimate.title ||
    parseCurrencyInput(metaDraft.discountAmount) !== workspace.estimate.discountCents ||
    parsePercentInput(metaDraft.taxRatePercent) !== workspace.estimate.taxRateBasisPoints ||
    metaDraft.notes !== (workspace.estimate.notes ?? "") ||
    metaDraft.terms !== (workspace.estimate.terms ?? "");
  const workflowReadiness = [
    {
      label: "Canvas",
      tone: hasCanvasContent ? ("success" as const) : ("warning" as const),
      value: hasCanvasContent ? `${liveWorkspaceSummary.lineItemCount} live line${liveWorkspaceSummary.lineItemCount === 1 ? "" : "s"}` : "Add first line"
    },
    {
      label: "Part pricing",
      tone: pendingPricingPartCount ? ("warning" as const) : ("success" as const),
      value: pendingPricingPartCount ? `${pendingPricingPartCount} pending` : "Clear"
    },
    {
      label: "Document",
      tone: documentSettingsDirty || !documentSettingsReady ? ("warning" as const) : ("success" as const),
      value: !documentSettingsReady ? "Needs title" : documentSettingsDirty ? "Unsaved" : "Saved"
    }
  ];
  const workflowFocusCommand =
    !hasCanvasContent
      ? {
          actionLabel: "Add first operation",
          copy: "The quote is still empty. Start with the main operation or a quick line so the estimate can move into sourcing.",
          label: "Build the first operation",
          onAction: () => {
            if (!focusWorkspaceField(NEW_SECTION_INPUT_ID)) {
              focusWorkspaceField(QUICK_ADD_NAME_INPUT_ID);
            }
          }
        }
      : pendingPricingPrimaryLine
        ? {
            actionLabel: "Source next part",
            copy: `${pendingPricingPartCount} part line${pendingPricingPartCount === 1 ? "" : "s"} still need supplier cost before this quote is genuinely review-ready.`,
            label: `Price ${pendingPricingPrimaryLine.name}`,
            onAction: () => {
              handleSourceLine(pendingPricingPrimaryLine.id);
            }
          }
        : documentSettingsDirty && !buildMode
          ? {
              actionLabel: "Save settings",
              copy: "Document details changed in the review rail. Save them before sending or discussing the quote.",
              label: "Persist document settings",
              onAction: () => {
                void handleMetaSave();
              }
            }
          : documentSettingsDirty
            ? {
                actionLabel: "Review settings",
                copy: "Quote content is built, but document details still need review before this becomes customer-ready.",
                label: "Open document settings",
                onAction: () => {
                  setBuildMode(false);
                }
              }
            : {
                actionHref: reviewEstimateHref,
                actionLabel: "Review customer-ready quote",
                copy: "Pricing and sourcing are clear. Switch to the estimate review page to confirm the customer-facing version and release path.",
                label: "Review and convert the quote"
              };

  useEffect(() => {
    setLineDrafts({});
    setWorkspace(initialWorkspace);
  }, [initialWorkspace]);

  useEffect(() => {
    currentEstimateIdRef.current = workspace.estimate.id;
  }, [workspace.estimate.id]);

  useEffect(() => {
    setMetaDraft({
      discountAmount: formatCurrencyInput(workspace.estimate.discountCents),
      estimateNumber: workspace.estimate.estimateNumber,
      notes: workspace.estimate.notes ?? "",
      taxRatePercent: formatPercentInput(workspace.estimate.taxRateBasisPoints),
      terms: workspace.estimate.terms ?? "",
      title: workspace.estimate.title
    });
  }, [workspace.estimate]);

  useEffect(() => {
    const nextSelectedLineItem = getSelectedLineItem(workspace, selectedLineItemId);

    if (!nextSelectedLineItem) {
      setSelectedLineItemId(getDefaultSelectedLineItemId(workspace));
      return;
    }

    if (nextSelectedLineItem.itemType === "part") {
      setPartSearchTerm(nextSelectedLineItem.linkedPartRequestLine?.partNumber ?? nextSelectedLineItem.name);
    }
  }, [selectedLineItemId, workspace]);

  useEffect(() => {
    if (selectedLineItem?.itemType !== "part") {
      setLiveRetailerSearch(null);
      setLiveRetailerSession(null);
      return;
    }

    setLiveRetailerSearch((current) =>
      current?.lineItemId === selectedLineItem.id ? current : null
    );
    setLiveRetailerSession((current) =>
      current?.lineItemId === selectedLineItem.id ? current : null
    );
  }, [selectedLineItem?.id, selectedLineItem?.itemType]);

  useEffect(() => {
    const nextSelectedLineItem = getSelectedLineItem(workspace, selectedLineItemId);

    if (nextSelectedLineItem?.itemType !== "part") {
      previousManualDraftLineItemIdRef.current = null;
      return;
    }

    const nextBaseDraft = buildManualOfferDraft(nextSelectedLineItem, activeSupplierAccounts);
    const isSamePartLine = previousManualDraftLineItemIdRef.current === nextSelectedLineItem.id;

    setManualOfferDraft((current) => {
      if (!isSamePartLine) {
        return nextBaseDraft;
      }

      const currentSupplierAccount =
        activeSupplierAccounts.find(
          (supplierAccount) => supplierAccount.id === current.supplierAccountId
        ) ?? null;

      return {
        ...nextBaseDraft,
        availabilityText: current.availabilityText,
        notes: current.notes,
        quotedCoreCharge: current.quotedCoreCharge,
        quotedUnitCost: current.quotedUnitCost,
        supplierAccountId: currentSupplierAccount?.id ?? nextBaseDraft.supplierAccountId,
        supplierPartNumber: current.supplierPartNumber || nextBaseDraft.supplierPartNumber,
        supplierUrl: currentSupplierAccount?.externalUrl ?? current.supplierUrl
      };
    });
    previousManualDraftLineItemIdRef.current = nextSelectedLineItem.id;
  }, [activeSupplierAccountIdsKey, selectedLineItemId, selectedPartLineContextKey]);

  useEffect(() => {
    const currentSectionId = quickAdd.estimateSectionId;
    const hasCurrentSection =
      currentSectionId === "" ||
      workspace.sections.some((sectionDetail) => sectionDetail.section.id === currentSectionId);

    if (!hasCurrentSection) {
      setQuickAdd((current) => ({
        ...current,
        estimateSectionId: workspace.sections[0]?.section.id ?? ""
      }));
    }
  }, [quickAdd.estimateSectionId, workspace.sections]);

  useEffect(() => {
    if (
      selectedPackageId &&
      !workspace.servicePackages.some((servicePackage) => servicePackage.id === selectedPackageId)
    ) {
      setSelectedPackageId("");
    }
  }, [selectedPackageId, workspace.servicePackages]);

  useEffect(() => {
    if (!activeSupplierAccounts.length) {
      setShowInlineSupplierBuilder(true);
    }
  }, [activeSupplierAccountIdsKey, activeSupplierAccounts.length]);

  useEffect(() => {
    setShowManualOfferDetails(false);
  }, [selectedPartLineContextKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setBuildMode((current) => !current);
        return;
      }

      if (isEditableElement(event.target)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        focusWorkspaceField(QUICK_ADD_NAME_INPUT_ID);
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const normalizedKey = event.key.toLowerCase();

        if (normalizedKey === "l") {
          event.preventDefault();
          handleQuickAddItemTypeChange("labor");
          return;
        }

        if (normalizedKey === "p") {
          event.preventDefault();
          handleQuickAddItemTypeChange("part");
          return;
        }

        if (normalizedKey === "f") {
          event.preventDefault();
          handleQuickAddItemTypeChange("fee");
          return;
        }

        if (normalizedKey === "k") {
          event.preventDefault();
          focusWorkspaceField(LABOR_SEARCH_INPUT_ID);
          return;
        }

        if (normalizedKey === "s" && selectedLineItem?.itemType === "part") {
          event.preventDefault();
          focusSourcingRail(preferredSourcingFocusId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [preferredSourcingFocusId, selectedLineItem?.itemType, workspace.pricingDefaults.laborRateCents]);

  function applyWorkspace(nextWorkspace: EstimateWorkspace, nextFeedback?: string) {
    setLineDrafts({});
    setWorkspace(nextWorkspace);
    setError(null);
    setFeedback(nextFeedback ?? null);
  }

  function handleLineDraftChange(lineItemId: string, draft: EstimateLineDraft) {
    setLineDrafts((current) => ({
      ...current,
      [lineItemId]: draft
    }));
  }

  function handleQuickAddItemTypeChange(itemType: EstimateLineMutationInput["itemType"]) {
    setQuickAdd((current) => ({
      ...current,
      itemType,
      unitPrice:
        itemType === "part"
          ? ""
          : current.itemType === itemType && current.unitPrice.trim()
            ? current.unitPrice
            : itemType === "labor"
              ? formatCurrencyInput(workspace.pricingDefaults.laborRateCents)
              : "0"
    }));
    focusWorkspaceField(QUICK_ADD_NAME_INPUT_ID);
  }

  async function runMutation<TPayload extends { workspace: EstimateWorkspace }>(
    url: string,
    input?: {
      body?: object;
      method?: "POST" | "PATCH" | "DELETE";
      successMessage?: string;
    }
  ) {
    startTransition(() => {
      const requestInput: { body?: object; method?: "GET" | "POST" | "PATCH" | "DELETE" } = {};

      if (input?.body) {
        requestInput.body = input.body;
      }

      if (input?.method) {
        requestInput.method = input.method;
      }

      void requestJson<TPayload>(url, requestInput)
        .then((payload) => applyWorkspace(payload.workspace, input?.successMessage))
        .catch((mutationError) =>
          setError(
            mutationError instanceof Error
              ? mutationError.message
              : "Estimate workspace action could not be completed."
          )
        );
    });
  }

  async function applyCapturedLiveRetailerOffer(input: {
    estimateId: string;
    lineItemId: string;
    offer: EstimateLiveRetailerPartOffer;
    sessionId: string;
  }) {
    const actionKey = `live-retailer-capture:${input.lineItemId}`;
    setBusyAction(actionKey);

    try {
      const payload = await requestJson<{ workspace: EstimateWorkspace }>(
        `/api/internal/estimates/${input.estimateId}/parts/live-search/select`,
        {
          body: {
            lineItemId: input.lineItemId,
            offer: input.offer
          }
        }
      );

      setSelectedLineItemId(input.lineItemId);
      applyWorkspace(
        payload.workspace,
        `${input.offer.supplierLabel} live offer captured and selected.`
      );
      setLiveRetailerSearch((current) =>
        appendCapturedLiveRetailerOffer(current, {
          lineItemId: input.lineItemId,
          offer: input.offer
        })
      );
      setLiveRetailerSession((current) =>
        current?.sessionId === input.sessionId
          ? {
              ...current,
              lineItemId: input.lineItemId,
              query: input.offer.searchQuery,
              stage: "captured"
            }
          : current
      );
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Captured live retailer offer could not be applied."
      );
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeToRetailerExtensionEvents((event) => {
      if (event.type === "extension-ready") {
        setRetailerExtensionState("ready");
        return;
      }

      if (
        (event.type === "oreilly-session-status" || event.type === "oreilly-offer-captured") &&
        event.payload.estimateId !== currentEstimateIdRef.current
      ) {
        return;
      }

      if (event.type === "oreilly-session-status") {
        setRetailerExtensionState("ready");
        setLiveRetailerSession((current) => ({
          lineItemId: event.payload.lineItemId,
          query: event.payload.query,
          retailerTabId: event.payload.retailerTabId ?? current?.retailerTabId ?? null,
          sessionId: event.payload.sessionId,
          stage: event.payload.stage
        }));
        setError(null);
        setFeedback(
          event.payload.message ??
            "O'Reilly sourcing is open in a managed browser tab. Use `Use in estimate` on the retailer page to capture the exact part."
        );
        return;
      }

      if (event.type === "oreilly-offer-captured") {
        setRetailerExtensionState("ready");
        void applyCapturedLiveRetailerOffer({
          estimateId: event.payload.estimateId,
          lineItemId: event.payload.lineItemId,
          offer: event.payload.offer,
          sessionId: event.payload.sessionId
        });
      }
    });

    void probeRetailerExtension().then((ready) => {
      if (!cancelled) {
        setRetailerExtensionState(ready ? "ready" : "missing");
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function handleMetaSave() {
    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/workspace`,
      {
        body: {
          estimateNumber: metaDraft.estimateNumber,
          title: metaDraft.title,
          notes: metaDraft.notes.trim() ? metaDraft.notes : null,
          terms: metaDraft.terms.trim() ? metaDraft.terms : null,
          taxRateBasisPoints,
          discountCents
        },
        method: "PATCH",
        successMessage: "Estimate settings saved."
      }
    );
  }

  async function handleAddSection() {
    if (!newSectionTitle.trim()) {
      setError("Enter a section title before adding a new operation.");
      return;
    }

    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/sections`,
      {
        body: {
          jobId: workspace.job.id,
          title: newSectionTitle,
          description: null,
          notes: null
        },
        successMessage: "Estimate section added."
      }
    );
    setNewSectionTitle("");
    focusWorkspaceField(NEW_SECTION_INPUT_ID);
  }

  async function handleCreateInlineSupplierAccount() {
    if (busyAction) {
      return;
    }

    if (!inlineSupplierDraft.name.trim()) {
      setError("Enter a supplier name before adding it to the estimate.");
      return;
    }

    setBusyAction("inline-supplier");

    try {
      const payload = await requestJson<{ supplierAccountId: string; workspace: EstimateWorkspace }>(
        `/api/internal/estimates/${workspace.estimate.id}/parts/suppliers`,
        {
          body: {
            externalUrl: inlineSupplierDraft.externalUrl.trim()
              ? inlineSupplierDraft.externalUrl.trim()
              : null,
            name: inlineSupplierDraft.name.trim()
          }
        }
      );
      const createdSupplierAccount =
        payload.workspace.supplierAccounts.find(
          (supplierAccount) => supplierAccount.id === payload.supplierAccountId
        ) ?? null;

      applyWorkspace(payload.workspace, `${inlineSupplierDraft.name.trim()} is ready for quotes.`);
      setShowInlineSupplierBuilder(false);
      setInlineSupplierDraft(buildInlineSupplierDraft());
      setManualOfferDraft((current) => ({
        ...current,
        supplierAccountId: payload.supplierAccountId,
        supplierUrl: createdSupplierAccount?.externalUrl ?? current.supplierUrl
      }));
      focusWorkspaceField(MANUAL_PART_PRICE_INPUT_ID);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Supplier account could not be added from the estimate."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleQuickAdd() {
    if (busyAction) {
      return;
    }

    if (!quickAdd.name.trim()) {
      setError("Enter a labor, part, or fee name before adding a line.");
      return;
    }

    setBusyAction("quick-add");

    try {
      const previousLineItemIds = new Set(allLineItems.map((lineItem) => lineItem.id));
      const payload = await requestJson<{ workspace: EstimateWorkspace }>(
        `/api/internal/estimates/${workspace.estimate.id}/lines`,
        {
          body: {
            estimateSectionId: quickAdd.estimateSectionId || null,
            itemType: quickAdd.itemType,
            name: quickAdd.name.trim(),
            description: null,
            quantity: parseNumberInput(quickAdd.quantity),
            unitPriceCents: parseCurrencyInput(quickAdd.unitPrice),
            taxable: true
          }
        }
      );
      const createdLineItemId = findNewMatchingLineItemId({
        itemType: quickAdd.itemType,
        name: quickAdd.name.trim(),
        nextWorkspace: payload.workspace,
        previousLineItemIds
      });
      const createdLineItem = createdLineItemId
        ? getSelectedLineItem(payload.workspace, createdLineItemId)
        : null;
      const successMessage =
        quickAdd.itemType === "part" && createdLineItem?.linkedPartRequestLine?.partNumber
          ? `Estimate line added and ${createdLineItem.linkedPartRequestLine.partNumber} was matched automatically.`
          : "Estimate line added.";

      applyWorkspace(payload.workspace, successMessage);

      if (createdLineItemId) {
        setSelectedLineItemId(createdLineItemId);

        if (quickAdd.itemType === "part") {
          focusSourcingRail(preferredSourcingFocusId);
        }
      }

      setQuickAdd((current) => ({
        ...current,
        name: "",
        itemType: current.itemType
      }));
      focusWorkspaceField(QUICK_ADD_NAME_INPUT_ID);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Quick add could not create the estimate line."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApplyQuickRepairPreset(preset: QuickRepairPreset) {
    if (busyAction) {
      return;
    }

    const actionKey = `quick-repair:${preset.id}`;
    setBusyAction(actionKey);

    try {
      const previousLineItemIds = new Set(getAllWorkspaceLineItems(workspace).map((lineItem) => lineItem.id));
      const payload = await requestJson<{ workspace: EstimateWorkspace }>(
        `/api/internal/estimates/${workspace.estimate.id}/presets`,
        {
          body: {
            description: preset.description,
            lines: preset.lines,
            sectionTitle: preset.sectionTitle
          }
        }
      );
      const partLineName =
        [...preset.lines].reverse().find((line) => line.itemType === "part")?.name ?? null;
      const createdPartLineId =
        partLineName !== null
          ? findNewMatchingLineItemId({
              itemType: "part",
              name: partLineName,
              nextWorkspace: payload.workspace,
              previousLineItemIds
            })
          : null;
      const createdPartLine = createdPartLineId
        ? getSelectedLineItem(payload.workspace, createdPartLineId)
        : null;
      const successMessage = createdPartLine?.linkedPartRequestLine?.partNumber
        ? `${preset.label} preset added and ${createdPartLine.linkedPartRequestLine.partNumber} was auto-sourced in app.`
        : `${preset.label} preset added.`;

      applyWorkspace(payload.workspace, successMessage);

      if (createdPartLineId) {
        setSelectedLineItemId(createdPartLineId);
        focusSourcingRail(preferredSourcingFocusId);
      }
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Quick repair preset could not be applied."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveLine(lineItemId: string, input: EstimateLineMutationInput) {
    await runMutation<{ workspace: EstimateWorkspace }>(`/api/internal/estimates/lines/${lineItemId}`, {
      body: input,
      method: "PATCH",
      successMessage: "Estimate line saved."
    });
  }

  async function handleDeleteLine(lineItemId: string) {
    await runMutation<{ workspace: EstimateWorkspace }>(`/api/internal/estimates/lines/${lineItemId}`, {
      method: "DELETE",
      successMessage: "Estimate line removed."
    });
  }

  async function handleDeleteSection(sectionId: string) {
    await runMutation<{ workspace: EstimateWorkspace }>(`/api/internal/estimates/sections/${sectionId}`, {
      body: { estimateId: workspace.estimate.id },
      method: "DELETE",
      successMessage: "Estimate section removed."
    });
  }

  async function handleUpdateSection(
    sectionId: string,
    input: { description?: string | null; notes?: string | null; title: string }
  ) {
    await runMutation<{ workspace: EstimateWorkspace }>(`/api/internal/estimates/sections/${sectionId}`, {
      body: {
        estimateId: workspace.estimate.id,
        ...input
      },
      method: "PATCH",
      successMessage: "Estimate section saved."
    });
  }

  async function handlePackageApply(servicePackageId?: string) {
    const resolvedServicePackageId = servicePackageId ?? selectedPackageId;

    if (!resolvedServicePackageId) {
      setError("Select a saved service package before applying it to the estimate.");
      return;
    }

    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/packages/apply`,
      {
        body: {
          servicePackageId: resolvedServicePackageId
        },
        successMessage: "Service package applied."
      }
    );
  }

  async function handleSaveSectionAsPackage(section: EstimateSectionDetail["section"]) {
    const actionKey = `save-package:${section.id}`;

    if (busyAction) {
      return;
    }

    setBusyAction(actionKey);

    try {
      await requestJson<{ servicePackage: unknown }>(`/api/internal/estimates/sections/${section.id}/package`, {
        body: {
          description: section.description,
          name: section.title,
          notes: section.notes
        }
      });
      const payload = await requestJson<{ workspace: EstimateWorkspace }>(
        `/api/internal/estimates/${workspace.estimate.id}/workspace`,
        { method: "GET" }
      );

      applyWorkspace(payload.workspace, `Saved "${section.title}" as a reusable package.`);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Section could not be saved as a package."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLaborSearch() {
    startLaborSearch(() => {
      void fetch("/api/labor-guide/suggest", {
        body: JSON.stringify({
          estimateId: workspace.estimate.id,
          jobId: workspace.job.id,
          query: laborQuery.trim() ? laborQuery.trim() : null
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      })
        .then(async (response) => {
          const payload = (await response.json()) as LaborGuideSuggestionResult | { message?: string };

          if (!response.ok) {
            throw new Error(
              "message" in payload && payload.message
                ? payload.message
                : "Labor suggestions could not be loaded."
            );
          }

          setLaborResult(payload as LaborGuideSuggestionResult);
          setFeedback("Labor suggestions refreshed.");
          setError(null);
        })
        .catch((laborError) =>
          setError(
            laborError instanceof Error
              ? laborError.message
              : "Labor suggestions could not be loaded."
          )
        );
    });
  }

  async function handleAddSuggestedLaborLine(operation: LaborGuideSuggestionResult["operations"][number]) {
    const actionKey = `labor-suggestion:${operation.code}`;

    if (busyAction) {
      return;
    }

    setBusyAction(actionKey);

    try {
      const previousLineItemIds = new Set(getAllWorkspaceLineItems(workspace).map((lineItem) => lineItem.id));
      const payload = await requestJson<{ workspace: EstimateWorkspace }>(
        `/api/internal/estimates/${workspace.estimate.id}/lines`,
        {
          body: {
            estimateSectionId: quickAdd.estimateSectionId || workspace.sections[0]?.section.id || null,
            ...operation.lineItemDefaults,
            unitPriceCents: workspace.pricingDefaults.laborRateCents
          }
        }
      );

      applyWorkspace(payload.workspace, `Added labor line for ${operation.name}.`);
      const createdLineItemId = findNewMatchingLineItemId({
        itemType: "labor",
        name: operation.lineItemDefaults.name,
        nextWorkspace: payload.workspace,
        previousLineItemIds
      });

      if (createdLineItemId) {
        setSelectedLineItemId(createdLineItemId);
      }
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Labor suggestion could not be added."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSearchProvider(provider: "partstech" | "repairlink" | "amazon_business") {
    if (!selectedLineItem || selectedLineItem.itemType !== "part") {
      setError("Select a part line before opening supplier search.");
      return;
    }

    const body: Record<string, unknown> = {
      lineItemId: selectedLineItem.id,
      provider
    };

    if (provider !== "repairlink") {
      body.searchTerms = partSearchTerm.trim() ? [partSearchTerm.trim()] : [selectedLineItem.name];
    }

    if (provider === "repairlink") {
      if (!repairLinkDealerIds.length) {
        setError("RepairLink needs preferred dealer mappings configured before OEM search can run.");
        return;
      }

      body.selectedDealerMappingIds = repairLinkDealerIds;
    }

    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/parts/search`,
      {
        body,
        successMessage: `${provider === "repairlink" ? "RepairLink" : provider === "partstech" ? "PartsTech" : "Amazon Business"} search refreshed.`
      }
    );
  }

  async function handleLaunchLiveRetailerSession() {
    if (!selectedLineItem || selectedLineItem.itemType !== "part") {
      setError("Select a part line before opening live retailer sourcing.");
      return;
    }

    if (retailerExtensionState !== "ready") {
      setError(
        "Load the browser-assisted procurement extension from apps/browser-extension before opening live retailer sourcing."
      );
      return;
    }

    const searchQuery = buildVehicleAwareRetailerSearchQuery({
      explicitQuery: partSearchTerm.trim() || null,
      fallbackQuery: selectedLineItem.name,
      vehicleContext: workspace.vehicleContext
    });

    if (!searchQuery) {
      setError("Enter a part description before opening live retailer sourcing.");
      return;
    }

    const actionKey = `live-retailer-session:${selectedLineItem.id}`;

    if (busyAction) {
      return;
    }

    setBusyAction(actionKey);
    setLiveRetailerSession({
      lineItemId: selectedLineItem.id,
      query: searchQuery,
      retailerTabId: null,
      sessionId: "launching",
      stage: "launching"
    });

    try {
      const session = await launchOReillyRetailerSourcingSession({
        appOrigin: window.location.origin,
        estimateId: workspace.estimate.id,
        lineItemId: selectedLineItem.id,
        lineItemName: selectedLineItem.name,
        query: searchQuery,
        vehicleDisplayName: workspace.vehicleContext.displayName
      });

      setLiveRetailerSession({
        lineItemId: selectedLineItem.id,
        query: searchQuery,
        retailerTabId: session.retailerTabId ?? null,
        sessionId: session.sessionId,
        stage: "ready"
      });
      setError(null);
      setFeedback(
        "O'Reilly sourcing opened in a real browser tab. Use `Use in estimate` on the retailer page to capture the exact part."
      );
    } catch (searchError) {
      setLiveRetailerSession(null);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Live retailer sourcing could not be opened."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSelectLiveRetailerOffer(offer: EstimateLiveRetailerPartOffer) {
    if (!selectedLineItem || selectedLineItem.itemType !== "part") {
      return;
    }

    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/parts/live-search/select`,
      {
        body: {
          lineItemId: selectedLineItem.id,
          offer
        },
        successMessage: `${offer.supplierLabel} result selected and part line filled.`
      }
    );
  }

  async function handleSelectOffer(offer: EstimatePartOfferSummary) {
    if (!selectedLineItem || selectedLineItem.itemType !== "part") {
      return;
    }

    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/parts/offers/select`,
      {
        body: {
          lineItemId: selectedLineItem.id,
          providerQuoteLineId: offer.quoteLine.id
        },
        successMessage: "Supplier offer selected and part line filled."
      }
    );
  }

  async function handleSaveManualOffer(selectAfterCreate: boolean) {
    if (!selectedLineItem || selectedLineItem.itemType !== "part") {
      setError("Select a part line before saving a supplier offer.");
      return;
    }

    if (!manualOfferDraft.supplierAccountId) {
      setError("Choose a supplier before saving a manual offer.");
      return;
    }

    if (!manualOfferDraft.quotedUnitCost.trim()) {
      setError("Enter a supplier price before saving a manual offer.");
      return;
    }

    const actionKey = `manual-offer:${selectedLineItem.id}`;

    if (busyAction) {
      return;
    }

    setBusyAction(actionKey);

    try {
      const payload = await requestJson<{ workspace: EstimateWorkspace }>(
        `/api/internal/estimates/${workspace.estimate.id}/parts/manual-offers`,
        {
          body: {
            lineItemId: selectedLineItem.id,
            supplierAccountId: manualOfferDraft.supplierAccountId,
            supplierPartNumber: manualOfferDraft.supplierPartNumber.trim()
              ? manualOfferDraft.supplierPartNumber
              : null,
            quotedUnitCostCents: parseCurrencyInput(manualOfferDraft.quotedUnitCost),
            quotedCoreChargeCents: manualOfferDraft.quotedCoreCharge.trim()
              ? parseCurrencyInput(manualOfferDraft.quotedCoreCharge)
              : 0,
            availabilityText: manualOfferDraft.availabilityText.trim()
              ? manualOfferDraft.availabilityText
              : null,
            supplierUrl: manualOfferDraft.supplierUrl.trim() ? manualOfferDraft.supplierUrl : null,
            notes: manualOfferDraft.notes.trim() ? manualOfferDraft.notes : null,
            selectAfterCreate
          }
        }
      );

      applyWorkspace(
        payload.workspace,
        selectAfterCreate ? "Supplier offer selected and part line filled." : "Manual supplier offer saved."
      );
      const selectedSupplierAccount =
        activeSupplierAccounts.find(
          (supplierAccount) => supplierAccount.id === manualOfferDraft.supplierAccountId
        ) ?? null;

      setManualOfferDraft({
        availabilityText: "",
        notes: "",
        quotedCoreCharge:
          selectedLineItem.linkedPartRequestLine?.coreChargeCents
            ? formatCurrencyInput(selectedLineItem.linkedPartRequestLine.coreChargeCents)
            : "",
        quotedUnitCost: "",
        supplierAccountId: manualOfferDraft.supplierAccountId,
        supplierPartNumber: manualOfferDraft.supplierPartNumber.trim()
          ? manualOfferDraft.supplierPartNumber
          : selectedLineItem.linkedPartRequestLine?.partNumber ?? "",
        supplierUrl: selectedSupplierAccount?.externalUrl ?? manualOfferDraft.supplierUrl
      });
      setShowManualOfferDetails(false);
      window.setTimeout(() => {
        focusWorkspaceField(MANUAL_PART_PRICE_INPUT_ID);
      }, 0);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Manual supplier offer could not be saved."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSelectManualOffer(offer: EstimateManualPartOfferSummary) {
    if (!selectedLineItem || selectedLineItem.itemType !== "part") {
      return;
    }

    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/parts/manual-offers/select`,
      {
        body: {
          lineItemId: selectedLineItem.id,
          supplierCartLineId: offer.cartLine.id
        },
        successMessage: "Supplier offer selected and part line filled."
      }
    );
  }

  async function handleSelectCatalogOffer(offer: EstimateCatalogPartOfferSummary) {
    if (!selectedLineItem || selectedLineItem.itemType !== "part") {
      return;
    }

    await runMutation<{ workspace: EstimateWorkspace }>(
      `/api/internal/estimates/${workspace.estimate.id}/parts/catalog-offers/select`,
      {
        body: {
          lineItemId: selectedLineItem.id,
          offerId: offer.id
        },
        successMessage: "Fitment suggestion selected and part line filled."
      }
    );
  }

  function handleSourceLine(lineItemId: string) {
    setSelectedLineItemId(lineItemId);
    focusSourcingRail(preferredSourcingFocusId);
  }

  function handleLoadManualOfferDraft(
    offer: EstimateManualPartOfferSummary,
    mode: "duplicate-next-supplier" | "reuse"
  ) {
    try {
      const nextDraft = buildManualOfferDraftFromSavedOffer({
        mode,
        offer,
        supplierAccounts: activeSupplierAccounts
      });

      setManualOfferDraft(nextDraft);
      setShowManualOfferDetails(
        mode === "reuse" &&
          Boolean(
            nextDraft.availabilityText.trim() ||
              nextDraft.notes.trim() ||
              nextDraft.quotedCoreCharge.trim()
          )
      );
      setError(null);
      window.setTimeout(() => {
        focusWorkspaceField(MANUAL_PART_PRICE_INPUT_ID);
      }, 0);
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? draftError.message
          : "Quote details could not be copied into the manual offer form."
      );
    }
  }

  const sortedOffers = (selectedLineItem?.partOffers ?? []).slice().sort((left, right) => {
    if (left.isSelected !== right.isSelected) {
      return left.isSelected ? -1 : 1;
    }

    return getOfferUnitPriceCents(left) - getOfferUnitPriceCents(right);
  });
  const bestOffer =
    (selectedLineItem?.partOffers ?? [])
      .filter((offer) => offer.quoteLine.unitPriceCents !== null)
      .slice()
      .sort((left, right) => getOfferUnitPriceCents(left) - getOfferUnitPriceCents(right))[0] ?? null;
  const selectedOffer = sortedOffers.find((offer) => offer.isSelected) ?? null;
  const sortedManualOffers = (selectedLineItem?.manualPartOffers ?? []).slice().sort((left, right) => {
    if (left.isSelected !== right.isSelected) {
      return left.isSelected ? -1 : 1;
    }

    return getManualOfferUnitPriceCents(left) - getManualOfferUnitPriceCents(right);
  });
  const bestManualOffer =
    (selectedLineItem?.manualPartOffers ?? [])
      .filter((offer) => typeof offer.cartLine.quotedUnitCostCents === "number")
      .slice()
      .sort((left, right) => getManualOfferUnitPriceCents(left) - getManualOfferUnitPriceCents(right))[0] ??
    null;
  const sortedCatalogOffers = (selectedLineItem?.catalogPartOffers ?? [])
    .slice()
    .sort((left, right) => getCatalogOfferUnitPriceCents(left) - getCatalogOfferUnitPriceCents(right));
  const sortedLiveRetailerOffers = (liveRetailerSearch?.offers ?? [])
    .slice()
    .sort((left, right) => left.quotedUnitCostCents - right.quotedUnitCostCents);
  const bestLiveRetailerOffer = sortedLiveRetailerOffers[0] ?? null;
  const bestCatalogOffer = sortedCatalogOffers[0] ?? null;
  const selectedManualOffer = sortedManualOffers.find((offer) => offer.isSelected) ?? null;
  const selectedCatalogOffer =
    selectedManualOffer
      ? sortedCatalogOffers.find(
          (offer) =>
            offer.partNumber === selectedManualOffer.cartLine.supplierPartNumber &&
            offer.supplierLabel === selectedManualOffer.supplierLabel
        ) ?? null
      : null;
  const latestManualOffer =
    (selectedLineItem?.manualPartOffers ?? [])
      .slice()
      .sort(
        (left, right) =>
          Date.parse(right.cartLine.updatedAt) - Date.parse(left.cartLine.updatedAt)
      )[0] ?? null;
  const comparedOfferCount = countDistinctComparableOffers({
    catalogOffers: sortedCatalogOffers,
    liveRetailerOffers: sortedLiveRetailerOffers,
    manualOffers: sortedManualOffers,
    providerOffers: sortedOffers
  });
  const visibleOfferCountLabel = comparedOfferCount
    ? `${comparedOfferCount} compared`
    : "Start comparing";
  const selectedSourceLabel = selectedOffer
    ? "Connected supplier"
    : selectedCatalogOffer
      ? "In-app catalog"
      : selectedManualOffer
        ? "Manual quote"
        : "Pending";
  const bestOfferPriceCents =
    [
      bestOffer ? getOfferUnitPriceCents(bestOffer) : null,
      bestManualOffer ? getManualOfferUnitPriceCents(bestManualOffer) : null,
      bestLiveRetailerOffer?.quotedUnitCostCents ?? null,
      bestCatalogOffer ? getCatalogOfferUnitPriceCents(bestCatalogOffer) : null
    ]
      .filter((value): value is number => typeof value === "number" && value !== Number.MAX_SAFE_INTEGER)
      .sort((left, right) => left - right)[0] ?? null;

  return (
    <div className="estimate-workspace">
      <Card className="estimate-workspace__hero" tone="raised">
          <CardHeader className="estimate-workspace__hero-header">
          <CardHeaderContent>
            <CardEyebrow>Estimate thread</CardEyebrow>
            <CardTitle>Estimate file</CardTitle>
            <CardDescription>
              Build the estimate in one flow for {getCustomerDisplayName(workspace.customer)} on{" "}
              {workspace.vehicleContext.displayName}, without dropping the live service thread.
            </CardDescription>
          </CardHeaderContent>
          <div className="estimate-workspace__hero-meta">
            <div className="estimate-workspace__hero-status">
              <Badge tone="brand">{workspace.estimate.status}</Badge>
              <span className="estimate-workspace__hero-copy">
                Updated {formatDateTime(workspace.estimate.updatedAt, { timeZone })}
              </span>
            </div>
            <div className="estimate-workspace__hero-actions">
              <Link
                className={buttonClassName({ size: "sm", tone: "secondary" })}
                href={buildVisitEstimateHref(jobId, visitLinkOptions)}
              >
                Review estimate
              </Link>
              <Link
                className={buttonClassName({ size: "sm", tone: "tertiary" })}
                href={customerThreadHref}
              >
                Customer thread
              </Link>
              <Link
                className={buttonClassName({ size: "sm", tone: "tertiary" })}
                href={siteThreadHref}
              >
                Site thread
              </Link>
              <Link
                className={buttonClassName({ size: "sm", tone: "tertiary" })}
                href={visitThreadHref}
              >
                Visit thread
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="estimate-workspace__hero-grid">
          <div className="estimate-workspace__hero-item">
            <span className="estimate-workspace__hero-label">Vehicle</span>
            <strong>{workspace.vehicleContext.displayName}</strong>
            <span>{workspace.vehicleContext.engine ?? "Engine not decoded yet"}</span>
          </div>
          <div className="estimate-workspace__hero-item">
            <span className="estimate-workspace__hero-label">VIN</span>
            <strong>{workspace.vehicleContext.vin ?? "VIN not captured"}</strong>
            <span>{workspace.vehicleContext.licensePlate ?? "No plate on file"}</span>
          </div>
          <div className="estimate-workspace__hero-item">
            <span className="estimate-workspace__hero-label">Estimate</span>
            <strong>{workspace.estimate.estimateNumber}</strong>
            <span>{liveWorkspaceSummary.lineItemCount} live line(s)</span>
          </div>
          <div className="estimate-workspace__hero-item">
            <span className="estimate-workspace__hero-label">Parts request</span>
            <strong>{workspace.partRequest ? "Linked" : "Starts on first part line"}</strong>
            <span>{workspace.partRequest?.status ?? "No request yet"}</span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Callout tone="danger" title="Estimate thread needs attention">
          <p className="ui-section-copy">{error}</p>
        </Callout>
      ) : null}

      {feedback ? (
        <Callout tone="success" title="Estimate thread updated">
          <p className="ui-section-copy">{feedback}</p>
        </Callout>
      ) : null}

      <Card className="estimate-workspace__thread-strip" tone="subtle">
        <CardContent className="estimate-workspace__thread-strip-content">
          <div className="estimate-workspace__thread-strip-header">
            <div>
              <span className="estimate-workspace__hero-label">Live visit thread</span>
              <strong className="estimate-workspace__thread-strip-title">
                {getVisitNextMove(workspace.job)}
              </strong>
              <p className="estimate-workspace__hero-copy">
                Keep pricing, sourcing, and release tied to the same visit, customer, and site thread.
              </p>
            </div>
            <div className="estimate-workspace__thread-strip-badges">
              <Badge tone={getVisitWorkflowTone(visitWorkflowState)}>
                {getVisitWorkflowLabel(visitWorkflowState)}
              </Badge>
              <Badge tone={pendingSourcePartCount ? "warning" : "success"}>
                {pendingSourcePartCount
                  ? `${pendingSourcePartCount} part${pendingSourcePartCount === 1 ? "" : "s"} pending`
                  : "Sourcing clear"}
              </Badge>
              <Badge tone="neutral">
                {workspace.partRequest ? formatWorkspaceLabel(workspace.partRequest.status) : "No open request"}
              </Badge>
            </div>
          </div>

          <div className="estimate-workspace__thread-strip-grid">
            <div className="estimate-workspace__thread-strip-item">
              <span>Technician</span>
              <strong>{workspace.job.assignedTechnicianUserId ? "Assigned" : "Unassigned"}</strong>
            </div>
            <div className="estimate-workspace__thread-strip-item">
              <span>Promise</span>
              <strong>{visitPromiseLabel}</strong>
            </div>
            <div className="estimate-workspace__thread-strip-item">
              <span>Quoted total</span>
              <strong>{formatCurrencyFromCents(liveTotals.totalCents, workspace.estimate.currencyCode)}</strong>
            </div>
            <div className="estimate-workspace__thread-strip-item">
              <span>Builder</span>
              <strong>{liveWorkspaceSummary.lineItemCount} live lines</strong>
            </div>
          </div>

          <div className="estimate-workspace__thread-strip-actions">
            <Link className={buttonClassName({ size: "sm", tone: "secondary" })} href={visitThreadHref}>
              Visit thread
            </Link>
            <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={customerThreadHref}>
              Customer thread
            </Link>
            <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={siteThreadHref}>
              Site thread
            </Link>
            {visitWorkflowState === "ready_to_dispatch" || visitWorkflowState === "live" ? (
              <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={dispatchHref}>
                Open dispatch
              </Link>
            ) : null}
            <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={partsWorkspaceHref}>
              {pendingSourcePartCount ? "Source pending parts" : "Open parts thread"}
            </Link>
            <Link className={buttonClassName({ size: "sm", tone: "ghost" })} href={buildVisitEstimateHref(jobId, visitLinkOptions)}>
              Review estimate
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="estimate-workspace__workflow-strip">
        <Card className="estimate-workspace__workflow-card" tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Next move</CardEyebrow>
              <CardTitle>{workflowFocusCommand.label}</CardTitle>
              <CardDescription>{workflowFocusCommand.copy}</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent className="estimate-workspace__workflow-card-content">
            <div className="estimate-workspace__workflow-metrics">
              {workflowReadiness.map((item) => (
                <div className="estimate-workspace__workflow-metric" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <Badge tone={item.tone}>{item.tone === "success" ? "Ready" : "Needs action"}</Badge>
                </div>
              ))}
            </div>
            <div className="estimate-workspace__workflow-actions">
              {"actionHref" in workflowFocusCommand ? (
                <Link className={buttonClassName()} href={workflowFocusCommand.actionHref}>
                  {workflowFocusCommand.actionLabel}
                </Link>
              ) : (
                <Button onClick={workflowFocusCommand.onAction} type="button">
                  {workflowFocusCommand.actionLabel}
                </Button>
              )}
              <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
                Visit thread
              </Link>
              {visitWorkflowState === "ready_to_dispatch" || visitWorkflowState === "live" ? (
                <Link className={buttonClassName({ tone: "tertiary" })} href={dispatchHref}>
                  Open dispatch
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="estimate-workspace__workflow-card" tone="subtle">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Sourcing queue</CardEyebrow>
              <CardTitle>
                {pendingPricingPartCount
                  ? `${pendingPricingPartCount} part line${pendingPricingPartCount === 1 ? "" : "s"} still need pricing`
                  : "Part pricing is clear"}
              </CardTitle>
              <CardDescription>
                Keep the pricing queue visible without hunting through the estimate canvas.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent className="estimate-workspace__workflow-card-content">
            {pendingPricingPartLines.length ? (
              <div className="estimate-workspace__workflow-list">
                {pendingPricingPartLines.slice(0, 4).map((lineItem) => (
                  <button
                    className="estimate-workspace__workflow-list-item"
                    key={lineItem.id}
                    onClick={() => handleSourceLine(lineItem.id)}
                    type="button"
                  >
                    <div>
                      <strong>{lineItem.name}</strong>
                      <span>
                        {lineSectionTitleByLineItemId.get(lineItem.id) ?? "Ungrouped"} ·{" "}
                        {lineItem.linkedPartRequestLine?.partNumber ? "Choose supplier offer" : "Match exact part"}
                      </span>
                    </div>
                    <Badge tone={lineItem.linkedPartRequestLine?.partNumber ? "warning" : "danger"}>
                      {lineItem.linkedPartRequestLine?.partNumber ? "Need cost" : "Need match"}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p className="estimate-workspace__line-subcopy">
                Every part line has pricing. Use the sourcing rail for comparison, not triage.
              </p>
            )}
            <div className="estimate-workspace__workflow-actions">
              {pendingPricingPrimaryLine ? (
                <Button
                  onClick={() => handleSourceLine(pendingPricingPrimaryLine.id)}
                  tone="secondary"
                  type="button"
                >
                  Source next part
                </Button>
              ) : null}
              <Link className={buttonClassName({ tone: "tertiary" })} href={partsWorkspaceHref}>
                Open parts thread
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="estimate-workspace__workflow-card" tone="subtle">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Review and release</CardEyebrow>
              <CardTitle>
                {!hasCanvasContent
                  ? "Quote is not ready"
                  : pendingPricingPartCount
                    ? "Resolve pricing blockers first"
                    : documentSettingsDirty
                      ? "Document settings need review"
                      : "Quote is ready for review"}
              </CardTitle>
              <CardDescription>
                Keep customer-facing review, document polish, and visit release on the same thread.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent className="estimate-workspace__workflow-card-content">
            <div className="estimate-workspace__workflow-metrics">
              <div className="estimate-workspace__workflow-metric">
                <span>Total</span>
                <strong>{formatCurrencyFromCents(liveTotals.totalCents, workspace.estimate.currencyCode)}</strong>
                <Badge tone={hasCanvasContent ? "brand" : "neutral"}>{liveWorkspaceSummary.lineItemCount} lines</Badge>
              </div>
              <div className="estimate-workspace__workflow-metric">
                <span>Visit status</span>
                <strong>{getVisitWorkflowLabel(visitWorkflowState)}</strong>
                <Badge tone={getVisitWorkflowTone(visitWorkflowState)}>{workspace.job.status}</Badge>
              </div>
              <div className="estimate-workspace__workflow-metric">
                <span>Document</span>
                <strong>{documentSettingsReady ? metaDraft.estimateNumber : "Needs estimate number"}</strong>
                <Badge tone={documentSettingsDirty || !documentSettingsReady ? "warning" : "success"}>
                  {documentSettingsDirty || !documentSettingsReady ? "Review" : "Ready"}
                </Badge>
              </div>
            </div>
            <p className="estimate-workspace__line-subcopy">
              {pendingPricingPartCount
                ? "The next fastest improvement is clearing pending supplier pricing so review stops being premature."
                : documentSettingsDirty
                  ? "Quote content is set. Save the document details before moving into customer-facing review."
                  : "The builder is clear enough to move into customer-facing review and visit release planning."}
            </p>
            <div className="estimate-workspace__workflow-actions">
              <Link className={buttonClassName()} href={reviewEstimateHref}>
                Review estimate
              </Link>
              <Button
                onClick={() => {
                  if (buildMode) {
                    setBuildMode(false);
                    return;
                  }

                  if (documentSettingsDirty) {
                    void handleMetaSave();
                    return;
                  }

                  setBuildMode(true);
                }}
                tone="secondary"
                type="button"
              >
                {buildMode
                  ? "Open document settings"
                  : documentSettingsDirty
                    ? "Save settings"
                    : "Return to build mode"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="estimate-workspace__command-bar">
        <form
          className="estimate-workspace__command-section"
          onSubmit={(event) => {
            event.preventDefault();
            void handleQuickAdd();
          }}
        >
          <div className="estimate-workspace__command-heading">
            <div>
              <span className="estimate-workspace__hero-label">Quick add</span>
              <strong className="estimate-workspace__command-title">Build the next line</strong>
            </div>
            <span className="estimate-workspace__line-subcopy">/ focuses quick add · Alt+L/P/F switches line type.</span>
          </div>

          <div className="estimate-workspace__item-type-tabs">
            {(["labor", "part", "fee"] as const).map((itemType) => (
              <Button
                aria-pressed={quickAdd.itemType === itemType}
                key={itemType}
                onClick={() => handleQuickAddItemTypeChange(itemType)}
                size="sm"
                tone={quickAdd.itemType === itemType ? "primary" : "secondary"}
                type="button"
              >
                {itemType === "fee" ? "Fee" : itemType === "part" ? "Part" : "Labor"}
              </Button>
            ))}
          </div>

          <div className="estimate-workspace__command-cluster">
            <Input
              id={QUICK_ADD_NAME_INPUT_ID}
              onChange={(event) => setQuickAdd((current) => ({ ...current, name: event.target.value }))}
              placeholder={quickAddPlaceholder}
              value={quickAdd.name}
            />
            <Input
              onChange={(event) => setQuickAdd((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="Qty"
              step="0.25"
              type="number"
              value={quickAdd.quantity}
            />
            <Input
              id={QUICK_ADD_PRICE_INPUT_ID}
              onChange={(event) =>
                setQuickAdd((current) => ({ ...current, unitPrice: event.target.value }))
              }
              inputMode="decimal"
              placeholder={quickAdd.itemType === "part" ? "Sell (auto)" : "Sell"}
              type="text"
              value={quickAdd.unitPrice}
            />
            <Select
              onChange={(event) =>
                setQuickAdd((current) => ({ ...current, estimateSectionId: event.target.value }))
              }
              value={quickAdd.estimateSectionId}
            >
              <option value="">Ungrouped / quick items</option>
              {workspace.sections.map((section) => (
                <option key={section.section.id} value={section.section.id}>
                  {section.section.title}
                </option>
              ))}
            </Select>
            <Button
              disabled={!quickAdd.name.trim() || isPending || Boolean(busyAction)}
              loading={busyAction === "quick-add"}
              type="submit"
            >
              {quickAddActionLabel}
            </Button>
          </div>

          <p className="estimate-workspace__line-subcopy">
            {quickAdd.itemType === "part"
              ? `Leave sell blank if needed. Choosing a supplier offer prices the line at cost x ${formatPartSellMultiplier(workspace.pricingDefaults.partSellMultiplierBasisPoints)}.`
              : quickAdd.itemType === "labor"
                ? `Use labor search in the rail for VIN-aware operations. New labor defaults to ${formatCurrencyFromCents(workspace.pricingDefaults.laborRateCents, workspace.estimate.currencyCode)}/hr.`
                : "Use fees for shop supplies, disposal, and one-off charges."}
          </p>
        </form>

        <div className="estimate-workspace__command-section">
          <div className="estimate-workspace__command-heading">
            <div>
              <span className="estimate-workspace__hero-label">Operations and kits</span>
              <strong className="estimate-workspace__command-title">Move faster on common jobs</strong>
            </div>
            <span className="estimate-workspace__line-subcopy">One click seeds labor and parts together.</span>
          </div>

          <div className="estimate-workspace__offer-section">
            <div className="estimate-workspace__offer-heading">
              <strong>Built-in quick repairs</strong>
              <span className="estimate-workspace__line-subcopy">
                Common jobs pre-stage an operation plus the first part line so you can source immediately.
              </span>
            </div>
            <div className="estimate-workspace__package-quick-row">
              {quickRepairPresets.map((preset) => (
                <Button
                  key={preset.id}
                  loading={busyAction === `quick-repair:${preset.id}`}
                  onClick={() => void handleApplyQuickRepairPreset(preset)}
                  size="sm"
                  title={preset.description}
                  tone="secondary"
                  type="button"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {quickPackages.length ? (
            <div className="estimate-workspace__offer-section">
              <div className="estimate-workspace__offer-heading">
                <strong>Saved shop kits</strong>
                <span className="estimate-workspace__line-subcopy">
                  Your reusable packages stay one click away here.
                </span>
              </div>
              <div className="estimate-workspace__package-quick-row">
                {quickPackages.map((servicePackage) => (
                  <Button
                    key={servicePackage.id}
                    onClick={() => void handlePackageApply(servicePackage.id)}
                    size="sm"
                    title={servicePackage.description ?? servicePackage.name}
                    tone="secondary"
                    type="button"
                  >
                    {servicePackage.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="estimate-workspace__line-subcopy">
              Save strong repeatable jobs from any section so common quotes become one-click inserts.
            </p>
          )}

          <form
            className="estimate-workspace__command-cluster estimate-workspace__command-cluster--compact"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddSection();
            }}
          >
            <Input
              id={NEW_SECTION_INPUT_ID}
              onChange={(event) => setNewSectionTitle(event.target.value)}
              placeholder="New operation title"
              value={newSectionTitle}
            />
            <Button disabled={!newSectionTitle.trim()} loading={isPending} tone="secondary" type="submit">
              Add section
            </Button>
          </form>

          <form
            className="estimate-workspace__command-cluster estimate-workspace__command-cluster--compact"
            onSubmit={(event) => {
              event.preventDefault();
              void handlePackageApply();
            }}
          >
            <Select onChange={(event) => setSelectedPackageId(event.target.value)} value={selectedPackageId}>
              <option value="">Saved package</option>
              {workspace.servicePackages.map((servicePackage) => (
                <option key={servicePackage.id} value={servicePackage.id}>
                  {servicePackage.name}
                </option>
              ))}
            </Select>
            <Button disabled={!selectedPackageId} loading={isPending} tone="secondary" type="submit">
              Apply selected kit
            </Button>
          </form>
        </div>

        <div className="estimate-workspace__command-section estimate-workspace__command-section--summary">
          <div className="estimate-workspace__command-heading">
            <div>
              <span className="estimate-workspace__hero-label">Live quote</span>
              <strong className="estimate-workspace__command-total">
                {formatCurrencyFromCents(liveTotals.totalCents, workspace.estimate.currencyCode)}
              </strong>
            </div>
            <Button onClick={() => setBuildMode((current) => !current)} size="sm" tone="secondary" type="button">
              {buildMode ? "Show details" : "Return to build mode"}
            </Button>
          </div>
          <p className="estimate-workspace__line-subcopy">
            {buildMode
              ? "Focused build mode is on. Ctrl+B brings document settings and vehicle context back."
              : "Document settings and vehicle context are visible. Ctrl+B returns to focused build mode."}
          </p>

          <div className="estimate-workspace__command-summary-grid">
            <div className="estimate-workspace__command-summary-item">
              <span className="estimate-workspace__hero-label">Subtotal</span>
              <strong>{formatCurrencyFromCents(liveTotals.subtotalCents, workspace.estimate.currencyCode)}</strong>
            </div>
            <div className="estimate-workspace__command-summary-item">
              <span className="estimate-workspace__hero-label">Labor</span>
              <strong>{formatQuantityInput(liveWorkspaceSummary.totalLaborHours)} hr</strong>
            </div>
            <div className="estimate-workspace__command-summary-item">
              <span className="estimate-workspace__hero-label">Part lines</span>
              <strong>{liveWorkspaceSummary.partLineCount}</strong>
              <span className="estimate-workspace__line-subcopy">
                {pendingSourcePartCount ? `${pendingSourcePartCount} still need supplier choice` : "Ready to review"}
              </span>
            </div>
            <div className="estimate-workspace__command-summary-item estimate-workspace__command-summary-item--accent">
              <span className="estimate-workspace__hero-label">Canvas</span>
              <strong>{liveWorkspaceSummary.lineItemCount} lines</strong>
              <span className="estimate-workspace__line-subcopy">{workspace.sections.length} operation blocks</span>
            </div>
          </div>
        </div>
      </div>

      <div className="estimate-workspace__layout">
        <div className="estimate-workspace__main">
          {!hasCanvasContent ? (
            <Card className="estimate-workspace__section-card estimate-workspace__section-card--empty" tone="subtle">
              <CardHeader className="estimate-workspace__section-header">
                <CardHeaderContent>
                  <CardEyebrow>Start here</CardEyebrow>
                  <CardTitle>Build the first operation</CardTitle>
                  <CardDescription>
                    Add a section for the main job, or drop quick labor, part, and fee lines straight into the estimate canvas.
                  </CardDescription>
                </CardHeaderContent>
              </CardHeader>
            </Card>
          ) : null}

          {workspace.sections.map((sectionDetail) => (
            <EstimateSectionCard
              key={sectionDetail.section.id}
              currencyCode={workspace.estimate.currencyCode}
              lineItems={sectionDetail.lineItems}
              onDeleteLine={handleDeleteLine}
              onDraftChange={handleLineDraftChange}
              onDeleteSection={handleDeleteSection}
              onSaveLine={handleSaveLine}
              onSaveSectionAsPackage={handleSaveSectionAsPackage}
              onSelectLine={setSelectedLineItemId}
              onSourceLine={handleSourceLine}
              onUpdateSection={handleUpdateSection}
              saveSectionAsPackageLoading={busyAction === `save-package:${sectionDetail.section.id}`}
              sectionDetail={sectionDetail}
              selectedLineItemId={selectedLineItemId}
              summary={
                liveSectionSummaries.get(sectionDetail.section.id) ??
                calculateSectionSummary(sectionDetail.lineItems)
              }
            />
          ))}

          {workspace.ungroupedLineItems.length ? (
            <EstimateUngroupedCard
              currencyCode={workspace.estimate.currencyCode}
              lineItems={workspace.ungroupedLineItems}
              onDeleteLine={handleDeleteLine}
              onDraftChange={handleLineDraftChange}
              onSaveLine={handleSaveLine}
              onSelectLine={setSelectedLineItemId}
              onSourceLine={handleSourceLine}
              selectedLineItemId={selectedLineItemId}
            />
          ) : null}
        </div>

        <div className="estimate-workspace__rail">
          {!buildMode ? (
            <Card className="estimate-workspace__sticky-card" tone="raised">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Estimate settings</CardEyebrow>
                  <CardTitle>Live totals and document settings</CardTitle>
                </CardHeaderContent>
              </CardHeader>
              <CardContent className="estimate-workspace__settings-grid">
                <Input onChange={(event) => setMetaDraft((current) => ({ ...current, estimateNumber: event.target.value }))} placeholder="Estimate number" value={metaDraft.estimateNumber} />
                <Input onChange={(event) => setMetaDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Estimate title" value={metaDraft.title} />
                <Input
                  onChange={(event) => setMetaDraft((current) => ({ ...current, taxRatePercent: event.target.value }))}
                  inputMode="decimal"
                  placeholder="Tax rate %"
                  type="text"
                  value={metaDraft.taxRatePercent}
                />
                <Input
                  onChange={(event) => setMetaDraft((current) => ({ ...current, discountAmount: event.target.value }))}
                  inputMode="decimal"
                  placeholder="Discount"
                  type="text"
                  value={metaDraft.discountAmount}
                />
                <Textarea onChange={(event) => setMetaDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Estimate notes" rows={3} value={metaDraft.notes} />
                <Textarea onChange={(event) => setMetaDraft((current) => ({ ...current, terms: event.target.value }))} placeholder="Estimate terms" rows={3} value={metaDraft.terms} />
                <div className="estimate-workspace__totals-grid">
                  <div>
                    <span className="estimate-workspace__hero-label">Subtotal</span>
                    <strong>{formatCurrencyFromCents(liveTotals.subtotalCents, workspace.estimate.currencyCode)}</strong>
                  </div>
                  <div>
                    <span className="estimate-workspace__hero-label">Tax</span>
                    <strong>{formatCurrencyFromCents(liveTotals.taxCents, workspace.estimate.currencyCode)}</strong>
                  </div>
                  <div>
                    <span className="estimate-workspace__hero-label">Discount</span>
                    <strong>{formatCurrencyFromCents(liveTotals.discountCents, workspace.estimate.currencyCode)}</strong>
                  </div>
                  <div>
                    <span className="estimate-workspace__hero-label">Total</span>
                    <strong>{formatCurrencyFromCents(liveTotals.totalCents, workspace.estimate.currencyCode)}</strong>
                  </div>
                </div>
                <Button loading={isPending} onClick={() => void handleMetaSave()} type="button">
                  Save estimate settings
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card tone="subtle">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Labor suggestions</CardEyebrow>
                <CardTitle>Vehicle-aware labor quick add</CardTitle>
              </CardHeaderContent>
            </CardHeader>
            <CardContent className="estimate-workspace__rail-stack">
              <form
                className="estimate-workspace__rail-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleLaborSearch();
                }}
              >
                <Input
                  id={LABOR_SEARCH_INPUT_ID}
                  onChange={(event) => setLaborQuery(event.target.value)}
                  placeholder="Search labor by complaint or visit phrasing"
                  value={laborQuery}
                />
                <Button loading={isSearchingLabor} tone="secondary" type="submit">
                  Search labor
                </Button>
              </form>
              <p className="estimate-workspace__line-subcopy">
                Search by complaint, service name, or the way a mechanic would actually describe the job.
              </p>
              {laborResult?.warnings.map((warning) => (
                <p key={warning} className="estimate-workspace__line-subcopy">
                  {warning}
                </p>
              ))}
              {laborResult?.operations.map((operation) => (
                <div key={operation.code} className="estimate-workspace__suggestion-card">
                  <div className="estimate-workspace__suggestion-header">
                    <strong>{operation.name}</strong>
                    <Badge tone="brand">{operation.suggestedHours} hr</Badge>
                  </div>
                  <p className="estimate-workspace__line-subcopy">{operation.rationale}</p>
                  <p className="estimate-workspace__line-subcopy">
                    Adds editable labor hours at{" "}
                    {formatCurrencyFromCents(
                      workspace.pricingDefaults.laborRateCents,
                      workspace.estimate.currencyCode
                    )}
                    /hr
                    {workspace.pricingDefaults.laborRateSource === "estimate_history"
                      ? " based on current estimate pricing."
                      : " using the shop default fallback."}
                  </p>
                  <Button
                    disabled={isPending || Boolean(busyAction)}
                    loading={busyAction === `labor-suggestion:${operation.code}`}
                    onClick={() => void handleAddSuggestedLaborLine(operation)}
                    size="sm"
                    tone="secondary"
                    type="button"
                  >
                    Add labor line
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="estimate-workspace-parts-rail" tone="subtle">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Parts sourcing rail</CardEyebrow>
                <CardTitle>
                  {selectedLineItem?.itemType === "part" ? selectedLineItem.name : "Select a part line"}
                </CardTitle>
              </CardHeaderContent>
            </CardHeader>
            <CardContent className="estimate-workspace__rail-stack">
              {selectedLineItem?.itemType === "part" ? (
                <>
                  <div className="estimate-workspace__part-focus-card">
                    <div className="estimate-workspace__part-focus-header">
                      <div>
                        <span className="estimate-workspace__hero-label">Selected part line</span>
                        <strong className="estimate-workspace__command-title">
                          {selectedLineItem.linkedPartRequestLine?.partNumber ?? "Needs supplier selection"}
                        </strong>
                      </div>
                      <Badge tone={selectedLineItem.linkedPartRequestLine?.partNumber ? "success" : "warning"}>
                        {selectedLineItem.linkedPartRequestLine?.partNumber ? "Sourced" : "Pending"}
                      </Badge>
                    </div>
                    <div className="estimate-workspace__part-focus-grid">
                      <div>
                        <span className="estimate-workspace__hero-label">Current cost</span>
                        <strong>
                          {typeof selectedLineItem.linkedPartRequestLine?.quotedUnitCostCents === "number"
                            ? formatCurrencyFromCents(
                                selectedLineItem.linkedPartRequestLine.quotedUnitCostCents,
                                workspace.estimate.currencyCode
                              )
                            : "No offer chosen"}
                        </strong>
                      </div>
                      <div>
                        <span className="estimate-workspace__hero-label">Offers</span>
                        <strong>{visibleOfferCountLabel}</strong>
                      </div>
                      <div>
                        <span className="estimate-workspace__hero-label">Best price</span>
                        <strong>
                          {bestOfferPriceCents !== null
                            ? formatCurrencyFromCents(bestOfferPriceCents, workspace.estimate.currencyCode)
                            : "No pricing yet"}
                        </strong>
                      </div>
                      <div>
                        <span className="estimate-workspace__hero-label">Selected supplier</span>
                        <strong>
                          {selectedManualOffer?.supplierLabel ?? selectedOffer?.supplierLabel ?? "Not chosen"}
                        </strong>
                      </div>
                      <div>
                        <span className="estimate-workspace__hero-label">Source mode</span>
                        <strong>{selectedSourceLabel}</strong>
                      </div>
                      <div>
                        <span className="estimate-workspace__hero-label">Current fitment</span>
                        <strong>
                          {selectedLineItem.description ??
                            selectedCatalogOffer?.description ??
                            "Waiting for matched part details"}
                        </strong>
                      </div>
                    </div>
                    <p className="estimate-workspace__line-subcopy">
                      Blank part sell prices auto-fill from the chosen source at cost x{" "}
                      {formatPartSellMultiplier(workspace.pricingDefaults.partSellMultiplierBasisPoints)}
                      {workspace.pricingDefaults.partSellMultiplierSource === "estimate_history"
                        ? " based on current estimate pricing."
                        : " using the shop fallback multiplier."}
                    </p>
                    {selectedCatalogOffer ? (
                      <p className="estimate-workspace__line-subcopy">
                        This line is currently running on the best matched in-app catalog offer.
                        Switch suppliers below if the mechanic wants a different store.
                      </p>
                    ) : null}
                  </div>
                  {sortedCatalogOffers.length ? (
                    <div className="estimate-workspace__offer-section">
                      <div className="estimate-workspace__offer-header">
                        <div className="estimate-workspace__offer-heading">
                          <strong>In-app matched parts</strong>
                          <span className="estimate-workspace__line-subcopy">
                            Vehicle-matched supplier offers maintained inside the app. Supported
                            part lines auto-pick the best price, and you can switch retailers here
                            without retyping the part.
                          </span>
                        </div>
                        <Badge tone="brand">{sortedCatalogOffers.length} in app</Badge>
                      </div>
                      <div className="estimate-workspace__offer-list">
                        {sortedCatalogOffers.map((offer) => (
                          <div
                            key={offer.id}
                            className={`estimate-workspace__offer-card${
                              selectedManualOffer?.cartLine.supplierPartNumber === offer.partNumber &&
                              (selectedManualOffer?.supplierLabel ?? "") === offer.supplierLabel
                                ? " estimate-workspace__offer-card--selected"
                                : ""
                            }`}
                          >
                            <div className="estimate-workspace__offer-header">
                              <div className="estimate-workspace__offer-heading">
                                <strong>{offer.supplierLabel}</strong>
                                <span className="estimate-workspace__line-subcopy">
                                  {offer.manufacturer ?? "Internal catalog"} · {offer.partNumber}
                                </span>
                                <span className="estimate-workspace__line-subcopy">
                                  {offer.description}
                                </span>
                              </div>
                              <Badge tone="brand">In-app fitment</Badge>
                            </div>
                            <div className="estimate-workspace__offer-price-row">
                              <strong className="estimate-workspace__offer-price">
                                {formatCurrencyFromCents(
                                  offer.quotedUnitCostCents,
                                  workspace.estimate.currencyCode
                                )}
                              </strong>
                              <span className="estimate-workspace__line-subcopy">
                                {offer.availabilityText ?? "Availability not captured"}
                              </span>
                            </div>
                            {offer.fitmentNotes ? (
                              <p className="estimate-workspace__line-subcopy">{offer.fitmentNotes}</p>
                            ) : null}
                            <div className="estimate-workspace__offer-actions">
                              {selectedCatalogOffer?.id === offer.id ? (
                                <Badge tone="success">Selected</Badge>
                              ) : null}
                              {bestCatalogOffer?.id === offer.id ? (
                                <Badge tone="brand">Best price</Badge>
                              ) : null}
                              <Button
                                disabled={isPending}
                                onClick={() => void handleSelectCatalogOffer(offer)}
                                size="sm"
                                type="button"
                              >
                                Use offer
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="estimate-workspace__offer-section">
                    <div className="estimate-workspace__offer-header">
                      <div className="estimate-workspace__offer-heading">
                        <strong>Live browser sourcing</strong>
                        <span className="estimate-workspace__line-subcopy">
                          Launch a real O&apos;Reilly tab, then use the injected
                          `Use in estimate` buttons on the retailer site to capture the exact
                          part back into this estimate without retyping it.
                        </span>
                      </div>
                      <Badge
                        tone={
                          retailerExtensionState === "ready"
                            ? "success"
                            : retailerExtensionState === "missing"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {retailerExtensionState === "ready"
                          ? "Extension ready"
                          : retailerExtensionState === "missing"
                            ? "Extension needed"
                            : "Checking extension"}
                      </Badge>
                    </div>
                    <form
                      className="estimate-workspace__rail-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleLaunchLiveRetailerSession();
                      }}
                    >
                      <Input
                        id={PART_SEARCH_INPUT_ID}
                        onChange={(event) => setPartSearchTerm(event.target.value)}
                        placeholder="Search part or part number"
                        value={partSearchTerm}
                      />
                      <Button
                        disabled={retailerExtensionState !== "ready" || isPending || Boolean(busyAction)}
                        loading={busyAction === `live-retailer-session:${selectedLineItem.id}`}
                        tone="secondary"
                        type="submit"
                      >
                        Open O&apos;Reilly sourcing
                      </Button>
                    </form>
                    <p className="estimate-workspace__line-subcopy">
                      Vehicle context is appended automatically, so the mechanic only needs the
                      repair term or exact part number.
                    </p>
                    {retailerExtensionState === "missing" ? (
                      <Callout
                        title="Browser extension required"
                        tone="warning"
                      >
                        Load the unpacked extension from `apps/browser-extension`, refresh this
                        estimate, and this button will start a real in-browser O&apos;Reilly
                        sourcing session.
                      </Callout>
                    ) : null}
                    {liveRetailerSession?.lineItemId === selectedLineItem.id ? (
                      <Callout
                        title="Live sourcing in progress"
                        tone={liveRetailerSession.stage === "captured" ? "success" : "default"}
                      >
                        {liveRetailerSession.stage === "captured"
                          ? "A live O'Reilly result was captured back into this estimate. Capture another one if you want to compare multiple exact website results."
                          : "The O'Reilly tab is connected. Use the injected `Use in estimate` buttons on that site to capture real part data back into this estimate."}
                      </Callout>
                    ) : null}
                    {liveRetailerSearch ? (
                      liveRetailerSearch.offers.length ? (
                        <>
                          <p className="estimate-workspace__line-subcopy">
                            Captured {liveRetailerSearch.offers.length} live browser result(s) for
                            &quot;{liveRetailerSearch.query}&quot;.
                          </p>
                          <div className="estimate-workspace__offer-list">
                            {sortedLiveRetailerOffers.map((offer) => (
                              <div key={offer.id} className="estimate-workspace__offer-card">
                                <div className="estimate-workspace__offer-header">
                                  <div className="estimate-workspace__offer-heading">
                                    <strong>{offer.supplierLabel}</strong>
                                    <span className="estimate-workspace__line-subcopy">
                                      {offer.description}
                                    </span>
                                    <span className="estimate-workspace__line-subcopy">
                                      {offer.manufacturer ?? "Retail result"} · {offer.partNumber}
                                    </span>
                                  </div>
                                  <Badge tone="neutral">Browser capture</Badge>
                                </div>
                                <div className="estimate-workspace__offer-price-row">
                                  <strong className="estimate-workspace__offer-price">
                                    {formatCurrencyFromCents(
                                      offer.quotedUnitCostCents,
                                      workspace.estimate.currencyCode
                                    )}
                                  </strong>
                                  <span className="estimate-workspace__line-subcopy">
                                    {offer.availabilityText ?? "Availability not captured"}
                                    {offer.quotedCoreChargeCents
                                      ? ` · Core ${formatCurrencyFromCents(offer.quotedCoreChargeCents, workspace.estimate.currencyCode)}`
                                      : ""}
                                  </span>
                                </div>
                                {offer.fitmentNotes ? (
                                  <p className="estimate-workspace__line-subcopy">{offer.fitmentNotes}</p>
                                ) : null}
                                <div className="estimate-workspace__offer-actions">
                                  {bestLiveRetailerOffer?.id === offer.id ? (
                                    <Badge tone="brand">Best price</Badge>
                                  ) : null}
                                  <Button
                                    disabled={isPending}
                                    onClick={() => void handleSelectLiveRetailerOffer(offer)}
                                    size="sm"
                                    type="button"
                                  >
                                    Use captured result
                                  </Button>
                                  {offer.supplierUrl ? (
                                    <a
                                      className={buttonClassName({ size: "sm", tone: "tertiary" })}
                                      href={offer.supplierUrl}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      Open source
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="estimate-workspace__line-subcopy">
                          No live retailer results have been captured yet. Open O&apos;Reilly
                          sourcing above, then capture the exact result you want from the website.
                        </p>
                      )
                    ) : null}
                  </div>
                  <div className="estimate-workspace__suggestion-card">
                    <div className="estimate-workspace__suggestion-header">
                      <div className="estimate-workspace__offer-heading">
                        <strong>Manual retailer quote</strong>
                        <span className="estimate-workspace__line-subcopy">
                          Use this for phone quotes, counter pricing, or any supplier without an API.
                        </span>
                      </div>
                      <div className="estimate-workspace__offer-actions estimate-workspace__offer-actions--compact">
                        <Badge tone="brand">In-app</Badge>
                        <Button
                          onClick={() => {
                            setShowInlineSupplierBuilder((current) => !current);
                            if (!showInlineSupplierBuilder) {
                              window.setTimeout(() => {
                                focusWorkspaceField(INLINE_SUPPLIER_NAME_INPUT_ID);
                              }, 0);
                            }
                          }}
                          size="sm"
                          tone="tertiary"
                          type="button"
                        >
                          {showInlineSupplierBuilder ? "Hide supplier form" : "Add supplier"}
                        </Button>
                      </div>
                    </div>
                    {showInlineSupplierBuilder ? (
                      <div className="estimate-workspace__offer-section estimate-workspace__offer-section--subtle">
                        <div className="estimate-workspace__offer-heading">
                          <strong>Add supplier without leaving the estimate</strong>
                          <span className="estimate-workspace__line-subcopy">
                            Save the vendor once, then keep quoting on the same thread.
                          </span>
                        </div>
                        <form
                          className="estimate-workspace__rail-stack"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleCreateInlineSupplierAccount();
                          }}
                        >
                          <div className="estimate-workspace__inline-supplier-grid">
                            <Input
                              id={INLINE_SUPPLIER_NAME_INPUT_ID}
                              onChange={(event) =>
                                setInlineSupplierDraft((current) => ({
                                  ...current,
                                  name: event.target.value
                                }))
                              }
                              placeholder="Supplier name"
                              value={inlineSupplierDraft.name}
                            />
                            <Input
                              onChange={(event) =>
                                setInlineSupplierDraft((current) => ({
                                  ...current,
                                  externalUrl: event.target.value
                                }))
                              }
                              placeholder="Website / source URL (optional)"
                              type="url"
                              value={inlineSupplierDraft.externalUrl}
                            />
                          </div>
                          <div className="estimate-workspace__offer-actions">
                            <Button
                              disabled={!inlineSupplierDraft.name.trim()}
                              loading={busyAction === "inline-supplier"}
                              type="submit"
                            >
                              Save supplier
                            </Button>
                            {activeSupplierAccounts.length ? (
                              <Button
                                onClick={() => {
                                  setShowInlineSupplierBuilder(false);
                                  setInlineSupplierDraft(buildInlineSupplierDraft());
                                }}
                                size="sm"
                                tone="secondary"
                                type="button"
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </div>
                        </form>
                      </div>
                    ) : null}
                    {activeSupplierAccounts.length ? (
                      <form
                        className="estimate-workspace__rail-stack"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleSaveManualOffer(true);
                        }}
                      >
                        <div className="estimate-workspace__offer-section estimate-workspace__offer-section--subtle">
                          <div className="estimate-workspace__offer-heading">
                            <strong>Quick quote essentials</strong>
                            <span className="estimate-workspace__line-subcopy">
                              Supplier, part number, and unit cost are enough to save the quote.
                            </span>
                          </div>
                          <div className="estimate-workspace__manual-offer-grid estimate-workspace__manual-offer-grid--essentials">
                            <Select
                              onChange={(event) => {
                                const nextSupplierAccount =
                                  activeSupplierAccounts.find(
                                    (supplierAccount) => supplierAccount.id === event.target.value
                                  ) ?? null;

                                setManualOfferDraft((current) => ({
                                  ...current,
                                  supplierAccountId: event.target.value,
                                  supplierUrl: nextSupplierAccount?.externalUrl ?? ""
                                }));
                              }}
                              value={manualOfferDraft.supplierAccountId}
                            >
                              <option value="">Choose supplier</option>
                              {activeSupplierAccounts.map((supplierAccount) => (
                                <option key={supplierAccount.id} value={supplierAccount.id}>
                                  {supplierAccount.name}
                                </option>
                              ))}
                            </Select>
                            <Input
                              onChange={(event) =>
                                setManualOfferDraft((current) => ({
                                  ...current,
                                  supplierPartNumber: event.target.value
                                }))
                              }
                              placeholder="Supplier part number"
                              value={manualOfferDraft.supplierPartNumber}
                            />
                            <Input
                              id={MANUAL_PART_PRICE_INPUT_ID}
                              inputMode="decimal"
                              onChange={(event) =>
                                setManualOfferDraft((current) => ({
                                  ...current,
                                  quotedUnitCost: event.target.value
                                }))
                              }
                              placeholder="Unit cost"
                              type="text"
                              value={manualOfferDraft.quotedUnitCost}
                            />
                          </div>
                          <div className="estimate-workspace__offer-actions">
                            <Button
                              onClick={() => setShowManualOfferDetails((current) => !current)}
                              size="sm"
                              tone="tertiary"
                              type="button"
                            >
                              {showManualOfferDetails ? "Hide optional details" : "Add optional details"}
                            </Button>
                            {latestManualOffer ? (
                              <Button
                                onClick={() => handleLoadManualOfferDraft(latestManualOffer, "reuse")}
                                size="sm"
                                tone="secondary"
                                type="button"
                              >
                                Reuse last quote
                              </Button>
                            ) : null}
                            {latestManualOffer && activeSupplierAccounts.length > 1 ? (
                              <Button
                                onClick={() =>
                                  handleLoadManualOfferDraft(
                                    latestManualOffer,
                                    "duplicate-next-supplier"
                                  )
                                }
                                size="sm"
                                tone="secondary"
                                type="button"
                              >
                                Copy to next supplier
                              </Button>
                            ) : null}
                          </div>
                          {latestManualOffer ? (
                            <p className="estimate-workspace__line-subcopy">
                              Last quote: {latestManualOffer.supplierLabel} ·{" "}
                              {latestManualOffer.cartLine.supplierPartNumber ?? "No part number"}
                            </p>
                          ) : null}
                        </div>
                        {showManualOfferDetails ? (
                          <div className="estimate-workspace__offer-section estimate-workspace__offer-section--subtle">
                            <div className="estimate-workspace__offer-heading">
                              <strong>Optional quote details</strong>
                              <span className="estimate-workspace__line-subcopy">
                                Availability, core, notes, and source link stay optional.
                              </span>
                            </div>
                            <div className="estimate-workspace__manual-offer-grid">
                              <Input
                                inputMode="decimal"
                                onChange={(event) =>
                                  setManualOfferDraft((current) => ({
                                    ...current,
                                    quotedCoreCharge: event.target.value
                                  }))
                                }
                                placeholder="Core"
                                type="text"
                                value={manualOfferDraft.quotedCoreCharge}
                              />
                              <Input
                                onChange={(event) =>
                                  setManualOfferDraft((current) => ({
                                    ...current,
                                    availabilityText: event.target.value
                                  }))
                                }
                                placeholder="Availability / ETA"
                                value={manualOfferDraft.availabilityText}
                              />
                              <Input
                                onChange={(event) =>
                                  setManualOfferDraft((current) => ({
                                    ...current,
                                    supplierUrl: event.target.value
                                  }))
                                }
                                placeholder="Source URL"
                                type="url"
                                value={manualOfferDraft.supplierUrl}
                              />
                              <Textarea
                                onChange={(event) =>
                                  setManualOfferDraft((current) => ({
                                    ...current,
                                    notes: event.target.value
                                  }))
                                }
                                placeholder="Optional note"
                                rows={2}
                                value={manualOfferDraft.notes}
                              />
                            </div>
                          </div>
                        ) : null}
                        <div className="estimate-workspace__offer-actions">
                          <Button
                            disabled={!manualOfferDraft.supplierAccountId || !manualOfferDraft.quotedUnitCost.trim()}
                            loading={busyAction === `manual-offer:${selectedLineItem.id}`}
                            type="submit"
                          >
                            Save and choose
                          </Button>
                          <Button
                            disabled={!manualOfferDraft.supplierAccountId || !manualOfferDraft.quotedUnitCost.trim()}
                            loading={busyAction === `manual-offer:${selectedLineItem.id}`}
                            onClick={() => void handleSaveManualOffer(false)}
                            tone="secondary"
                            type="button"
                          >
                            Save only
                          </Button>
                          <span className="estimate-workspace__line-subcopy">
                            Press Enter or use Save and choose for the fastest path. Availability is optional.
                          </span>
                        </div>
                      </form>
                    ) : (
                      <p className="estimate-workspace__line-subcopy">
                        Add the first supplier above, then this thread keeps every quote in one place.
                      </p>
                    )}
                  </div>
                  {sortedManualOffers.length ? (
                    <div className="estimate-workspace__offer-section">
                      <div className="estimate-workspace__offer-header">
                        <div className="estimate-workspace__offer-heading">
                          <strong>Saved retailer quotes</strong>
                          <span className="estimate-workspace__line-subcopy">
                            Compare saved manual pricing without leaving this estimate.
                          </span>
                        </div>
                        <Badge tone="neutral">{sortedManualOffers.length} saved</Badge>
                      </div>
                      <div className="estimate-workspace__offer-list">
                        {sortedManualOffers.map((offer) => (
                          <div
                            key={offer.cartLine.id}
                            className={`estimate-workspace__offer-card${offer.isSelected ? " estimate-workspace__offer-card--selected" : ""}`}
                          >
                            <div className="estimate-workspace__offer-header">
                              <div className="estimate-workspace__offer-heading">
                                <strong>{offer.supplierLabel}</strong>
                                <span className="estimate-workspace__line-subcopy">
                                  {offer.cartLine.supplierPartNumber ?? "No part number"}
                                  {offer.cartLine.notes ? ` · ${offer.cartLine.notes}` : ""}
                                </span>
                              </div>
                              <Badge tone={offer.isSelected ? "success" : "neutral"}>
                                {offer.isSelected ? "Selected" : "Manual"}
                              </Badge>
                            </div>
                            <div className="estimate-workspace__offer-price-row">
                              <strong className="estimate-workspace__offer-price">
                                {formatCurrencyFromCents(
                                  offer.cartLine.quotedUnitCostCents ?? 0,
                                  workspace.estimate.currencyCode
                                )}
                              </strong>
                              <span className="estimate-workspace__line-subcopy">
                                {offer.cartLine.availabilityText ?? "Availability not captured"}
                                {offer.cartLine.quotedCoreChargeCents
                                  ? ` · Core ${formatCurrencyFromCents(offer.cartLine.quotedCoreChargeCents, workspace.estimate.currencyCode)}`
                                  : ""}
                              </span>
                            </div>
                            <div className="estimate-workspace__offer-actions">
                              {bestManualOffer?.cartLine.id === offer.cartLine.id && !offer.isSelected ? (
                                <Badge tone="brand">Best price</Badge>
                              ) : null}
                              <Button
                                disabled={offer.isSelected || isPending}
                                onClick={() => void handleSelectManualOffer(offer)}
                                size="sm"
                                type="button"
                              >
                                {offer.isSelected ? "Selected offer" : "Choose offer"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {hasConnectedProviderSearch ? (
                    <>
                      <form
                        className="estimate-workspace__rail-form"
                        onSubmit={(event) => {
                          event.preventDefault();

                          if (defaultProviderSearchAction) {
                            void handleSearchProvider(defaultProviderSearchAction.provider);
                          }
                        }}
                      >
                        <Input
                          id={CONNECTED_PART_SEARCH_INPUT_ID}
                          onChange={(event) => setPartSearchTerm(event.target.value)}
                          placeholder="Search term or part number"
                          value={partSearchTerm}
                        />
                        <Button
                          disabled={!defaultProviderSearchAction}
                          tone="secondary"
                          type="submit"
                        >
                          {defaultProviderSearchAction ? `Search ${defaultProviderSearchAction.label}` : "Search suppliers"}
                        </Button>
                      </form>
                      <div className="estimate-workspace__provider-actions">
                        {providerSearchActions.map((action) => (
                          <Button
                            key={action.provider}
                            disabled={Boolean(action.disabledReason)}
                            onClick={() => void handleSearchProvider(action.provider)}
                            size="sm"
                            title={action.disabledReason ?? `Search ${action.label}`}
                            tone="secondary"
                            type="button"
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                      <p className="estimate-workspace__line-subcopy estimate-workspace__provider-copy">
                        Search uses {workspace.vehicleContext.displayName}
                        {workspace.vehicleContext.vin ? ` · VIN ${workspace.vehicleContext.vin}` : ""}.
                      </p>
                      {unavailableProviderMessages.length ? (
                        <div className="estimate-workspace__provider-notes">
                          {unavailableProviderMessages.map((message) => (
                            <p key={message} className="estimate-workspace__line-subcopy">
                              {message}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="estimate-workspace__offer-section">
                      <div className="estimate-workspace__offer-heading">
                        <strong>Connected supplier search</strong>
                        <span className="estimate-workspace__line-subcopy">
                          Live O&apos;Reilly lookup is available above. Connect PartsTech, RepairLink, or Amazon
                          Business if you also want provider-backed search in this same rail.
                        </span>
                      </div>
                      <div className="estimate-workspace__offer-actions">
                        <Link
                          className={buttonClassName({ size: "sm", tone: "tertiary" })}
                          href="/dashboard/supply/integrations"
                        >
                          Manage integrations
                        </Link>
                        <span className="estimate-workspace__line-subcopy">
                          Provider integrations stay optional. The live retailer and manual quote flows do not place
                          orders during estimate building.
                        </span>
                      </div>
                    </div>
                  )}
                  {sortedOffers.length ? (
                    <div className="estimate-workspace__offer-section">
                      <div className="estimate-workspace__offer-header">
                        <div className="estimate-workspace__offer-heading">
                          <strong>Connected supplier offers</strong>
                          <span className="estimate-workspace__line-subcopy">
                            Live quotes from connected provider accounts.
                          </span>
                        </div>
                        <Badge tone="neutral">{sortedOffers.length} live</Badge>
                      </div>
                      <div className="estimate-workspace__offer-list">
                        {sortedOffers.map((offer) => (
                          <div
                            key={offer.quoteLine.id}
                            className={`estimate-workspace__offer-card${offer.isSelected ? " estimate-workspace__offer-card--selected" : ""}`}
                          >
                            <div className="estimate-workspace__offer-header">
                              <div className="estimate-workspace__offer-heading">
                                <strong>{offer.supplierLabel}</strong>
                                <span className="estimate-workspace__line-subcopy">
                                  {offer.quoteLine.manufacturer ?? "Aftermarket"} · {offer.quoteLine.partNumber ?? "No part number"}
                                </span>
                              </div>
                              <Badge tone={offer.isSelected ? "success" : "neutral"}>
                                {offer.isSelected ? "Selected" : offer.provider}
                              </Badge>
                            </div>
                            <div className="estimate-workspace__offer-price-row">
                              <strong className="estimate-workspace__offer-price">
                                {formatCurrencyFromCents(
                                  offer.quoteLine.unitPriceCents ?? 0,
                                  workspace.estimate.currencyCode
                                )}
                              </strong>
                              <span className="estimate-workspace__line-subcopy">
                                {offer.quoteLine.availabilityText ?? "Availability unknown"} · {offer.quoteLine.etaText ?? "ETA pending"}
                              </span>
                            </div>
                            <div className="estimate-workspace__offer-actions">
                              {bestOffer?.quoteLine.id === offer.quoteLine.id && !offer.isSelected ? (
                                <Badge tone="brand">Best price</Badge>
                              ) : null}
                              <Button
                                disabled={offer.isSelected || isPending}
                                onClick={() => void handleSelectOffer(offer)}
                                size="sm"
                                type="button"
                              >
                                {offer.isSelected ? "Selected offer" : "Choose offer"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="estimate-workspace__line-subcopy">
                      Save manual retailer quotes here, or run a connected supplier search without leaving the service thread.
                    </p>
                  )}
                </>
              ) : (
                <p className="estimate-workspace__line-subcopy">
                  Select a part line from the estimate thread to compare supplier offers in this rail.
                </p>
              )}
            </CardContent>
          </Card>

          {!buildMode ? (
            <Card tone="subtle">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Vehicle context</CardEyebrow>
                  <CardTitle>{workspace.vehicleContext.displayName}</CardTitle>
                </CardHeaderContent>
              </CardHeader>
              <CardContent className="estimate-workspace__vehicle-grid">
                <div>
                  <span className="estimate-workspace__hero-label">VIN</span>
                  <strong>{workspace.vehicleContext.vin ?? "No VIN"}</strong>
                </div>
                <div>
                  <span className="estimate-workspace__hero-label">Engine</span>
                  <strong>{workspace.vehicleContext.engine ?? "No engine data"}</strong>
                </div>
                <div>
                  <span className="estimate-workspace__hero-label">Plate</span>
                  <strong>{workspace.vehicleContext.licensePlate ?? "No plate"}</strong>
                </div>
                <div>
                  <span className="estimate-workspace__hero-label">Odometer</span>
                  <strong>
                    {typeof workspace.vehicleContext.odometer === "number"
                      ? `${workspace.vehicleContext.odometer.toLocaleString()} mi`
                      : "Not captured"}
                  </strong>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
