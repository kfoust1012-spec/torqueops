import {
  DEFAULT_ESTIMATE_APPROVAL_STATEMENT,
  fieldStopStages,
  formatDesignLabel,
  formatCurrencyFromCents,
  formatDateTime,
  getCustomerDisplayName,
  getFieldStopStageSummary,
  getAllowedTechnicianNextJobStatuses,
  getPublicTechnicianProfileMissingFields,
  hasPublicTechnicianProfile,
  type FieldStopStage
} from "@mobile-mechanic/core";
import type {
  AttachmentCategory,
  CreateTechnicianPaymentHandoffInput,
  CustomerCommunicationLogEntry,
  EstimateLineItem,
  EstimateLineItemType,
  JobStatus,
  TechnicianJobListItem,
  TechnicianAllowedStatus,
  TechnicianPaymentHandoffKind,
  TechnicianPaymentTenderType
} from "@mobile-mechanic/types";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";

import {
  Badge,
  BottomSheet,
  Button,
  Card,
  CardCopy,
  DetailRow,
  DictationButton,
  Chip,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Notice,
  PriorityBadge,
  Screen,
  ScreenScrollView,
  SectionCard,
  StickyActionDock,
  StatusBadge
} from "../../../src/components/ui";
import {
  loadAssignedJobAttachmentGallery,
  pickCameraImage,
  pickCameraVideo,
  pickMediaLibraryImage,
  uploadAssignedJobAttachment
} from "../../../src/features/attachments/api";
import { AttachmentCard } from "../../../src/features/attachments/components/attachment-card";
import { AttachmentUploadSheet } from "../../../src/features/attachments/components/attachment-upload-sheet";
import type { AttachmentGalleryItem } from "../../../src/features/attachments/mappers";
import {
  addAssignedJobEstimateLineItem,
  ensureAssignedJobEstimateDraft,
  loadAssignedJobEstimate,
  saveAssignedJobEstimatePartSource,
  saveAssignedJobEstimateLineItem,
  type AssignedEstimatePartSource
} from "../../../src/features/estimates/api";
import { approveAssignedEstimateFromMobile } from "../../../src/features/estimates/approval-api";
import {
  SignaturePad,
  type SignaturePadHandle
} from "../../../src/features/estimates/components/signature-pad";
import {
  createAssignedJobInvoiceDraft,
  createAssignedJobPaymentHandoff,
  loadAssignedJobPaymentHandoffs,
  recordAssignedJobManualPayment,
  runAssignedJobInvoiceAction,
  type AssignedInvoiceActionName,
  type AssignedTechnicianPaymentHandoff
} from "../../../src/features/invoices/api";
import { ensureAssignedInspection } from "../../../src/features/inspections/api";
import {
  loadTechnicianJobDetail,
  loadTechnicianJobs,
  loadTechnicianJobWorkflowSnapshot,
  submitTechnicianNote,
  submitTechnicianStatusChange
} from "../../../src/features/jobs/api";
import {
  clearStopConsoleRecovery,
  loadStopConsoleRecovery,
  saveStopConsoleRecovery,
  type StopConsoleRecoveryState
} from "../../../src/features/jobs/stop-console-recovery";
import {
  billingPhrases,
  customerCallPhrases,
  estimatePhrases,
  mechanicActionPhrases,
  mergeDictationContext,
  paymentPhrases,
  sourcingPhrases
} from "../../../src/features/voice/dictation-context";
import { getInspectionRunPath } from "../../../src/features/inspections/navigation";
import { JobNoteComposer } from "../../../src/features/jobs/components/job-note-composer";
import { JobStatusActions } from "../../../src/features/jobs/components/job-status-actions";
import {
  formatAddressLabel,
  formatArrivalWindow,
  formatJobDateTime,
  formatJobTitleLabel,
  formatJobStatusLabel,
  formatPhoneLabel
} from "../../../src/features/jobs/mappers";
import type { TechnicianNotificationInboxEntry } from "../../../src/features/notifications/inbox-store";
import { useNotificationInbox } from "../../../src/features/notifications/notification-inbox-provider";
import { callPhoneNumber, openMapsForAddress, openSmsComposer } from "../../../src/lib/linking";
import { useSessionContext } from "../../../src/providers/session-provider";
import { mobileTheme } from "../../../src/theme";

type JobDetailData = Awaited<ReturnType<typeof loadTechnicianJobDetail>> | null;
type JobWorkflowSnapshot = Awaited<ReturnType<typeof loadTechnicianJobWorkflowSnapshot>> | null;
type StopEstimateDetailData = Awaited<ReturnType<typeof loadAssignedJobEstimate>> | null;
type StopAttachmentGalleryData = AttachmentGalleryItem[];
type QuickAction = {
  id: string;
  label: string;
  onPress: () => void;
  tone: "primary" | "secondary" | "tertiary";
};
type StopEstimateLineForm = {
  description: string;
  id: string | null;
  itemType: EstimateLineItemType;
  name: string;
  quantity: string;
  taxable: boolean;
  unitPrice: string;
};
type StopPartSourceForm = {
  availabilityText: string;
  lineItemId: string | null;
  notes: string;
  quotedUnitCost: string;
  supplierAccountId: string | null;
  supplierName: string;
  supplierPartNumber: string;
  workflowOutcome: StopPartWorkflowOutcome | null;
};
type StopPartWorkflowOutcome =
  | "install_now"
  | "same_day_pickup"
  | "runner_pickup"
  | "return_visit";
type CustomerContactMode = "call" | "sms";
type StopFieldThreadEntry =
  | {
      body: string;
      id: string;
      occurredAt: string;
      source: "approval";
      status: NonNullable<StopEstimateDetailData>["estimate"]["status"];
      title: string;
    }
  | {
      body: string;
      entryType: TechnicianNotificationInboxEntry["type"];
      id: string;
      occurredAt: string;
      source: "dispatch";
      title: string;
      unread: boolean;
    }
  | {
      amountCents: number | null;
      id: string;
      kind: AssignedTechnicianPaymentHandoff["kind"];
      note: string | null;
      occurredAt: string;
      pendingSync: boolean;
      resolutionNote: string | null;
      source: "billing";
      status: AssignedTechnicianPaymentHandoff["status"];
      tenderType: AssignedTechnicianPaymentHandoff["tenderType"];
    }
  | {
      author: "office" | "you";
      body: string;
      id: string;
      occurredAt: string;
      source: "note";
    }
  | {
      body: string;
      channel: CustomerCommunicationLogEntry["channel"];
      communicationType: CustomerCommunicationLogEntry["communicationType"];
      errorMessage: string | null;
      id: string;
      occurredAt: string;
      recipientName: string;
      recipientPhone: string | null;
      source: "customer";
      status: CustomerCommunicationLogEntry["status"];
    };
type StopSheet =
  | "approval_capture"
  | "call_followup"
  | "closeout_confirm"
  | "estimate_line"
  | "evidence"
  | "navigation_return"
  | "part_source"
  | "payment"
  | null;

const fieldStageLabels: Record<FieldStopStage, string> = {
  approval: "Approval",
  billing: "Billing",
  closeout: "Closeout",
  complete: "Complete",
  inspection: "Inspection",
  parts: "Parts",
  repair: "Repair",
  travel: "Travel"
};

function getFieldStageTone(stage: FieldStopStage, blocked: boolean) {
  if (stage === "complete") return "success" as const;
  if (blocked) return "warning" as const;
  if (stage === "travel") return "info" as const;
  if (stage === "repair") return "progress" as const;
  return "success" as const;
}

function summarizeReasons(reasons: string[]) {
  if (!reasons.length) {
    return null;
  }

  if (reasons.length === 1) {
    return reasons[0];
  }

  const summary = reasons.slice(0, 2).join(" ");
  return reasons.length > 2 ? `${summary} ${reasons.length - 2} more closeout checks remain.` : summary;
}

function hasSavedPartSource(
  partSource:
    | NonNullable<StopEstimateDetailData>["partSources"][number]
    | null
    | undefined
) {
  return Boolean(
    partSource?.selectedSupplierAccount ||
      partSource?.selectedCartLine ||
      partSource?.requestLine?.lastSupplierAccountId ||
      (typeof partSource?.requestLine?.quotedUnitCostCents === "number" &&
        partSource.requestLine.quotedUnitCostCents > 0)
  );
}

function buildStopAmountPresetChoices(balanceDueCents: number) {
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

function buildStopEstimateLineNameChoices(itemType: EstimateLineItemType) {
  switch (itemType) {
    case "part":
      return ["Replacement part", "Service kit", "Fluid and materials"] as const;
    case "fee":
      return ["Mobile service fee", "Shop supplies", "Disposal fee"] as const;
    case "labor":
    default:
      return ["Diagnostic labor", "Repair labor", "Install labor"] as const;
  }
}

function buildStopPartSourceNoteChoices() {
  return [
    "Same-day pickup confirmed.",
    "Runner pickup needed.",
    "Return visit required.",
    "Core due at pickup.",
    "Customer approved this source."
  ] as const;
}

const stopPartWorkflowOutcomeOptions: Array<{
  availabilityText: string;
  description: string;
  label: string;
  note: string;
  value: StopPartWorkflowOutcome;
}> = [
  {
    availabilityText: "In stock",
    description: "Part is already on hand for this visit.",
    label: "Install now",
    note: "Part is on hand for this visit.",
    value: "install_now"
  },
  {
    availabilityText: "Same day pickup",
    description: "Pickup is confirmed and the repair can stay on this stop.",
    label: "Same-day pickup",
    note: "Same-day pickup confirmed.",
    value: "same_day_pickup"
  },
  {
    availabilityText: "Same day pickup",
    description: "Someone else has to grab the part before repair can continue.",
    label: "Need runner",
    note: "Runner pickup needed.",
    value: "runner_pickup"
  },
  {
    availabilityText: "Ordered for return visit",
    description: "The stop has to pause and come back later.",
    label: "Return visit",
    note: "Return visit required.",
    value: "return_visit"
  }
];

function getStopPartWorkflowOutcomeOption(outcome: StopPartWorkflowOutcome | null) {
  return stopPartWorkflowOutcomeOptions.find((option) => option.value === outcome) ?? null;
}

function inferStopPartWorkflowOutcome(partSource: AssignedEstimatePartSource | null): StopPartWorkflowOutcome | null {
  const availability = partSource?.selectedCartLine?.availabilityText?.trim().toLowerCase() ?? "";
  const notes =
    partSource?.selectedCartLine?.notes?.trim().toLowerCase() ??
    partSource?.requestLine?.notes?.trim().toLowerCase() ??
    "";

  if (
    availability.includes("return visit") ||
    availability.includes("ordered") ||
    notes.includes("return visit")
  ) {
    return "return_visit";
  }

  if (notes.includes("runner")) {
    return "runner_pickup";
  }

  if (availability.includes("pickup") || notes.includes("pickup")) {
    return "same_day_pickup";
  }

  if (availability.includes("in stock") || notes.includes("on hand") || notes.includes("install")) {
    return "install_now";
  }

  return null;
}

function applyStopPartWorkflowOutcome(
  form: StopPartSourceForm,
  outcome: StopPartWorkflowOutcome
): StopPartSourceForm {
  const option = getStopPartWorkflowOutcomeOption(outcome);

  if (!option) {
    return form;
  }

  return {
    ...form,
    availabilityText: option.availabilityText,
    notes: option.note,
    workflowOutcome: outcome
  };
}

function buildStopPaymentNoteChoices(tenderType: "cash" | "check" | "other") {
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

const stopPaymentHandoffKindOptions: Array<{
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
    description: "Use this when billing follow-up does not fit the standard field outcome.",
    kind: "other",
    label: "Other"
  }
];

function buildStopBillingHandoffNoteChoices(
  kind: TechnicianPaymentHandoffKind,
  tenderType: TechnicianPaymentTenderType
) {
  switch (kind) {
    case "manual_tender":
      return buildStopPaymentNoteChoices(tenderType);
    case "promised_to_pay_later":
      return ["Customer will pay later today.", "Customer asked for reminder later."] as const;
    case "resend_link":
      return ["Customer asked for payment link again.", "Customer wants invoice resent after visit."] as const;
    case "follow_up_required":
      return ["Office follow-up required.", "Customer left before payment finished."] as const;
    case "other":
    default:
      return [] as const;
  }
}

function formatStopPaymentHandoffKindLabel(kind: TechnicianPaymentHandoffKind) {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatStopTenderTypeLabel(tenderType: TechnicianPaymentTenderType) {
  return tenderType.charAt(0).toUpperCase() + tenderType.slice(1);
}

function getStopPaymentHandoffBadgeTone(handoff: AssignedTechnicianPaymentHandoff) {
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

function getStopPaymentHandoffThreadTone(entry: Extract<StopFieldThreadEntry, { source: "billing" }>) {
  if (entry.pendingSync) {
    return "warning" as const;
  }

  if (entry.kind === "manual_tender") {
    return "info" as const;
  }

  if (entry.kind === "follow_up_required" || entry.kind === "other") {
    return "warning" as const;
  }

  return "info" as const;
}

function buildOfflineStopInvoiceActionHandoff(args: {
  action: AssignedInvoiceActionName;
  balanceDueCents: number;
  currencyCode: string;
  invoiceNumber: string;
}) {
  const balanceDueLabel = formatCurrencyFromCents(args.balanceDueCents, args.currencyCode);

  switch (args.action) {
    case "issue_invoice":
      return {
        buttonLabel: "Queue office issue + send",
        handoff: {
          kind: "follow_up_required" as const,
          note: `Technician could not issue invoice ${args.invoiceNumber} from the field. Office should issue it, send the customer link, and prep checkout if balance due remains ${balanceDueLabel}.`
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
          note: `Technician needs office to refresh the payment page for invoice ${args.invoiceNumber}. Customer still has ${balanceDueLabel} due.`
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
          note: `Technician needs office to send a payment reminder for invoice ${args.invoiceNumber}. Customer still has ${balanceDueLabel} due.`
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
          note: `Technician needs office to resend invoice ${args.invoiceNumber} to the customer from the field workflow.`
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

function isLikelyStopInvoiceActionConnectivityFailure(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("network")
  );
}

function buildStopCustomerContactOutcomeChoices(mode: CustomerContactMode) {
  if (mode === "sms") {
    return [
      "Sent arrival update by text.",
      "Sent approval summary by text.",
      "Sent payment link reminder by text.",
      "Customer replied by text and asked for callback.",
      "No reply yet to text update."
    ] as const;
  }

  return [
    "Customer confirmed arrival.",
    "No answer. Left voicemail.",
    "Customer asked for callback.",
    "Approval discussed by phone.",
    "Delay explained to customer."
  ] as const;
}

function formatCommunicationTypeLabel(type: CustomerCommunicationLogEntry["communicationType"]) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCommunicationStatusLabel(status: CustomerCommunicationLogEntry["status"]) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function getCommunicationStatusTone(status: CustomerCommunicationLogEntry["status"]) {
  switch (status) {
    case "delivered":
    case "sent":
      return "success" as const;
    case "failed":
    case "canceled":
      return "warning" as const;
    case "processing":
      return "info" as const;
    case "queued":
    default:
      return "neutral" as const;
  }
}

function formatInboxTypeLabel(type: TechnicianNotificationInboxEntry["type"]) {
  switch (type) {
    case "job_assigned":
      return "New assignment";
    case "job_rescheduled":
      return "Timing update";
    case "unknown":
    default:
      return "Dispatch update";
  }
}

function getInboxTypeTone(type: TechnicianNotificationInboxEntry["type"], unread: boolean) {
  if (unread) {
    return "warning" as const;
  }

  switch (type) {
    case "job_assigned":
      return "info" as const;
    case "job_rescheduled":
      return "neutral" as const;
    case "unknown":
    default:
      return "neutral" as const;
  }
}

function buildStopStatusDisabledReasons(args: {
  completionGateReason: string | null;
  currentStatus: JobStatus;
  estimateStatus: string | null;
  fieldStage: FieldStopStage;
  hasPartLines: boolean;
  inspectionCompleted: boolean;
  invoiceExists: boolean;
}) {
  const reasons: Partial<Record<TechnicianAllowedStatus, string>> = {};

  if (!args.inspectionCompleted) {
    reasons.ready_for_payment = "Finish the inspection before moving the stop into billing.";

    if (args.currentStatus === "arrived") {
      reasons.repairing = "Start diagnosis first so the inspection and findings are captured.";
    }
  }

  if (!args.hasPartLines) {
    reasons.waiting_parts = "Add a part line before marking this stop waiting on parts.";
  }

  if (!args.invoiceExists) {
    reasons.ready_for_payment = "Create the invoice before moving the stop into payment.";
  }

  switch (args.estimateStatus) {
    case null:
      reasons.waiting_approval = "Create the estimate before putting the stop in approval hold.";
      reasons.repairing =
        reasons.repairing ?? "Build or confirm the estimate before starting active repair.";
      reasons.ready_for_payment =
        reasons.ready_for_payment ?? "Create the estimate and invoice before moving into payment.";
      break;
    case "draft":
      reasons.waiting_approval = "Send the estimate first, then use waiting approval.";
      reasons.repairing =
        reasons.repairing ?? "Finish the draft estimate before starting repair.";
      reasons.ready_for_payment =
        reasons.ready_for_payment ?? "Finish the estimate before moving into payment.";
      break;
    case "sent":
      reasons.repairing = "Capture customer approval before starting repair.";
      reasons.ready_for_payment = "Approval is still pending on this stop.";
      break;
    case "declined":
    case "void":
      reasons.repairing = "Resolve the estimate state before returning to repair.";
      reasons.ready_for_payment = "Resolve the estimate state before moving into billing.";
      break;
    default:
      break;
  }

  if (args.currentStatus === "arrived") {
    reasons.ready_for_payment =
      reasons.ready_for_payment ?? "Finish diagnosis first before jumping to payment.";
  }

  if (args.fieldStage !== "closeout") {
    reasons.completed =
      args.completionGateReason ?? "Use Complete stop from closeout once the finish checks are clear.";
  } else if (args.completionGateReason) {
    reasons.completed = args.completionGateReason;
  }

  return reasons;
}

function parseStopMoneyInput(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function parseStopQuantityInput(value: string) {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function emptyStopEstimateLineForm(itemType: EstimateLineItemType = "labor"): StopEstimateLineForm {
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

function buildStopEstimateLineForm(lineItem: EstimateLineItem): StopEstimateLineForm {
  const dollars = lineItem.unitPriceCents / 100;

  return {
    description: lineItem.description ?? "",
    id: lineItem.id,
    itemType: lineItem.itemType,
    name: lineItem.name,
    quantity: Number.isInteger(lineItem.quantity) ? `${lineItem.quantity}` : lineItem.quantity.toFixed(2),
    taxable: lineItem.taxable,
    unitPrice: Number.isInteger(dollars) ? `${dollars}` : dollars.toFixed(2)
  };
}

const availabilityQuickChoices = [
  "In stock",
  "Same day pickup",
  "Next business day",
  "Ordered for return visit"
] as const;

function emptyStopPartSourceForm(): StopPartSourceForm {
  return {
    availabilityText: "",
    lineItemId: null,
    notes: "",
    quotedUnitCost: "",
    supplierAccountId: null,
    supplierName: "",
    supplierPartNumber: "",
    workflowOutcome: null
  };
}

function buildStopPartSourceForm(partSource: AssignedEstimatePartSource | null): StopPartSourceForm {
  return {
    availabilityText: partSource?.selectedCartLine?.availabilityText ?? "",
    lineItemId: partSource?.lineItemId ?? null,
    notes: partSource?.selectedCartLine?.notes ?? partSource?.requestLine?.notes ?? "",
    quotedUnitCost:
      typeof partSource?.selectedCartLine?.quotedUnitCostCents === "number"
        ? (partSource.selectedCartLine.quotedUnitCostCents / 100).toFixed(2)
        : typeof partSource?.requestLine?.quotedUnitCostCents === "number"
          ? (partSource.requestLine.quotedUnitCostCents / 100).toFixed(2)
          : "",
    supplierAccountId: partSource?.selectedSupplierAccount?.id ?? null,
    supplierName: partSource?.selectedSupplierAccount?.name ?? "",
    supplierPartNumber:
      partSource?.selectedCartLine?.supplierPartNumber ?? partSource?.requestLine?.partNumber ?? "",
    workflowOutcome: inferStopPartWorkflowOutcome(partSource)
  };
}

function buildStopSelectedSourceSummary(
  partSource: AssignedEstimatePartSource | null,
  currencyCode: string
) {
  if (!partSource?.selectedSupplierAccount) {
    return "No supplier captured yet for this part line.";
  }

  const details = [
    partSource.selectedSupplierAccount.name,
    typeof partSource.selectedCartLine?.quotedUnitCostCents === "number"
      ? formatCurrencyFromCents(partSource.selectedCartLine.quotedUnitCostCents, currencyCode)
      : typeof partSource.requestLine?.quotedUnitCostCents === "number"
        ? formatCurrencyFromCents(partSource.requestLine.quotedUnitCostCents, currencyCode)
        : null,
    partSource.selectedCartLine?.availabilityText ?? null
  ].filter(Boolean);

  return details.join(" · ");
}

export default function JobDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : params.jobId?.[0] ?? null;
  const { appContext, session } = useSessionContext();
  const { entries: inboxEntries, markRead: markInboxEntryRead } = useNotificationInbox();
  const [detail, setDetail] = useState<JobDetailData>(null);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<JobWorkflowSnapshot>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [activeInlineAction, setActiveInlineAction] = useState<
    | "approve_estimate"
    | "create_estimate"
    | "create_invoice"
    | "create_payment_handoff"
    | "issue_invoice"
    | "load_inspection"
    | "load_part_source"
    | "record_payment"
    | "refresh_payment_page"
    | "save_estimate_line"
    | "save_part_source"
    | "send_invoice_link"
    | "send_payment_reminder"
    | null
  >(null);
  const [inlineEstimateDetail, setInlineEstimateDetail] = useState<StopEstimateDetailData>(null);
  const [stopEvidenceGallery, setStopEvidenceGallery] = useState<StopAttachmentGalleryData>([]);
  const [evidenceCaption, setEvidenceCaption] = useState("");
  const [callFollowupNote, setCallFollowupNote] = useState("");
  const [customerContactMode, setCustomerContactMode] = useState<CustomerContactMode>("call");
  const [approvalSignerName, setApprovalSignerName] = useState("");
  const [approvalStatement, setApprovalStatement] = useState(DEFAULT_ESTIMATE_APPROVAL_STATEMENT);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false);
  const [isEvidenceUploading, setIsEvidenceUploading] = useState(false);
  const [selectedEvidenceCategory, setSelectedEvidenceCategory] =
    useState<AttachmentCategory>("general");
  const [estimateLineForm, setEstimateLineForm] = useState<StopEstimateLineForm>(() =>
    emptyStopEstimateLineForm()
  );
  const [partSourceForm, setPartSourceForm] = useState<StopPartSourceForm>(() =>
    emptyStopPartSourceForm()
  );
  const [activePartSourceLineId, setActivePartSourceLineId] = useState<string | null>(null);
  const [activeStopSheet, setActiveStopSheet] = useState<StopSheet>(null);
  const [resumeRecovery, setResumeRecovery] = useState<StopConsoleRecoveryState | null>(null);
  const [quickPaymentAmountInput, setQuickPaymentAmountInput] = useState("");
  const [quickPaymentTenderType, setQuickPaymentTenderType] = useState<"cash" | "check" | "other">(
    "cash"
  );
  const [quickPaymentNote, setQuickPaymentNote] = useState("");
  const [billingHandoffs, setBillingHandoffs] = useState<AssignedTechnicianPaymentHandoff[]>([]);
  const [selectedBillingHandoffKind, setSelectedBillingHandoffKind] =
    useState<TechnicianPaymentHandoffKind>("follow_up_required");
  const [billingHandoffTenderType, setBillingHandoffTenderType] =
    useState<TechnicianPaymentTenderType>("cash");
  const [billingHandoffAmountInput, setBillingHandoffAmountInput] = useState("");
  const [billingHandoffNote, setBillingHandoffNote] = useState("");
  const [nextAssignedJob, setNextAssignedJob] = useState<TechnicianJobListItem | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TechnicianAllowedStatus | null>(null);
  const [showFullStatusHistory, setShowFullStatusHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDockVisible, setIsDockVisible] = useState(true);
  const [notice, setNotice] = useState<{
    body: string;
    title?: string;
    tone: "brand" | "danger" | "success" | "warning";
  } | null>(null);
  const signaturePadRef = useRef<SignaturePadHandle | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastScrollOffsetRef = useRef(0);
  const pendingCustomerCallFollowupRef = useRef(false);
  const pendingCustomerTextFollowupRef = useRef(false);
  const pendingNavigationReturnRef = useRef(false);

  const loadDetail = useCallback(async () => {
    if (!appContext || !jobId) return;
    const [detailResult, workflowResult, queueResult] = await Promise.all([
      loadTechnicianJobDetail(appContext.companyId, appContext.userId, jobId),
      loadTechnicianJobWorkflowSnapshot(appContext.companyId, appContext.userId, jobId),
      loadTechnicianJobs(appContext.companyId, appContext.userId)
    ]);
    const handoffResult = workflowResult?.invoice ? await loadAssignedJobPaymentHandoffs(jobId) : [];
    setDetail(detailResult);
    setWorkflowSnapshot(workflowResult);
    setBillingHandoffs(handoffResult);
    setNextAssignedJob(
      queueResult.find((job) => job.id !== jobId && job.status !== "completed" && job.status !== "canceled") ??
        null
    );
  }, [appContext, jobId]);

  const handleStopScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffset = event.nativeEvent.contentOffset.y;
      const previousOffset = lastScrollOffsetRef.current;
      const delta = nextOffset - previousOffset;

      if (nextOffset <= 120) {
        if (!isDockVisible) {
          setIsDockVisible(true);
        }
      } else if (delta > 14 && nextOffset > 220) {
        if (isDockVisible) {
          setIsDockVisible(false);
        }
      } else if (delta < -14) {
        if (!isDockVisible) {
          setIsDockVisible(true);
        }
      }

      lastScrollOffsetRef.current = nextOffset;
    },
    [isDockVisible]
  );

  useEffect(() => {
    let isMounted = true;
    async function run() {
      if (!appContext || !jobId) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [detailResult, workflowResult, queueResult] = await Promise.all([
          loadTechnicianJobDetail(appContext.companyId, appContext.userId, jobId),
          loadTechnicianJobWorkflowSnapshot(appContext.companyId, appContext.userId, jobId),
          loadTechnicianJobs(appContext.companyId, appContext.userId)
        ]);
        const handoffResult = workflowResult?.invoice
          ? await loadAssignedJobPaymentHandoffs(jobId)
          : [];
        if (!isMounted) return;
        setDetail(detailResult);
        setWorkflowSnapshot(workflowResult);
        setBillingHandoffs(handoffResult);
        setNextAssignedJob(
          queueResult.find((job) => job.id !== jobId && job.status !== "completed" && job.status !== "canceled") ??
            null
        );
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load assigned job.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void run();
    return () => {
      isMounted = false;
    };
  }, [appContext, jobId]);

  useEffect(() => {
    setIsDockVisible(true);
    lastScrollOffsetRef.current = 0;
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function refreshOnFocus() {
        if (!appContext || !jobId) {
          return;
        }

        try {
          await loadDetail();
        } catch (error) {
          if (!isActive) {
            return;
          }

          const message =
            error instanceof Error ? error.message : "Failed to refresh assigned job.";
          setErrorMessage(message);

          if (message.toLowerCase().includes("assigned job not found")) {
            router.replace("/jobs");
          }
        }
      }

      void refreshOnFocus();

      return () => {
        isActive = false;
      };
    }, [appContext, jobId, loadDetail, router])
  );

  useEffect(() => {
    const balanceDueCents = workflowSnapshot?.invoice?.totals.balanceDueCents ?? 0;

    if (!quickPaymentAmountInput.trim() && balanceDueCents > 0) {
      setQuickPaymentAmountInput((balanceDueCents / 100).toFixed(2));
    }
  }, [workflowSnapshot?.invoice?.invoice.id, workflowSnapshot?.invoice?.totals.balanceDueCents]);

  useEffect(() => {
    const balanceDueCents = workflowSnapshot?.invoice?.totals.balanceDueCents ?? 0;

    if (!billingHandoffAmountInput.trim() && balanceDueCents > 0) {
      setBillingHandoffAmountInput((balanceDueCents / 100).toFixed(2));
    }
  }, [billingHandoffAmountInput, workflowSnapshot?.invoice?.invoice.id, workflowSnapshot?.invoice?.totals.balanceDueCents]);

  useEffect(() => {
    if (!workflowSnapshot?.estimate) {
      setEstimateLineForm(emptyStopEstimateLineForm());
      setInlineEstimateDetail(null);
      setPartSourceForm(emptyStopPartSourceForm());
      setActivePartSourceLineId(null);
    }
  }, [workflowSnapshot?.estimate?.estimate.id]);

  useEffect(() => {
    let isMounted = true;

    async function refreshInlineEstimateSummary() {
      if (!appContext || !jobId || !workflowSnapshot?.estimate?.estimate.id) {
        return;
      }

      const workflowEstimate = workflowSnapshot.estimate;
      const hasPartLines = workflowEstimate.lineItems.some((lineItem) => lineItem.itemType === "part");
      const needsFreshDetail =
        inlineEstimateDetail?.estimate.id !== workflowEstimate.estimate.id ||
        inlineEstimateDetail?.estimate.updatedAt !== workflowEstimate.estimate.updatedAt;

      if (!needsFreshDetail || (!hasPartLines && !inlineEstimateDetail)) {
        return;
      }

      try {
        const result = await loadAssignedJobEstimate(appContext.companyId, appContext.userId, jobId);

        if (isMounted) {
          setInlineEstimateDetail(result);
        }
      } catch {
        // The stop can still render from the workflow snapshot; skip noisy notices here.
      }
    }

    void refreshInlineEstimateSummary();

    return () => {
      isMounted = false;
    };
  }, [
    appContext,
    inlineEstimateDetail,
    jobId,
    workflowSnapshot?.estimate
  ]);

  useEffect(() => {
    setNotice(null);
  }, [jobId]);

  async function ensureInlineEstimateDetail(lineItemId?: string) {
    if (!appContext || !jobId || !workflowSnapshot?.estimate) {
      return null;
    }

    const canReuseCurrentDetail =
      inlineEstimateDetail?.estimate.id === workflowSnapshot.estimate.estimate.id &&
      (!lineItemId || inlineEstimateDetail.lineItems.some((lineItem) => lineItem.id === lineItemId));

    if (canReuseCurrentDetail) {
      return inlineEstimateDetail;
    }

    const result = await loadAssignedJobEstimate(appContext.companyId, appContext.userId, jobId);
    setInlineEstimateDetail(result);
    return result;
  }

  useEffect(() => {
    let isMounted = true;

    async function loadRecovery() {
      if (!jobId) return;

      const result = await loadStopConsoleRecovery(jobId);

      if (isMounted) {
        setResumeRecovery(result);
      }
    }

    void loadRecovery();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  useEffect(() => {
    async function persistRecovery() {
      if (!jobId || !activeStopSheet || activeStopSheet === "closeout_confirm") {
        return;
      }

      const summary =
        activeStopSheet === "approval_capture"
          ? "capturing customer approval"
          : activeStopSheet === "payment"
          ? "recording a field payment"
          : activeStopSheet === "navigation_return"
            ? "resuming after navigation"
          : activeStopSheet === "call_followup"
            ? "capturing the customer call outcome"
          : activeStopSheet === "evidence"
            ? "adding stop evidence"
          : activeStopSheet === "part_source"
            ? "sourcing a part line"
            : estimateLineForm.id
              ? `editing ${estimateLineForm.name.trim() || "an estimate line"}`
              : "adding a quick estimate line";
      const nextRecovery = {
        jobId,
        lineItemId: activeStopSheet === "part_source" ? partSourceForm.lineItemId : null,
        sheet: activeStopSheet,
        summary,
        updatedAt: new Date().toISOString()
      } satisfies StopConsoleRecoveryState;

      await saveStopConsoleRecovery(nextRecovery);
      setResumeRecovery(nextRecovery);
    }

    void persistRecovery();
  }, [
    activeStopSheet,
    estimateLineForm.id,
    estimateLineForm.name,
    jobId,
    partSourceForm.lineItemId
  ]);

  function closeStopSheet() {
    if (activeStopSheet === "approval_capture") {
      setApprovalSignerName("");
      setApprovalStatement(DEFAULT_ESTIMATE_APPROVAL_STATEMENT);
      signaturePadRef.current?.clear();
    }

    if (activeStopSheet === "call_followup") {
      setCallFollowupNote("");
      setCustomerContactMode("call");
    }

    if (activeStopSheet === "part_source") {
      setPartSourceForm(emptyStopPartSourceForm());
      setActivePartSourceLineId(null);
    }

    if (activeStopSheet === "estimate_line" && !estimateLineForm.id) {
      setEstimateLineForm(emptyStopEstimateLineForm(estimateLineForm.itemType));
    }

    setActiveStopSheet(null);
    setResumeRecovery(null);
    if (jobId) {
      void clearStopConsoleRecovery(jobId);
    }
  }

  function openEstimateLineEditor(lineItem?: EstimateLineItem) {
    setEstimateLineForm(
      lineItem ? buildStopEstimateLineForm(lineItem) : emptyStopEstimateLineForm(estimateLineForm.itemType)
    );
    setActiveStopSheet("estimate_line");
  }

  function openQuickPaymentSheet() {
    setNotice(null);
    setResumeRecovery(null);
    if (jobId) {
      void clearStopConsoleRecovery(jobId);
      router.push(`/jobs/${jobId}/invoice`);
    }
  }

  function openCustomerContactSheet(mode: CustomerContactMode = "call") {
    setCustomerContactMode(mode);
    setActiveStopSheet("call_followup");
  }

  function openApprovalSheet() {
    setNotice(null);
    setResumeRecovery(null);
    if (jobId) {
      void clearStopConsoleRecovery(jobId);
      router.push(`/jobs/${jobId}/estimate/approve`);
    }
  }

  function openCloseoutSheet() {
    setActiveStopSheet("closeout_confirm");
  }

  function openNextAssignedStop() {
    if (!nextAssignedJob) {
      router.replace("/jobs");
      return;
    }

    closeStopSheet();
    router.replace(`/jobs/${nextAssignedJob.id}`);
  }

  async function loadStopEvidenceGallery() {
    if (!appContext || !jobId) {
      return;
    }

    const gallery = await loadAssignedJobAttachmentGallery(appContext.companyId, appContext.userId, jobId);
    setStopEvidenceGallery(gallery);
  }

  async function handleOpenEvidenceSheet() {
    setActiveStopSheet("evidence");

    if (!appContext || !jobId) {
      return;
    }

    setIsEvidenceLoading(true);

    try {
      await loadStopEvidenceGallery();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The stop evidence could not be loaded.";

      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return;
      }

      setNotice({
        body: message,
        title: "Evidence unavailable",
        tone: "danger"
      });
    } finally {
      setIsEvidenceLoading(false);
    }
  }

  async function handleDismissRecovery() {
    setResumeRecovery(null);

    if (jobId) {
      await clearStopConsoleRecovery(jobId);
    }
  }

  async function handleResumeRecovery() {
    if (!resumeRecovery) return;

    if (resumeRecovery.sheet === "approval_capture") {
      openApprovalSheet();
      return;
    }

    if (resumeRecovery.sheet === "call_followup") {
      openCustomerContactSheet();
      return;
    }

    if (resumeRecovery.sheet === "navigation_return") {
      setActiveStopSheet("navigation_return");
      return;
    }

    if (resumeRecovery.sheet === "payment") {
      openQuickPaymentSheet();
      return;
    }

    if (resumeRecovery.sheet === "evidence") {
      await handleOpenEvidenceSheet();
      return;
    }

    if (resumeRecovery.sheet === "estimate_line") {
      setActiveStopSheet("estimate_line");
      return;
    }

    if (!estimateSummary) {
      router.push(`/jobs/${jobId}/estimate`);
      return;
    }

    const lineItem =
      estimateSummary.lineItems.find((candidate) => candidate.id === resumeRecovery.lineItemId) ?? null;

    if (!lineItem) {
      router.push(`/jobs/${jobId}/estimate`);
      return;
    }

    await handleBeginPartSourcing(lineItem);
  }

  async function handleRefresh() {
    if (!appContext || !jobId) return;
    setIsRefreshing(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      await loadDetail();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh assigned job.";
      setErrorMessage(message);
      if (message.toLowerCase().includes("assigned job not found")) router.replace("/jobs");
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        pendingCustomerCallFollowupRef.current &&
        previousState !== "active" &&
        nextState === "active"
      ) {
        pendingCustomerCallFollowupRef.current = false;
        openCustomerContactSheet("call");
        return;
      }

      if (
        pendingCustomerTextFollowupRef.current &&
        previousState !== "active" &&
        nextState === "active"
      ) {
        pendingCustomerTextFollowupRef.current = false;
        openCustomerContactSheet("sms");
        return;
      }

      if (
        pendingNavigationReturnRef.current &&
        previousState !== "active" &&
        nextState === "active"
      ) {
        pendingNavigationReturnRef.current = false;
        setActiveStopSheet("navigation_return");
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const unreadJobEntries = inboxEntries.filter((entry) => entry.jobId === jobId && !entry.readAt);

    if (!unreadJobEntries.length) {
      return;
    }

    void Promise.all(unreadJobEntries.map((entry) => markInboxEntryRead(entry.id))).catch(() => undefined);
  }, [inboxEntries, jobId, markInboxEntryRead]);

  async function handleCallCustomer() {
    try {
      setCustomerContactMode("call");
      pendingCustomerCallFollowupRef.current = true;
      await callPhoneNumber(detail?.customer.phone ?? null);
    } catch (error) {
      pendingCustomerCallFollowupRef.current = false;
      Alert.alert("Call unavailable", error instanceof Error ? error.message : "Customer phone is not available.");
    }
  }

  async function handleTextCustomer() {
    try {
      setCustomerContactMode("sms");
      pendingCustomerTextFollowupRef.current = true;
      await openSmsComposer(detail?.customer.phone ?? null);
    } catch (error) {
      pendingCustomerTextFollowupRef.current = false;
      Alert.alert("Text unavailable", error instanceof Error ? error.message : "Customer phone is not available.");
    }
  }

  async function handleOpenMaps() {
    const shouldAutoMarkEnRoute =
      detail?.job.status === "scheduled" || detail?.job.status === "dispatched";
    let queuedTravelStatus = false;

    try {
      if (shouldAutoMarkEnRoute && appContext && jobId) {
        setIsSubmittingStatus(true);
        setPendingStatus("en_route");

        try {
          const result = await submitTechnicianStatusChange(
            appContext.companyId,
            appContext.userId,
            jobId,
            {
              toStatus: "en_route",
              reason: null
            }
          );
          queuedTravelStatus = result.queued;
          await loadDetail();
        } catch (error) {
          setNotice({
            body:
              error instanceof Error
                ? error.message
                : "The stop could not be marked en route before opening navigation.",
            title: "Travel status update failed",
            tone: "warning"
          });
        } finally {
          setIsSubmittingStatus(false);
          setPendingStatus(null);
        }
      }

      pendingNavigationReturnRef.current = true;
      await openMapsForAddress(detail?.serviceSite ?? detail?.primaryAddress ?? null, detail ? getCustomerDisplayName(detail.customer) : undefined);
      if (shouldAutoMarkEnRoute) {
        setNotice({
          body: queuedTravelStatus
            ? "Maps is open and the stop is marked en route on this device. The travel update will sync automatically when the connection is back."
            : "Maps is open and the stop is now marked en route.",
          title: queuedTravelStatus ? "Navigation opened and travel queued" : "Navigation opened",
          tone: queuedTravelStatus ? "warning" : "success"
        });
      }
    } catch (error) {
      pendingNavigationReturnRef.current = false;
      Alert.alert("Maps unavailable", error instanceof Error ? error.message : "Service location is not available.");
    }
  }

  async function handleOpenInspection() {
    if (!appContext || !jobId) {
      return;
    }

    setActiveInlineAction("load_inspection");
    setNotice(null);

    try {
      const inspectionDetail = await ensureAssignedInspection(
        appContext.companyId,
        appContext.userId,
        jobId
      );
      router.push(getInspectionRunPath(jobId, inspectionDetail) as never);
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The inspection checklist could not be opened from the stop.",
        title: "Inspection unavailable",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleOpenPaymentPage() {
    const paymentUrl = workflowSnapshot?.invoice?.invoice.paymentUrl ?? null;
    try {
      if (!paymentUrl) throw new Error("A live payment page is not available for this stop yet.");
      await Linking.openURL(paymentUrl);
    } catch (error) {
      Alert.alert("Payment page unavailable", error instanceof Error ? error.message : "A live payment page is not available.");
    }
  }

  async function handleStopEvidenceUpload(type: "camera-photo" | "camera-video" | "library") {
    if (!appContext || !jobId) {
      return;
    }

    setIsEvidenceUploading(true);
    setNotice(null);

    try {
      const asset =
        type === "camera-photo"
          ? await pickCameraImage()
          : type === "camera-video"
            ? await pickCameraVideo()
            : await pickMediaLibraryImage();

      if (!asset) {
        return;
      }

      const result = await uploadAssignedJobAttachment(appContext.companyId, appContext.userId, jobId, {
        asset,
        caption: evidenceCaption,
        category: selectedEvidenceCategory
      });

      setEvidenceCaption("");
      await Promise.all([loadDetail(), loadStopEvidenceGallery()]);
      setNotice({
        body: result.queued
          ? `This ${asset.mimeType.startsWith("video/") ? "video" : "photo"} is stored on this device and will upload automatically when the connection is back.`
          : `The ${asset.mimeType.startsWith("video/") ? "video" : "photo"} is now in the stop file.`,
        title: result.queued ? "Evidence queued" : "Evidence saved",
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The stop evidence could not be uploaded.";

      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return;
      }

      setNotice({
        body: message,
        title: "Evidence upload failed",
        tone: "danger"
      });
    } finally {
      setIsEvidenceUploading(false);
    }
  }

  async function handleSaveCallFollowup() {
    const trimmedBody = callFollowupNote.trim();
    const contactLabel = customerContactMode === "sms" ? "text" : "call";

    if (!trimmedBody) {
      setNotice({
        body: `Capture what happened on the customer ${contactLabel} before leaving this sheet.`,
        title: "Contact outcome still missing",
        tone: "warning"
      });
      return;
    }

    const saved = await handleSubmitNote(trimmedBody);

    if (!saved) {
      return;
    }

    setCallFollowupNote("");
    setActiveStopSheet(null);
    setResumeRecovery(null);
    pendingCustomerCallFollowupRef.current = false;
    pendingCustomerTextFollowupRef.current = false;
    setCustomerContactMode("call");

    if (jobId) {
      await clearStopConsoleRecovery(jobId);
    }
  }

  async function handleStatusChange(nextStatus: TechnicianAllowedStatus) {
    if (!appContext || !jobId) return;
    setIsSubmittingStatus(true);
    setPendingStatus(nextStatus);
    setNotice(null);
    try {
      const result = await submitTechnicianStatusChange(appContext.companyId, appContext.userId, jobId, { toStatus: nextStatus, reason: null });
      await loadDetail();
      if (nextStatus === "completed") {
        setActiveStopSheet("closeout_confirm");
      }
      setNotice(result.queued
        ? { body: `The stop is marked ${formatJobStatusLabel(nextStatus)} on this device and will sync automatically when the connection is back.`, title: "Status queued", tone: "warning" }
        : { body: `The assigned job is now marked ${formatJobStatusLabel(nextStatus)}.`, title: "Status updated", tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The job status could not be updated.";
      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return;
      }
      setNotice({ body: message, title: "Status update failed", tone: "danger" });
    } finally {
      setIsSubmittingStatus(false);
      setPendingStatus(null);
    }
  }

  async function handleSubmitNote(body: string) {
    if (!appContext || !jobId) return false;
    setIsSubmittingNote(true);
    setNotice(null);
    try {
      const result = await submitTechnicianNote(appContext.companyId, appContext.userId, jobId, body);
      await loadDetail();
      setNotice(result.queued
        ? { body: "The new note is stored on this device and will sync automatically when the connection is back.", title: "Note queued", tone: "warning" }
        : { body: "The new note is visible in the technician timeline now.", title: "Note saved", tone: "success" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The technician note could not be saved.";
      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return false;
      }
      setNotice({ body: message, title: "Note failed", tone: "danger" });
      return false;
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleCreateEstimateDraft() {
    if (!appContext || !jobId) return;

    setActiveInlineAction("create_estimate");
    setNotice(null);

    try {
      const result = await ensureAssignedJobEstimateDraft({
        companyId: appContext.companyId,
        jobId,
        technicianUserId: appContext.userId
      });
      setInlineEstimateDetail(result);
      await loadDetail();
      setNotice({
        body: "The estimate draft is ready on the stop. Add pricing detail when you need more than the quick stop actions.",
        title: "Estimate draft started",
        tone: "success"
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? error.message : "Estimate draft could not be created from the stop.",
        title: "Estimate action failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleCreateInvoiceDraft() {
    if (!jobId || !appContext) return;

    setActiveInlineAction("create_invoice");
    setNotice(null);

    try {
      const result = await createAssignedJobInvoiceDraft(jobId);
      await loadDetail();
      setNotice({
        body: result.message,
        title: result.title,
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? error.message : "Invoice draft could not be created from the stop.",
        title: "Invoice action failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleIssueInvoice() {
    await handleStopInvoiceAction("issue_invoice");
  }

  async function queueStopInvoiceActionHandoff(action: AssignedInvoiceActionName) {
    if (!appContext || !jobId || !workflowSnapshot?.invoice) {
      return;
    }

    const fallback = buildOfflineStopInvoiceActionHandoff({
      action,
      balanceDueCents: workflowSnapshot.invoice.totals.balanceDueCents,
      currencyCode: workflowSnapshot.invoice.invoice.currencyCode,
      invoiceNumber: workflowSnapshot.invoice.invoice.invoiceNumber
    });
    const result = await createAssignedJobPaymentHandoff(appContext.userId, jobId, fallback.handoff);
    const refreshedHandoffs = await loadAssignedJobPaymentHandoffs(jobId);

    setBillingHandoffs(refreshedHandoffs);
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

  async function handleStopInvoiceAction(action: AssignedInvoiceActionName) {
    if (!jobId || !appContext || !workflowSnapshot?.invoice) return;

    setActiveInlineAction(action);
    setNotice(null);

    try {
      const result = await runAssignedJobInvoiceAction(jobId, action);
      await loadDetail();
      setNotice({
        body: result.message,
        title: result.title,
        tone: result.tone
      });

      if (action === "refresh_payment_page" && result.checkoutUrl) {
        await Linking.openURL(result.checkoutUrl);
      }
    } catch (error) {
      if (isLikelyStopInvoiceActionConnectivityFailure(error)) {
        try {
          await queueStopInvoiceActionHandoff(action);
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
            : "The invoice action could not be completed from the stop.",
        title: "Invoice action failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleQuickManualPayment() {
    if (!jobId || !workflowSnapshot?.invoice) return;

    const amount = Number(quickPaymentAmountInput.trim());

    setActiveInlineAction("record_payment");
    setNotice(null);

    try {
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter the amount collected before recording the field payment.");
      }

      const result = await recordAssignedJobManualPayment(jobId, {
        amountCents: Math.round(amount * 100),
        note: quickPaymentNote.trim() || null,
        tenderType: quickPaymentTenderType
      });
      await loadDetail();
      setQuickPaymentAmountInput("");
      setQuickPaymentNote("");
      setQuickPaymentTenderType("cash");
      setActiveStopSheet(null);
      setResumeRecovery(null);
      if (jobId) {
        await clearStopConsoleRecovery(jobId);
      }
      setNotice({
        body: result.queued
          ? "The field payment is stored on this device and will sync automatically when the connection is back."
          : "The field payment was posted from the stop console.",
        title: result.queued ? "Field payment queued" : "Field payment recorded",
        tone: result.queued ? "warning" : "success"
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? error.message : "Field payment could not be recorded from the stop.",
        title: "Field payment failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleSubmitStopPaymentHandoff() {
    if (!appContext || !jobId) {
      return;
    }

    const note = billingHandoffNote.trim();
    const amount = Number(billingHandoffAmountInput.trim());

    setActiveInlineAction("create_payment_handoff");
    setNotice(null);

    try {
      let payload: CreateTechnicianPaymentHandoffInput;

      if (selectedBillingHandoffKind === "manual_tender") {
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Enter the collected amount before recording a manual tender handoff.");
        }

        payload = {
          amountCents: Math.round(amount * 100),
          kind: selectedBillingHandoffKind,
          note: note || null,
          tenderType: billingHandoffTenderType
        };
      } else {
        if (selectedBillingHandoffKind === "other" && !note) {
          throw new Error("Add a note describing what still needs billing follow-up.");
        }

        payload = {
          kind: selectedBillingHandoffKind,
          note: note || null
        };
      }

      const result = await createAssignedJobPaymentHandoff(appContext.userId, jobId, payload);
      const refreshedHandoffs = await loadAssignedJobPaymentHandoffs(jobId);

      setBillingHandoffs(refreshedHandoffs);
      setSelectedBillingHandoffKind("follow_up_required");
      setBillingHandoffTenderType("cash");
      setBillingHandoffAmountInput(
        workflowSnapshot?.invoice?.totals.balanceDueCents
          ? (workflowSnapshot.invoice.totals.balanceDueCents / 100).toFixed(2)
          : ""
      );
      setBillingHandoffNote("");
      setNotice(
        result.queued
          ? {
              body: "The structured billing handoff is stored on this device and will sync automatically when the connection is back.",
              title: "Billing handoff queued",
              tone: "warning"
            }
          : {
              body: "The billing handoff is saved as a structured office follow-up for this stop.",
              title: "Billing handoff recorded",
              tone: "success"
            }
      );
    } catch (error) {
      setNotice({
        body:
          error instanceof Error
            ? error.message
            : "The billing handoff could not be saved from the stop.",
        title: "Billing handoff failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleSaveStopEstimateLine() {
    if (!appContext || !jobId) return;

    setActiveInlineAction("save_estimate_line");
    setNotice(null);

    try {
      const estimateDetail =
        workflowSnapshot?.estimate ??
        (await ensureAssignedJobEstimateDraft({
          companyId: appContext.companyId,
          jobId,
          technicianUserId: appContext.userId
        }));
      const quantity = parseStopQuantityInput(estimateLineForm.quantity);
      const unitPriceCents = parseStopMoneyInput(estimateLineForm.unitPrice);

      if (!estimateLineForm.name.trim()) {
        throw new Error("Add a line name before saving the estimate item.");
      }

      if (!quantity) {
        throw new Error("Enter a valid quantity before saving the estimate item.");
      }

      if (unitPriceCents === null) {
        throw new Error("Enter a valid unit price before saving the estimate item.");
      }

      const payload = {
        description: estimateLineForm.description.trim() || null,
        itemType: estimateLineForm.itemType,
        name: estimateLineForm.name.trim(),
        quantity,
        taxable: estimateLineForm.taxable,
        unitPriceCents
      } as const;

      const result = estimateLineForm.id
        ? await saveAssignedJobEstimateLineItem(
            {
              companyId: appContext.companyId,
              jobId,
              technicianUserId: appContext.userId
            },
            estimateLineForm.id,
            payload
          )
        : await addAssignedJobEstimateLineItem(
            {
              companyId: appContext.companyId,
              jobId,
              technicianUserId: appContext.userId
            },
            estimateDetail.estimate.id,
            payload
          );

      setInlineEstimateDetail(result);
      await loadDetail();
      setEstimateLineForm(emptyStopEstimateLineForm());
      setActiveStopSheet(null);
      setResumeRecovery(null);
      if (jobId) {
        await clearStopConsoleRecovery(jobId);
      }
      setNotice({
        body:
          result.pendingMutationCount && result.pendingMutationCount > 0
            ? "The estimate line is stored on this device and will sync automatically when the connection is back."
            : "The estimate line is saved from the stop console.",
        title:
          result.pendingMutationCount && result.pendingMutationCount > 0
            ? "Estimate line queued"
            : estimateLineForm.id
              ? "Estimate line updated"
              : "Estimate line added",
        tone:
          result.pendingMutationCount && result.pendingMutationCount > 0 ? "warning" : "success"
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? error.message : "Estimate line could not be saved from the stop.",
        title: "Estimate line failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleBeginPartSourcing(lineItem: EstimateLineItem) {
    setActiveInlineAction("load_part_source");
    setActivePartSourceLineId(lineItem.id);
    setActiveStopSheet("part_source");
    setNotice(null);

    try {
      const estimateDetail = await ensureInlineEstimateDetail(lineItem.id);
      const partSource =
        estimateDetail?.partSources.find((candidate) => candidate.lineItemId === lineItem.id) ?? null;

      setPartSourceForm({
        ...buildStopPartSourceForm(partSource),
        lineItemId: lineItem.id
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? error.message : "Part sourcing could not be opened from the stop.",
        title: "Parts sourcing failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleSaveStopPartSource(nextStatus?: TechnicianAllowedStatus) {
    if (!appContext || !jobId || !partSourceForm.lineItemId || !workflowSnapshot?.estimate) return;

    setActiveInlineAction("save_part_source");
    setActivePartSourceLineId(partSourceForm.lineItemId);
    setNotice(null);

    try {
      const currentJobStatus = detail?.job.status ?? null;
      const estimateDetail = await ensureInlineEstimateDetail(partSourceForm.lineItemId);

      if (!estimateDetail) {
        throw new Error("The estimate detail could not be loaded for this stop.");
      }

      if (!partSourceForm.supplierAccountId && !partSourceForm.supplierName.trim()) {
        throw new Error("Add a supplier before saving the part source.");
      }

      const quotedUnitCostCents = parseStopMoneyInput(partSourceForm.quotedUnitCost);

      if (quotedUnitCostCents === null) {
        throw new Error("Enter a valid supplier unit cost before saving the part source.");
      }

      const result = await saveAssignedJobEstimatePartSource(
        {
          companyId: appContext.companyId,
          jobId,
          technicianUserId: appContext.userId
        },
        estimateDetail.estimate.id,
        {
          availabilityText: partSourceForm.availabilityText.trim() || null,
          lineItemId: partSourceForm.lineItemId,
          notes: partSourceForm.notes.trim() || null,
          quotedUnitCostCents,
          supplierAccountId: partSourceForm.supplierAccountId,
          supplierName: partSourceForm.supplierName.trim() || null,
          supplierPartNumber: partSourceForm.supplierPartNumber.trim() || null
        }
      );

      let chainedStatusQueued = false;
      let chainedStatusError: string | null = null;

      if (nextStatus && nextStatus !== currentJobStatus) {
        try {
          const statusResult = await submitTechnicianStatusChange(
            appContext.companyId,
            appContext.userId,
            jobId,
            { reason: null, toStatus: nextStatus }
          );
          chainedStatusQueued = statusResult.queued;
        } catch (statusError) {
          const message =
            statusError instanceof Error ? statusError.message : "The stop status could not be updated.";

          if (message.toLowerCase().includes("assigned job not found")) {
            router.replace("/jobs");
            return;
          }

          chainedStatusError = message;
        }
      }

      setInlineEstimateDetail(result);
      await loadDetail();
      setPartSourceForm(emptyStopPartSourceForm());
      setActivePartSourceLineId(null);
      setActiveStopSheet(null);
      setResumeRecovery(null);
      if (jobId) {
        await clearStopConsoleRecovery(jobId);
      }
      setNotice({
        body: [
          result.pendingMutationCount && result.pendingMutationCount > 0
            ? "The part source is stored on this device and will sync automatically when the connection is back."
            : "The supplier quote is saved from the stop console.",
          nextStatus && nextStatus !== currentJobStatus
            ? chainedStatusError
              ? `The source saved, but ${formatJobStatusLabel(nextStatus)} still needs attention: ${chainedStatusError}`
              : chainedStatusQueued
                ? `The stop is also marked ${formatJobStatusLabel(nextStatus)} on this device and will sync automatically when the connection is back.`
                : `The stop is also marked ${formatJobStatusLabel(nextStatus)}.`
            : null
        ]
          .filter(Boolean)
          .join(" "),
        title:
          nextStatus && nextStatus !== currentJobStatus
            ? chainedStatusError
              ? "Part source saved, status still open"
              : result.pendingMutationCount && result.pendingMutationCount > 0
                ? "Part source + status queued"
                : "Part source + status saved"
            : result.pendingMutationCount && result.pendingMutationCount > 0
              ? "Part source queued"
              : "Part source saved",
        tone:
          chainedStatusError || (result.pendingMutationCount && result.pendingMutationCount > 0) || chainedStatusQueued
            ? "warning"
            : "success"
      });
    } catch (error) {
      setNotice({
        body: error instanceof Error ? error.message : "Part sourcing could not be saved from the stop.",
        title: "Part source failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  async function handleApproveEstimate(nextStatus?: TechnicianAllowedStatus) {
    if (!appContext || !jobId || !estimateSummary) {
      return;
    }

    if (estimateSummary.estimate.status !== "sent") {
      setNotice({
        body: "Only sent estimates can be approved from the stop.",
        title: "Approval unavailable",
        tone: "warning"
      });
      return;
    }

    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setNotice({
        body: "Draw the customer signature before submitting approval.",
        title: "Signature required",
        tone: "warning"
      });
      return;
    }

    setActiveInlineAction("approve_estimate");
    setNotice(null);

    try {
      const currentJobStatus = detail?.job.status ?? null;
      console.info("[approval-sheet] submit pressed", { jobId });
      const capturedSignature = await signaturePadRef.current.capture();
      console.info("[approval-sheet] signature captured", {
        jobId,
        signatureUri: capturedSignature.uri
      });

      await approveAssignedEstimateFromMobile(appContext.companyId, appContext.userId, jobId, {
        signatureMimeType: capturedSignature.mimeType,
        signatureUri: capturedSignature.uri,
        signedByName: approvalSignerName.trim() || customerDisplayName,
        statement: approvalStatement.trim() || DEFAULT_ESTIMATE_APPROVAL_STATEMENT
      });

      let chainedStatusQueued = false;
      let chainedStatusError: string | null = null;

      if (nextStatus && nextStatus !== currentJobStatus) {
        try {
          const statusResult = await submitTechnicianStatusChange(
            appContext.companyId,
            appContext.userId,
            jobId,
            { reason: null, toStatus: nextStatus }
          );
          chainedStatusQueued = statusResult.queued;
        } catch (statusError) {
          const message =
            statusError instanceof Error ? statusError.message : "The stop status could not be updated.";

          if (message.toLowerCase().includes("assigned job not found")) {
            router.replace("/jobs");
            return;
          }

          chainedStatusError = message;
        }
      }

      await loadDetail();
      setApprovalSignerName("");
      setApprovalStatement(DEFAULT_ESTIMATE_APPROVAL_STATEMENT);
      signaturePadRef.current?.clear();
      setActiveStopSheet(null);
      setResumeRecovery(null);
      if (jobId) {
        await clearStopConsoleRecovery(jobId);
      }
      setNotice({
        body: [
          "Customer approval is captured on this estimate.",
          nextStatus && nextStatus !== currentJobStatus
            ? chainedStatusError
              ? `Approval saved, but ${formatJobStatusLabel(nextStatus)} still needs attention: ${chainedStatusError}`
              : chainedStatusQueued
                ? `The stop is also marked ${formatJobStatusLabel(nextStatus)} on this device and will sync automatically when the connection is back.`
                : `The stop is also marked ${formatJobStatusLabel(nextStatus)}.`
            : null
        ]
          .filter(Boolean)
          .join(" "),
        title:
          nextStatus && nextStatus !== currentJobStatus
            ? chainedStatusError
              ? "Approval saved, status still open"
              : chainedStatusQueued
                ? "Approval + status queued"
                : "Approval + status saved"
            : "Approval saved",
        tone: chainedStatusError || chainedStatusQueued ? "warning" : "success"
      });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The approval signature could not be saved.";
        console.error("[approval-sheet] submit failed", {
          jobId,
          message
        });

        if (message.toLowerCase().includes("assigned job not found")) {
          router.replace("/jobs");
          return;
        }

      setNotice({
        body: message,
        title: "Approval failed",
        tone: "danger"
      });
    } finally {
      setActiveInlineAction(null);
    }
  }

  if (isLoading) return <LoadingState body="Loading the assigned job workspace." title="Loading job" />;
  if (!detail) {
    return (
      <Screen>
        <ErrorState
          actions={<View style={{ gap: 12 }}><Button onPress={() => void handleRefresh()}>Retry</Button><Button onPress={() => router.replace("/jobs")} tone="secondary">Back to jobs</Button></View>}
          body={errorMessage ?? "This assigned stop could not be loaded."}
          eyebrow="Technician workspace"
          title="Stop unavailable"
        />
      </Screen>
    );
  }

  const technicianPublicProfile = appContext ? {
    fullName: appContext.profile.full_name,
    meetYourMechanicEnabled: appContext.profile.meet_your_mechanic_enabled,
    profilePhotoPath: appContext.profile.profile_photo_path,
    technicianBio: appContext.profile.technician_bio,
    technicianCertifications: appContext.profile.technician_certifications ?? [],
    yearsExperience: appContext.profile.years_experience
  } : null;
  const customerUpdateMissingFields = getPublicTechnicianProfileMissingFields(technicianPublicProfile);
  const customerUpdatesReady = Boolean(detail.job.scheduledStartAt) && hasPublicTechnicianProfile(technicianPublicProfile);
  const customerUpdatesMessage = !detail.job.scheduledStartAt ? "The office still needs a confirmed schedule before they can send appointment timing." : customerUpdatesReady ? "Schedule and mechanic-card details are ready for office customer updates." : `Office customer updates are waiting on ${customerUpdateMissingFields.join(", ")}.`;
  const customerUpdatesLabel = !detail.job.scheduledStartAt ? "Needs schedule" : customerUpdatesReady ? "Ready" : "Needs profile";
  const scheduledLabel = formatJobDateTime(detail.job.scheduledStartAt, appContext?.company.timezone);
  const arrivalWindowLabel = formatArrivalWindow(detail.job.arrivalWindowStartAt, detail.job.arrivalWindowEndAt, appContext?.company.timezone) ?? "No arrival window";
  const canCallCustomer = Boolean(detail.customer.phone);
  const canTextCustomer = Boolean(detail.customer.phone);
  const canOpenMaps = Boolean(detail.serviceSite ?? detail.primaryAddress);
  const canCollectPayment = Boolean(workflowSnapshot?.invoice?.invoice.paymentUrl) && (workflowSnapshot?.invoice?.totals.balanceDueCents ?? 0) > 0;
  const customerDisplayName = getCustomerDisplayName(detail.customer);
  const fieldStageSummary = getFieldStopStageSummary({
    balanceDueCents: workflowSnapshot?.invoice?.totals.balanceDueCents ?? null,
    estimateStatus: workflowSnapshot?.estimate?.estimate.status ?? null,
    hadPartialFailure: workflowSnapshot?.hadPartialFailure ?? false,
    inspectionStatus: workflowSnapshot?.inspection?.inspection.status ?? null,
    invoiceStatus: workflowSnapshot?.invoice?.invoice.status ?? null,
    jobStatus: detail.job.status,
    photoCount: workflowSnapshot?.photoCount ?? null
  });
  const fieldStageTone = getFieldStageTone(fieldStageSummary.stage, Boolean(fieldStageSummary.blocker));
  const currentStageIndex = fieldStopStages.indexOf(fieldStageSummary.stage);
  const completionGateReasons = [
    workflowSnapshot?.hadPartialFailure ? "Refresh the stop snapshot before closing so the office is not relying on stale artifacts." : null,
    workflowSnapshot?.inspection?.inspection.status !== "completed" ? "Complete the inspection first." : null,
    workflowSnapshot?.estimate?.estimate.status === "draft" ? "Finish or review the estimate before billing." : null,
    workflowSnapshot?.estimate?.estimate.status === "sent" ? "Estimate approval is still pending." : null,
    workflowSnapshot?.estimate?.estimate.status === "declined" ? "The estimate was declined and needs office follow-up." : null,
    workflowSnapshot?.estimate?.estimate.status === "void" ? "The estimate was voided and needs review before billing." : null,
    !workflowSnapshot?.invoice ? "Create the invoice before closing the stop." : null,
    workflowSnapshot?.invoice && workflowSnapshot.invoice.totals.balanceDueCents > 0 ? `Collect ${formatCurrencyFromCents(workflowSnapshot.invoice.totals.balanceDueCents, workflowSnapshot.invoice.invoice.currencyCode)} or leave a clear payment handoff.` : null,
    (workflowSnapshot?.photoCount ?? 0) === 0 ? "Capture at least one supporting photo." : null
  ].filter((value): value is string => Boolean(value));
  const completionGateReason = completionGateReasons[0] ?? null;
  const completionGateSummary = summarizeReasons(completionGateReasons);
  const nextAssignedStopTimeLabel = nextAssignedJob
    ? nextAssignedJob.scheduledStartAt
      ? formatJobDateTime(nextAssignedJob.scheduledStartAt, appContext?.company.timezone)
      : "Start time not set"
    : "No next stop assigned";
  const stageProgressLabels = fieldStopStages.map((stage, index) => ({ label: fieldStageLabels[stage], stage, tone: index < currentStageIndex ? ("success" as const) : index === currentStageIndex ? fieldStageTone : ("neutral" as const) }));
  const toolsUnavailableMessage = [!canCallCustomer ? "Customer phone is missing." : null, !canOpenMaps ? "Service location is missing." : null].filter((value): value is string => Boolean(value)).join(" ");
  const navigationReturnPrimaryAction =
    detail.job.status === "scheduled" || detail.job.status === "dispatched"
      ? {
          label: "Mark en route",
          onPress: () => {
            closeStopSheet();
            void handleStatusChange("en_route");
          },
          tone: "primary" as const
        }
      : detail.job.status === "en_route"
        ? {
            label: "Mark arrived",
            onPress: () => {
              closeStopSheet();
              void handleStatusChange("arrived");
            },
            tone: "primary" as const
          }
        : {
            label: "Resume current stop",
            onPress: closeStopSheet,
            tone: "secondary" as const
          };
  const estimateSummary = workflowSnapshot?.estimate ?? null;
  const invoiceSummary = workflowSnapshot?.invoice ?? null;
  const hasPartLines = Boolean(
    estimateSummary?.lineItems.some((lineItem) => lineItem.itemType === "part")
  );
  const partLines = estimateSummary
    ? estimateSummary.lineItems.filter((lineItem) => lineItem.itemType === "part")
    : [];
  const estimateIsDraft = estimateSummary?.estimate.status === "draft";
  const technicianStatusActions = getAllowedTechnicianNextJobStatuses(detail.job.status);
  const statusDisabledReasons = buildStopStatusDisabledReasons({
    completionGateReason,
    currentStatus: detail.job.status,
    estimateStatus: estimateSummary?.estimate.status ?? null,
    fieldStage: fieldStageSummary.stage,
    hasPartLines,
    inspectionCompleted: workflowSnapshot?.inspection?.inspection.status === "completed",
    invoiceExists: Boolean(invoiceSummary)
  });
  const quickEstimateLines = estimateSummary
    ? estimateSummary.lineItems.filter((lineItem) => !lineItem.estimateSectionId).slice(0, 3)
    : [];
  const partSourceByLineItemId = new Map(
    (inlineEstimateDetail?.partSources ?? []).map((partSource) => [partSource.lineItemId, partSource])
  );
  const sourcedPartLines = partLines.filter((lineItem) =>
    hasSavedPartSource(partSourceByLineItemId.get(lineItem.id))
  );
  const unsourcedPartLines = partLines.filter(
    (lineItem) => !hasSavedPartSource(partSourceByLineItemId.get(lineItem.id))
  );
  const selectedPartSourceLine = partSourceForm.lineItemId
    ? estimateSummary?.lineItems.find((lineItem) => lineItem.id === partSourceForm.lineItemId) ?? null
    : null;
  const nextPartLineToSource = selectedPartSourceLine ?? unsourcedPartLines[0] ?? partLines[0] ?? null;
  const supplierFilter = partSourceForm.supplierName.trim().toLowerCase();
  const filteredSuppliers = (inlineEstimateDetail?.supplierAccounts ?? [])
    .filter((supplierAccount) =>
      supplierFilter ? supplierAccount.name.toLowerCase().includes(supplierFilter) : true
    )
    .slice(0, 5);
  const recentSupplierChoices = Array.from(
    new Map(
      (inlineEstimateDetail?.partSources ?? [])
        .filter((partSource) => partSource.selectedSupplierAccount)
        .map((partSource) => [
          partSource.selectedSupplierAccount!.id,
          partSource.selectedSupplierAccount!
        ])
    ).values()
  )
    .filter((supplierAccount) => supplierAccount.id !== partSourceForm.supplierAccountId)
    .slice(0, 4);
  const groupedEstimateLineCount = estimateSummary
    ? estimateSummary.lineItems.filter((lineItem) => lineItem.estimateSectionId).length
    : 0;
  const approvalActionLabel =
    estimateSummary?.estimate.status === "sent" ? "Capture approval" : !estimateSummary ? "Build estimate" : "Open estimate";
  const estimateSummaryLines = !estimateSummary
    ? ["No estimate is attached to this stop yet."]
    : [
        `Estimate ${estimateSummary.estimate.estimateNumber}`,
        formatCurrencyFromCents(estimateSummary.totals.totalCents, estimateSummary.estimate.currencyCode),
        estimateSummary.estimate.status === "sent"
            ? "Waiting on customer approval."
            : estimateSummary.estimate.status === "draft"
              ? "Draft still needs review."
              : null
      ].filter(Boolean);
  const invoiceSummaryLines = !invoiceSummary
    ? ["No invoice is attached to this stop yet."]
    : [
        `Invoice ${invoiceSummary.invoice.invoiceNumber}`,
        `Balance ${formatCurrencyFromCents(invoiceSummary.totals.balanceDueCents, invoiceSummary.invoice.currencyCode)}`,
        invoiceSummary.invoice.status === "paid"
          ? "Payment is complete."
          : invoiceSummary.invoice.paymentUrl
            ? "Live payment page is ready."
            : "Payment page still needs prep."
      ];
  const quickPaymentAmountPresets = buildStopAmountPresetChoices(
    invoiceSummary?.totals.balanceDueCents ?? 0
  );
  const quickEstimateLineNameChoices = buildStopEstimateLineNameChoices(estimateLineForm.itemType);
  const quickEstimateQuantityChoices = ["0.5", "1", "2"] as const;
  const quickCallOutcomeChoices = buildStopCustomerContactOutcomeChoices(customerContactMode);
  const quickPartSourceNoteChoices = buildStopPartSourceNoteChoices();
  const selectedPartWorkflowOption = getStopPartWorkflowOutcomeOption(partSourceForm.workflowOutcome);
  const canMoveToWaitingParts = Boolean(
    technicianStatusActions.includes("waiting_parts") && !statusDisabledReasons.waiting_parts
  );
  const canMoveToRepairing = Boolean(
    technicianStatusActions.includes("repairing") && !statusDisabledReasons.repairing
  );
  const suggestedApprovalStatus =
    estimateSummary?.estimate.status === "sent" &&
    fieldStageSummary.stage === "approval" &&
    technicianStatusActions.includes("repairing") &&
    detail.job.status !== "repairing"
      ? "repairing"
      : null;
  const approvalPrimaryActionLabel =
    suggestedApprovalStatus === "repairing" ? "Approve + start repair" : "Approve estimate";
  const suggestedPartSourceStatus =
    partSourceForm.workflowOutcome === "runner_pickup" || partSourceForm.workflowOutcome === "return_visit"
      ? canMoveToWaitingParts && detail.job.status !== "waiting_parts"
        ? "waiting_parts"
        : null
      : (partSourceForm.workflowOutcome === "install_now" ||
            partSourceForm.workflowOutcome === "same_day_pickup") &&
          detail.job.status === "waiting_parts" &&
          canMoveToRepairing
        ? "repairing"
        : null;
  const partSourceSuggestedActionLabel =
    suggestedPartSourceStatus === "waiting_parts"
      ? "Save + hold on parts"
      : suggestedPartSourceStatus === "repairing"
        ? "Save + resume repair"
        : null;
  const quickPaymentNoteChoices = buildStopPaymentNoteChoices(quickPaymentTenderType);
  const billingHandoffOption =
    stopPaymentHandoffKindOptions.find((option) => option.kind === selectedBillingHandoffKind) ??
    stopPaymentHandoffKindOptions[0]!;
  const billingHandoffNoteChoices = buildStopBillingHandoffNoteChoices(
    selectedBillingHandoffKind,
    billingHandoffTenderType
  );
  const latestBillingHandoff = billingHandoffs[0] ?? null;
  const stopDispatchEntries = jobId ? inboxEntries.filter((entry) => entry.jobId === jobId) : [];
  const approvalThreadEntry: StopFieldThreadEntry | null = estimateSummary
    ? {
        body:
          estimateSummary.estimate.status === "accepted"
            ? "Customer approval is complete and the stop can move through repair or billing without another office callback."
            : estimateSummary.estimate.status === "sent"
              ? "The estimate is waiting on customer approval. Keep the next field move attached to this stop instead of handling it in a separate workflow."
              : estimateSummary.estimate.status === "declined"
                ? "The estimate was declined. Review the repair plan with the office before continuing work tied to that approval."
                : estimateSummary.estimate.status === "void"
                  ? "The estimate was voided and the office needs to reset the approval path before billing continues."
                  : "Estimate work is still being prepared for approval.",
        id: `approval-${estimateSummary.estimate.id}`,
        occurredAt: estimateSummary.estimate.updatedAt,
        source: "approval",
        status: estimateSummary.estimate.status,
        title: `Estimate ${estimateSummary.estimate.estimateNumber} approval`
      }
    : null;
  const fieldThreadEntries: StopFieldThreadEntry[] = [
    ...stopDispatchEntries.map(
      (entry): StopFieldThreadEntry => ({
        body: entry.body,
        entryType: entry.type,
        id: `dispatch-${entry.id}`,
        occurredAt: entry.createdAt,
        source: "dispatch",
        title: entry.title,
        unread: !entry.readAt
      })
    ),
    ...detail.notes.map(
      (note): StopFieldThreadEntry => ({
        author: note.authorUserId === session?.user.id ? "you" : "office",
        body: note.body,
        id: `note-${note.id}`,
        occurredAt: note.createdAt,
        source: "note"
      })
    ),
    ...detail.communications.map(
      (communication): StopFieldThreadEntry => ({
        body: communication.bodyText,
        channel: communication.channel,
        communicationType: communication.communicationType,
        errorMessage: communication.errorMessage,
        id: `customer-${communication.id}`,
        occurredAt:
          communication.deliveredAt ??
          communication.sentAt ??
          communication.failedAt ??
          communication.queuedAt,
        recipientName: communication.recipientName,
        recipientPhone: communication.recipientPhone,
        source: "customer",
        status: communication.status
      })
    ),
    ...billingHandoffs.map(
      (handoff): StopFieldThreadEntry => ({
        amountCents: handoff.amountCents,
        id: `billing-${handoff.id}`,
        kind: handoff.kind,
        note: handoff.note,
        occurredAt: handoff.resolvedAt ?? handoff.createdAt,
        pendingSync: Boolean(handoff.pendingSync),
        resolutionNote: handoff.resolutionNote,
        source: "billing",
        status: handoff.status,
        tenderType: handoff.tenderType
      })
    ),
    ...(approvalThreadEntry ? [approvalThreadEntry] : [])
  ].sort((left, right) => {
    const leftTime = new Date(left.occurredAt).getTime();
    const rightTime = new Date(right.occurredAt).getTime();

    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id.localeCompare(left.id);
  });
  const stopWatchouts = [
    detail.job.customerConcern
      ? {
          body: detail.job.customerConcern,
          title: "Customer concern",
          tone: "info" as const
        }
      : null,
    toolsUnavailableMessage
      ? {
          body: toolsUnavailableMessage,
          title: "Some field tools are unavailable",
          tone: "warning" as const
        }
      : null,
    !customerUpdatesReady
      ? {
          body: customerUpdatesMessage,
          title: `Office updates: ${customerUpdatesLabel}`,
          tone: "warning" as const
        }
      : null,
    workflowSnapshot?.hadPartialFailure
      ? {
          body: "Some artifact details could not be refreshed from the field. Reopen estimate, invoice, or photos before closing the stop.",
          title: "Workflow snapshot is partial",
          tone: "warning" as const
        }
      : null
  ].filter(
    (
      value
    ): value is {
      body: string;
      title: string;
      tone: "info" | "warning";
    } => Boolean(value)
  );
  const latestStatusHistoryEntry = detail.statusHistory[0] ?? null;
  const remainingStatusHistory = detail.statusHistory.slice(latestStatusHistoryEntry ? 1 : 0);
  const visibleStatusHistory = showFullStatusHistory
    ? remainingStatusHistory
    : remainingStatusHistory.slice(0, 2);
  const hiddenStatusHistoryCount = Math.max(0, remainingStatusHistory.length - visibleStatusHistory.length);
  const stopBlockers: Array<{
    actionLabel: string;
    body: string;
    id: string;
    onPress: () => void;
    title: string;
  }> = [];

  if (workflowSnapshot?.hadPartialFailure) {
    stopBlockers.push({
      actionLabel: "Refresh stop",
      body: "Some field artifact details are stale. Refresh before you trust closeout or billing state.",
      id: "refresh",
      onPress: () => {
        void handleRefresh();
      },
      title: "Stop snapshot needs refresh"
    });
  }

  if (workflowSnapshot?.inspection?.inspection.status !== "completed") {
    stopBlockers.push({
      actionLabel: "Open inspection",
      body: "The stop cannot close until the inspection is completed.",
      id: "inspection",
      onPress: () => {
        void handleOpenInspection();
      },
      title: "Inspection is incomplete"
    });
  }

  if (!estimateSummary) {
    stopBlockers.push({
      actionLabel: "Start estimate",
      body: "Pricing still needs a draft estimate before this stop can move into approval or billing.",
      id: "estimate_missing",
      onPress: () => {
        void handleCreateEstimateDraft();
      },
      title: "Estimate is missing"
    });
  } else if (estimateSummary.estimate.status === "draft") {
    stopBlockers.push({
      actionLabel: quickEstimateLines.length ? "Review estimate" : "Add quick line",
      body: quickEstimateLines.length
        ? "The estimate is still a draft. Review pricing or send it for approval."
        : "The estimate draft has no quick lines yet. Add the common field line before sending it on."
      ,
      id: "estimate_draft",
      onPress: () => {
        if (quickEstimateLines.length) {
          router.push(`/jobs/${jobId}/estimate`);
          return;
        }

        openEstimateLineEditor();
      },
      title: "Estimate still needs review"
    });
  } else if (estimateSummary.estimate.status === "sent") {
    stopBlockers.push({
      actionLabel: "Capture approval",
      body: "Customer approval is still pending on this stop.",
      id: "estimate_sent",
      onPress: openApprovalSheet,
      title: "Estimate approval is pending"
    });
  } else if (estimateSummary.estimate.status === "declined" || estimateSummary.estimate.status === "void") {
    stopBlockers.push({
      actionLabel: "Open estimate",
      body: "The current estimate state needs review before billing can continue.",
      id: "estimate_review",
      onPress: () => router.push(`/jobs/${jobId}/estimate`),
      title: "Estimate needs review"
    });
  }

  if (!invoiceSummary) {
    stopBlockers.push({
      actionLabel: "Create invoice",
      body: "Billing cannot finish until an invoice draft exists for this stop.",
      id: "invoice_missing",
      onPress: () => {
        void handleCreateInvoiceDraft();
      },
      title: "Invoice is missing"
    });
  } else if (invoiceSummary.totals.balanceDueCents > 0) {
    stopBlockers.push({
      actionLabel: "Resolve payment",
      body: `Balance due ${formatCurrencyFromCents(invoiceSummary.totals.balanceDueCents, invoiceSummary.invoice.currencyCode)} still needs a field payment or a clear handoff.`,
      id: "invoice_balance_due",
      onPress: () => openQuickPaymentSheet(),
      title: "Payment is still open"
    });
  }

  if ((workflowSnapshot?.photoCount ?? 0) === 0) {
    stopBlockers.push({
      actionLabel: "Add evidence",
      body: "At least one supporting photo or video is still missing from the stop file.",
      id: "photos_missing",
      onPress: () => {
        void handleOpenEvidenceSheet();
      },
      title: "Evidence is missing"
    });
  }

  const primaryAction = detail.job.status === "completed"
    ? nextAssignedJob
      ? {
          label: "Open next stop",
          onPress: openNextAssignedStop,
          tone: "primary" as const
        }
      : {
          label: "Back to My Work",
          onPress: () => router.replace("/jobs"),
          tone: "secondary" as const
        }
    : workflowSnapshot?.hadPartialFailure
    ? { label: "Refresh stop", onPress: () => { void handleRefresh(); }, tone: "secondary" as const }
    : fieldStageSummary.stage === "travel"
      ? detail.job.status === "scheduled" || detail.job.status === "dispatched" ? { label: "Mark en route", onPress: () => { void handleStatusChange("en_route"); }, tone: "primary" as const }
      : detail.job.status === "en_route" ? { label: "Mark arrived", onPress: () => { void handleStatusChange("arrived"); }, tone: "primary" as const }
      : canOpenMaps ? { label: fieldStageSummary.nextActionLabel, onPress: () => { void handleOpenMaps(); }, tone: "secondary" as const }
      : canCallCustomer ? { label: "Call customer", onPress: () => { void handleCallCustomer(); }, tone: "secondary" as const } : null
    : fieldStageSummary.stage === "inspection"
      ? detail.job.status === "arrived" ? { label: "Start diagnosis", onPress: () => { void handleStatusChange("diagnosing"); }, tone: "primary" as const }
      : { label: "Open inspection", onPress: () => { void handleOpenInspection(); }, tone: "primary" as const }
    : fieldStageSummary.stage === "approval"
        ? { label: workflowSnapshot?.estimate?.estimate.status === "sent" ? "Capture approval" : "Open estimate", onPress: () => workflowSnapshot?.estimate?.estimate.status === "sent" ? openApprovalSheet() : router.push(`/jobs/${jobId}/estimate`), tone: workflowSnapshot?.estimate?.estimate.status === "sent" ? ("primary" as const) : ("secondary" as const) }
        : fieldStageSummary.stage === "parts"
          ? unsourcedPartLines.length && nextPartLineToSource
            ? {
                label: "Source next part",
                onPress: () => {
                  void handleBeginPartSourcing(nextPartLineToSource);
                },
                tone: "primary" as const
              }
            : detail.job.status === "waiting_parts" && canMoveToRepairing
              ? {
                  label: "Mark repairing",
                  onPress: () => {
                    void handleStatusChange("repairing");
                  },
                  tone: "secondary" as const
                }
              : {
                  label: "Review parts",
                  onPress: () => {
                    if (nextPartLineToSource) {
                      void handleBeginPartSourcing(nextPartLineToSource);
                      return;
                    }

                    router.push(`/jobs/${jobId}/estimate`);
                  },
                  tone: "secondary" as const
                }
          : fieldStageSummary.stage === "repair"
            ? (workflowSnapshot?.photoCount ?? 0) === 0 ? { label: "Add evidence", onPress: () => { void handleOpenEvidenceSheet(); }, tone: "secondary" as const } : { label: "Mark ready for payment", onPress: () => { void handleStatusChange("ready_for_payment"); }, tone: "primary" as const }
        : fieldStageSummary.stage === "billing"
          ? !workflowSnapshot?.invoice
            ? { label: "Create invoice", onPress: () => router.push(`/jobs/${jobId}/invoice`), tone: "primary" as const }
            : { label: invoiceSummary?.totals.balanceDueCents ? "Open billing console" : "Review billing", onPress: openQuickPaymentSheet, tone: "primary" as const }
          : fieldStageSummary.stage === "closeout"
            ? (workflowSnapshot?.photoCount ?? 0) === 0 ? { label: "Add evidence", onPress: () => { void handleOpenEvidenceSheet(); }, tone: "primary" as const }
            : !completionGateReasons.length ? { label: "Review closeout", onPress: openCloseoutSheet, tone: "success" as const }
            : null
            : { label: "Open invoice", onPress: () => router.push(`/jobs/${jobId}/invoice`), tone: "secondary" as const };
  const quickActions: QuickAction[] = [];
  if (canCallCustomer) {
    quickActions.push({ id: "call", label: "Call customer", onPress: () => { void handleCallCustomer(); }, tone: fieldStageSummary.stage === "travel" && !canOpenMaps ? "primary" : "tertiary" });
  }
  if (canTextCustomer) {
    quickActions.push({ id: "text", label: "Text customer", onPress: () => { void handleTextCustomer(); }, tone: fieldStageSummary.stage === "travel" && !canOpenMaps && !canCallCustomer ? "primary" : "tertiary" });
  }
  if (canOpenMaps) {
    quickActions.push({ id: "navigate", label: "Navigate", onPress: () => { void handleOpenMaps(); }, tone: fieldStageSummary.stage === "travel" ? "primary" : "tertiary" });
  }
  quickActions.push(
    { id: "inspection", label: workflowSnapshot?.inspection?.inspection.status === "completed" ? "Inspection done" : "Open inspection", onPress: () => { void handleOpenInspection(); }, tone: fieldStageSummary.stage === "inspection" ? "primary" : "secondary" },
    {
      id: "estimate",
      label:
        !workflowSnapshot?.estimate
          ? "Build estimate"
          : workflowSnapshot?.estimate?.estimate.status === "sent"
            ? "Capture approval"
            : fieldStageSummary.stage === "parts"
              ? unsourcedPartLines.length
                ? "Source next part"
                : "Review parts"
              : "Open estimate",
      onPress: () => {
        if (workflowSnapshot?.estimate?.estimate.status === "sent") {
          openApprovalSheet();
          return;
        }

        if (fieldStageSummary.stage === "parts" && nextPartLineToSource) {
          void handleBeginPartSourcing(nextPartLineToSource);
          return;
        }

        router.push(`/jobs/${jobId}/estimate`);
      },
      tone:
        fieldStageSummary.stage === "approval" || fieldStageSummary.stage === "parts" || !workflowSnapshot?.estimate
          ? "primary"
          : "secondary"
    },
    { id: "photos", label: (workflowSnapshot?.photoCount ?? 0) > 0 ? `Evidence (${workflowSnapshot?.photoCount ?? 0})` : "Add evidence", onPress: () => { void handleOpenEvidenceSheet(); }, tone: fieldStageSummary.stage === "closeout" && (workflowSnapshot?.photoCount ?? 0) === 0 ? "primary" : "secondary" },
    { id: "invoice", label: !workflowSnapshot?.invoice ? "Create invoice" : canCollectPayment ? "Billing console" : "Review billing", onPress: () => { if (!workflowSnapshot?.invoice) { router.push(`/jobs/${jobId}/invoice`); return; } openQuickPaymentSheet(); }, tone: fieldStageSummary.stage === "billing" || !workflowSnapshot?.invoice ? "primary" : "secondary" }
  );
  if (detail.job.status !== "completed") {
    quickActions.push({
      id: "closeout",
      label: completionGateReasons.length ? "Closeout checks" : "Finish stop",
      onPress: openCloseoutSheet,
      tone: fieldStageSummary.stage === "closeout" ? "primary" : "secondary"
    });
  } else if (nextAssignedJob) {
    quickActions.push({
      id: "next_stop",
      label: "Open next stop",
      onPress: openNextAssignedStop,
      tone: "primary"
    });
  }
  const dockActions = quickActions.filter(
    (action) => !primaryAction || action.label !== primaryAction.label
  );

  return (
    <Screen>
      <ScreenScrollView
        contentContainerStyle={{ paddingBottom: mobileTheme.spacing[11] + mobileTheme.spacing[8] }}
        onScroll={handleStopScroll}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        scrollEventThrottle={16}
      >
        <View
          style={{
            backgroundColor: mobileTheme.colors.surface.base,
            borderRadius: mobileTheme.radius.xl,
            borderWidth: 1,
            borderColor: mobileTheme.colors.border.subtle,
            padding: mobileTheme.spacing[2],
            gap: 10
          }}
        >
          <Text
            style={{
              color: mobileTheme.colors.brand.warm,
              fontFamily: mobileTheme.typography.family.body,
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.8,
              textTransform: "uppercase"
            }}
          >
            Assigned stop
          </Text>
          <Text
            style={{
              color: mobileTheme.colors.text.strong,
              fontFamily: mobileTheme.typography.family.display,
              fontSize: 20,
              fontWeight: "700",
              lineHeight: 22
            }}
          >
            {formatJobTitleLabel(detail.job.title)}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8
            }}
          >
            <Text
              style={{
                color: mobileTheme.colors.text.muted,
                flex: 1,
                flexShrink: 1,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 12,
                lineHeight: 16
              }}
            >
              {`${customerDisplayName} · ${detail.vehicle.year ? `${detail.vehicle.year} ` : ""}${detail.vehicle.make} ${detail.vehicle.model}`}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <StatusBadge status={detail.job.status} />
              <PriorityBadge value={detail.job.priority} />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.replace("/jobs")}
            style={{ alignSelf: "flex-start" }}
          >
            <Text
              style={{
                color: mobileTheme.colors.brand.warm,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 12,
                fontWeight: "600"
              }}
            >
              {"< Back to My Work"}
            </Text>
          </Pressable>
        </View>

        {errorMessage ? <Notice actions={<Button onPress={() => void handleRefresh()} tone="secondary">Retry refresh</Button>} body={errorMessage} title="Refresh failed" tone="danger" /> : null}
        {notice ? <Notice body={notice.body} title={notice.title} tone={notice.tone} /> : null}
        {detail.pendingMutationCount ? <Notice body={`${detail.pendingMutationCount} stop update${detail.pendingMutationCount === 1 ? "" : "s"} are stored on this device and will sync automatically when the app reconnects.`} title="Offline queue" tone="warning" /> : null}
        {resumeRecovery && activeStopSheet === null ? (
          <Notice
            actions={
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button fullWidth={false} onPress={() => void handleResumeRecovery()} tone="secondary">
                  Resume
                </Button>
                <Button fullWidth={false} onPress={() => void handleDismissRecovery()} tone="tertiary">
                  Dismiss
                </Button>
              </View>
            }
            body={`You were ${resumeRecovery.summary} on this stop. Reopen that sheet instead of rebuilding the step from memory.`}
            title="Resume where you left off"
            tone="brand"
          />
        ) : null}

        <SectionCard eyebrow="Stop console" surface="flat" title="Field workboard">
          <View style={{ gap: mobileTheme.spacing[4] }}>
            <Card
              style={{
                backgroundColor: mobileTheme.colors.surface.inverse,
                borderColor: "transparent",
                gap: mobileTheme.spacing[3]
              }}
              tone="raised"
            >
              <View
                style={{
                  alignItems: "flex-start",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: mobileTheme.spacing[3],
                  justifyContent: "space-between"
                }}
              >
                <View style={{ flex: 1, gap: mobileTheme.spacing[2], minWidth: 220 }}>
                  <Text
                    style={{
                      color: "#d7e5f7",
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1.1,
                      textTransform: "uppercase"
                    }}
                  >
                    Current stage
                  </Text>
                  <Text
                    style={{
                      color: mobileTheme.colors.text.inverse,
                      fontFamily: mobileTheme.typography.family.display,
                      fontSize: 30,
                      fontWeight: "700",
                      lineHeight: 31
                    }}
                  >
                    {fieldStageSummary.label}
                  </Text>
                  <Text
                    style={{
                      color: "#e8f0f8",
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 14,
                      lineHeight: 20
                    }}
                  >
                    {fieldStageSummary.detail}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-start", gap: mobileTheme.spacing[2] }}>
                  <Badge tone={fieldStageTone}>{fieldStageLabels[fieldStageSummary.stage]}</Badge>
                  <StatusBadge status={detail.job.status} />
                  <PriorityBadge value={detail.job.priority} />
                </View>
              </View>

              <View
                style={{
                  backgroundColor: "rgba(255, 253, 249, 0.08)",
                  borderColor: "rgba(255, 253, 249, 0.12)",
                  borderWidth: 1,
                  borderRadius: mobileTheme.radius.xl,
                  gap: mobileTheme.spacing[2],
                  padding: mobileTheme.spacing[4]
                }}
              >
                <View style={{ gap: mobileTheme.spacing[1] }}>
                  <Text
                    style={{
                      color: "#cfdded",
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1,
                      textTransform: "uppercase"
                    }}
                  >
                    Next move
                  </Text>
                  <Text
                    style={{
                      color: mobileTheme.colors.text.inverse,
                      fontFamily: mobileTheme.typography.family.display,
                      fontSize: 20,
                      fontWeight: "700",
                      lineHeight: 22
                    }}
                  >
                    {fieldStageSummary.nextActionLabel}
                  </Text>
                </View>
                <Text
                  style={{
                    color: "#d7e5f7",
                    fontFamily: mobileTheme.typography.family.body,
                    fontSize: 13,
                    lineHeight: 18
                  }}
                >
                  {fieldStageSummary.blocker
                    ? fieldStageSummary.blocker
                    : "Run the next move from this stop before jumping into deeper screens."}
                </Text>
              </View>
            </Card>

            <View aria-hidden style={{ height: mobileTheme.spacing[8] }} />

            {nextAssignedJob && (fieldStageSummary.stage === "closeout" || detail.job.status === "completed") ? (
              <Card tone="subtle">
                <View style={{ gap: mobileTheme.spacing[3] }}>
                  <Text
                    style={{
                      color: mobileTheme.colors.text.muted,
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1,
                      textTransform: "uppercase"
                    }}
                  >
                    Up next after this stop
                  </Text>
                  <CardCopy>
                    Keep the next assignment visible here so the handoff from payment and closeout does not send you back through the job list.
                  </CardCopy>
                  <DetailRow label="Next stop" value={nextAssignedJob.title} />
                  <DetailRow label="Customer" value={nextAssignedJob.customerDisplayName} />
                  <DetailRow label="When" value={nextAssignedStopTimeLabel} />
                  <DetailRow
                    label="Location"
                    value={nextAssignedJob.addressSummary ?? nextAssignedJob.serviceSiteSummary ?? "Location missing"}
                  />
                  <Button fullWidth={false} onPress={openNextAssignedStop} tone="secondary">
                    Open next stop
                  </Button>
                </View>
              </Card>
            ) : null}

            <View style={{ gap: mobileTheme.spacing[3] }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 220 }}>
                  <Card style={{ gap: 8, padding: mobileTheme.spacing[3] }} tone="subtle">
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Badge tone={estimateSummary?.estimate.status === "accepted" ? "success" : estimateSummary?.estimate.status === "sent" ? "warning" : "info"}>
                          {estimateSummary?.estimate.status === "accepted"
                            ? "Approved"
                            : estimateSummary?.estimate.status === "sent"
                              ? "Approval pending"
                              : estimateSummary
                                ? "Estimate open"
                                : "Estimate missing"}
                        </Badge>
                      </View>
                      <Text style={{ color: "#111827", fontSize: 17, fontWeight: "700" }}>Estimate and approval</Text>
                        {estimateSummaryLines.map((line) => (
                          <Text key={line} style={{ color: "#374151", fontSize: 14, lineHeight: 19 }}>
                            {line}
                          </Text>
                        ))}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {!estimateSummary ? (
                          <Button
                            fullWidth={false}
                            loading={activeInlineAction === "create_estimate"}
                            onPress={() => void handleCreateEstimateDraft()}
                            tone="primary"
                          >
                            Start estimate draft
                          </Button>
                        ) : null}
                        <Button
                          fullWidth={false}
                          onPress={() =>
                            estimateSummary?.estimate.status === "sent"
                              ? openApprovalSheet()
                              : router.push(`/jobs/${jobId}/estimate`)
                          }
                          tone={estimateSummary?.estimate.status === "sent" ? "primary" : "secondary"}
                        >
                          {approvalActionLabel}
                        </Button>
                      </View>
                      {estimateSummary ? (
                        <View style={{ gap: 8 }}>
                          {partLines.length ? (
                            <Notice
                              body={
                                unsourcedPartLines.length
                                  ? `${unsourcedPartLines.length} of ${partLines.length} part line${partLines.length === 1 ? "" : "s"} still need a supplier, price, or ETA.`
                                  : detail.job.status === "waiting_parts"
                                    ? `${sourcedPartLines.length} part line${sourcedPartLines.length === 1 ? "" : "s"} are sourced and the stop is waiting on parts.`
                                    : `${sourcedPartLines.length} part line${sourcedPartLines.length === 1 ? "" : "s"} already have supplier pricing and availability attached.`
                              }
                              title={unsourcedPartLines.length ? "Parts still need a decision" : "Parts are sourced"}
                              tone={unsourcedPartLines.length ? "warning" : "brand"}
                            />
                          ) : null}
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                            <DetailRow
                              label="Quick lines"
                              value={`${quickEstimateLines.length}${groupedEstimateLineCount ? ` + ${groupedEstimateLineCount} grouped` : ""}`}
                            />
                            <DetailRow
                              label="Parts"
                              value={
                                partLines.length
                                  ? unsourcedPartLines.length
                                    ? `${unsourcedPartLines.length} unsourced`
                                    : `${sourcedPartLines.length} sourced`
                                  : "No parts yet"
                              }
                            />
                          </View>
                          {estimateIsDraft && partLines.length ? (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              <Button
                                fullWidth={false}
                                loading={
                                  activeInlineAction === "load_part_source" &&
                                  Boolean(nextPartLineToSource) &&
                                  activePartSourceLineId === nextPartLineToSource?.id
                                }
                                onPress={() => {
                                  if (nextPartLineToSource) {
                                    void handleBeginPartSourcing(nextPartLineToSource);
                                    return;
                                  }

                                  router.push(`/jobs/${jobId}/estimate`);
                                }}
                                tone={unsourcedPartLines.length ? "primary" : "secondary"}
                              >
                                {unsourcedPartLines.length ? "Source next part" : "Review sourced parts"}
                              </Button>
                              {detail.job.status === "waiting_parts" && canMoveToRepairing ? (
                                <Button
                                  fullWidth={false}
                                  onPress={() => void handleStatusChange("repairing")}
                                  tone="tertiary"
                                >
                                  Mark repairing
                                </Button>
                              ) : null}
                            </View>
                          ) : null}
                          {estimateIsDraft ? (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              <Button
                                fullWidth={false}
                                onPress={() => openEstimateLineEditor()}
                                tone="secondary"
                              >
                                {quickEstimateLines.length ? "Add quick line" : "Add first quick line"}
                              </Button>
                              {quickEstimateLines[0] ? (
                                <Button
                                  fullWidth={false}
                                  onPress={() => openEstimateLineEditor(quickEstimateLines[0])}
                                  tone="tertiary"
                                >
                                  Edit latest line
                                </Button>
                              ) : null}
                              {partSourceForm.lineItemId ? (
                                <Button
                                  fullWidth={false}
                                  onPress={() => setActiveStopSheet("part_source")}
                                  tone="tertiary"
                                >
                                  Resume source
                                </Button>
                              ) : null}
                            </View>
                          ) : (
                            <View
                              style={{
                                backgroundColor: mobileTheme.colors.surface.base,
                                borderRadius: mobileTheme.radius.lg,
                                borderWidth: 1,
                                borderColor: mobileTheme.colors.border.subtle,
                                flexDirection: "row",
                                flexWrap: "wrap",
                                alignItems: "center",
                                columnGap: 8,
                                rowGap: 4,
                                paddingHorizontal: mobileTheme.spacing[2],
                                paddingVertical: mobileTheme.spacing[1]
                              }}
                            >
                              <Text
                                style={{
                                  color: mobileTheme.colors.brand.warm,
                                  fontFamily: mobileTheme.typography.family.body,
                                  fontSize: 10,
                                  fontWeight: "700",
                                  letterSpacing: 0.7,
                                  textTransform: "uppercase"
                                }}
                              >
                                Estimate locked here
                              </Text>
                              <Text
                                style={{
                                  color: mobileTheme.colors.text.base,
                                  fontFamily: mobileTheme.typography.family.body,
                                  fontSize: 12,
                                  lineHeight: 16
                                }}
                              >
                                Use the full estimate screen for edits.
                              </Text>
                            </View>
                          )}
                          {estimateIsDraft && partSourceForm.lineItemId ? (
                            <Notice
                              body={`Supplier capture is ready for ${selectedPartSourceLine?.name ?? "the selected part line"}. Finish it from the stop sheet or jump to the full estimate workspace if you need deeper sourcing tools.`}
                              title="Part source in progress"
                              tone="brand"
                            />
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </Card>
                </View>

                <View style={{ flex: 1, minWidth: 220 }}>
                  <Card style={{ gap: 8, padding: mobileTheme.spacing[3] }} tone="subtle">
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Badge tone={!invoiceSummary ? "warning" : invoiceSummary.totals.balanceDueCents > 0 ? "warning" : "success"}>
                          {!invoiceSummary
                            ? "Invoice missing"
                            : invoiceSummary.totals.balanceDueCents > 0
                              ? "Balance due"
                              : "Paid"}
                        </Badge>
                      </View>
                      <Text style={{ color: "#111827", fontSize: 17, fontWeight: "700" }}>Billing and payment</Text>
                        {invoiceSummaryLines.map((line) => (
                          <Text key={line} style={{ color: "#374151", fontSize: 14, lineHeight: 19 }}>
                            {line}
                          </Text>
                        ))}
                      <DetailRow
                        label="Balance"
                        value={
                          !invoiceSummary
                            ? "No invoice"
                            : formatCurrencyFromCents(
                                invoiceSummary.totals.balanceDueCents,
                                invoiceSummary.invoice.currencyCode
                              )
                        }
                      />
                      <View style={{ gap: 8 }}>
                        {!invoiceSummary ? (
                          <Button
                            fullWidth={false}
                            onPress={() => router.push(`/jobs/${jobId}/invoice`)}
                            tone="primary"
                          >
                            Open invoice
                          </Button>
                        ) : invoiceSummary.invoice.status === "draft" ? (
                          <Button
                            fullWidth={false}
                            loading={activeInlineAction === "issue_invoice"}
                            onPress={() => void handleIssueInvoice()}
                            tone="primary"
                          >
                            Issue invoice
                          </Button>
                        ) : (
                          <Button
                            fullWidth={false}
                            onPress={openQuickPaymentSheet}
                            tone={invoiceSummary.totals.balanceDueCents > 0 ? "primary" : "secondary"}
                          >
                            {invoiceSummary.totals.balanceDueCents > 0 ? "Open billing console" : "Review billing"}
                          </Button>
                        )}
                        {invoiceSummary ? (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                            {invoiceSummary.invoice.paymentUrl ? (
                              <Pressable
                                accessibilityRole="button"
                                hitSlop={8}
                                onPress={() => void handleOpenPaymentPage()}
                                style={{ alignSelf: "flex-start" }}
                              >
                                <Text
                                  style={{
                                    color: mobileTheme.colors.brand.warm,
                                    fontFamily: mobileTheme.typography.family.body,
                                    fontSize: 11,
                                    fontWeight: "600"
                                  }}
                                >
                                  Open payment page
                                </Text>
                              </Pressable>
                            ) : null}
                            <Pressable
                              accessibilityRole="button"
                              hitSlop={8}
                              onPress={() => router.push(`/jobs/${jobId}/invoice`)}
                              style={{ alignSelf: "flex-start" }}
                            >
                              <Text
                                style={{
                                  color: mobileTheme.colors.brand.warm,
                                  fontFamily: mobileTheme.typography.family.body,
                                  fontSize: 11,
                                  fontWeight: "600"
                                }}
                              >
                                Full invoice
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                      {latestBillingHandoff ? (
                        <Notice
                          body={latestBillingHandoff.note ?? "A structured office billing handoff is already attached to this stop."}
                          title={`Latest handoff: ${formatStopPaymentHandoffKindLabel(latestBillingHandoff.kind)}`}
                          tone={getStopPaymentHandoffBadgeTone(latestBillingHandoff)}
                        />
                      ) : null}
                    </View>
                  </Card>
                </View>

                <View style={{ flex: 1, minWidth: 220 }}>
                  <Card style={{ gap: 8, padding: mobileTheme.spacing[3] }} tone="subtle">
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Badge tone={(workflowSnapshot?.photoCount ?? 0) > 0 ? "success" : "warning"}>
                          {(workflowSnapshot?.photoCount ?? 0) > 0 ? "Evidence captured" : "Evidence missing"}
                        </Badge>
                      </View>
                      <Text style={{ color: "#111827", fontSize: 17, fontWeight: "700" }}>Evidence and closeout</Text>
                      <Text style={{ color: "#374151", fontSize: 14, lineHeight: 19 }}>
                        {(workflowSnapshot?.photoCount ?? 0) > 0
                          ? `${workflowSnapshot?.photoCount ?? 0} photo${(workflowSnapshot?.photoCount ?? 0) === 1 ? "" : "s"} or short video clips are already attached to this stop.`
                          : "Capture at least one photo or short video clip from the stop before closing it out."}
                      </Text>
                      {detail.pendingMutationCount ? (
                        <Notice
                          body="Queued stop updates still need to sync. Keep the app online until the evidence and other closeout work finish uploading."
                          title="Sync still running"
                          tone="warning"
                        />
                      ) : null}
                      {stopEvidenceGallery.some((attachment) => attachment.pendingUpload) ? (
                        <Notice
                          body={`${stopEvidenceGallery.filter((attachment) => attachment.pendingUpload).length} evidence item${stopEvidenceGallery.filter((attachment) => attachment.pendingUpload).length === 1 ? "" : "s"} are still queued on this device.`}
                          title="Evidence upload queue"
                          tone="warning"
                        />
                      ) : null}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Button fullWidth={false} onPress={() => void handleOpenEvidenceSheet()} tone="primary">
                          {(workflowSnapshot?.photoCount ?? 0) > 0 ? "Capture more evidence" : "Capture evidence"}
                        </Button>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => router.push(`/jobs/${jobId}/photos`)}
                        style={{ alignSelf: "flex-start" }}
                      >
                        <Text
                          style={{
                            color: mobileTheme.colors.brand.warm,
                            fontFamily: mobileTheme.typography.family.body,
                            fontSize: 11,
                            fontWeight: "600"
                          }}
                        >
                          Open full gallery
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                </View>
              </View>
            </View>

            <Card style={{ gap: mobileTheme.spacing[3], padding: mobileTheme.spacing[3] }} tone="subtle">
              <View style={{ gap: mobileTheme.spacing[3] }}>
                {detail.job.status !== "completed" ? (
                  <View
                    style={{
                      backgroundColor: completionGateSummary
                        ? mobileTheme.status.warning.background
                        : mobileTheme.status.success.background,
                      borderRadius: mobileTheme.radius.lg,
                      borderWidth: 1,
                      borderColor: completionGateSummary
                        ? mobileTheme.status.warning.border
                        : mobileTheme.status.success.border,
                      gap: 6,
                      paddingHorizontal: mobileTheme.spacing[3],
                      paddingVertical: mobileTheme.spacing[2]
                    }}
                  >
                    <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Text
                        style={{
                          color: completionGateSummary
                            ? mobileTheme.status.warning.text
                            : mobileTheme.status.success.text,
                          fontFamily: mobileTheme.typography.family.body,
                          fontSize: 11,
                          fontWeight: "700",
                          letterSpacing: 0.8,
                          textTransform: "uppercase"
                        }}
                      >
                        {completionGateSummary ? "Finish this stop" : "Closeout looks clear"}
                      </Text>
                      {completionGateReasons.length ? (
                        <Badge tone="warning">{`${completionGateReasons.length} checks left`}</Badge>
                      ) : (
                        <Badge tone="success">Ready to close</Badge>
                      )}
                    </View>
                    <Text
                      style={{
                        color: completionGateSummary
                          ? mobileTheme.status.warning.text
                          : mobileTheme.status.success.text,
                        fontFamily: mobileTheme.typography.family.body,
                        fontSize: 13,
                        lineHeight: 18
                      }}
                    >
                      {completionGateSummary
                        ? completionGateReason ?? completionGateSummary
                        : "Inspection, approval, billing, payment, and evidence look clear enough to finish from here."}
                    </Text>
                    {!completionGateReasons.length ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Button fullWidth={false} onPress={openCloseoutSheet} tone="success">
                          Review closeout
                        </Button>
                      </View>
                    ) : stopBlockers[0] ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Button fullWidth={false} onPress={stopBlockers[0].onPress} tone="secondary">
                          {stopBlockers[0].actionLabel}
                        </Button>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={{ gap: mobileTheme.spacing[3] }}>
                  <Text
                    style={{
                      color: mobileTheme.colors.text.muted,
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1,
                      textTransform: "uppercase"
                    }}
                  >
                    Customer + job
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <DetailRow label="Scheduled" value={scheduledLabel} />
                    <DetailRow label="Arrival" value={arrivalWindowLabel} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                    <DetailRow label="Phone" value={formatPhoneLabel(detail.customer.phone)} />
                    <DetailRow
                      label="Location"
                      value={formatAddressLabel(detail.serviceSite ?? detail.primaryAddress)}
                    />
                  </View>
                  {canCallCustomer || canTextCustomer ? (
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
                        {canCallCustomer ? (
                          <Button fullWidth={false} onPress={() => void handleCallCustomer()} tone="secondary">
                            Call customer
                          </Button>
                        ) : null}
                        {canTextCustomer ? (
                          <Button fullWidth={false} onPress={() => void handleTextCustomer()} tone="tertiary">
                            Text customer
                          </Button>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => openCustomerContactSheet()}
                        style={{ alignSelf: "flex-start" }}
                      >
                        <Text
                          style={{
                            color: mobileTheme.colors.brand.warm,
                            fontFamily: mobileTheme.typography.family.body,
                            fontSize: 11,
                            fontWeight: "600"
                          }}
                        >
                          Log contact outcome
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                <View style={{ gap: mobileTheme.spacing[3] }}>
                  <Text
                    style={{
                      color: mobileTheme.colors.text.muted,
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1,
                      textTransform: "uppercase"
                    }}
                  >
                    Workflow
                  </Text>
                  <ScrollView
                    contentContainerStyle={{ gap: 6, paddingRight: 2 }}
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                  >
                    {stageProgressLabels.map((stage) => {
                      const isCurrentStage = stage.stage === fieldStageSummary.stage;
                      const isCompletedStage = stage.tone === "success";

                      return (
                        <View
                          key={stage.stage}
                          style={{
                            backgroundColor: isCurrentStage
                              ? mobileTheme.status[stage.tone].background
                              : isCompletedStage
                                ? mobileTheme.colors.brand.soft
                                : mobileTheme.colors.surface.base,
                            borderColor: isCurrentStage
                              ? mobileTheme.status[stage.tone].border
                              : isCompletedStage
                                ? mobileTheme.colors.border.base
                                : mobileTheme.colors.border.subtle,
                            borderRadius: 999,
                            borderWidth: 1,
                            paddingHorizontal: 10,
                            paddingVertical: 5
                          }}
                        >
                          <Text
                            style={{
                              color: isCurrentStage
                                ? mobileTheme.status[stage.tone].text
                                : isCompletedStage
                                  ? mobileTheme.colors.brand.strong
                                  : mobileTheme.colors.text.subtle,
                              fontFamily: mobileTheme.typography.family.body,
                              fontSize: 10,
                              fontWeight: "700",
                              letterSpacing: 0.5,
                              textTransform: "uppercase"
                            }}
                          >
                            {stage.label}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>

                {stopWatchouts.length ? (
                  <View style={{ gap: mobileTheme.spacing[2] }}>
                    <Text
                      style={{
                        color: mobileTheme.colors.text.muted,
                        fontFamily: mobileTheme.typography.family.body,
                        fontSize: 12,
                        fontWeight: "700",
                        letterSpacing: 1,
                        textTransform: "uppercase"
                      }}
                    >
                      Watchouts
                    </Text>
                    <View
                      style={{
                        backgroundColor: mobileTheme.colors.surface.base,
                        borderRadius: mobileTheme.radius.lg,
                        borderWidth: 1,
                        borderColor: mobileTheme.colors.border.subtle,
                        gap: 6,
                        paddingHorizontal: mobileTheme.spacing[3],
                        paddingVertical: mobileTheme.spacing[2]
                      }}
                    >
                      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Badge tone={stopWatchouts[0]!.tone}>
                          {stopWatchouts[0]!.tone === "warning" ? "Needs attention" : "Heads up"}
                        </Badge>
                        {stopWatchouts.length > 1 ? (
                          <Badge tone="warning">{`${stopWatchouts.length} watchouts`}</Badge>
                        ) : null}
                      </View>
                      <Text
                        style={{
                          color: mobileTheme.colors.text.strong,
                          fontFamily: mobileTheme.typography.family.body,
                          fontSize: 14,
                          fontWeight: "700",
                          lineHeight: 18
                        }}
                      >
                        {stopWatchouts[0]!.title}
                      </Text>
                      <Text
                        style={{
                          color: mobileTheme.colors.text.base,
                          fontFamily: mobileTheme.typography.family.body,
                          fontSize: 13,
                          lineHeight: 17
                        }}
                      >
                        {stopWatchouts[0]!.body}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={{ gap: mobileTheme.spacing[3] }}>
                  <Text
                    style={{
                      color: mobileTheme.colors.text.muted,
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 1,
                      textTransform: "uppercase"
                    }}
                  >
                    Status
                  </Text>
                  <JobStatusActions
                    busyStatus={pendingStatus}
                    compact
                    currentStatus={detail.job.status}
                    disabledReasons={statusDisabledReasons}
                    isBusy={isSubmittingStatus}
                    onChangeStatus={(status) => void handleStatusChange(status)}
                  />
                  {technicianStatusActions.length === 0 ? <Notice body="There are no technician status changes available from the current stop state." tone={detail.job.status === "completed" ? "success" : "warning"} /> : null}
                </View>
              </View>
            </Card>
          </View>
        </SectionCard>

        <SectionCard compact description="Dispatch, customer, approval, billing, and field notes." eyebrow="Thread" title="Field log">
          <JobNoteComposer isSubmitting={isSubmittingNote} onSubmit={async (body) => { await handleSubmitNote(body); }} />
          {stopDispatchEntries.some((entry) => !entry.readAt) ? (
            <View
              style={{
                backgroundColor: mobileTheme.status.info.background,
                borderRadius: mobileTheme.radius.lg,
                borderWidth: 1,
                borderColor: mobileTheme.status.info.border,
                gap: 6,
                paddingHorizontal: mobileTheme.spacing[3],
                paddingVertical: mobileTheme.spacing[2]
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge tone="info">Dispatch synced</Badge>
                <Text
                  style={{
                    color: mobileTheme.status.info.text,
                    fontFamily: mobileTheme.typography.family.body,
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                    textTransform: "uppercase"
                  }}
                >
                  Inbox updates attached here
                </Text>
              </View>
              <Text
                style={{
                  color: mobileTheme.status.info.text,
                  fontFamily: mobileTheme.typography.family.body,
                  fontSize: 13,
                  lineHeight: 18
                }}
              >
                Unread dispatch updates were cleared when you opened this stop.
              </Text>
            </View>
          ) : null}
          {fieldThreadEntries.length ? (
            <View style={{ gap: 8 }}>
              {fieldThreadEntries.map((entry) => (
                <Card key={entry.id} style={{ gap: 6, paddingHorizontal: mobileTheme.spacing[3], paddingVertical: mobileTheme.spacing[2] }} tone="subtle">
                  <View style={{ gap: 6 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {entry.source === "dispatch" ? (
                        <>
                          <Badge tone={getInboxTypeTone(entry.entryType, entry.unread)}>
                            {formatInboxTypeLabel(entry.entryType)}
                          </Badge>
                          {entry.unread ? <Badge tone="warning">Unread</Badge> : <Badge tone="neutral">Read</Badge>}
                        </>
                      ) : null}
                      {entry.source === "note" ? (
                        <Badge tone={entry.author === "you" ? "info" : "neutral"}>
                          {entry.author === "you" ? "You" : "Office"}
                        </Badge>
                      ) : null}
                      {entry.source === "customer" ? (
                        <>
                          <Badge tone="info">Customer</Badge>
                          <Badge tone="neutral">{formatCommunicationTypeLabel(entry.communicationType)}</Badge>
                          <Badge tone="info">{formatDesignLabel(entry.channel)}</Badge>
                          <Badge tone={getCommunicationStatusTone(entry.status)}>
                            {formatCommunicationStatusLabel(entry.status)}
                          </Badge>
                        </>
                      ) : null}
                      {entry.source === "billing" ? (
                        <>
                          <Badge tone={getStopPaymentHandoffThreadTone(entry)}>
                            {formatStopPaymentHandoffKindLabel(entry.kind)}
                          </Badge>
                          <Badge tone={entry.status === "resolved" ? "success" : "warning"}>
                            {entry.status === "resolved" ? "Resolved" : "Open"}
                          </Badge>
                          {entry.pendingSync ? <Badge tone="warning">Syncing</Badge> : null}
                        </>
                      ) : null}
                      {entry.source === "approval" ? (
                        <>
                          <Badge tone="info">Approval</Badge>
                          <Badge
                            tone={
                              entry.status === "accepted"
                                ? "success"
                                : entry.status === "sent"
                                  ? "warning"
                                  : entry.status === "declined" || entry.status === "void"
                                    ? "danger"
                                    : "neutral"
                            }
                          >
                            {formatDesignLabel(entry.status)}
                          </Badge>
                        </>
                      ) : null}
                      <Text style={{ color: "#4b5563", fontSize: 13, lineHeight: 18 }}>
                        {formatDateTime(entry.occurredAt, {
                          includeTimeZoneName: false,
                          timeZone: appContext?.company.timezone
                        })}
                      </Text>
                    </View>
                    {entry.source === "dispatch" || entry.source === "approval" ? (
                      <Text style={{ color: "#111827", fontSize: 15, fontWeight: "700", lineHeight: 19 }}>
                        {entry.title}
                      </Text>
                    ) : null}
                    {entry.source === "customer" ? (
                      <Text style={{ color: "#4b5563", fontSize: 13, lineHeight: 18 }}>
                        {`${entry.recipientName}${entry.recipientPhone ? ` - ${formatPhoneLabel(entry.recipientPhone)}` : ""}`}
                      </Text>
                    ) : null}
                    {entry.source === "billing" && (entry.amountCents !== null || entry.tenderType) ? (
                      <Text style={{ color: "#4b5563", fontSize: 13, lineHeight: 18 }}>
                        {[
                          entry.amountCents !== null && invoiceSummary
                            ? formatCurrencyFromCents(entry.amountCents, invoiceSummary.invoice.currencyCode)
                            : null,
                          entry.tenderType ? formatDesignLabel(entry.tenderType) : null
                        ]
                          .filter(Boolean)
                          .join(" - ")}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        color: mobileTheme.colors.text.base,
                        fontFamily: mobileTheme.typography.family.body,
                        fontSize: 14,
                        lineHeight: 19
                      }}
                    >
                      {entry.source === "billing"
                        ? entry.resolutionNote ??
                          entry.note ??
                          "A billing follow-up is attached to this stop for office review."
                        : entry.body}
                    </Text>
                    {entry.source === "customer" && entry.errorMessage ? (
                      <Notice body={entry.errorMessage} title="Delivery issue" tone="warning" />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ) : <Notice body="No dispatch updates, customer contact, billing follow-up, or field notes are attached to this stop yet." tone="info" />}
        </SectionCard>

        <SectionCard compact description="Recent stop changes." eyebrow="Timeline" title="Recent moves">
          {latestStatusHistoryEntry ? (
            <Card
              style={{
                gap: 5,
                paddingHorizontal: mobileTheme.spacing[3],
                paddingVertical: mobileTheme.spacing[2]
              }}
              tone="subtle"
            >
              <View style={{ gap: 6 }}>
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Badge tone="neutral">
                    {latestStatusHistoryEntry.fromStatus ? formatJobStatusLabel(latestStatusHistoryEntry.fromStatus) : "Created"}
                  </Badge>
                  <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "700" }}>to</Text>
                  <StatusBadge status={latestStatusHistoryEntry.toStatus} />
                </View>
                <Text style={{ color: "#4b5563", fontSize: 13, lineHeight: 18 }}>
                  {formatDateTime(latestStatusHistoryEntry.createdAt, {
                    includeTimeZoneName: false,
                    timeZone: appContext?.company.timezone
                  })}
                </Text>
                {latestStatusHistoryEntry.reason ? <CardCopy>{latestStatusHistoryEntry.reason}</CardCopy> : null}
              </View>
            </Card>
          ) : null}
          {detail.statusHistory.length ? (
            <View style={{ gap: 8 }}>
              {visibleStatusHistory.map((entry) => (
                <Card
                  key={entry.id}
                  style={{
                    gap: 5,
                    paddingHorizontal: mobileTheme.spacing[3],
                    paddingVertical: mobileTheme.spacing[2]
                  }}
                  tone="subtle"
                >
                  <View style={{ gap: 6 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Badge tone="neutral">{entry.fromStatus ? formatJobStatusLabel(entry.fromStatus) : "Created"}</Badge>
                      <Text style={{ color: "#4b5563", fontSize: 13, fontWeight: "700" }}>to</Text>
                      <StatusBadge status={entry.toStatus} />
                    </View>
                    <Text style={{ color: "#4b5563", fontSize: 13, lineHeight: 18 }}>{formatDateTime(entry.createdAt, { includeTimeZoneName: false, timeZone: appContext?.company.timezone })}</Text>
                    {entry.reason ? <CardCopy>{entry.reason}</CardCopy> : null}
                  </View>
                </Card>
              ))}
              {detail.statusHistory.length > 3 ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setShowFullStatusHistory((current) => !current)}
                  style={{ alignSelf: "flex-start" }}
                >
                  <Text
                    style={{
                      color: mobileTheme.colors.brand.warm,
                      fontFamily: mobileTheme.typography.family.body,
                      fontSize: 11,
                      fontWeight: "600"
                    }}
                  >
                    {showFullStatusHistory
                      ? "Show recent moves only"
                      : `Show ${hiddenStatusHistoryCount} older update${hiddenStatusHistoryCount === 1 ? "" : "s"}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : <Notice body="Workflow history will appear here as the stop moves through the field stages." tone="info" />}
        </SectionCard>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {detail.job.status !== "completed" ? (
                !completionGateReasons.length ? (
                  <Button
                    loading={isSubmittingStatus && pendingStatus === "completed"}
                    onPress={() => void handleStatusChange("completed")}
                    tone="success"
                  >
                    Complete stop
                  </Button>
                ) : stopBlockers[0] ? (
                  <Button onPress={stopBlockers[0].onPress} tone="secondary">
                    {stopBlockers[0].actionLabel}
                  </Button>
                ) : null
              ) : nextAssignedJob ? (
                <Button onPress={openNextAssignedStop} tone="primary">
                  Open next stop
                </Button>
              ) : (
                <Button onPress={() => router.replace("/jobs")} tone="secondary">
                  Back to My Work
                </Button>
              )}
              <Button fullWidth={false} onPress={closeStopSheet} tone="tertiary">
                {detail.job.status === "completed" ? "Stay on completed stop" : "Back to stop"}
              </Button>
            </View>
          }
          description={
            detail.job.status === "completed"
              ? "Completion should end with a clear handoff. Launch the next stop from here instead of backing through the queue."
              : "Run the final gate check here before closing the stop so billing, evidence, and the next assignment stay in one place."
          }
          onClose={closeStopSheet}
          title={detail.job.status === "completed" ? "Stop completed" : "Closeout review"}
          visible={activeStopSheet === "closeout_confirm"}
        >
          {detail.job.status === "completed" ? (
            <Notice
              body="This stop is closed. Use this handoff state to launch the next assignment immediately while the context is still fresh."
              title="Closeout recorded"
              tone="success"
            />
          ) : completionGateSummary ? (
            <Notice
              body={completionGateSummary}
              title="Closeout is still blocked"
              tone="warning"
            />
          ) : (
            <Notice
              body="Inspection, estimate, billing, and evidence are in place. Finish the stop from here instead of hunting for one last status button."
              title="Ready to complete"
              tone="success"
            />
          )}
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700" }}>Closeout state</Text>
            <DetailRow label="Inspection" value={workflowSnapshot?.inspection?.inspection.status === "completed" ? "Completed" : "Needs work"} />
            <DetailRow label="Estimate" value={estimateSummary?.estimate.status ? formatDesignLabel(estimateSummary.estimate.status) : "Missing"} />
            <DetailRow label="Invoice" value={invoiceSummary ? invoiceSummary.invoice.invoiceNumber : "Missing"} />
            <DetailRow
              label="Balance due"
              value={
                invoiceSummary
                  ? formatCurrencyFromCents(
                      invoiceSummary.totals.balanceDueCents,
                      invoiceSummary.invoice.currencyCode
                    )
                  : "Invoice missing"
              }
            />
            <DetailRow
              label="Evidence"
              value={
                (workflowSnapshot?.photoCount ?? 0) > 0
                  ? `${workflowSnapshot?.photoCount ?? 0} item${(workflowSnapshot?.photoCount ?? 0) === 1 ? "" : "s"}`
                  : "Missing"
              }
            />
          </View>
          {completionGateReasons.length ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700" }}>What still needs attention</Text>
              {completionGateReasons.map((reason) => (
                <Card key={reason} tone="subtle">
                  <CardCopy>{reason}</CardCopy>
                </Card>
              ))}
            </View>
          ) : null}
          {nextAssignedJob ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700" }}>Next assigned stop</Text>
              <DetailRow label="Stop" value={nextAssignedJob.title} />
              <DetailRow label="Customer" value={nextAssignedJob.customerDisplayName} />
              <DetailRow label="When" value={nextAssignedStopTimeLabel} />
              <DetailRow
                label="Location"
                value={nextAssignedJob.addressSummary ?? nextAssignedJob.serviceSiteSummary ?? "Location missing"}
              />
            </View>
          ) : (
            <Notice
              body="There is no next assigned stop in your queue right now."
              title="Queue is clear"
              tone="brand"
            />
          )}
        </BottomSheet>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                loading={activeInlineAction === "approve_estimate"}
                onPress={() => void handleApproveEstimate(suggestedApprovalStatus ?? undefined)}
              >
                {approvalPrimaryActionLabel}
              </Button>
              {suggestedApprovalStatus ? (
                <Button
                  loading={activeInlineAction === "approve_estimate"}
                  onPress={() => void handleApproveEstimate()}
                  tone="secondary"
                >
                  Approve only
                </Button>
              ) : null}
              <Button onPress={closeStopSheet} tone="tertiary">
                Cancel
              </Button>
              <Button
                fullWidth={false}
                onPress={() => {
                  closeStopSheet();
                  router.push(`/jobs/${jobId}/estimate`);
                }}
                tone="tertiary"
              >
                Full estimate
              </Button>
            </View>
          }
          description="Capture signer name and signature without leaving the stop. Approval should stay attached to the field thread."
          onClose={closeStopSheet}
          title={estimateSummary ? `Approve ${estimateSummary.estimate.estimateNumber}` : "Capture approval"}
          visible={activeStopSheet === "approval_capture"}
        >
          <Notice
            body={
              suggestedApprovalStatus === "repairing"
                ? "This estimate is ready for field signoff. Saving now will also move the stop straight into active repair."
                : "This estimate is ready for field signoff. Capture the customer signature here so the mechanic does not have to leave the stop."
            }
            title="Approval in the stop"
            tone="brand"
          />
          <Field label="Customer signer name">
            <Input
              autoCapitalize="words"
              onChangeText={setApprovalSignerName}
              placeholder="Customer full name"
              placeholderTextColor="#9ca3af"
              value={approvalSignerName}
            />
          </Field>
          <Field label="Approval statement">
            <Input
              multiline
              onChangeText={setApprovalStatement}
              placeholder="Approval statement"
              placeholderTextColor="#9ca3af"
              value={approvalStatement}
            />
          </Field>
          <Field label="Signature">
            <Notice
              body="A customer signature is required before the estimate can move out of approval."
              tone="brand"
            />
            <SignaturePad ref={signaturePadRef} disabled={activeInlineAction === "approve_estimate"} />
            <Button
              fullWidth={false}
              onPress={() => signaturePadRef.current?.clear()}
              tone="secondary"
            >
              Clear signature
            </Button>
          </Field>
        </BottomSheet>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button onPress={navigationReturnPrimaryAction.onPress} tone={navigationReturnPrimaryAction.tone}>
                {navigationReturnPrimaryAction.label}
              </Button>
              {canOpenMaps ? (
                <Button fullWidth={false} onPress={() => void handleOpenMaps()} tone="tertiary">
                  Open maps again
                </Button>
              ) : null}
              <Button fullWidth={false} onPress={closeStopSheet} tone="tertiary">
                Stay on stop
              </Button>
            </View>
          }
          description="Pick up the stop where navigation left off instead of re-orienting from scratch."
          onClose={closeStopSheet}
          title="Back from navigation"
          visible={activeStopSheet === "navigation_return"}
        >
          <Notice
            body={`Service location: ${formatAddressLabel(detail.serviceSite ?? detail.primaryAddress)}.`}
            title="Route handoff complete"
            tone="brand"
          />
          <Notice
            body={
              detail.job.status === "scheduled" || detail.job.status === "dispatched"
                ? "Navigation is open, but the stop is not marked en route yet. Update travel status now so dispatch and the customer are not guessing."
                : detail.job.status === "en_route"
                  ? "You are back from Maps. Mark the stop arrived when you are on site so the workboard moves straight into inspection and diagnosis."
                  : "Navigation is done. Jump back into the stop without digging for the next action."
            }
            title="Next move"
            tone={detail.job.status === "en_route" ? "success" : "warning"}
          />
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "700" }}>Arrival context</Text>
            <DetailRow label="Arrival window" value={arrivalWindowLabel} />
            <DetailRow label="Current stop status" value={formatJobStatusLabel(detail.job.status)} />
          </View>
        </BottomSheet>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                loading={isSubmittingNote}
                onPress={() => void handleSaveCallFollowup()}
                tone="secondary"
              >
                Save contact note
              </Button>
              {customerContactMode === "call" ? (
                <Button fullWidth={false} onPress={() => void handleCallCustomer()} tone="tertiary">
                  Call again
                </Button>
              ) : (
                <Button fullWidth={false} onPress={() => void handleTextCustomer()} tone="tertiary">
                  Text again
                </Button>
              )}
              <Button fullWidth={false} onPress={closeStopSheet} tone="tertiary">
                Cancel
              </Button>
            </View>
          }
          description={
            customerContactMode === "sms"
              ? "Capture the outcome as soon as you come back from texting so the office and the next workflow step do not depend on memory."
              : "Capture the outcome as soon as you come back from the call so the office and the next workflow step do not depend on memory."
          }
          onClose={closeStopSheet}
          title={customerContactMode === "sms" ? "Customer text follow-up" : "Customer call follow-up"}
          visible={activeStopSheet === "call_followup"}
        >
          <Notice
            body={`Log what happened with ${customerDisplayName} before moving on. This keeps dispatch, approval, and closeout context attached to the stop instead of living in your head.`}
            title={customerContactMode === "sms" ? "What happened in the text?" : "What happened on the call?"}
            tone="brand"
          />
          <Field label="Quick outcomes">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {quickCallOutcomeChoices.map((choice) => (
                <Chip
                  key={choice}
                  onPress={() => setCallFollowupNote(choice)}
                  selected={callFollowupNote.trim() === choice}
                  tone="brand"
                >
                  {choice}
                </Chip>
              ))}
            </View>
          </Field>
          <Field label={customerContactMode === "sms" ? "Text note" : "Call note"}>
            <Input
              multiline
              onChangeText={setCallFollowupNote}
              placeholder={
                customerContactMode === "sms"
                  ? "Customer confirmed the arrival window, requested a later reply, asked to reschedule, or approved the next step."
                  : "Customer confirmed arrival time, requested a callback, asked to reschedule, or approved the next step."
              }
              placeholderTextColor="#9ca3af"
              value={callFollowupNote}
            />
            <DictationButton
              contextualStrings={mergeDictationContext(
                quickCallOutcomeChoices,
                customerCallPhrases,
                mechanicActionPhrases
              )}
              label={customerContactMode === "sms" ? "Dictate text outcome" : "Dictate call outcome"}
              onChangeText={setCallFollowupNote}
              value={callFollowupNote}
            />
          </Field>
        </BottomSheet>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                fullWidth={false}
                onPress={() => router.push(`/jobs/${jobId}/photos`)}
                tone="tertiary"
              >
                Full gallery
              </Button>
              <Button fullWidth={false} onPress={closeStopSheet} tone="secondary">
                Back to stop
              </Button>
            </View>
          }
          description="Grab the proof from the stop first. Use the camera here, keep the category sticky, and only jump to the full gallery when you need to review everything."
          onClose={closeStopSheet}
          title="Stop evidence"
          visible={activeStopSheet === "evidence"}
        >
          <AttachmentUploadSheet
            caption={evidenceCaption}
            isUploading={isEvidenceUploading}
            onCameraPress={() => void handleStopEvidenceUpload("camera-photo")}
            onCameraVideoPress={() => void handleStopEvidenceUpload("camera-video")}
            onCaptionChange={setEvidenceCaption}
            onCategoryChange={setSelectedEvidenceCategory}
            onLibraryPress={() => void handleStopEvidenceUpload("library")}
            selectedCategory={selectedEvidenceCategory}
          />
          {isEvidenceLoading ? (
            <Notice body="Refreshing the stop file so the latest proof stays visible here." title="Loading evidence" tone="brand" />
          ) : null}
          {stopEvidenceGallery.length ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "700" }}>Recent stop evidence</Text>
              {stopEvidenceGallery.slice(0, 3).map((attachment) => (
                <AttachmentCard key={attachment.id} item={attachment} />
              ))}
            </View>
          ) : (
            <Notice
              body="No stop evidence is attached yet. Start with a photo or short video here so closeout does not depend on memory later."
              title="Evidence still missing"
              tone="warning"
            />
          )}
        </BottomSheet>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                loading={activeInlineAction === "save_estimate_line"}
                onPress={() => void handleSaveStopEstimateLine()}
                tone="secondary"
              >
                {estimateLineForm.id ? "Save line" : "Add line"}
              </Button>
              <Button onPress={closeStopSheet} tone="tertiary">
                Cancel
              </Button>
            </View>
          }
          description="Handle the common draft pricing change without leaving the stop. Use the full estimate only when you need grouped sections or deeper pricing context."
          onClose={closeStopSheet}
          title={estimateLineForm.id ? "Edit estimate line" : "Add estimate line"}
          visible={activeStopSheet === "estimate_line"}
        >
          <Field label="Line type">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["labor", "part", "fee"] as const).map((itemType) => (
                <Chip
                  key={itemType}
                  onPress={() =>
                    setEstimateLineForm((current) => ({
                      ...current,
                      itemType
                    }))
                  }
                  selected={estimateLineForm.itemType === itemType}
                  tone="brand"
                >
                  {formatDesignLabel(itemType)}
                </Chip>
              ))}
            </View>
          </Field>
          <Field label="Quick line names">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {quickEstimateLineNameChoices.map((choice) => (
                <Chip
                  key={choice}
                  onPress={() =>
                    setEstimateLineForm((current) => ({
                      ...current,
                      name: choice
                    }))
                  }
                  selected={estimateLineForm.name.trim() === choice}
                  tone="brand"
                >
                  {choice}
                </Chip>
              ))}
            </View>
          </Field>
          <Field label="Line name">
            <Input
              onChangeText={(value) => setEstimateLineForm((current) => ({ ...current, name: value }))}
              placeholder="Front brake pad replacement"
              placeholderTextColor="#9ca3af"
              value={estimateLineForm.name}
            />
            <DictationButton
              contextualStrings={mergeDictationContext(quickEstimateLineNameChoices, estimatePhrases)}
              label="Dictate line name"
              onChangeText={(value) =>
                setEstimateLineForm((current) => ({ ...current, name: value }))
              }
              value={estimateLineForm.name}
            />
          </Field>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Field label="Qty">
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {quickEstimateQuantityChoices.map((choice) => (
                      <Chip
                        key={choice}
                        onPress={() =>
                          setEstimateLineForm((current) => ({
                            ...current,
                            quantity: choice
                          }))
                        }
                        selected={estimateLineForm.quantity === choice}
                        tone="brand"
                      >
                        {choice}
                      </Chip>
                    ))}
                  </View>
                <Input
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setEstimateLineForm((current) => ({ ...current, quantity: value }))
                  }
                  placeholder="1"
                  placeholderTextColor="#9ca3af"
                  value={estimateLineForm.quantity}
                />
                </View>
              </Field>
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Field label="Unit price">
                <Input
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setEstimateLineForm((current) => ({ ...current, unitPrice: value }))
                  }
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  value={estimateLineForm.unitPrice}
                />
              </Field>
            </View>
          </View>
          <Field label="Description">
            <Input
              multiline
              onChangeText={(value) =>
                setEstimateLineForm((current) => ({ ...current, description: value }))
              }
              placeholder="Optional line detail."
              placeholderTextColor="#9ca3af"
              value={estimateLineForm.description}
            />
            <DictationButton
              contextualStrings={mergeDictationContext([estimateLineForm.name], mechanicActionPhrases)}
              label="Dictate details"
              onChangeText={(value) =>
                setEstimateLineForm((current) => ({ ...current, description: value }))
              }
              value={estimateLineForm.description}
            />
          </Field>
          <Field label="Taxable">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                onPress={() => setEstimateLineForm((current) => ({ ...current, taxable: true }))}
                selected={estimateLineForm.taxable}
                tone="brand"
              >
                Taxable
              </Chip>
              <Chip
                onPress={() => setEstimateLineForm((current) => ({ ...current, taxable: false }))}
                selected={!estimateLineForm.taxable}
                tone="brand"
              >
                Non-taxable
              </Chip>
            </View>
          </Field>
        </BottomSheet>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {partSourceSuggestedActionLabel ? (
                <Button
                  loading={activeInlineAction === "save_part_source"}
                  onPress={() => void handleSaveStopPartSource(suggestedPartSourceStatus ?? undefined)}
                >
                  {partSourceSuggestedActionLabel}
                </Button>
              ) : null}
              <Button
                loading={activeInlineAction === "save_part_source"}
                onPress={() => void handleSaveStopPartSource()}
                tone={partSourceSuggestedActionLabel ? "secondary" : "primary"}
              >
                {partSourceSuggestedActionLabel ? "Save source only" : "Save source"}
              </Button>
              <Button onPress={closeStopSheet} tone="tertiary">
                Cancel
              </Button>
              <Button
                fullWidth={false}
                onPress={() => {
                  closeStopSheet();
                  router.push(`/jobs/${jobId}/estimate`);
                }}
                tone="tertiary"
              >
                Full estimate
              </Button>
            </View>
          }
          description="Capture the supplier, price, and availability while you are still at the vehicle. The office should not have to reconstruct this later."
          onClose={closeStopSheet}
          title={`Source ${selectedPartSourceLine?.name ?? "part line"}`}
          visible={activeStopSheet === "part_source"}
        >
          {selectedPartWorkflowOption ? (
            <Notice
              body={
                suggestedPartSourceStatus === "waiting_parts"
                  ? `${selectedPartWorkflowOption.description} Saving now will also mark this stop waiting on parts so dispatch can see the hold immediately.`
                  : suggestedPartSourceStatus === "repairing"
                    ? `${selectedPartWorkflowOption.description} Saving now will also move this stop back into active repair.`
                    : selectedPartWorkflowOption.description
              }
              title="Field outcome"
              tone={suggestedPartSourceStatus ? "brand" : "info"}
            />
          ) : (
            <Notice
              body="Pick what happens with this part in the field first. That fills the ETA and note language so the office does not have to reconstruct the story later."
              title="Choose the part outcome"
              tone="brand"
            />
          )}
          <Field label="What happens with this part?">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {stopPartWorkflowOutcomeOptions.map((option) => (
                <Chip
                  key={option.value}
                  onPress={() =>
                    setPartSourceForm((current) => applyStopPartWorkflowOutcome(current, option.value))
                  }
                  selected={partSourceForm.workflowOutcome === option.value}
                  tone="brand"
                >
                  {option.label}
                </Chip>
              ))}
            </View>
          </Field>
          {recentSupplierChoices.length ? (
            <Field label="Recent suppliers">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {recentSupplierChoices.map((supplierAccount) => (
                  <Chip
                    key={supplierAccount.id}
                    onPress={() =>
                      setPartSourceForm((current) => ({
                        ...current,
                        supplierAccountId: supplierAccount.id,
                        supplierName: supplierAccount.name
                      }))
                    }
                    selected={partSourceForm.supplierAccountId === supplierAccount.id}
                    tone="brand"
                  >
                    {supplierAccount.name}
                  </Chip>
                ))}
              </View>
            </Field>
          ) : null}
          <Field label="Supplier">
            <Input
              onChangeText={(value) =>
                setPartSourceForm((current) => ({
                  ...current,
                  supplierAccountId: null,
                  supplierName: value
                }))
              }
              placeholder="O'Reilly Auto Parts"
              placeholderTextColor="#9ca3af"
              value={partSourceForm.supplierName}
            />
          </Field>
          {filteredSuppliers.length ? (
            <Field hint="Tap a saved supplier to avoid retyping it." label="Saved suppliers">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {filteredSuppliers.map((supplierAccount) => (
                  <Chip
                    key={supplierAccount.id}
                    onPress={() =>
                      setPartSourceForm((current) => ({
                        ...current,
                        supplierAccountId: supplierAccount.id,
                        supplierName: supplierAccount.name
                      }))
                    }
                    selected={partSourceForm.supplierAccountId === supplierAccount.id}
                    tone="brand"
                  >
                    {supplierAccount.name}
                  </Chip>
                ))}
              </View>
            </Field>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Field label="Quoted unit cost">
                <Input
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setPartSourceForm((current) => ({
                      ...current,
                      quotedUnitCost: value
                    }))
                  }
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  value={partSourceForm.quotedUnitCost}
                />
              </Field>
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Field label="Part number">
                <Input
                  onChangeText={(value) =>
                    setPartSourceForm((current) => ({
                      ...current,
                      supplierPartNumber: value
                    }))
                  }
                  placeholder="Optional"
                  placeholderTextColor="#9ca3af"
                  value={partSourceForm.supplierPartNumber}
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
                    setPartSourceForm((current) => ({
                      ...current,
                      availabilityText: choice
                    }))
                  }
                  selected={partSourceForm.availabilityText === choice}
                  tone="brand"
                >
                  {choice}
                </Chip>
              ))}
            </View>
          </Field>
          <Field label="Quick notes">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {quickPartSourceNoteChoices.map((choice) => (
                <Chip
                  key={choice}
                  onPress={() =>
                    setPartSourceForm((current) => ({
                      ...current,
                      notes: choice
                    }))
                  }
                  selected={partSourceForm.notes.trim() === choice}
                  tone="brand"
                >
                  {choice}
                </Chip>
              ))}
            </View>
          </Field>
          <Field hint="Use the supplier wording when the pickup or return-visit timing matters." label="Availability detail">
            <Input
              onChangeText={(value) =>
                setPartSourceForm((current) => ({
                  ...current,
                  availabilityText: value
                }))
              }
              placeholder="Ready after 3 PM pickup"
              placeholderTextColor="#9ca3af"
              value={partSourceForm.availabilityText}
            />
          </Field>
          <Field label="Notes">
            <Input
              multiline
              onChangeText={(value) =>
                setPartSourceForm((current) => ({ ...current, notes: value }))
              }
              placeholder="Warranty, pickup contact, or return-visit detail."
              placeholderTextColor="#9ca3af"
              value={partSourceForm.notes}
            />
            <DictationButton
              contextualStrings={mergeDictationContext(
                [partSourceForm.supplierName, partSourceForm.supplierPartNumber],
                sourcingPhrases,
                mechanicActionPhrases
              )}
              label="Dictate sourcing note"
              onChangeText={(value) =>
                setPartSourceForm((current) => ({ ...current, notes: value }))
              }
              value={partSourceForm.notes}
            />
          </Field>
        </BottomSheet>

        <BottomSheet
          actions={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {invoiceSummary ? (
                <Button
                  fullWidth={false}
                  onPress={() => router.push(`/jobs/${jobId}/invoice`)}
                  tone="tertiary"
                >
                  Full invoice workspace
                </Button>
              ) : null}
              <Button onPress={closeStopSheet} tone="tertiary">
                Back to stop
              </Button>
            </View>
          }
          description={
            invoiceSummary
              ? `Balance due ${formatCurrencyFromCents(invoiceSummary.totals.balanceDueCents, invoiceSummary.invoice.currencyCode)}. Collect payment, send the live link, or record a clean office handoff without leaving the stop.`
              : "Start the invoice here first, then handle payment or office follow-up from the same billing console."
          }
          onClose={closeStopSheet}
          title="Billing console"
          visible={activeStopSheet === "payment"}
        >
          {!invoiceSummary ? (
            <View style={{ gap: 12 }}>
              <Notice
                body="No invoice is attached to this stop yet. Start the draft here so collection, reminders, and handoff stay in one place."
                title="Invoice still missing"
                tone="warning"
              />
              <Button
                loading={activeInlineAction === "create_invoice"}
                onPress={() => void handleCreateInvoiceDraft()}
                tone="primary"
              >
                Create invoice draft
              </Button>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <Notice
                body={
                  invoiceSummary.totals.balanceDueCents > 0
                    ? `Invoice ${invoiceSummary.invoice.invoiceNumber} still has ${formatCurrencyFromCents(invoiceSummary.totals.balanceDueCents, invoiceSummary.invoice.currencyCode)} due.`
                    : `Invoice ${invoiceSummary.invoice.invoiceNumber} is clear.`
                }
                title={
                  invoiceSummary.totals.balanceDueCents > 0 ? "Collection still open" : "Billing is settled"
                }
                tone={invoiceSummary.totals.balanceDueCents > 0 ? "warning" : "success"}
              />

              <View style={{ gap: 8 }}>
                <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "700" }}>
                  Invoice actions
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {invoiceSummary.invoice.status === "draft" ? (
                    <Button
                      fullWidth={false}
                      loading={activeInlineAction === "issue_invoice"}
                      onPress={() => void handleStopInvoiceAction("issue_invoice")}
                      tone="primary"
                    >
                      Issue invoice
                    </Button>
                  ) : (
                    <>
                      <Button
                        fullWidth={false}
                        loading={activeInlineAction === "send_invoice_link"}
                        onPress={() => void handleStopInvoiceAction("send_invoice_link")}
                        tone="secondary"
                      >
                        Send invoice link
                      </Button>
                      {invoiceSummary.totals.balanceDueCents > 0 ? (
                        <Button
                          fullWidth={false}
                          loading={activeInlineAction === "send_payment_reminder"}
                          onPress={() => void handleStopInvoiceAction("send_payment_reminder")}
                          tone="secondary"
                        >
                          Send payment reminder
                        </Button>
                      ) : null}
                      {invoiceSummary.totals.balanceDueCents > 0 && !invoiceSummary.invoice.paymentUrl ? (
                        <Button
                          fullWidth={false}
                          loading={activeInlineAction === "refresh_payment_page"}
                          onPress={() => void handleStopInvoiceAction("refresh_payment_page")}
                          tone="secondary"
                        >
                          Refresh payment page
                        </Button>
                      ) : null}
                    </>
                  )}
                  {invoiceSummary.invoice.paymentUrl ? (
                    <Button
                      fullWidth={false}
                      onPress={() => void handleOpenPaymentPage()}
                      tone="tertiary"
                    >
                      Open live payment page
                    </Button>
                  ) : null}
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "700" }}>
                  Manual field payment
                </Text>
                <Field label="Tender">
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {(["cash", "check", "other"] as const).map((tenderType) => (
                      <Chip
                        key={tenderType}
                        onPress={() => setQuickPaymentTenderType(tenderType)}
                        selected={quickPaymentTenderType === tenderType}
                        tone="brand"
                      >
                        {tenderType.charAt(0).toUpperCase() + tenderType.slice(1)}
                      </Chip>
                    ))}
                  </View>
                </Field>
                <Field label="Amount presets">
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {quickPaymentAmountPresets.map((choice) => (
                      <Chip
                        key={choice.label}
                        onPress={() => setQuickPaymentAmountInput(choice.value)}
                        selected={quickPaymentAmountInput === choice.value}
                        tone="brand"
                      >
                        {choice.label}
                      </Chip>
                    ))}
                  </View>
                </Field>
                <Field label="Quick notes">
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {quickPaymentNoteChoices.map((choice) => (
                      <Chip
                        key={choice}
                        onPress={() => setQuickPaymentNote(choice)}
                        selected={quickPaymentNote.trim() === choice}
                        tone="brand"
                      >
                        {choice}
                      </Chip>
                    ))}
                  </View>
                </Field>
                <Field label="Collected amount">
                  <Input
                    keyboardType="decimal-pad"
                    onChangeText={setQuickPaymentAmountInput}
                    placeholder={
                      invoiceSummary.totals.balanceDueCents > 0
                        ? (invoiceSummary.totals.balanceDueCents / 100).toFixed(2)
                        : "0.00"
                    }
                    placeholderTextColor="#9ca3af"
                    value={quickPaymentAmountInput}
                  />
                </Field>
                <Field label="Reference note">
                  <Input
                    onChangeText={setQuickPaymentNote}
                    placeholder="Optional payment reference."
                    placeholderTextColor="#9ca3af"
                    value={quickPaymentNote}
                  />
                  <DictationButton
                    contextualStrings={mergeDictationContext(quickPaymentNoteChoices, paymentPhrases)}
                    label="Dictate payment note"
                    onChangeText={setQuickPaymentNote}
                    value={quickPaymentNote}
                  />
                </Field>
                <Button
                  loading={activeInlineAction === "record_payment"}
                  onPress={() => void handleQuickManualPayment()}
                  tone="secondary"
                >
                  Record field payment
                </Button>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "700" }}>
                  Office billing handoff
                </Text>
                <Notice
                  body={billingHandoffOption.description}
                  title={formatStopPaymentHandoffKindLabel(selectedBillingHandoffKind)}
                  tone="brand"
                />
                <Field label="Billing outcome">
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {stopPaymentHandoffKindOptions.map((option) => (
                      <Chip
                        key={option.kind}
                        onPress={() => {
                          setSelectedBillingHandoffKind(option.kind);

                          if (option.kind === "manual_tender" && !billingHandoffAmountInput.trim()) {
                            setBillingHandoffAmountInput(
                              invoiceSummary.totals.balanceDueCents > 0
                                ? (invoiceSummary.totals.balanceDueCents / 100).toFixed(2)
                                : ""
                            );
                          }
                        }}
                        selected={selectedBillingHandoffKind === option.kind}
                        tone="brand"
                      >
                        {option.label}
                      </Chip>
                    ))}
                  </View>
                </Field>
                {selectedBillingHandoffKind === "manual_tender" ? (
                  <>
                    <Field label="Tender type">
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {(["cash", "check", "other"] as const).map((tenderType) => (
                          <Chip
                            key={`handoff-${tenderType}`}
                            onPress={() => setBillingHandoffTenderType(tenderType)}
                            selected={billingHandoffTenderType === tenderType}
                            tone="brand"
                          >
                            {tenderType.charAt(0).toUpperCase() + tenderType.slice(1)}
                          </Chip>
                        ))}
                      </View>
                    </Field>
                    <Field label="Collected amount">
                      <Input
                        keyboardType="decimal-pad"
                        onChangeText={setBillingHandoffAmountInput}
                        placeholder={
                          invoiceSummary.totals.balanceDueCents > 0
                            ? (invoiceSummary.totals.balanceDueCents / 100).toFixed(2)
                            : "0.00"
                        }
                        placeholderTextColor="#9ca3af"
                        value={billingHandoffAmountInput}
                      />
                    </Field>
                  </>
                ) : null}
                {billingHandoffNoteChoices.length ? (
                  <Field label="Quick notes">
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {billingHandoffNoteChoices.map((choice) => (
                        <Chip
                          key={`handoff-note-${choice}`}
                          onPress={() => setBillingHandoffNote(choice)}
                          selected={billingHandoffNote.trim() === choice}
                          tone="brand"
                        >
                          {choice}
                        </Chip>
                      ))}
                    </View>
                  </Field>
                ) : null}
                <Field
                  hint={
                    selectedBillingHandoffKind === "other"
                      ? "Describe the billing outcome so the office knows exactly what happened."
                      : "Add any payment promise, resend context, or reconciliation detail if it matters."
                  }
                  label={selectedBillingHandoffKind === "other" ? "Required note" : "Optional note"}
                >
                  <Input
                    multiline
                    onChangeText={setBillingHandoffNote}
                    placeholder="Customer asked for the invoice again after the visit, office should follow up, or reconciliation detail."
                    placeholderTextColor="#9ca3af"
                    value={billingHandoffNote}
                  />
                  <DictationButton
                    contextualStrings={mergeDictationContext(
                      [billingHandoffOption.label],
                      billingPhrases,
                      paymentPhrases
                    )}
                    label="Dictate billing handoff"
                    onChangeText={setBillingHandoffNote}
                    value={billingHandoffNote}
                  />
                </Field>
                <Button
                  loading={activeInlineAction === "create_payment_handoff"}
                  onPress={() => void handleSubmitStopPaymentHandoff()}
                  tone="secondary"
                >
                  Record billing handoff
                </Button>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "700" }}>
                  Recent billing handoffs
                </Text>
                {billingHandoffs.length ? (
                  <View style={{ gap: 10 }}>
                    {billingHandoffs.slice(0, 3).map((handoff) => (
                      <Card key={handoff.id} tone="subtle">
                        <View style={{ gap: 8 }}>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            <Badge tone={getStopPaymentHandoffBadgeTone(handoff)}>
                              {formatStopPaymentHandoffKindLabel(handoff.kind)}
                            </Badge>
                            <Badge tone={handoff.status === "resolved" ? "success" : "neutral"}>
                              {handoff.pendingSync ? "Queued" : handoff.status}
                            </Badge>
                            {handoff.tenderType ? (
                              <Badge tone="neutral">
                                {formatStopTenderTypeLabel(handoff.tenderType)}
                              </Badge>
                            ) : null}
                          </View>
                          <CardCopy>
                            {handoff.amountCents
                              ? formatCurrencyFromCents(
                                  handoff.amountCents,
                                  invoiceSummary.invoice.currencyCode
                                )
                              : "No amount captured"}
                          </CardCopy>
                          {handoff.note ? <CardCopy>{handoff.note}</CardCopy> : null}
                        </View>
                      </Card>
                    ))}
                  </View>
                ) : (
                  <Notice
                    body="No structured billing handoffs have been recorded for this stop yet."
                    title="No billing handoffs"
                    tone="brand"
                  />
                )}
              </View>
            </View>
          )}
        </BottomSheet>
      </ScreenScrollView>
      {isDockVisible ? (
        <StickyActionDock>
          {primaryAction ? (
            <Button onPress={primaryAction.onPress} size="sm" tone={primaryAction.tone}>
              {primaryAction.label}
            </Button>
          ) : null}
          {dockActions.length ? (
            <ScrollView
              contentContainerStyle={{ gap: 6, paddingRight: 2 }}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
            >
              {dockActions.map((action) => (
                <Button
                  fullWidth={false}
                  key={`dock-${action.id}`}
                  onPress={action.onPress}
                  size="sm"
                  tone={action.tone}
                >
                  {action.label}
                </Button>
              ))}
            </ScrollView>
          ) : null}
        </StickyActionDock>
      ) : null}
    </Screen>
  );
}
