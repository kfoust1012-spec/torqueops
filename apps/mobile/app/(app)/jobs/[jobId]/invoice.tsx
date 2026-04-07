import {
  canInvoiceAcceptPayments,
  formatCurrencyFromCents,
  formatDateTime,
  formatDesignLabel,
  getCustomerDisplayName
} from "@mobile-mechanic/core";
import type {
  CreateTechnicianPaymentHandoffInput,
  InvoiceLineItem,
  InvoiceLineItemType,
  TechnicianPaymentHandoffKind,
  TechnicianPaymentTenderType
} from "@mobile-mechanic/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, RefreshControl, View } from "react-native";

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
} from "../../../../src/components/ui";
import {
  addAssignedJobInvoiceLineItem,
  type AssignedInvoiceActionName,
  createAssignedJobInvoiceDraft,
  recordAssignedJobManualPayment,
  createAssignedJobPaymentHandoff,
  loadAssignedJobInvoice,
  loadAssignedJobPaymentHandoffs,
  removeAssignedJobInvoiceLineItem,
  runAssignedJobInvoiceAction,
  saveAssignedJobInvoiceDraft,
  saveAssignedJobInvoiceLineItem,
  type AssignedTechnicianPaymentHandoff
} from "../../../../src/features/invoices/api";
import {
  billingPhrases,
  estimatePhrases,
  mechanicActionPhrases,
  mergeDictationContext,
  paymentPhrases
} from "../../../../src/features/voice/dictation-context";
import type { MobileAppContext } from "../../../../src/lib/app-context";
import { useSessionContext } from "../../../../src/providers/session-provider";

type InvoiceDetailData = Awaited<ReturnType<typeof loadAssignedJobInvoice>> | null;
type PaymentHandoffListData = Awaited<ReturnType<typeof loadAssignedJobPaymentHandoffs>>;
type DraftForm = {
  discount: string;
  invoiceNumber: string;
  notes: string;
  taxRate: string;
  terms: string;
  title: string;
};
type LineForm = {
  description: string;
  id: string | null;
  itemType: InvoiceLineItemType;
  name: string;
  quantity: string;
  taxable: boolean;
  unitPrice: string;
};

const paymentHandoffKindOptions: Array<{
  description: string;
  kind: TechnicianPaymentHandoffKind;
  label: string;
}> = [
  {
    description: "Customer could not finish payment and the office needs to continue collection.",
    kind: "follow_up_required",
    label: "Need follow-up"
  },
  {
    description: "Customer asked for the payment link or invoice to be sent again after the visit.",
    kind: "resend_link",
    label: "Resend link"
  },
  {
    description: "Customer said they will complete payment later.",
    kind: "promised_to_pay_later",
    label: "Pays later"
  },
  {
    description: "Customer gave cash or check in the field and office reconciliation is needed.",
    kind: "manual_tender",
    label: "Manual tender"
  },
  {
    description: "Use this when billing follow-up does not fit the standard field outcomes.",
    kind: "other",
    label: "Other"
  }
];

const manualTenderTypeOptions: Array<{
  label: string;
  value: TechnicianPaymentTenderType;
}> = [
  { label: "Cash", value: "cash" },
  { label: "Check", value: "check" },
  { label: "Other", value: "other" }
];

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

function formatPercentInput(basisPoints: number) {
  const percent = basisPoints / 100;
  return Number.isInteger(percent) ? `${percent}` : percent.toFixed(2);
}

function parsePercentInput(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function parseQuantityInput(value: string) {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildDraftForm(detail: NonNullable<InvoiceDetailData>): DraftForm {
  return {
    discount: formatMoneyInput(detail.invoice.discountCents),
    invoiceNumber: detail.invoice.invoiceNumber,
    notes: detail.invoice.notes ?? "",
    taxRate: formatPercentInput(detail.invoice.taxRateBasisPoints),
    terms: detail.invoice.terms ?? "",
    title: detail.invoice.title
  };
}

function emptyLineForm(itemType: InvoiceLineItemType = "labor"): LineForm {
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

function buildLineForm(lineItem: InvoiceLineItem): LineForm {
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

function formatPaymentHandoffKindLabel(kind: TechnicianPaymentHandoffKind) {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTenderTypeLabel(tenderType: TechnicianPaymentTenderType) {
  return tenderType.charAt(0).toUpperCase() + tenderType.slice(1);
}

function getPaymentHandoffBadgeTone(handoff: AssignedTechnicianPaymentHandoff) {
  if (handoff.pendingSync) {
    return "warning" as const;
  }

  if (handoff.kind === "manual_tender") {
    return "info" as const;
  }

  if (handoff.kind === "follow_up_required" || handoff.kind === "other") {
    return "warning" as const;
  }

  return "info" as const;
}

function buildAmountPresetChoices(balanceDueCents: number) {
  if (balanceDueCents <= 0) {
    return [] as Array<{ label: string; value: string }>;
  }

  const full = balanceDueCents / 100;
  const half = Math.max(0.01, Math.round(balanceDueCents / 2) / 100);

  return [
    { label: "Full balance", value: full.toFixed(2) },
    { label: "Half", value: half.toFixed(2) }
  ];
}

function buildManualPaymentNoteChoices(tenderType: TechnicianPaymentTenderType) {
  switch (tenderType) {
    case "check":
      return ["Check received in field.", "Check number recorded separately."] as const;
    case "other":
      return ["Customer paid in field.", "Manual tender collected in field."] as const;
    case "cash":
    default:
      return ["Cash collected in field.", "Paid in full during visit."] as const;
  }
}

function getInvoiceCollectionMessage(args: {
  balanceDueCents: number;
  hasPaymentUrl: boolean;
  status: string;
}) {
  if (args.status === "paid" || args.balanceDueCents <= 0) {
    return {
      body: "Payment collection is complete. No further customer payment action is needed from the field.",
      tone: "success" as const,
      title: "Payment complete"
    };
  }

  if (args.hasPaymentUrl) {
    return {
      body: "Use the live payment page when the customer is ready so the balance can be collected without leaving the technician workflow.",
      tone: "brand" as const,
      title: "Collect payment from the live page"
    };
  }

  if (args.status === "draft") {
    return {
      body: "The office still needs to issue this invoice before you can collect payment from the field.",
      tone: "warning" as const,
      title: "Invoice still needs to be issued"
    };
  }

  return {
    body: "A live customer payment page is not available right now. Ask the office to issue or refresh the payment link before collecting payment.",
    tone: "warning" as const,
    title: "Payment link unavailable"
  };
}

function isLikelyInvoiceActionConnectivityFailure(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("network")
  );
}

function buildOfflineInvoiceActionHandoff(
  action: AssignedInvoiceActionName,
  detail: NonNullable<InvoiceDetailData>
) {
  const balanceDueLabel = formatCurrencyFromCents(
    detail.totals.balanceDueCents,
    detail.invoice.currencyCode
  );

  switch (action) {
    case "issue_invoice":
      return {
        buttonLabel: "Queue office issue + send",
        handoff: {
          kind: "follow_up_required" as const,
          note: `Technician could not issue invoice ${detail.invoice.invoiceNumber} from the field. Office should issue it, send the customer link, and prep checkout if balance due remains ${balanceDueLabel}.`
        } satisfies CreateTechnicianPaymentHandoffInput,
        queuedBody:
          "The office issue-and-send request is stored on this device and will sync automatically when the connection is back.",
        queuedTitle: "Invoice issue request queued",
        successBody:
          "The office issue-and-send request is saved as a structured billing follow-up for this invoice.",
        successTitle: "Invoice issue request logged"
      } as const;
    case "refresh_payment_page":
      return {
        buttonLabel: "Queue payment-page follow-up",
        handoff: {
          kind: "resend_link" as const,
          note: `Technician needs office to refresh the payment page for invoice ${detail.invoice.invoiceNumber}. Customer still has ${balanceDueLabel} due.`
        } satisfies CreateTechnicianPaymentHandoffInput,
        queuedBody:
          "The payment-page follow-up request is stored on this device and will sync automatically when the connection is back.",
        queuedTitle: "Payment page request queued",
        successBody:
          "The payment-page follow-up is saved as a structured billing handoff for this invoice.",
        successTitle: "Payment page request logged"
      } as const;
    case "send_payment_reminder":
      return {
        buttonLabel: "Queue reminder follow-up",
        handoff: {
          kind: "resend_link" as const,
          note: `Technician needs office to send a payment reminder for invoice ${detail.invoice.invoiceNumber}. Customer still has ${balanceDueLabel} due.`
        } satisfies CreateTechnicianPaymentHandoffInput,
        queuedBody:
          "The payment reminder request is stored on this device and will sync automatically when the connection is back.",
        queuedTitle: "Payment reminder request queued",
        successBody:
          "The payment reminder request is saved as a structured billing handoff for this invoice.",
        successTitle: "Payment reminder request logged"
      } as const;
    case "send_invoice_link":
    default:
      return {
        buttonLabel: "Queue resend link",
        handoff: {
          kind: "resend_link" as const,
          note: `Technician needs office to resend invoice ${detail.invoice.invoiceNumber} to the customer from the field workflow.`
        } satisfies CreateTechnicianPaymentHandoffInput,
        queuedBody:
          "The resend-link request is stored on this device and will sync automatically when the connection is back.",
        queuedTitle: "Resend link request queued",
        successBody:
          "The resend-link request is saved as a structured billing handoff for this invoice.",
        successTitle: "Resend link request logged"
      } as const;
  }
}

export default function JobInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : params.jobId?.[0] ?? null;
  const { appContext, refreshAppContext } = useSessionContext();
  const [detail, setDetail] = useState<InvoiceDetailData>(null);
  const [paymentHandoffs, setPaymentHandoffs] = useState<PaymentHandoffListData>([]);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [lineForm, setLineForm] = useState<LineForm>(() => emptyLineForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingLineItem, setIsSavingLineItem] = useState(false);
  const [isRemovingLineItemId, setIsRemovingLineItemId] = useState<string | null>(null);
  const [isSubmittingManualPayment, setIsSubmittingManualPayment] = useState(false);
  const [isSubmittingHandoff, setIsSubmittingHandoff] = useState(false);
  const [activeInvoiceAction, setActiveInvoiceAction] = useState<
    "issue_invoice" | "refresh_payment_page" | "send_invoice_link" | "send_payment_reminder" | null
  >(null);
  const [selectedHandoffKind, setSelectedHandoffKind] =
    useState<TechnicianPaymentHandoffKind>("follow_up_required");
  const [selectedTenderType, setSelectedTenderType] =
    useState<TechnicianPaymentTenderType>("cash");
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [selectedManualPaymentTenderType, setSelectedManualPaymentTenderType] =
    useState<TechnicianPaymentTenderType>("cash");
  const [manualPaymentAmountInput, setManualPaymentAmountInput] = useState("");
  const [manualPaymentNote, setManualPaymentNote] = useState("");
  const [showDraftAdminDetails, setShowDraftAdminDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    body: string;
    title: string;
    tone: "danger" | "success" | "warning";
  } | null>(null);

  useEffect(() => {
    if (!detail) {
      setDraftForm(null);
      setLineForm(emptyLineForm());
      return;
    }

    setDraftForm(buildDraftForm(detail));
    setLineForm(emptyLineForm());

    if (!manualPaymentAmountInput.trim() && detail.totals.balanceDueCents > 0) {
      setManualPaymentAmountInput((detail.totals.balanceDueCents / 100).toFixed(2));
    }
  }, [detail]);

  const loadInvoice = useCallback(
    async (context: MobileAppContext | null = appContext) => {
      if (!context || !jobId) {
        return;
      }

      const invoiceResult = await loadAssignedJobInvoice(context.companyId, context.userId, jobId);
      const handoffResult = invoiceResult ? await loadAssignedJobPaymentHandoffs(jobId) : [];
      setDetail(invoiceResult);
      setPaymentHandoffs(handoffResult);
    },
    [appContext, jobId]
  );

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!jobId) {
        setErrorMessage("This invoice route is invalid.");
        setIsLoading(false);
        return;
      }

      if (!appContext) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const invoiceResult = await loadAssignedJobInvoice(appContext.companyId, appContext.userId, jobId);
        const handoffResult = invoiceResult ? await loadAssignedJobPaymentHandoffs(jobId) : [];

        if (!isMounted) {
          return;
        }

        setDetail(invoiceResult);
        setPaymentHandoffs(handoffResult);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to load invoice summary.";
        setErrorMessage(message);

        if (message.toLowerCase().includes("assigned job not found")) {
          router.replace("/jobs");
          return;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, [appContext, jobId, router]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const nextContext = await refreshAppContext();
      await loadInvoice(nextContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh invoice summary.";
      setErrorMessage(message);

      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return;
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreateInvoiceDraft() {
    if (!appContext || !jobId) {
      return;
    }

    setIsCreatingInvoice(true);
    setNotice(null);
    setErrorMessage(null);

    try {
      console.info("[job-invoice] create draft started", { jobId });
      const result = await createAssignedJobInvoiceDraft(jobId);
      await loadInvoice(appContext);
      console.info("[job-invoice] create draft finished", {
        jobId,
        invoiceId: result.invoiceId,
        queued: result.queued
      });
      setNotice({
        body: result.message,
        title: result.title,
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      console.error("[job-invoice] create draft failed", { jobId, error });
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The invoice draft could not be created.",
        title: "Invoice create failed",
        tone: "danger"
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  async function handleSaveInvoiceDraft() {
    if (!appContext || !jobId || !detail || !draftForm) {
      return;
    }

    setIsSavingDraft(true);
    setNotice(null);

    try {
      const taxRateBasisPoints = parsePercentInput(draftForm.taxRate);
      const discountCents = parseMoneyInput(draftForm.discount);

      if (taxRateBasisPoints === null) {
        throw new Error("Enter a valid tax rate.");
      }

      if (discountCents === null) {
        throw new Error("Enter a valid discount.");
      }

      const result = await saveAssignedJobInvoiceDraft(jobId, {
        discountCents,
        invoiceNumber: draftForm.invoiceNumber,
        notes: draftForm.notes.trim() || null,
        taxRateBasisPoints,
        terms: draftForm.terms.trim() || null,
        title: draftForm.title
      });
      await loadInvoice(appContext);
      setNotice({
        body: result.queued
          ? "The invoice draft is stored on this device and will sync automatically when the connection is back."
          : "The invoice draft was updated from the field workflow.",
        title: result.queued ? "Invoice draft queued" : "Invoice draft saved",
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The invoice draft could not be updated.",
        title: "Invoice save failed",
        tone: "danger"
      });
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleSaveLineItem() {
    if (!appContext || !jobId || !detail) {
      return;
    }

    setIsSavingLineItem(true);
    setNotice(null);

    try {
      const quantity = parseQuantityInput(lineForm.quantity);
      const unitPriceCents = parseMoneyInput(lineForm.unitPrice);

      if (!quantity) {
        throw new Error("Enter a valid quantity.");
      }

      if (unitPriceCents === null) {
        throw new Error("Enter a valid unit price.");
      }

      const payload = {
        description: lineForm.description.trim() || null,
        itemType: lineForm.itemType,
        name: lineForm.name,
        quantity,
        taxable: lineForm.taxable,
        unitPriceCents
      } as const;

      const result = lineForm.id
        ? await saveAssignedJobInvoiceLineItem(jobId, lineForm.id, payload)
        : await addAssignedJobInvoiceLineItem(jobId, payload);

      await loadInvoice(appContext);
      setLineForm(emptyLineForm());
      setNotice({
        body: result.queued
          ? "The invoice line item is stored on this device and will sync automatically when the connection is back."
          : "The invoice line item is saved.",
        title: result.queued
          ? lineForm.id
            ? "Line item update queued"
            : "Line item queued"
          : lineForm.id
            ? "Line item updated"
            : "Line item added",
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The invoice line item could not be saved.",
        title: "Line item save failed",
        tone: "danger"
      });
    } finally {
      setIsSavingLineItem(false);
    }
  }

  async function handleRemoveLineItem(lineItemId: string) {
    if (!appContext || !jobId) {
      return;
    }

    setIsRemovingLineItemId(lineItemId);
    setNotice(null);

    try {
      const result = await removeAssignedJobInvoiceLineItem(jobId, lineItemId);
      await loadInvoice(appContext);
      if (lineForm.id === lineItemId) {
        setLineForm(emptyLineForm());
      }
      setNotice({
        body: result.queued
          ? "The line item removal is stored on this device and will sync automatically when the connection is back."
          : "The invoice line item was removed from the draft.",
        title: result.queued ? "Line item removal queued" : "Line item removed",
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The invoice line item could not be removed.",
        title: "Line item remove failed",
        tone: "danger"
      });
    } finally {
      setIsRemovingLineItemId(null);
    }
  }

  async function handleSubmitPaymentHandoff() {
    if (!appContext || !jobId) {
      return;
    }

    const note = paymentNote.trim();
    let payload: CreateTechnicianPaymentHandoffInput;

    try {
      payload =
        selectedHandoffKind === "manual_tender"
          ? {
              amountCents: Math.round(Number(paymentAmountInput.trim()) * 100),
              kind: selectedHandoffKind,
              note: note || null,
              tenderType: selectedTenderType
            }
          : {
              kind: selectedHandoffKind,
              note: note || null
            };
    } catch {
      setNotice({
        body: "The payment handoff details are invalid.",
        title: "Payment handoff failed",
        tone: "danger"
      });
      return;
    }

    setIsSubmittingHandoff(true);
    setNotice(null);

    try {
      if (
        selectedHandoffKind === "manual_tender" &&
        (!Number.isFinite(Number(paymentAmountInput.trim())) || Number(paymentAmountInput.trim()) <= 0)
      ) {
        throw new Error("Enter the collected amount before recording a manual tender handoff.");
      }

      if (selectedHandoffKind === "other" && !note) {
        throw new Error("Add a note describing the billing handoff.");
      }

      const result = await createAssignedJobPaymentHandoff(
        appContext.userId,
        jobId,
        payload
      );
      const refreshedHandoffs = await loadAssignedJobPaymentHandoffs(jobId);

      setPaymentHandoffs(refreshedHandoffs);
      setSelectedHandoffKind("follow_up_required");
      setSelectedTenderType("cash");
      setPaymentAmountInput(
        detail?.totals.balanceDueCents
          ? (detail.totals.balanceDueCents / 100).toFixed(2)
          : ""
      );
      setPaymentNote("");
      setNotice(
        result.queued
          ? {
              body: "The structured payment handoff is stored on this device and will sync automatically when the connection is back.",
              title: "Payment handoff queued",
              tone: "warning"
            }
          : {
              body: "The payment handoff is saved as a structured billing record for this invoice.",
              title: "Payment handoff recorded",
              tone: "success"
            }
      );
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The payment handoff could not be saved.",
        title: "Payment handoff failed",
        tone: "danger"
      });
    } finally {
      setIsSubmittingHandoff(false);
    }
  }

  async function handleRecordManualPayment() {
    if (!appContext || !jobId || !detail) {
      return;
    }

    const amount = Number(manualPaymentAmountInput.trim());
    const note = manualPaymentNote.trim();

    setIsSubmittingManualPayment(true);
    setNotice(null);

    try {
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter the collected amount before recording the field payment.");
      }

      const result = await recordAssignedJobManualPayment(jobId, {
        amountCents: Math.round(amount * 100),
        note: note || null,
        tenderType: selectedManualPaymentTenderType
      });
      await loadInvoice(appContext);
      setManualPaymentAmountInput("");
      setManualPaymentNote("");
      setSelectedManualPaymentTenderType("cash");
      setNotice({
        body: result.queued
          ? "The field payment is stored on this device and will sync automatically when the connection is back."
          : "The payment was posted directly to the invoice ledger from the field workflow.",
        title: result.queued ? "Field payment queued" : "Field payment recorded",
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The field payment could not be recorded.",
        title: "Payment record failed",
        tone: "danger"
      });
    } finally {
      setIsSubmittingManualPayment(false);
    }
  }

  async function queueInvoiceActionHandoff(action: AssignedInvoiceActionName) {
    if (!appContext || !jobId || !detail) {
      return;
    }

    const fallback = buildOfflineInvoiceActionHandoff(action, detail);
    const result = await createAssignedJobPaymentHandoff(
      appContext.userId,
      jobId,
      fallback.handoff
    );
    const refreshedHandoffs = await loadAssignedJobPaymentHandoffs(jobId);

    setPaymentHandoffs(refreshedHandoffs);
    setNotice(
      result.queued
        ? {
            body: fallback.queuedBody,
            title: fallback.queuedTitle,
            tone: "warning"
          }
        : {
            body: fallback.successBody,
            title: fallback.successTitle,
            tone: "success"
          }
    );
  }

  async function handleInvoiceAction(action: AssignedInvoiceActionName) {
    if (!appContext || !jobId || !detail) {
      return;
    }

    setActiveInvoiceAction(action);
    setNotice(null);
    setErrorMessage(null);

    try {
      if (detail.isCached) {
        await queueInvoiceActionHandoff(action);
        return;
      }

      const result = await runAssignedJobInvoiceAction(jobId, action);
      await loadInvoice(appContext);
      setNotice({
        body: result.message,
        title: result.title,
        tone: result.tone
      });

      if (action === "refresh_payment_page" && result.checkoutUrl) {
        await Linking.openURL(result.checkoutUrl);
      }
    } catch (error) {
      if (isLikelyInvoiceActionConnectivityFailure(error)) {
        try {
          await queueInvoiceActionHandoff(action);
          return;
        } catch (fallbackError) {
          setNotice({
            body:
              fallbackError instanceof Error
                ? fallbackError.message
                : "The billing follow-through request could not be recorded.",
            title: "Invoice action follow-up failed",
            tone: "danger"
          });
          return;
        }
      }

      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The invoice action could not be completed.",
        title: "Invoice action failed",
        tone: "danger"
      });
    } finally {
      setActiveInvoiceAction(null);
    }
  }

  if (isLoading) {
    return <LoadingState body="Loading the invoice summary for this assigned stop." title="Loading invoice" />;
  }

  if (!detail) {
    const canCreateInvoice = !errorMessage;

    return (
      <Screen>
        <ScreenScrollView contentContainerStyle={{ gap: 20 }}>
          {notice ? <Notice body={notice.body} title={notice.title} tone={notice.tone} /> : null}
          {canCreateInvoice ? (
            <EmptyState
              actions={
                <View style={{ gap: 12 }}>
                  <Button loading={isCreatingInvoice} onPress={() => void handleCreateInvoiceDraft()}>
                    Create invoice draft
                  </Button>
                  <Button
                    onPress={() => router.push(jobId ? `/jobs/${jobId}/estimate` : "/jobs")}
                    tone="secondary"
                  >
                    Open estimate
                  </Button>
                  <Button
                    onPress={() => router.replace(jobId ? `/jobs/${jobId}` : "/jobs")}
                    tone="tertiary"
                  >
                    Back to stop
                  </Button>
                </View>
              }
              body="Create the invoice from the current estimate so billing, payment collection, and closeout can stay on the phone."
              eyebrow="Stop invoice"
              title="Invoice not started yet"
            />
          ) : (
            <ErrorState
              actions={
                <View style={{ gap: 12 }}>
                  <Button onPress={() => void handleRefresh()}>Retry</Button>
                  <Button onPress={() => router.replace(jobId ? `/jobs/${jobId}` : "/jobs")} tone="secondary">
                    Back to stop
                  </Button>
                </View>
              }
              body={errorMessage}
              eyebrow="Stop invoice"
              title="Invoice unavailable"
            />
          )}
        </ScreenScrollView>
      </Screen>
    );
  }

  const collectionMessage = getInvoiceCollectionMessage({
    balanceDueCents: detail.totals.balanceDueCents,
    hasPaymentUrl: Boolean(detail.invoice.paymentUrl),
    status: detail.invoice.status
  });
  const pendingInvoiceMutationCount = detail.pendingInvoiceMutationCount ?? 0;
  const pendingManualPaymentCount = Math.max(
    detail.pendingManualPaymentCount ?? 0,
    detail.payments.filter((payment) => payment.pendingSync).length
  );
  const pendingPaymentHandoffCount = paymentHandoffs.filter((handoff) => handoff.pendingSync).length;
  const isManualTender = selectedHandoffKind === "manual_tender";
  const canCollectPayment =
    canInvoiceAcceptPayments(detail.invoice.status) && detail.totals.balanceDueCents > 0;
  const canSendInvoiceLink = ["issued", "partially_paid", "paid"].includes(detail.invoice.status);
  const liveBillingActionsDisabled = detail.isCached === true;
  const handoffOption = paymentHandoffKindOptions.find(
    (option) => option.kind === selectedHandoffKind
  );
  const amountPresetChoices = buildAmountPresetChoices(detail.totals.balanceDueCents);
  const manualPaymentNoteChoices = buildManualPaymentNoteChoices(selectedManualPaymentTenderType);
  const handoffNoteChoices = buildManualPaymentNoteChoices(selectedTenderType);

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
              <StatusBadge status={detail.invoice.status} />
              <Badge tone="info">{detail.invoice.invoiceNumber}</Badge>
            </View>
          }
          description={`${getCustomerDisplayName(detail.customer)} · ${
            detail.vehicle.year ? `${detail.vehicle.year} ` : ""
          }${detail.vehicle.make} ${detail.vehicle.model}`}
          eyebrow="Invoice"
          title={detail.invoice.title}
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
        {notice ? <Notice body={notice.body} title={notice.title} tone={notice.tone} /> : null}
        {detail.isCached ? (
          <Notice
            body={`This screen is showing the last synced invoice copy${
              detail.cachedAt
                ? ` from ${formatDateTime(detail.cachedAt, {
                    includeTimeZoneName: false,
                    timeZone: appContext?.company.timezone
                  })}`
                : ""
            }. Payment totals and link availability may be stale until the app reconnects.`}
            title="Offline invoice copy"
            tone="warning"
          />
        ) : null}
        {pendingInvoiceMutationCount ? (
          <Notice
            body={`${pendingInvoiceMutationCount} invoice draft change${
              pendingInvoiceMutationCount === 1 ? "" : "s"
            } ${pendingInvoiceMutationCount === 1 ? "is" : "are"} stored on this device and will sync automatically when the connection is back.`}
            title="Invoice draft queue"
            tone="warning"
          />
        ) : null}
        {pendingManualPaymentCount ? (
          <Notice
            body={`${pendingManualPaymentCount} field payment${
              pendingManualPaymentCount === 1 ? "" : "s"
            } ${pendingManualPaymentCount === 1 ? "is" : "are"} stored on this device and will sync automatically when the connection is back.`}
            title="Field payment queue"
            tone="warning"
          />
        ) : null}
        {pendingPaymentHandoffCount ? (
          <Notice
            body={`${pendingPaymentHandoffCount} payment handoff${
              pendingPaymentHandoffCount === 1 ? "" : "s"
            } ${pendingPaymentHandoffCount === 1 ? "is" : "are"} stored on this device and will sync automatically when the connection is back.`}
            title="Payment handoff queue"
            tone="warning"
          />
        ) : null}

        <SectionCard
          description="Use this route for review and draft cleanup. Live payment collection, handoff decisions, and closeout run faster from the stop billing console."
          eyebrow="Field mode"
          title="Stay in the billing flow"
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button fullWidth={false} onPress={() => router.replace(`/jobs/${jobId}`)} tone="primary">
              Return to stop
            </Button>
            {canCollectPayment ? (
              <Button fullWidth={false} onPress={() => router.replace(`/jobs/${jobId}`)} tone="secondary">
                Open billing console
              </Button>
            ) : null}
            {detail.invoice.status === "draft" ? (
              <Button fullWidth={false} onPress={() => setLineForm(emptyLineForm())} tone="secondary">
                Add quick line
              </Button>
            ) : null}
          </View>
          {canCollectPayment ? (
            <Notice
              body="Payment collection and billing follow-up now belong on the stop so the mechanic can finish checkout and closeout from one screen."
              title="Use the stop for live checkout"
              tone="brand"
            />
          ) : null}
        </SectionCard>

        {detail.invoice.paymentUrl && detail.totals.balanceDueCents > 0 ? (
          <ActionTile
            badge={<Badge tone="info">Payment page</Badge>}
            description="Open the live customer payment page to collect or confirm payment while you are in the field."
            eyebrow="Payment"
            onPress={() => void Linking.openURL(detail.invoice.paymentUrl!)}
            title="Open payment page"
            tone="primary"
          />
        ) : null}

        <Notice
          body={collectionMessage.body}
          title={collectionMessage.title}
          tone={collectionMessage.tone}
        />

        {detail.invoice.status === "draft" && draftForm ? (
          <SectionCard
            description="Keep the draft header minimal on mobile. Tax, discount, notes, and terms stay collapsed until you actually need them."
            eyebrow="Draft editor"
            title="Invoice draft"
          >
            {detail.isCached ? (
              <Notice
                body="You can keep editing this cached draft. If live saving fails, the changes will stay queued on this device until the app reconnects."
                title="Draft edits can queue offline"
                tone="warning"
              />
            ) : null}

            <Field label="Invoice number">
              <Input
                onChangeText={(value) =>
                  setDraftForm((current) => (current ? { ...current, invoiceNumber: value } : current))
                }
                placeholder="INV-1001"
                placeholderTextColor="#9ca3af"
                value={draftForm.invoiceNumber}
              />
            </Field>

            <Field label="Title">
              <Input
                onChangeText={(value) =>
                  setDraftForm((current) => (current ? { ...current, title: value } : current))
                }
                placeholder="Completed repair invoice"
                placeholderTextColor="#9ca3af"
                value={draftForm.title}
              />
              <DictationButton
                contextualStrings={mergeDictationContext(billingPhrases, mechanicActionPhrases)}
                label="Dictate title"
                onChangeText={(value) =>
                  setDraftForm((current) => (current ? { ...current, title: value } : current))
                }
                value={draftForm.title}
              />
            </Field>
            <Button
              fullWidth={false}
              onPress={() => setShowDraftAdminDetails((current) => !current)}
              tone="tertiary"
            >
              {showDraftAdminDetails ? "Hide billing details" : "Show billing details"}
            </Button>
            {showDraftAdminDetails ? (
              <>
                <Field label="Tax rate (%)">
                  <Input
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, taxRate: value } : current))
                    }
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={draftForm.taxRate}
                  />
                </Field>

                <Field label="Discount ($)">
                  <Input
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, discount: value } : current))
                    }
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={draftForm.discount}
                  />
                </Field>

                <Field label="Notes">
                  <Input
                    multiline
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, notes: value } : current))
                    }
                    placeholder="Invoice notes or completion summary."
                    placeholderTextColor="#9ca3af"
                    value={draftForm.notes}
                  />
                  <DictationButton
                    contextualStrings={mergeDictationContext(mechanicActionPhrases, paymentPhrases)}
                    label="Dictate notes"
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, notes: value } : current))
                    }
                    value={draftForm.notes}
                  />
                </Field>

                <Field label="Terms">
                  <Input
                    multiline
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, terms: value } : current))
                    }
                    placeholder="Payment terms and service terms."
                    placeholderTextColor="#9ca3af"
                    value={draftForm.terms}
                  />
                  <DictationButton
                    contextualStrings={mergeDictationContext(billingPhrases, paymentPhrases)}
                    label="Dictate terms"
                    onChangeText={(value) =>
                      setDraftForm((current) => (current ? { ...current, terms: value } : current))
                    }
                    value={draftForm.terms}
                  />
                </Field>
              </>
            ) : null}

            <Button
              loading={isSavingDraft}
              onPress={() => void handleSaveInvoiceDraft()}
            >
              Save invoice draft
            </Button>

            <SectionCard
              description="Add or adjust labor, parts, and fees before issuing the invoice."
              eyebrow="Draft line items"
              title={lineForm.id ? "Edit line item" : "Add line item"}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["labor", "part", "fee"] as const).map((itemType) => (
                  <Chip
                    key={itemType}
                    onPress={() =>
                      setLineForm((current) => ({ ...current, itemType }))
                    }
                    selected={lineForm.itemType === itemType}
                    tone="brand"
                  >
                    {formatDesignLabel(itemType)}
                  </Chip>
                ))}
              </View>

              <Field label="Name">
                <Input
                  onChangeText={(value) =>
                    setLineForm((current) => ({ ...current, name: value }))
                  }
                  placeholder="Front brake pad replacement"
                  placeholderTextColor="#9ca3af"
                  value={lineForm.name}
                />
                <DictationButton
                  contextualStrings={mergeDictationContext(estimatePhrases)}
                  label="Dictate line name"
                  onChangeText={(value) =>
                    setLineForm((current) => ({ ...current, name: value }))
                  }
                  value={lineForm.name}
                />
              </Field>

              <Field label="Quantity">
                <Input
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setLineForm((current) => ({ ...current, quantity: value }))
                  }
                  placeholder="1"
                  placeholderTextColor="#9ca3af"
                  value={lineForm.quantity}
                />
              </Field>

              <Field label="Unit price ($)">
                <Input
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setLineForm((current) => ({ ...current, unitPrice: value }))
                  }
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  value={lineForm.unitPrice}
                />
              </Field>

              <Field label="Description">
                <Input
                  multiline
                  onChangeText={(value) =>
                    setLineForm((current) => ({ ...current, description: value }))
                  }
                  placeholder="Optional line item description."
                  placeholderTextColor="#9ca3af"
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

              <Field label="Taxable">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Chip
                    onPress={() => setLineForm((current) => ({ ...current, taxable: true }))}
                    selected={lineForm.taxable}
                    tone="brand"
                  >
                    Taxable
                  </Chip>
                  <Chip
                    onPress={() => setLineForm((current) => ({ ...current, taxable: false }))}
                    selected={!lineForm.taxable}
                    tone="brand"
                  >
                    Non-taxable
                  </Chip>
                </View>
              </Field>

              <View style={{ gap: 12 }}>
                <Button
                  loading={isSavingLineItem}
                  onPress={() => void handleSaveLineItem()}
                  tone="secondary"
                >
                  {lineForm.id ? "Save line item" : "Add line item"}
                </Button>
                {lineForm.id ? (
                  <Button
                    onPress={() => setLineForm(emptyLineForm())}
                    tone="tertiary"
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </View>

              {detail.lineItems.length ? (
                <View style={{ gap: 12 }}>
                  {detail.lineItems.map((lineItem) => (
                    <Card key={lineItem.id} tone="subtle">
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Badge tone="info">{formatDesignLabel(lineItem.itemType)}</Badge>
                          <Badge tone="neutral">{`Qty ${formatQuantity(lineItem.quantity)}`}</Badge>
                        </View>
                        <CardTitle>{lineItem.name}</CardTitle>
                        {lineItem.description ? <CardCopy>{lineItem.description}</CardCopy> : null}
                        <DetailRow
                          label="Line total"
                          value={formatCurrencyFromCents(
                            lineItem.lineSubtotalCents,
                            detail.invoice.currencyCode
                          )}
                        />
                        <View style={{ gap: 8 }}>
                          <Button
                            fullWidth={false}
                            onPress={() => setLineForm(buildLineForm(lineItem))}
                            tone="secondary"
                          >
                            Edit
                          </Button>
                          <Button
                            fullWidth={false}
                            loading={isRemovingLineItemId === lineItem.id}
                            onPress={() => void handleRemoveLineItem(lineItem.id)}
                            tone="tertiary"
                          >
                            Remove
                          </Button>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : (
                <EmptyState
                  body="No invoice line items are on this draft yet."
                  eyebrow="Draft lines"
                  title="No draft line items"
                />
              )}
            </SectionCard>
          </SectionCard>
        ) : null}

        <SectionCard
          description="Keep invoice issue, customer link delivery, and live checkout controls inside the field workflow."
          eyebrow="Field billing actions"
          title="Customer-ready billing"
        >
          {liveBillingActionsDisabled ? (
            <Notice
              body="Live issue/send actions cannot run from this cached invoice copy. Use these controls to queue a structured office follow-through request instead of losing the billing task."
              title="Office follow-through is available offline"
              tone="warning"
            />
          ) : null}

          {detail.invoice.status === "draft" ? (
            <Button
              loading={activeInvoiceAction === "issue_invoice"}
              onPress={() => void handleInvoiceAction("issue_invoice")}
            >
              {liveBillingActionsDisabled
                ? buildOfflineInvoiceActionHandoff("issue_invoice", detail).buttonLabel
                : "Issue invoice"}
            </Button>
          ) : null}

          {canCollectPayment && !detail.invoice.paymentUrl ? (
            <Button
              loading={activeInvoiceAction === "refresh_payment_page"}
              onPress={() => void handleInvoiceAction("refresh_payment_page")}
              tone="secondary"
            >
              {liveBillingActionsDisabled
                ? buildOfflineInvoiceActionHandoff("refresh_payment_page", detail).buttonLabel
                : "Prepare payment page"}
            </Button>
          ) : null}

          {canSendInvoiceLink ? (
            <Button
              loading={activeInvoiceAction === "send_invoice_link"}
              onPress={() => void handleInvoiceAction("send_invoice_link")}
              tone="secondary"
            >
              {liveBillingActionsDisabled
                ? buildOfflineInvoiceActionHandoff("send_invoice_link", detail).buttonLabel
                : "Send invoice link"}
            </Button>
          ) : null}

          {canCollectPayment ? (
            <Button
              loading={activeInvoiceAction === "send_payment_reminder"}
              onPress={() => void handleInvoiceAction("send_payment_reminder")}
              tone="secondary"
            >
              {liveBillingActionsDisabled
                ? buildOfflineInvoiceActionHandoff("send_payment_reminder", detail).buttonLabel
                : "Send payment reminder"}
            </Button>
          ) : null}
        </SectionCard>

        {canCollectPayment ? (
          <SectionCard
            description="Use this when the customer pays you directly in the field and that payment should hit the invoice ledger now."
            eyebrow="Field payment"
            title="Record cash or check"
          >
            {detail.isCached ? (
              <Notice
                body="You can still record a field payment from this cached invoice copy. If live posting fails, the payment will stay queued on this device until the app reconnects."
                title="Field payment can queue offline"
                tone="warning"
              />
            ) : null}

            <Field
              hint="Choose how the customer paid so the ledger and office follow-up stay accurate."
              label="Tender type"
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {manualTenderTypeOptions.map((option) => (
                  <Chip
                    key={`manual-payment-${option.value}`}
                    onPress={() => setSelectedManualPaymentTenderType(option.value)}
                    selected={selectedManualPaymentTenderType === option.value}
                    tone="brand"
                  >
                    {option.label}
                  </Chip>
                ))}
              </View>
            </Field>

            <Field
              hint="Defaults to the remaining balance. Adjust it if the customer paid only part of the invoice."
              label="Collected amount"
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {amountPresetChoices.map((choice) => (
                  <Chip
                    key={`manual-amount-${choice.label}`}
                    onPress={() => setManualPaymentAmountInput(choice.value)}
                    selected={manualPaymentAmountInput === choice.value}
                    tone="brand"
                  >
                    {choice.label}
                  </Chip>
                ))}
              </View>
            </Field>

            <Field label="Collected amount detail">
              <Input
                keyboardType="decimal-pad"
                onChangeText={setManualPaymentAmountInput}
                placeholder={
                  detail.totals.balanceDueCents > 0
                    ? (detail.totals.balanceDueCents / 100).toFixed(2)
                    : "0.00"
                }
                placeholderTextColor="#9ca3af"
                value={manualPaymentAmountInput}
              />
            </Field>

            <Field
              hint="Add check number, payer context, or anything finance should keep with the payment record."
              label="Reference note"
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {manualPaymentNoteChoices.map((choice) => (
                  <Chip
                    key={`manual-note-${choice}`}
                    onPress={() => setManualPaymentNote(choice)}
                    selected={manualPaymentNote === choice}
                    tone="brand"
                  >
                    {choice}
                  </Chip>
                ))}
              </View>
            </Field>

            <Field label="Reference note detail">
              <Input
                multiline
                onChangeText={setManualPaymentNote}
                placeholder="Optional payment reference."
                placeholderTextColor="#9ca3af"
                value={manualPaymentNote}
              />
              <DictationButton
                contextualStrings={mergeDictationContext(paymentPhrases)}
                label="Dictate payment note"
                onChangeText={setManualPaymentNote}
                value={manualPaymentNote}
              />
            </Field>

            <Button
              loading={isSubmittingManualPayment}
              onPress={() => void handleRecordManualPayment()}
            >
              Record field payment
            </Button>
          </SectionCard>
        ) : null}

        <SectionCard
          description="Use a structured handoff only when billing still needs office follow-up after the visit."
          eyebrow="Payment handoff"
          title="Collection follow-up"
        >
          <Notice
            body="Direct cash or check payments should use the field payment section above. This handoff flow is for unresolved billing outcomes that still need office action."
            title="Billing handoff"
            tone="warning"
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {paymentHandoffKindOptions.map((option) => (
              <Chip
                key={option.kind}
                onPress={() => {
                  setSelectedHandoffKind(option.kind);

                  if (option.kind === "manual_tender" && !paymentAmountInput.trim()) {
                    setPaymentAmountInput(
                      detail.totals.balanceDueCents > 0
                        ? (detail.totals.balanceDueCents / 100).toFixed(2)
                        : ""
                    );
                  }
                }}
                selected={selectedHandoffKind === option.kind}
                tone="brand"
              >
                {option.label}
              </Chip>
            ))}
          </View>

          <Notice
            body={handoffOption?.description ?? "Select the billing outcome that best matches what happened in the field."}
            title={formatPaymentHandoffKindLabel(selectedHandoffKind)}
            tone="brand"
          />

          {isManualTender ? (
            <>
              <Field
                hint="Choose how the customer paid so the office can reconcile the invoice correctly."
                label="Tender type"
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {manualTenderTypeOptions.map((option) => (
                    <Chip
                      key={option.value}
                      onPress={() => setSelectedTenderType(option.value)}
                      selected={selectedTenderType === option.value}
                      tone="brand"
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              </Field>

              <Field
                hint="Defaults to the remaining balance. Adjust it if the customer paid a different amount."
                label="Collected amount"
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {amountPresetChoices.map((choice) => (
                    <Chip
                      key={`handoff-amount-${choice.label}`}
                      onPress={() => setPaymentAmountInput(choice.value)}
                      selected={paymentAmountInput === choice.value}
                      tone="brand"
                    >
                      {choice.label}
                    </Chip>
                  ))}
                </View>
              </Field>

              <Field label="Collected amount detail">
                <Input
                  keyboardType="decimal-pad"
                  onChangeText={setPaymentAmountInput}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  value={paymentAmountInput}
                />
              </Field>
            </>
          ) : null}

          <Field
            hint={
              selectedHandoffKind === "other"
                ? "Describe the billing outcome so the office knows exactly what happened."
                : "Add any extra promise, customer context, or reconciliation detail if it matters."
            }
            label={selectedHandoffKind === "other" ? "Required note" : "Optional note"}
          >
            {selectedHandoffKind === "manual_tender" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {handoffNoteChoices.map((choice) => (
                  <Chip
                    key={`handoff-note-${choice}`}
                    onPress={() => setPaymentNote(choice)}
                    selected={paymentNote === choice}
                    tone="brand"
                  >
                    {choice}
                  </Chip>
                ))}
              </View>
            ) : null}
            <Input
              multiline
              onChangeText={setPaymentNote}
              placeholder="Add billing follow-up context."
              placeholderTextColor="#9ca3af"
              value={paymentNote}
            />
            <DictationButton
              contextualStrings={mergeDictationContext([handoffOption?.label], paymentPhrases)}
              label="Dictate handoff note"
              onChangeText={setPaymentNote}
              value={paymentNote}
            />
          </Field>

          <Button
            loading={isSubmittingHandoff}
            onPress={() => void handleSubmitPaymentHandoff()}
            tone="secondary"
          >
            Record payment handoff
          </Button>

          {paymentHandoffs.length ? (
            <View style={{ gap: 12 }}>
              {paymentHandoffs.map((handoff) => (
                <Card key={handoff.id} tone="subtle">
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Badge tone={getPaymentHandoffBadgeTone(handoff)}>
                        {formatPaymentHandoffKindLabel(handoff.kind)}
                      </Badge>
                      <Badge tone={handoff.status === "resolved" ? "success" : "neutral"}>
                        {handoff.pendingSync ? "Queued" : handoff.status}
                      </Badge>
                      {handoff.tenderType ? (
                        <Badge tone="neutral">{formatTenderTypeLabel(handoff.tenderType)}</Badge>
                      ) : null}
                    </View>
                    <CardTitle>
                      {handoff.amountCents
                        ? formatCurrencyFromCents(handoff.amountCents, detail.invoice.currencyCode)
                        : "No amount captured"}
                    </CardTitle>
                    <CardCopy>
                      {formatDateTime(handoff.createdAt, {
                        includeTimeZoneName: false,
                        timeZone: appContext?.company.timezone
                      })}
                    </CardCopy>
                    {handoff.note ? <CardCopy>{handoff.note}</CardCopy> : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              body="No structured payment handoffs have been recorded for this invoice yet."
              eyebrow="Payment handoff"
              title="No billing handoffs"
            />
          )}
        </SectionCard>

        <SectionCard
          description="Keep the billing totals and payment state visible before walking through collection with the customer."
          eyebrow="Invoice totals"
          title="Summary"
        >
          <DetailRow label="Status" value={<StatusBadge status={detail.invoice.status} />} />
          <DetailRow
            label="Subtotal"
            value={formatCurrencyFromCents(detail.totals.subtotalCents, detail.invoice.currencyCode)}
          />
          <DetailRow
            label="Discount"
            value={formatCurrencyFromCents(detail.totals.discountCents, detail.invoice.currencyCode)}
          />
          <DetailRow
            label="Tax"
            value={formatCurrencyFromCents(detail.totals.taxCents, detail.invoice.currencyCode)}
          />
          <DetailRow
            label="Paid amount"
            value={formatCurrencyFromCents(detail.totals.amountPaidCents, detail.invoice.currencyCode)}
          />
          <DetailRow
            label="Balance due"
            value={formatCurrencyFromCents(detail.totals.balanceDueCents, detail.invoice.currencyCode)}
          />
          <DetailRow
            label="Due"
            value={
              detail.invoice.dueAt
                ? formatDateTime(detail.invoice.dueAt, {
                    includeTimeZoneName: false,
                    timeZone: appContext?.company.timezone
                  })
                : "No due date"
            }
          />
          <Notice
            body={formatCurrencyFromCents(detail.totals.totalCents, detail.invoice.currencyCode)}
            title="Invoice total"
            tone="brand"
          />
        </SectionCard>

        <SectionCard
          description="Review collected payments and customer checkout links without leaving the active stop workspace."
          eyebrow="Payments"
          title="Payment activity"
        >
          {detail.invoice.paymentUrlExpiresAt ? (
            <DetailRow
              label="Payment page expires"
              value={formatDateTime(detail.invoice.paymentUrlExpiresAt, {
                includeTimeZoneName: false,
                timeZone: appContext?.company.timezone
              })}
            />
          ) : null}

          {detail.payments.length ? (
            <View style={{ gap: 12 }}>
              {detail.payments.map((payment) => (
                <Card key={payment.id} tone="subtle">
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <StatusBadge status={payment.status} />
                      {payment.pendingSync ? (
                        <Badge tone="warning">Queued</Badge>
                      ) : null}
                      <Badge tone={payment.provider === "manual" ? "info" : "neutral"}>
                        {payment.provider === "manual" ? "Field payment" : "Stripe"}
                      </Badge>
                      <Badge tone="neutral">{payment.currencyCode}</Badge>
                      {payment.manualTenderType ? (
                        <Badge tone="neutral">
                          {formatTenderTypeLabel(payment.manualTenderType)}
                        </Badge>
                      ) : null}
                    </View>
                    <CardTitle>
                      {formatCurrencyFromCents(payment.amountCents, payment.currencyCode)}
                    </CardTitle>
                    <CardCopy>
                      {formatDateTime(payment.paidAt, {
                        includeTimeZoneName: false,
                        timeZone: appContext?.company.timezone
                      })}
                    </CardCopy>
                    {payment.manualReferenceNote ? (
                      <CardCopy>{payment.manualReferenceNote}</CardCopy>
                    ) : null}
                    {payment.receiptUrl ? (
                      <Button
                        fullWidth={false}
                        onPress={() => void Linking.openURL(payment.receiptUrl!)}
                        tone="secondary"
                      >
                        View receipt
                      </Button>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              body="No payments have been recorded for this invoice yet."
              eyebrow="Payments"
              title="No payment activity"
            />
          )}
        </SectionCard>

        <SectionCard
          description="Review the labor, parts, and fees that make up the customer invoice."
          eyebrow="Line items"
          title="Invoice items"
        >
          {detail.lineItems.length ? (
            <View style={{ gap: 12 }}>
              {detail.lineItems.map((lineItem) => (
                <Card key={lineItem.id} tone="subtle">
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Badge tone="info">{formatDesignLabel(lineItem.itemType)}</Badge>
                      <Badge tone="neutral">{`Qty ${formatQuantity(lineItem.quantity)}`}</Badge>
                    </View>
                    <CardTitle>{lineItem.name}</CardTitle>
                    {lineItem.description ? <CardCopy>{lineItem.description}</CardCopy> : null}
                    <DetailRow
                      label="Line total"
                      value={formatCurrencyFromCents(
                        lineItem.lineSubtotalCents,
                        detail.invoice.currencyCode
                      )}
                    />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState
              body="No invoice line items have been added yet."
              eyebrow="Line items"
              title="No invoice items"
            />
          )}
        </SectionCard>

        {detail.invoice.notes ? (
          <SectionCard
            description="Invoice notes shared from the office workflow."
            eyebrow="Notes"
            title="Invoice notes"
          >
            <CardCopy>{detail.invoice.notes}</CardCopy>
          </SectionCard>
        ) : null}

        {detail.invoice.terms ? (
          <SectionCard
            description="Terms attached to this invoice for customer review."
            eyebrow="Terms"
            title="Invoice terms"
          >
            <CardCopy>{detail.invoice.terms}</CardCopy>
          </SectionCard>
        ) : null}
      </ScreenScrollView>
    </Screen>
  );
}
