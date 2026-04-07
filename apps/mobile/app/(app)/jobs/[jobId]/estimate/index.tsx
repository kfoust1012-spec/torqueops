import {
  buildEstimateSupplierBrowserSearchUrl,
  buildEstimateVehicleContextSnapshot,
  formatDesignLabel,
  formatCurrencyFromCents,
  formatDateTime,
  getEstimateLiveRetailerConnector,
  getCustomerDisplayName,
  isEstimateApprovalComplete,
  resolveEstimateCatalogPartOffers
} from "@mobile-mechanic/core";
import type {
  EstimateCatalogPartOfferSummary,
  EstimateLineItem,
  EstimateLineItemType,
  EstimateLiveRetailerPartOffer,
  SearchEstimateLiveRetailerOffersResult
} from "@mobile-mechanic/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, Text, View } from "react-native";

import {
  ActionTile,
  Badge,
  Button,
  Card,
  CardCopy,
  CardTitle,
  Chip,
  DetailRow,
  DictationButton,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Notice,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  SectionCard,
  StatusBadge
} from "../../../../../src/components/ui";
import {
  addAssignedJobEstimateLineItem,
  changeAssignedJobEstimateStatus,
  ensureAssignedJobEstimateDraft,
  loadAssignedJobEstimate,
  removeAssignedJobEstimateLineItem,
  saveAssignedJobEstimateDraft,
  saveAssignedJobEstimateLineItem,
  saveAssignedJobEstimatePartSource,
  searchAssignedJobEstimateLiveRetailerOffers,
  type AssignedEstimatePartSource
} from "../../../../../src/features/estimates/api";
import {
  estimatePhrases,
  mechanicActionPhrases,
  mergeDictationContext,
  sourcingPhrases
} from "../../../../../src/features/voice/dictation-context";
import type { MobileAppContext } from "../../../../../src/lib/app-context";
import { openExternalUrl } from "../../../../../src/lib/linking";
import { useSessionContext } from "../../../../../src/providers/session-provider";

type EstimateDetailData = Awaited<ReturnType<typeof loadAssignedJobEstimate>> | null;
type Tone = "brand" | "danger" | "success" | "warning";
type Flash = { body: string; title?: string; tone: Tone };
type DraftForm = { estimateNumber: string; notes: string; terms: string; title: string };
type LiveRetailerSearchState = SearchEstimateLiveRetailerOffersResult;
type LineForm = {
  description: string;
  id: string | null;
  itemType: EstimateLineItemType;
  name: string;
  quantity: string;
  taxable: boolean;
  unitPrice: string;
};
type PartSourceForm = {
  availabilityText: string;
  coreCharge: string;
  lineItemId: string | null;
  notes: string;
  quotedUnitCost: string;
  supplierAccountId: string | null;
  supplierName: string;
  supplierPartNumber: string;
  supplierUrl: string;
};
type PartSourcingMode = "fitment" | "live" | "manual";

function formatQuantity(quantity: number) {
  return Number.isInteger(quantity) ? `${quantity}` : quantity.toFixed(2);
}

function formatMoneyInput(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `${dollars}` : dollars.toFixed(2);
}

function parseMoneyInput(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function parseQuantityInput(value: string) {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildDraftForm(detail: NonNullable<EstimateDetailData>): DraftForm {
  return {
    estimateNumber: detail.estimate.estimateNumber,
    notes: detail.estimate.notes ?? "",
    terms: detail.estimate.terms ?? "",
    title: detail.estimate.title
  };
}

function emptyLineForm(itemType: EstimateLineItemType = "labor"): LineForm {
  return {
    description: "",
    id: null,
    itemType,
    name: "",
    quantity: "1",
    taxable: true,
    unitPrice: ""
  };
}

function buildLineForm(lineItem: EstimateLineItem): LineForm {
  return {
    description: lineItem.description ?? "",
    id: lineItem.id,
    itemType: lineItem.itemType,
    name: lineItem.name,
    quantity: formatQuantity(lineItem.quantity),
    taxable: lineItem.taxable,
    unitPrice: formatMoneyInput(lineItem.unitPriceCents)
  };
}

function emptyPartSourceForm(): PartSourceForm {
  return {
    availabilityText: "",
    coreCharge: "",
    lineItemId: null,
    notes: "",
    quotedUnitCost: "",
    supplierAccountId: null,
    supplierName: "",
    supplierPartNumber: "",
    supplierUrl: ""
  };
}

function buildPartSourceForm(partSource: AssignedEstimatePartSource | null): PartSourceForm {
  return {
    availabilityText: partSource?.selectedCartLine?.availabilityText ?? "",
    coreCharge:
      typeof partSource?.selectedCartLine?.quotedCoreChargeCents === "number" &&
      partSource.selectedCartLine.quotedCoreChargeCents > 0
        ? formatMoneyInput(partSource.selectedCartLine.quotedCoreChargeCents)
        : typeof partSource?.requestLine?.coreChargeCents === "number" &&
            partSource.requestLine.coreChargeCents > 0
          ? formatMoneyInput(partSource.requestLine.coreChargeCents)
          : "",
    lineItemId: partSource?.lineItemId ?? null,
    notes: partSource?.selectedCartLine?.notes ?? partSource?.requestLine?.notes ?? "",
    quotedUnitCost:
      typeof partSource?.selectedCartLine?.quotedUnitCostCents === "number"
        ? formatMoneyInput(partSource.selectedCartLine.quotedUnitCostCents)
        : typeof partSource?.requestLine?.quotedUnitCostCents === "number"
          ? formatMoneyInput(partSource.requestLine.quotedUnitCostCents)
          : "",
    supplierAccountId: partSource?.selectedSupplierAccount?.id ?? null,
    supplierName: partSource?.selectedSupplierAccount?.name ?? "",
    supplierPartNumber:
      partSource?.selectedCartLine?.supplierPartNumber ?? partSource?.requestLine?.partNumber ?? "",
    supplierUrl:
      partSource?.selectedCartLine?.supplierUrl ??
      partSource?.selectedSupplierAccount?.externalUrl ??
      ""
  };
}

function hasSavedPartSource(partSource: AssignedEstimatePartSource | null) {
  return Boolean(
    partSource?.selectedSupplierAccount ||
      partSource?.selectedCartLine ||
      partSource?.requestLine?.lastSupplierAccountId ||
      (typeof partSource?.requestLine?.quotedUnitCostCents === "number" &&
        partSource.requestLine.quotedUnitCostCents > 0)
  );
}

function getSourceProviderLabel(partSource: AssignedEstimatePartSource | null) {
  if (partSource?.selectedSupplierAccount?.name?.trim()) {
    return partSource.selectedSupplierAccount.name.trim();
  }

  const supplierUrl = partSource?.selectedCartLine?.supplierUrl?.trim();

  if (supplierUrl) {
    if (supplierUrl.includes("oreillyauto.com")) {
      return "O'Reilly Auto Parts";
    }

    try {
      return new URL(supplierUrl).hostname.replace(/^www\./, "");
    } catch {
      return supplierUrl;
    }
  }

  return "Saved source";
}

function buildSelectedSourceSummary(
  partSource: AssignedEstimatePartSource | null,
  currencyCode: string
) {
  if (!hasSavedPartSource(partSource)) {
    return "No supplier captured yet for this part line.";
  }

  const savedPartSource = partSource!;

  const details = [
    getSourceProviderLabel(savedPartSource),
    typeof savedPartSource.selectedCartLine?.quotedUnitCostCents === "number"
      ? formatCurrencyFromCents(savedPartSource.selectedCartLine.quotedUnitCostCents, currencyCode)
      : typeof savedPartSource.requestLine?.quotedUnitCostCents === "number"
        ? formatCurrencyFromCents(savedPartSource.requestLine.quotedUnitCostCents, currencyCode)
        : null,
    savedPartSource.selectedCartLine?.availabilityText ?? null
  ].filter(Boolean);

  return details.join(" · ");
}

const availabilityQuickChoices = [
  "In stock",
  "Same day pickup",
  "Next business day",
  "Ordered for return visit"
] as const;

export default function JobEstimateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : params.jobId?.[0] ?? null;
  const { appContext, refreshAppContext } = useSessionContext();
  const [detail, setDetail] = useState<EstimateDetailData>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [lineForm, setLineForm] = useState<LineForm>(() => emptyLineForm());
  const [partSourceForm, setPartSourceForm] = useState<PartSourceForm>(() => emptyPartSourceForm());
  const [flash, setFlash] = useState<Flash | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isSearchingRetailer, setIsSearchingRetailer] = useState(false);
  const [liveRetailerError, setLiveRetailerError] = useState<string | null>(null);
  const [liveRetailerQuery, setLiveRetailerQuery] = useState("");
  const [liveRetailerState, setLiveRetailerState] = useState<LiveRetailerSearchState | null>(null);
  const [partSourcingMode, setPartSourcingMode] = useState<PartSourcingMode>("live");
  const [showDraftHeaderDetails, setShowDraftHeaderDetails] = useState(false);

  const estimateContext = useMemo(
    () =>
      appContext && jobId
        ? {
            companyId: appContext.companyId,
            jobId,
            technicianUserId: appContext.userId
          }
        : null,
    [appContext, jobId]
  );

  const loadEstimate = useCallback(
    async (context: MobileAppContext | null = appContext) => {
      if (!context || !jobId) return;
      setDetail(await loadAssignedJobEstimate(context.companyId, context.userId, jobId));
    },
    [appContext, jobId]
  );

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!jobId) {
        setErrorMessage("This estimate route is invalid.");
        setIsLoading(false);
        return;
      }

      if (!appContext) return;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await loadAssignedJobEstimate(appContext.companyId, appContext.userId, jobId);
        if (isMounted) setDetail(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load estimate summary.";
        if (isMounted) setErrorMessage(message);
        if (message.toLowerCase().includes("assigned job not found")) router.replace("/jobs");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, [appContext, jobId, router]);

  useEffect(() => {
    if (!detail) {
      setDraftForm(null);
      setLiveRetailerError(null);
      setLiveRetailerState(null);
      return;
    }

    setDraftForm(buildDraftForm(detail));
  }, [detail?.estimate.id, detail?.estimate.updatedAt]);

  useEffect(() => {
    if (!detail || detail.estimate.status !== "draft" || partSourceForm.lineItemId) {
      return;
    }

    const detailPartLines = detail.lineItems.filter((lineItem) => lineItem.itemType === "part");

    if (!detailPartLines.length) {
      return;
    }

    const nextPartLine =
      detailPartLines.find(
        (lineItem) =>
          !detail.partSources.some(
            (partSource) =>
              partSource.lineItemId === lineItem.id && hasSavedPartSource(partSource)
          )
      ) ?? detailPartLines[0];

    if (!nextPartLine) {
      return;
    }

    const nextPartSource =
      detail.partSources.find((partSource) => partSource.lineItemId === nextPartLine.id) ?? null;

    setPartSourceForm({
      ...buildPartSourceForm(nextPartSource),
      lineItemId: nextPartLine.id
    });
    setLiveRetailerError(null);
    setLiveRetailerState(null);
    setLiveRetailerQuery(nextPartLine.name);
  }, [detail, partSourceForm.lineItemId]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      await loadEstimate(await refreshAppContext());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to refresh estimate summary.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function runMutation(action: () => Promise<EstimateDetailData>, success: Flash) {
    setIsMutating(true);
    setFlash(null);
    setErrorMessage(null);

    try {
      const previousPendingMutationCount = detail?.pendingMutationCount ?? 0;
      const nextDetail = await action();
      setDetail(nextDetail);

      if (nextDetail) {
        setDraftForm(buildDraftForm(nextDetail));
      }

      const nextPendingMutationCount = nextDetail?.pendingMutationCount ?? 0;

      setFlash(
        nextPendingMutationCount > previousPendingMutationCount
          ? {
              body: `${nextPendingMutationCount} estimate change${
                nextPendingMutationCount === 1 ? "" : "s"
              } will sync automatically when the app reconnects.`,
              title: "Queued for sync",
              tone: "warning"
            }
          : success
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Estimate action failed.";
      setErrorMessage(message);
      setFlash({ body: message, title: "Estimate action failed", tone: "danger" });
    } finally {
      setIsMutating(false);
    }
  }

  if (isLoading) {
    return <LoadingState body="Loading the estimate summary for this assigned stop." title="Loading estimate" />;
  }

  if (!jobId) {
    return (
      <Screen>
        <ErrorState
          actions={<Button onPress={() => router.replace("/jobs")}>Back to jobs</Button>}
          body="This estimate route is invalid."
          eyebrow="Stop estimate"
          title="Estimate unavailable"
        />
      </Screen>
    );
  }

  if (!detail && errorMessage) {
    return (
      <Screen>
        <ErrorState
          actions={
            <View style={{ gap: 12 }}>
              <Button onPress={() => void handleRefresh()}>Retry</Button>
              <Button onPress={() => router.replace(`/jobs/${jobId}`)} tone="secondary">
                Back to stop
              </Button>
            </View>
          }
          body={errorMessage}
          eyebrow="Stop estimate"
          title="Estimate unavailable"
        />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <ScreenScrollView
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        >
          <ScreenHeader
            actions={
              <Button fullWidth={false} onPress={() => router.replace(`/jobs/${jobId}`)} tone="secondary">
                Back to stop
              </Button>
            }
            description="This stop does not have estimate pricing yet. Start the draft here instead of bouncing the mechanic back to the office."
            eyebrow="Estimate"
            title="Start field estimate"
          />
          {flash ? <Notice body={flash.body} title={flash.title} tone={flash.tone} /> : null}
          {errorMessage ? <Notice body={errorMessage} title="Refresh failed" tone="danger" /> : null}
          <ActionTile
            badge={<Badge tone="warning">Missing</Badge>}
            description="Create a draft estimate, then add labor, part, and fee lines from the field."
            eyebrow="Next action"
            onPress={() => {
              if (!estimateContext) return;
              void runMutation(
                () => ensureAssignedJobEstimateDraft(estimateContext),
                {
                  body: "The draft is ready. Add the first line while you are still with the customer.",
                  title: "Estimate draft started",
                  tone: "success"
                }
              );
            }}
            title="Start estimate draft"
            tone="primary"
          />
        </ScreenScrollView>
      </Screen>
    );
  }

  const isDraft = detail.estimate.status === "draft";
  const approvalComplete = isEstimateApprovalComplete({
    approvalStatement: detail.estimate.approvalStatement,
    approvedByName: detail.estimate.approvedByName,
    approvedSignatureId: detail.estimate.approvedSignatureId,
    approvedAt: detail.estimate.acceptedAt
  });
  const groupedLineCount = detail.lineItems.filter((lineItem) => lineItem.estimateSectionId).length;
  const partLines = detail.lineItems.filter((lineItem) => lineItem.itemType === "part");
  const partSourceByLineItemId = new Map(
    detail.partSources.map((partSource) => [partSource.lineItemId, partSource])
  );
  const selectedSourceLine = partSourceForm.lineItemId
    ? detail.lineItems.find((lineItem) => lineItem.id === partSourceForm.lineItemId) ?? null
    : null;
  const activePartSource = selectedSourceLine
    ? partSourceByLineItemId.get(selectedSourceLine.id) ?? null
    : null;
  const supplierFilter = partSourceForm.supplierName.trim().toLowerCase();
  const filteredSuppliers = detail.supplierAccounts
    .filter((supplierAccount) =>
      supplierFilter
        ? supplierAccount.name.toLowerCase().includes(supplierFilter)
        : true
    )
    .slice(0, 6);
  const vehicleContext = buildEstimateVehicleContextSnapshot(detail.vehicle);
  const catalogOffersByLineItemId = new Map(
    partLines.map((lineItem) => [
      lineItem.id,
      resolveEstimateCatalogPartOffers({
        lineItem: {
          name: lineItem.name,
          description: lineItem.description
        },
        supplierAccounts: detail.supplierAccounts,
        vehicleContext
      })
    ])
  );
  const activeCatalogOffers = selectedSourceLine
    ? catalogOffersByLineItemId.get(selectedSourceLine.id) ?? []
    : [];
  const recentSupplierChoices = Array.from(
    new Map(
      detail.partSources
        .filter((partSource) => partSource.selectedSupplierAccount)
        .map((partSource) => [
          partSource.selectedSupplierAccount!.id,
          partSource.selectedSupplierAccount!
        ])
    ).values()
  )
    .filter((supplierAccount) => supplierAccount.id !== partSourceForm.supplierAccountId)
    .slice(0, 4);
  const preferredOReillySupplier =
    detail.supplierAccounts.find((supplierAccount) =>
      /o['’]?reilly/i.test(supplierAccount.name)
    ) ?? null;
  const defaultLiveConnector = getEstimateLiveRetailerConnector("oreilly");
  const activeLiveConnector = liveRetailerState?.connector ?? defaultLiveConnector;
  const liveConnectorSearchLabel =
    activeLiveConnector.shortLabel === activeLiveConnector.label
      ? `Search ${activeLiveConnector.label}`
      : `Search ${activeLiveConnector.shortLabel.replace(/^Live\s+/i, "")}`;
  const liveConnectorBrowserLabel = activeLiveConnector.browserLabel ?? `Open ${activeLiveConnector.label}`;

  function beginPartSourcing(lineItem: EstimateLineItem, partSource: AssignedEstimatePartSource | null) {
    const nextCatalogOffers = catalogOffersByLineItemId.get(lineItem.id) ?? [];

    setPartSourceForm({
      ...buildPartSourceForm(partSource),
      lineItemId: lineItem.id
    });
    setLiveRetailerError(null);
    setLiveRetailerState(null);
    setLiveRetailerQuery(lineItem.name);
    setPartSourcingMode(hasSavedPartSource(partSource) ? "manual" : nextCatalogOffers.length ? "fitment" : "live");
  }

  function seedManualOReillySource() {
    const canonicalSupplierName = defaultLiveConnector.label;
    setPartSourcingMode("manual");
    setPartSourceForm((current) => ({
      ...current,
      supplierAccountId: preferredOReillySupplier?.id ?? current.supplierAccountId,
      supplierName: canonicalSupplierName,
      supplierUrl: preferredOReillySupplier?.externalUrl ?? current.supplierUrl
    }));
  }

  async function handleOpenOReillySearch() {
    const searchUrl =
      preferredOReillySupplier?.externalUrl?.trim() ||
      buildEstimateSupplierBrowserSearchUrl({
        connectorId: activeLiveConnector.id,
        query: liveRetailerQuery
      });

    if (!searchUrl) {
      setLiveRetailerError(
        `${activeLiveConnector.label} cannot be opened from this connector yet. Use manual supplier capture instead.`
      );
      return;
    }

    await openExternalUrl(
      searchUrl,
      `${activeLiveConnector.label} could not be opened on this device. Use the manual source fallback instead.`
    );
  }

  async function handleSaveDraft() {
    if (!estimateContext || !draftForm || !detail) return;
    const activeDetail = detail;

    if (!draftForm.title.trim() || !draftForm.estimateNumber.trim()) {
      setFlash({
        body: "Estimate number and title are required before the draft can be saved.",
        title: "Missing estimate details",
        tone: "warning"
      });
      return;
    }

    await runMutation(
      () =>
        saveAssignedJobEstimateDraft(estimateContext, activeDetail.estimate.id, {
          discountCents: activeDetail.estimate.discountCents,
          estimateNumber: draftForm.estimateNumber.trim(),
          notes: draftForm.notes.trim() || null,
          taxRateBasisPoints: activeDetail.estimate.taxRateBasisPoints,
          terms: draftForm.terms.trim() || null,
          title: draftForm.title.trim()
        }),
      { body: "The draft header is updated.", title: "Estimate saved", tone: "success" }
    );
  }

  async function handleSendForApproval() {
    if (!estimateContext || !detail || !draftForm) return;
    const activeDetail = detail;

    if (!activeDetail.lineItems.length) {
      setFlash({
        body: "Add at least one line item before sending this estimate for approval.",
        title: "Estimate is empty",
        tone: "warning"
      });
      return;
    }

    if (!draftForm.title.trim() || !draftForm.estimateNumber.trim()) {
      setFlash({
        body: "Estimate number and title are required before the estimate can be sent.",
        title: "Missing estimate details",
        tone: "warning"
      });
      return;
    }

    await runMutation(
      async () => {
        await saveAssignedJobEstimateDraft(estimateContext, activeDetail.estimate.id, {
          discountCents: activeDetail.estimate.discountCents,
          estimateNumber: draftForm.estimateNumber.trim(),
          notes: draftForm.notes.trim() || null,
          taxRateBasisPoints: activeDetail.estimate.taxRateBasisPoints,
          terms: draftForm.terms.trim() || null,
          title: draftForm.title.trim()
        });

        return changeAssignedJobEstimateStatus(estimateContext, activeDetail.estimate.id, {
          status: "sent"
        });
      },
      {
        body: "The estimate is sent and ready for customer approval from the stop.",
        title: "Estimate sent",
        tone: "success"
      }
    );
  }

  async function handleSaveLine() {
    if (!estimateContext || !detail) return;
    const activeDetail = detail;
    const quantity = parseQuantityInput(lineForm.quantity);
    const unitPriceCents = parseMoneyInput(lineForm.unitPrice);

    if (!lineForm.name.trim() || quantity === null || unitPriceCents === null) {
      setFlash({
        body: "Name, quantity, and unit price all need valid values before the line can be saved.",
        title: "Line item is incomplete",
        tone: "warning"
      });
      return;
    }

    await runMutation(
      () =>
        lineForm.id
          ? saveAssignedJobEstimateLineItem(estimateContext, lineForm.id, {
              description: lineForm.description.trim() || null,
              estimateSectionId: null,
              itemType: lineForm.itemType,
              name: lineForm.name.trim(),
              quantity,
              taxable: lineForm.taxable,
              unitPriceCents
            })
          : addAssignedJobEstimateLineItem(estimateContext, activeDetail.estimate.id, {
              description: lineForm.description.trim() || null,
              estimateSectionId: null,
              itemType: lineForm.itemType,
              name: lineForm.name.trim(),
              quantity,
              taxable: lineForm.taxable,
              unitPriceCents
            }),
      {
        body: lineForm.id ? "The estimate line was updated." : "The estimate line was added.",
        title: lineForm.id ? "Line saved" : "Line added",
        tone: "success"
      }
    );

    setLineForm(emptyLineForm(lineForm.itemType));
  }

  async function handleDeleteLine() {
    if (!estimateContext || !lineForm.id) return;

    await runMutation(
      () => removeAssignedJobEstimateLineItem(estimateContext, lineForm.id!),
      { body: "The estimate line was removed.", title: "Line removed", tone: "success" }
    );

    setLineForm(emptyLineForm());
  }

  async function handleSavePartSource() {
    if (!estimateContext || !detail || !partSourceForm.lineItemId) return;
    const selectedLineItemId = partSourceForm.lineItemId;
    const quotedUnitCostCents = parseMoneyInput(partSourceForm.quotedUnitCost);
    const coreChargeCents = parseMoneyInput(partSourceForm.coreCharge) ?? 0;

    if (!partSourceForm.supplierName.trim() || quotedUnitCostCents === null) {
      setFlash({
        body: "Supplier name and quoted unit cost are required before the part source can be saved.",
        title: "Part source is incomplete",
        tone: "warning"
      });
      return;
    }

    await runMutation(
      () =>
        saveAssignedJobEstimatePartSource(estimateContext, detail.estimate.id, {
          availabilityText: partSourceForm.availabilityText.trim() || null,
          coreChargeCents,
          lineItemId: selectedLineItemId,
          notes: partSourceForm.notes.trim() || null,
          quotedUnitCostCents,
          supplierAccountId: partSourceForm.supplierAccountId,
          supplierName: partSourceForm.supplierName.trim(),
          supplierPartNumber: partSourceForm.supplierPartNumber.trim() || null,
          supplierUrl: partSourceForm.supplierUrl.trim() || null
        }),
      {
        body:
          "The part source is saved to the estimate thread. Mark the stop waiting on parts from the workboard if the repair has to pause.",
        title: "Part source saved",
        tone: "success"
      }
    );

    setPartSourceForm(emptyPartSourceForm());
    setLiveRetailerState(null);
    setLiveRetailerError(null);
  }

  async function handleApplyCatalogOffer(offer: EstimateCatalogPartOfferSummary) {
    if (!estimateContext || !detail || !selectedSourceLine) return;

    await runMutation(
      () =>
        saveAssignedJobEstimatePartSource(estimateContext, detail.estimate.id, {
          availabilityText: offer.availabilityText,
          coreChargeCents: 0,
          lineItemId: selectedSourceLine.id,
          notes: offer.fitmentNotes,
          quotedUnitCostCents: offer.quotedUnitCostCents,
          supplierAccountId: offer.supplierAccountId,
          supplierName: offer.supplierLabel,
          supplierPartNumber: offer.partNumber,
          supplierUrl: offer.supplierUrl
        }),
      {
        body: "The fitment-backed catalog offer is now tied to this estimate part line.",
        title: "Catalog offer applied",
        tone: "success"
      }
    );

    setPartSourceForm(emptyPartSourceForm());
    setLiveRetailerState(null);
    setLiveRetailerError(null);
  }

  async function handleSearchLiveRetailer() {
    if (!estimateContext || !selectedSourceLine) return;

    setIsSearchingRetailer(true);
    setLiveRetailerError(null);

    try {
      const result = await searchAssignedJobEstimateLiveRetailerOffers(estimateContext, {
        lineItemId: selectedSourceLine.id,
        limit: 4,
        provider: defaultLiveConnector.provider ?? "oreilly",
        query: liveRetailerQuery.trim() || selectedSourceLine.name
      });

      setLiveRetailerState(result);
    } catch (error) {
      setLiveRetailerState(null);
      setLiveRetailerError(
        error instanceof Error ? error.message : "Live retailer lookup could not be completed."
      );
    } finally {
      setIsSearchingRetailer(false);
    }
  }

  async function handleApplyLiveRetailerOffer(offer: EstimateLiveRetailerPartOffer) {
    if (!estimateContext || !detail || !selectedSourceLine) return;

    await runMutation(
      () =>
        saveAssignedJobEstimatePartSource(estimateContext, detail.estimate.id, {
          availabilityText: offer.availabilityText,
          coreChargeCents: offer.quotedCoreChargeCents,
          lineItemId: selectedSourceLine.id,
          notes: offer.fitmentNotes,
          quotedUnitCostCents: offer.quotedUnitCostCents,
          supplierName: offer.supplierLabel,
          supplierPartNumber: offer.partNumber,
          supplierUrl: offer.supplierUrl
        }),
      {
        body: "The live retailer quote is saved against this estimate part line.",
        title: "Retailer offer applied",
        tone: "success"
      }
    );

    setPartSourceForm(emptyPartSourceForm());
    setLiveRetailerState(null);
    setLiveRetailerError(null);
  }

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <ScreenHeader
          actions={
            <Button fullWidth={false} onPress={() => router.replace(`/jobs/${jobId}`)} tone="secondary">
              Back to stop
            </Button>
          }
          badges={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <StatusBadge status={detail.estimate.status} />
              <Badge tone="info">{detail.estimate.estimateNumber}</Badge>
              {detail.pendingMutationCount ? (
                <Badge tone="warning">{`${detail.pendingMutationCount} queued`}</Badge>
              ) : null}
            </View>
          }
          description={`${getCustomerDisplayName(detail.customer)} · ${
            detail.vehicle.year ? `${detail.vehicle.year} ` : ""
          }${detail.vehicle.make} ${detail.vehicle.model}`}
          eyebrow="Estimate"
          title={detail.estimate.title}
        />

        {errorMessage ? (
          <Notice
            actions={
              <Button onPress={() => void handleRefresh()} tone="secondary">
                Retry refresh
              </Button>
            }
            body={errorMessage}
            title="Refresh failed"
            tone="danger"
          />
        ) : null}
        {flash ? <Notice body={flash.body} title={flash.title} tone={flash.tone} /> : null}
        {detail.pendingMutationCount ? (
          <Notice
            body={`${detail.pendingMutationCount} estimate change${
              detail.pendingMutationCount === 1 ? "" : "s"
            } are stored on this device and will flush automatically when the app reconnects.`}
            title="Offline queue"
            tone="warning"
          />
        ) : null}

        <SectionCard
          description="Use this route for quick pricing review. Live field actions like approval, billing, and stop status now run from the stop."
          eyebrow="Field mode"
          title="Stay in the field flow"
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button fullWidth={false} onPress={() => router.replace(`/jobs/${jobId}`)} tone="primary">
              Return to stop
            </Button>
            {isDraft ? (
              <Button
                fullWidth={false}
                onPress={() => setLineForm(emptyLineForm())}
                tone="secondary"
              >
                Add quick line
              </Button>
            ) : null}
            {isDraft && detail.lineItems.some((lineItem) => lineItem.itemType === "part") ? (
              <Button
                fullWidth={false}
                onPress={() => {
                  const nextPartLine =
                    detail.lineItems.find(
                      (lineItem) =>
                        lineItem.itemType === "part" &&
                        !detail.partSources.some(
                          (partSource) =>
                            partSource.lineItemId === lineItem.id && hasSavedPartSource(partSource)
                        )
                    ) ??
                    detail.lineItems.find((lineItem) => lineItem.itemType === "part");

                  if (!nextPartLine) {
                    return;
                  }

                  beginPartSourcing(
                    nextPartLine,
                    detail.partSources.find((partSource) => partSource.lineItemId === nextPartLine.id) ?? null
                  );
                }}
                tone="secondary"
              >
                Source next part
              </Button>
            ) : null}
          </View>
          {detail.estimate.status === "sent" ? (
            <Notice
              body="Customer approval now runs from the stop so the signature, approval, and next status change happen in one place."
              title="Finish approval from the stop"
              tone="warning"
            />
          ) : null}
          {detail.estimate.status === "accepted" ? (
            <Notice
              body="Billing and payment collection now run from the stop billing console so the closeout thread stays intact."
              title="Finish billing from the stop"
              tone="brand"
            />
          ) : null}
        </SectionCard>

        {isDraft ? (
          <ActionTile
            badge={<Badge tone="warning">Draft</Badge>}
            description="Keep pricing and sourcing in this screen until the office is ready to send approval."
            eyebrow="Field builder"
            onPress={() => void handleSaveDraft()}
            title="Save draft changes"
            tone="primary"
          />
        ) : null}

        {isDraft ? (
          <ActionTile
            badge={<Badge tone={detail.lineItems.length ? "info" : "warning"}>{detail.lineItems.length ? "Ready" : "Need pricing"}</Badge>}
            description={
              detail.lineItems.length
                ? "Send this estimate so the customer can sign from the stop and the field workflow can continue."
                : "Add at least one estimate line before sending this job into approval."
            }
            eyebrow="Approval handoff"
            onPress={() => void handleSendForApproval()}
            title="Send for approval"
            tone="primary"
          />
        ) : null}

        {detail.estimate.status === "sent" ? (
          <ActionTile
            badge={<Badge tone="warning">Approval needed</Badge>}
            description="Customer signature capture now lives on the stop so approval and the next job status stay together."
            eyebrow="Next action"
            onPress={() => router.replace(`/jobs/${jobId}`)}
            title="Finish approval from stop"
            tone="primary"
          />
        ) : null}

        {detail.estimate.status === "accepted" ? (
          <ActionTile
            badge={<Badge tone="success">Approved</Badge>}
            description="Customer approval is complete. Use the stop billing console for invoice issue, payment, and closeout so you do not bounce between screens."
            eyebrow="Next action"
            onPress={() => router.replace(`/jobs/${jobId}`)}
            title="Return to stop billing"
            tone="primary"
          />
        ) : null}

        {isDraft ? (
          <SectionCard
            description="Keep the customer-facing draft header light here. Optional notes and terms stay collapsed until you need them."
            eyebrow="Draft"
            title="Estimate header"
          >
            <Field label="Estimate number">
              <Input
                autoCapitalize="characters"
                onChangeText={(value) =>
                  setDraftForm((current) =>
                    current ? { ...current, estimateNumber: value } : current
                  )
                }
                value={draftForm?.estimateNumber ?? ""}
              />
            </Field>
            <Field label="Estimate title">
              <Input
                onChangeText={(value) =>
                  setDraftForm((current) => (current ? { ...current, title: value } : current))
                }
                value={draftForm?.title ?? ""}
              />
              <DictationButton
                contextualStrings={mergeDictationContext(estimatePhrases, mechanicActionPhrases)}
                label="Dictate title"
                onChangeText={(value) =>
                  setDraftForm((current) => (current ? { ...current, title: value } : current))
                }
                value={draftForm?.title ?? ""}
              />
            </Field>
            <Button
              fullWidth={false}
              onPress={() => setShowDraftHeaderDetails((current) => !current)}
              tone="tertiary"
            >
              {showDraftHeaderDetails ? "Hide notes + terms" : "Show notes + terms"}
            </Button>
            {showDraftHeaderDetails ? (
              <>
                <Field label="Estimate notes">
                  <Input
                    multiline
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, notes: value } : current))
                    }
                    style={{ minHeight: 96, textAlignVertical: "top" }}
                    value={draftForm?.notes ?? ""}
                  />
                  <DictationButton
                    contextualStrings={mergeDictationContext(mechanicActionPhrases)}
                    label="Dictate notes"
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, notes: value } : current))
                    }
                    value={draftForm?.notes ?? ""}
                  />
                </Field>
                <Field label="Estimate terms">
                  <Input
                    multiline
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, terms: value } : current))
                    }
                    style={{ minHeight: 96, textAlignVertical: "top" }}
                    value={draftForm?.terms ?? ""}
                  />
                  <DictationButton
                    contextualStrings={mergeDictationContext(["payment due on completion", "parts and labor warranty", "return visit pending parts"], mechanicActionPhrases)}
                    label="Dictate terms"
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, terms: value } : current))
                    }
                    value={draftForm?.terms ?? ""}
                  />
                </Field>
              </>
            ) : null}
            <Button loading={isMutating} onPress={() => void handleSaveDraft()}>
              Save draft details
            </Button>
          </SectionCard>
        ) : null}

        <SectionCard
          description="Keep totals and approval state clear before walking through approval with the customer."
          eyebrow="Estimate totals"
          title="Summary"
        >
          <DetailRow label="Status" value={<StatusBadge status={detail.estimate.status} />} />
          <DetailRow
            label="Subtotal"
            value={formatCurrencyFromCents(detail.totals.subtotalCents, detail.estimate.currencyCode)}
          />
          <DetailRow
            label="Discount"
            value={formatCurrencyFromCents(detail.totals.discountCents, detail.estimate.currencyCode)}
          />
          <DetailRow
            label="Tax"
            value={formatCurrencyFromCents(detail.totals.taxCents, detail.estimate.currencyCode)}
          />
          <Notice
            body={formatCurrencyFromCents(detail.totals.totalCents, detail.estimate.currencyCode)}
            title="Total estimate"
            tone="brand"
          />
        </SectionCard>

        <SectionCard
          description="Review customer approval details before moving into invoicing or repair follow-up."
          eyebrow="Approval"
          title="Approval state"
        >
          {approvalComplete ? (
            <>
              <DetailRow label="Approved by" value={detail.estimate.approvedByName ?? "Customer"} />
              <DetailRow
                label="Approved at"
                value={
                  detail.estimate.acceptedAt
                    ? formatDateTime(detail.estimate.acceptedAt, {
                        includeTimeZoneName: false,
                        timeZone: appContext?.company.timezone
                      })
                    : "Pending"
                }
              />
              <DetailRow
                label="Statement"
                value={detail.estimate.approvalStatement ?? "No approval statement recorded."}
              />
            </>
          ) : (
            <Notice
              body={
                detail.estimate.status === "sent"
                  ? "The estimate is waiting for customer approval. Capture the signature from the field when they are ready."
                  : "This estimate does not have a completed approval record yet."
              }
              tone={detail.estimate.status === "sent" ? "warning" : "brand"}
            />
          )}
        </SectionCard>

        {isDraft ? (
          <SectionCard
            description="Add quick flat lines from the field. Grouped estimate lines still belong to the office workspace for now."
            eyebrow="Draft pricing"
            title={lineForm.id ? "Edit line item" : "Add line item"}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["labor", "part", "fee"] as const).map((itemType) => (
                <Chip
                  key={itemType}
                  onPress={() => setLineForm((current) => ({ ...current, itemType }))}
                  selected={lineForm.itemType === itemType}
                  tone={lineForm.itemType === itemType ? "brand" : "neutral"}
                >
                  {formatDesignLabel(itemType)}
                </Chip>
              ))}
            </View>
            <Field label="Line name">
              <Input
                onChangeText={(value) => setLineForm((current) => ({ ...current, name: value }))}
                value={lineForm.name}
              />
              <DictationButton
                contextualStrings={mergeDictationContext(estimatePhrases)}
                label="Dictate line name"
                onChangeText={(value) => setLineForm((current) => ({ ...current, name: value }))}
                value={lineForm.name}
              />
            </Field>
            <Field label="Description">
              <Input
                multiline
                onChangeText={(value) =>
                  setLineForm((current) => ({ ...current, description: value }))
                }
                style={{ minHeight: 88, textAlignVertical: "top" }}
                value={lineForm.description}
              />
              <DictationButton
                contextualStrings={mergeDictationContext([lineForm.name], mechanicActionPhrases)}
                label="Dictate description"
                onChangeText={(value) =>
                  setLineForm((current) => ({ ...current, description: value }))
                }
                value={lineForm.description}
              />
            </Field>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 132 }}>
                <Field label="Quantity">
                  <Input
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setLineForm((current) => ({ ...current, quantity: value }))
                    }
                    value={lineForm.quantity}
                  />
                </Field>
              </View>
              <View style={{ flex: 1, minWidth: 132 }}>
                <Field label="Unit price">
                  <Input
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setLineForm((current) => ({ ...current, unitPrice: value }))
                    }
                    value={lineForm.unitPrice}
                  />
                </Field>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#6a655d", fontSize: 13, fontWeight: "700" }}>Taxable</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Chip
                  onPress={() => setLineForm((current) => ({ ...current, taxable: true }))}
                  selected={lineForm.taxable}
                  tone={lineForm.taxable ? "brand" : "neutral"}
                >
                  Taxable
                </Chip>
                <Chip
                  onPress={() => setLineForm((current) => ({ ...current, taxable: false }))}
                  selected={!lineForm.taxable}
                  tone={!lineForm.taxable ? "brand" : "neutral"}
                >
                  Non-taxable
                </Chip>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <Button loading={isMutating} onPress={() => void handleSaveLine()}>
                {lineForm.id ? "Save line" : "Add line"}
              </Button>
              <Button
                disabled={isMutating}
                onPress={() => setLineForm(lineForm.id ? emptyLineForm(lineForm.itemType) : emptyLineForm())}
                tone="secondary"
              >
                {lineForm.id ? "Cancel edit" : "Reset form"}
              </Button>
              {lineForm.id ? (
                <Button disabled={isMutating} onPress={() => void handleDeleteLine()} tone="danger">
                  Remove line
                </Button>
              ) : null}
            </View>
          </SectionCard>
        ) : null}

        {isDraft && partLines.length ? (
          <SectionCard
            description={`Choose a part line once, then source it with fitment matches, ${defaultLiveConnector.shortLabel}, or a manual supplier capture without leaving the estimate.`}
            eyebrow="Parts sourcing"
            title={selectedSourceLine ? `Source ${selectedSourceLine.name}` : "Part sourcing"}
          >
            {selectedSourceLine ? (
              <>
                {hasSavedPartSource(activePartSource) ? (
                  <Notice
                    body={buildSelectedSourceSummary(activePartSource, detail.estimate.currencyCode)}
                    title="Selected source"
                    tone="brand"
                  />
                ) : null}
                <Card tone="subtle">
                  <View style={{ gap: 12 }}>
                    <View style={{ gap: 8 }}>
                      <CardTitle>{selectedSourceLine.name}</CardTitle>
                      <CardCopy>
                        Move fast here: pick a source mode, capture an exact part, then save it back into the estimate line.
                      </CardCopy>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Chip
                          onPress={() => setPartSourcingMode("fitment")}
                          selected={partSourcingMode === "fitment"}
                          tone={partSourcingMode === "fitment" ? "brand" : "neutral"}
                        >
                          Fitment
                        </Chip>
                        <Chip
                          onPress={() => setPartSourcingMode("live")}
                          selected={partSourcingMode === "live"}
                          tone={partSourcingMode === "live" ? "brand" : "neutral"}
                        >
                          {defaultLiveConnector.shortLabel}
                        </Chip>
                        <Chip
                          onPress={() => setPartSourcingMode("manual")}
                          selected={partSourcingMode === "manual"}
                          tone={partSourcingMode === "manual" ? "brand" : "neutral"}
                        >
                          Manual / recent
                        </Chip>
                      </View>
                    </View>
                    {partSourcingMode === "fitment" ? (
                      activeCatalogOffers.length ? (
                        <View style={{ gap: 12 }}>
                          <Notice
                            body="These seeded fitment matches are the fastest path when the repair and vehicle already line up."
                            title="Suggested fits"
                            tone="brand"
                          />
                          {activeCatalogOffers.map((offer) => (
                            <Card key={offer.id} tone="subtle">
                              <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                  <Badge tone="info">{offer.supplierLabel}</Badge>
                                  <Badge tone="neutral">
                                    {formatCurrencyFromCents(
                                      offer.quotedUnitCostCents,
                                      detail.estimate.currencyCode
                                    )}
                                  </Badge>
                                </View>
                                <CardTitle>{offer.description}</CardTitle>
                                <CardCopy>{offer.partNumber}</CardCopy>
                                {offer.availabilityText ? <CardCopy>{offer.availabilityText}</CardCopy> : null}
                                {offer.fitmentNotes ? <CardCopy>{offer.fitmentNotes}</CardCopy> : null}
                                <Button
                                  fullWidth={false}
                                  loading={isMutating}
                                  onPress={() => void handleApplyCatalogOffer(offer)}
                                  tone="secondary"
                                >
                                  Use fitment offer
                                </Button>
                              </View>
                            </Card>
                          ))}
                        </View>
                      ) : (
                        <Notice
                          body={`No seeded fitment match is ready for this exact line. Switch to ${defaultLiveConnector.shortLabel} or manual supplier capture.`}
                          title="No fitment match"
                          tone="warning"
                        />
                      )
                    ) : null}
                    {partSourcingMode === "live" ? (
                      <View style={{ gap: 12 }}>
                        <Notice
                          body={`Search ${activeLiveConnector.label} directly from the phone, then drop the exact result into this estimate line.`}
                          title="Live supplier lookup"
                          tone="brand"
                        />
                        <Field label="Search query">
                          <Input onChangeText={setLiveRetailerQuery} value={liveRetailerQuery} />
                        </Field>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Button
                            fullWidth={false}
                            loading={isSearchingRetailer}
                            onPress={() => void handleSearchLiveRetailer()}
                          >
                            {liveConnectorSearchLabel}
                          </Button>
                          <Button
                            fullWidth={false}
                            disabled={isSearchingRetailer}
                            onPress={() => setLiveRetailerQuery(selectedSourceLine.name)}
                            tone="secondary"
                          >
                            Reset query
                          </Button>
                          <Button
                            fullWidth={false}
                            disabled={isSearchingRetailer}
                            onPress={() => void handleOpenOReillySearch()}
                            tone="tertiary"
                          >
                            {activeLiveConnector.supportsBrowserHandoff
                              ? "Open in browser"
                              : liveConnectorBrowserLabel}
                          </Button>
                        </View>
                        {liveRetailerError ? (
                          <Notice
                            actions={
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                <Button
                                  fullWidth={false}
                                  onPress={() => void handleOpenOReillySearch()}
                                  tone="primary"
                                >
                                  {liveConnectorBrowserLabel}
                                </Button>
                                <Button
                                  fullWidth={false}
                                  onPress={seedManualOReillySource}
                                  tone="secondary"
                                >
                                  {`Use ${activeLiveConnector.shortLabel.replace(/^Live\s+/i, "")} manually`}
                                </Button>
                              </View>
                            }
                            body={liveRetailerError}
                            title="Live lookup failed"
                            tone="danger"
                          />
                        ) : null}
                        {liveRetailerState ? (
                          liveRetailerState.offers.length ? (
                            <View style={{ gap: 12 }}>
                              <Notice
                                body={`Showing ${liveRetailerState.offers.length} ${liveRetailerState.providerLabel} results for ${liveRetailerState.query}.`}
                                title="Live results"
                                tone="brand"
                              />
                              {liveRetailerState.offers.map((offer) => (
                                <Card key={offer.id} tone="subtle">
                                  <View style={{ gap: 8 }}>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                      <Badge tone="info">{offer.supplierLabel}</Badge>
                                      <Badge tone="neutral">
                                        {formatCurrencyFromCents(
                                          offer.quotedUnitCostCents,
                                          detail.estimate.currencyCode
                                        )}
                                      </Badge>
                                      {offer.quotedCoreChargeCents ? (
                                        <Badge tone="warning">
                                          {`Core ${formatCurrencyFromCents(
                                            offer.quotedCoreChargeCents,
                                            detail.estimate.currencyCode
                                          )}`}
                                        </Badge>
                                      ) : null}
                                    </View>
                                    <CardTitle>{offer.description}</CardTitle>
                                    <CardCopy>{offer.partNumber}</CardCopy>
                                    {offer.availabilityText ? <CardCopy>{offer.availabilityText}</CardCopy> : null}
                                    {offer.fitmentNotes ? <CardCopy>{offer.fitmentNotes}</CardCopy> : null}
                                    <Button
                                      fullWidth={false}
                                      loading={isMutating}
                                      onPress={() => void handleApplyLiveRetailerOffer(offer)}
                                      tone="secondary"
                                    >
                                      Use live offer
                                    </Button>
                                  </View>
                                </Card>
                              ))}
                            </View>
                          ) : (
                            <Notice
                              body={`No live ${activeLiveConnector.label} results matched yet. Tighten the query or switch to manual supplier capture.`}
                              title="No live results"
                              tone="warning"
                            />
                          )
                        ) : null}
                      </View>
                    ) : null}
                    {partSourcingMode === "manual" ? (
                      <Notice
                        body="Use this when the tech already has a supplier in mind, needs a local house account, or has to key in a quoted source manually."
                        title="Manual supplier capture"
                        tone="brand"
                      />
                    ) : null}
                  </View>
                </Card>
                {partSourcingMode === "manual" ? (
                  <>
                    <Field hint="Pick an existing supplier below or type a new supplier name." label="Supplier">
                      <Input
                        onChangeText={(value) =>
                          setPartSourceForm((current) => ({
                            ...current,
                            supplierAccountId: null,
                            supplierName: value
                          }))
                        }
                        value={partSourceForm.supplierName}
                      />
                    </Field>
                    {recentSupplierChoices.length ? (
                      <Field
                        hint="Reuse a supplier already chosen on another part line before typing a new source."
                        label="Recent suppliers"
                      >
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {recentSupplierChoices.map((supplierAccount) => (
                            <Chip
                              key={`recent-${supplierAccount.id}`}
                              onPress={() =>
                                setPartSourceForm((current) => ({
                                  ...current,
                                  supplierAccountId: supplierAccount.id,
                                  supplierName: supplierAccount.name,
                                  supplierUrl: supplierAccount.externalUrl ?? current.supplierUrl
                                }))
                              }
                              tone="brand"
                            >
                              {supplierAccount.name}
                            </Chip>
                          ))}
                        </View>
                      </Field>
                    ) : null}
                    {filteredSuppliers.length ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {filteredSuppliers.map((supplierAccount) => (
                          <Chip
                            key={supplierAccount.id}
                            onPress={() =>
                              setPartSourceForm((current) => ({
                                ...current,
                                supplierAccountId: supplierAccount.id,
                                supplierName: supplierAccount.name,
                                supplierUrl: supplierAccount.externalUrl ?? current.supplierUrl
                              }))
                            }
                            selected={partSourceForm.supplierAccountId === supplierAccount.id}
                            tone={partSourceForm.supplierAccountId === supplierAccount.id ? "brand" : "neutral"}
                          >
                            {supplierAccount.name}
                          </Chip>
                        ))}
                      </View>
                    ) : null}
                    <Field label="Supplier URL">
                      <Input
                        autoCapitalize="none"
                        keyboardType="url"
                        onChangeText={(value) =>
                          setPartSourceForm((current) => ({ ...current, supplierUrl: value }))
                        }
                        value={partSourceForm.supplierUrl}
                      />
                    </Field>
                    <Field label="Supplier part number">
                      <Input
                        autoCapitalize="characters"
                        onChangeText={(value) =>
                          setPartSourceForm((current) => ({ ...current, supplierPartNumber: value }))
                        }
                        value={partSourceForm.supplierPartNumber}
                      />
                    </Field>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      <View style={{ flex: 1, minWidth: 132 }}>
                        <Field label="Quoted unit cost">
                          <Input
                            keyboardType="decimal-pad"
                            onChangeText={(value) =>
                              setPartSourceForm((current) => ({ ...current, quotedUnitCost: value }))
                            }
                            value={partSourceForm.quotedUnitCost}
                          />
                        </Field>
                      </View>
                      <View style={{ flex: 1, minWidth: 132 }}>
                        <Field label="Core charge">
                          <Input
                            keyboardType="decimal-pad"
                            onChangeText={(value) =>
                              setPartSourceForm((current) => ({ ...current, coreCharge: value }))
                            }
                            value={partSourceForm.coreCharge}
                          />
                        </Field>
                      </View>
                    </View>
                    <Field label="Availability">
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {availabilityQuickChoices.map((choice) => (
                          <Chip
                            key={choice}
                            onPress={() =>
                              setPartSourceForm((current) => ({ ...current, availabilityText: choice }))
                            }
                            selected={partSourceForm.availabilityText === choice}
                            tone="brand"
                          >
                            {choice}
                          </Chip>
                        ))}
                      </View>
                    </Field>
                    <Field hint="Tap a quick availability state or type the supplier wording." label="Availability detail">
                      <Input
                        onChangeText={(value) =>
                          setPartSourceForm((current) => ({ ...current, availabilityText: value }))
                        }
                        value={partSourceForm.availabilityText}
                      />
                    </Field>
                    <Field label="Source notes">
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Chip
                          onPress={() =>
                            setPartSourceForm((current) => ({
                              ...current,
                              notes: "Best price option selected in field."
                            }))
                          }
                          selected={partSourceForm.notes === "Best price option selected in field."}
                          tone="brand"
                        >
                          Best price
                        </Chip>
                        <Chip
                          onPress={() =>
                            setPartSourceForm((current) => ({
                              ...current,
                              notes: "Fastest ETA selected for same-day repair."
                            }))
                          }
                          selected={partSourceForm.notes === "Fastest ETA selected for same-day repair."}
                          tone="brand"
                        >
                          Fastest ETA
                        </Chip>
                        <Chip
                          onPress={() =>
                            setPartSourceForm((current) => ({
                              ...current,
                              notes: "Part ordered for follow-up visit."
                            }))
                          }
                          selected={partSourceForm.notes === "Part ordered for follow-up visit."}
                          tone="brand"
                        >
                          Return visit
                        </Chip>
                      </View>
                    </Field>
                    <Field label="Source notes detail">
                      <Input
                        multiline
                        onChangeText={(value) =>
                          setPartSourceForm((current) => ({ ...current, notes: value }))
                        }
                        style={{ minHeight: 88, textAlignVertical: "top" }}
                        value={partSourceForm.notes}
                      />
                      <DictationButton
                        contextualStrings={mergeDictationContext(
                          [partSourceForm.supplierName, partSourceForm.supplierPartNumber],
                          sourcingPhrases,
                          mechanicActionPhrases
                        )}
                        label="Dictate source note"
                        onChangeText={(value) =>
                          setPartSourceForm((current) => ({ ...current, notes: value }))
                        }
                        value={partSourceForm.notes}
                      />
                    </Field>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      <Button loading={isMutating} onPress={() => void handleSavePartSource()}>
                        Save part source
                      </Button>
                      <Button
                        disabled={isMutating}
                        onPress={() => {
                          setPartSourceForm(emptyPartSourceForm());
                          setLiveRetailerState(null);
                          setLiveRetailerError(null);
                        }}
                        tone="secondary"
                      >
                        Cancel sourcing
                      </Button>
                    </View>
                  </>
                ) : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <Button
                      fullWidth={false}
                      disabled={isMutating}
                      onPress={() => setPartSourcingMode("manual")}
                      tone="secondary"
                    >
                      Enter manual source
                    </Button>
                    <Button
                      fullWidth={false}
                      disabled={isMutating}
                      onPress={() => {
                        setPartSourceForm(emptyPartSourceForm());
                        setLiveRetailerState(null);
                        setLiveRetailerError(null);
                      }}
                      tone="tertiary"
                    >
                      Cancel sourcing
                    </Button>
                  </View>
                )}
              </>
            ) : (
              <Notice
                body="Tap Source part on any estimate part line below. This keeps the mechanic inside one estimate screen instead of bouncing between disconnected procurement pages."
                title="Choose a part line"
                tone="warning"
              />
            )}
          </SectionCard>
        ) : null}

        <SectionCard
          description="Review the labor, parts, and fee items that make up this estimate."
          eyebrow="Line items"
          title="Estimate items"
        >
          {detail.lineItems.length ? (
            <View style={{ gap: 12 }}>
              {detail.lineItems.map((lineItem) => {
                const isGrouped = Boolean(lineItem.estimateSectionId);
                const canEditLine = isDraft && !isGrouped;
                const partSource = partSourceByLineItemId.get(lineItem.id) ?? null;

                return (
                  <Card key={lineItem.id} tone="subtle">
                    <View style={{ gap: 12 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Badge tone="info">{formatDesignLabel(lineItem.itemType)}</Badge>
                        <Badge tone="neutral">{`Qty ${formatQuantity(lineItem.quantity)}`}</Badge>
                        {isGrouped ? <Badge tone="warning">Grouped</Badge> : null}
                      </View>
                      <CardTitle>{lineItem.name}</CardTitle>
                      {lineItem.description ? <CardCopy>{lineItem.description}</CardCopy> : null}
                      <DetailRow
                        label="Line total"
                        value={formatCurrencyFromCents(lineItem.lineSubtotalCents, detail.estimate.currencyCode)}
                      />
                      {lineItem.itemType === "part" ? (
                        <Notice
                          body={buildSelectedSourceSummary(partSource, detail.estimate.currencyCode)}
                          title={hasSavedPartSource(partSource) ? "Selected source" : "Parts sourcing"}
                          tone={hasSavedPartSource(partSource) ? "brand" : "warning"}
                        />
                      ) : null}
                      {canEditLine ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                          <Button fullWidth={false} onPress={() => setLineForm(buildLineForm(lineItem))} tone="secondary">
                            Edit line
                          </Button>
                          {lineItem.itemType === "part" ? (
                              <Button
                                fullWidth={false}
                                onPress={() => beginPartSourcing(lineItem, partSource)}
                                tone="secondary"
                              >
                                {hasSavedPartSource(partSource) ? "Edit source" : "Source part"}
                              </Button>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : (
            <EmptyState body="No estimate line items have been added yet." eyebrow="Line items" title="No estimate items" />
          )}
          {groupedLineCount ? (
            <Notice
              body={`${groupedLineCount} grouped line${groupedLineCount === 1 ? "" : "s"} came from the office workspace. This mobile draft editor only changes flat lines for now.`}
              title="Grouped lines are read-only here"
              tone="warning"
            />
          ) : null}
        </SectionCard>
      </ScreenScrollView>
    </Screen>
  );
}
