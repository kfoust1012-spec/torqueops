import {
  createInvoice,
  createInvoiceFromEstimate,
  enqueueInvoiceNotification,
  enqueuePaymentReminder,
  getEstimateByJobId as getEstimateByVisitId,
  getInvoiceByJobId as getInvoiceByVisitId,
  getInvoiceDetailById,
  getJobById as getVisitById,
  listJobCommunications as listVisitCommunications
} from "@mobile-mechanic/api-client";
import { resolveTechnicianPaymentHandoffInputSchema } from "@mobile-mechanic/validation";
import type {
  TechnicianPaymentHandoff,
  TechnicianPaymentResolutionDisposition,
  TechnicianPaymentTenderType
} from "@mobile-mechanic/types";
import { technicianPaymentResolutionDispositions } from "@mobile-mechanic/types";
import {
  canInvoiceAcceptPayments,
  formatDateTime,
  formatCurrencyFromCents,
  getCustomerDisplayName,
  isInvoiceEligibleForReminder,
  isTerminalInvoiceStatus,
  zonedLocalDateTimeToUtc
} from "@mobile-mechanic/core";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  AppIcon,
  Badge,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  Cell,
  EmptyState,
  HeaderCell,
  Input,
  Page,
  PageGrid,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TableWrap,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { processCommunicationMutationResult } from "../../../../../lib/communications/actions";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  ensureInvoiceAccessLink,
  getInvoiceAccessLinkSummary,
  markInvoiceAccessLinkSent
} from "../../../../../lib/customer-documents/service";
import {
  formatTechnicianPaymentResolutionDispositionLabel,
  inferTechnicianPaymentHandoffResolutionDisposition,
  listTechnicianPaymentHandoffsByInvoice,
  resolveTechnicianPaymentHandoff
} from "../../../../../lib/invoices/payment-handoffs";
import {
  buildVisitBillingThreadHref,
  buildVisitEstimateHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref,
  buildVisitInvoiceEditHref,
  buildVisitInvoiceHref
} from "../../../../../lib/visits/workspace";
import { VisitArtifactIntroCard } from "../_components/visit-artifact-intro-card";
import { VisitArtifactLineItemsCard } from "../_components/visit-artifact-line-items-card";
import { CommunicationLogPanel } from "../../../_components/communication-log-panel";
import { CopyPublicLinkButton } from "../../../_components/copy-public-link-button";
import { InvoiceDetailsDrawer } from "./_components/invoice-details-drawer";
import { InvoiceForm } from "./_components/invoice-form";
import { InvoiceTotalsCard } from "./_components/invoice-totals-card";

type JobInvoicePageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams: Promise<{
    checkout?: string;
    panel?: string;
    returnLabel?: string;
    returnScope?: string;
    returnTo?: string;
  }>;
};

type InvoicePanel = "activity" | "customer";

function formatCustomerName(customer: {
  companyName?: string | null | undefined;
  firstName: string;
  lastName: string;
  relationshipType?: "retail_customer" | "fleet_account" | undefined;
}) {
  return getCustomerDisplayName(customer);
}

function formatVehicleLabel(vehicle: {
  year: number | null;
  make: string | null;
  model: string | null;
}) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() || "Vehicle";
}

function getInvoiceWorkflowCopy(status: string, balanceDueCents: number) {
  switch (status) {
    case "draft":
      return "Review line items, terms, and totals before the invoice is issued.";
    case "issued":
      return balanceDueCents > 0
        ? "Keep payment access and reminders close while the customer settles the balance."
        : "Issued with no remaining balance. Keep the record ready for payment confirmation.";
    case "partially_paid":
      return "Payment is in motion. Track the remainder and preserve context for follow-up.";
    case "paid":
      return "Billing is complete. The focus now is auditability and a clean service record.";
    case "void":
      return "This billing record is closed. Preserve the trail and avoid new collection actions.";
    default:
      return "Keep the invoice state clear and customer-ready.";
  }
}

function getCheckoutCallout(checkout: string | undefined) {
  switch (checkout) {
    case "success":
      return {
        body: "Stripe accepted the payment submission. The invoice will update to its final paid state after reconciliation finishes.",
        title: "Payment submitted",
        tone: "success" as const
      };
    case "canceled":
      return {
        body: "No payment was completed. Reopen the payment page only when the customer is ready to try again.",
        title: "Payment canceled",
        tone: "warning" as const
      };
    case "unavailable":
      return {
        body: "Online payment is not configured right now. Add the Stripe server secrets before offering checkout from this invoice.",
        title: "Payment unavailable",
        tone: "danger" as const
      };
    default:
      return null;
  }
}

function getInvoicePanel(panel: string | undefined): InvoicePanel | null {
  return panel === "activity" || panel === "customer" ? panel : null;
}

function formatPaymentHandoffKindLabel(kind: TechnicianPaymentHandoff["kind"]) {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPaymentTenderTypeLabel(tenderType: TechnicianPaymentTenderType) {
  return tenderType.charAt(0).toUpperCase() + tenderType.slice(1);
}

function getPaymentHandoffTone(handoff: TechnicianPaymentHandoff) {
  if (handoff.status === "resolved") {
    return "success" as const;
  }

  if (handoff.kind === "manual_tender") {
    return "info" as const;
  }

  if (handoff.kind === "follow_up_required" || handoff.kind === "other") {
    return "warning" as const;
  }

  return "brand" as const;
}

function isTechnicianPaymentResolutionDisposition(
  value: string
): value is TechnicianPaymentResolutionDisposition {
  return technicianPaymentResolutionDispositions.includes(
    value as TechnicianPaymentResolutionDisposition
  );
}

function buildInvoicePageHref(
  path: string,
  query: {
    checkout?: string | undefined;
    panel?: string | null | undefined;
    returnLabel?: string | null | undefined;
    returnScope?: string | null | undefined;
    returnTo?: string | null | undefined;
  }
) {
  const searchParams = new URLSearchParams();

  if (query.checkout) {
    searchParams.set("checkout", query.checkout);
  }

  if (query.panel) {
    searchParams.set("panel", query.panel);
  }

  const returnLabel = query.returnLabel?.trim();
  if (returnLabel) {
    searchParams.set("returnLabel", returnLabel);
  }

  const returnScope = query.returnScope?.trim();
  if (returnScope) {
    searchParams.set("returnScope", returnScope);
  }

  const returnTo = normalizeVisitReturnTo(query.returnTo);
  if (returnTo) {
    searchParams.set("returnTo", returnTo);
  }

  const search = searchParams.toString();
  return search ? `${path}?${search}` : path;
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string): string | null {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function getNumber(formData: FormData, key: string): number {
  const value = getString(formData, key).trim();
  return value ? Number(value) : 0;
}

function getCurrencyCents(formData: FormData, key: string): number {
  const value = getString(formData, key).trim();

  if (!value) {
    return 0;
  }

  const normalized = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(normalized) ? Math.round(normalized * 100) : 0;
}

function getPercentBasisPoints(formData: FormData, key: string): number {
  const value = getString(formData, key).trim();

  if (!value) {
    return 0;
  }

  const normalized = Number(value.replace(/[%\s]/g, ""));
  return Number.isFinite(normalized) ? Math.round(normalized * 100) : 0;
}

function getNullableDateTime(formData: FormData, key: string, timeZone: string): string | null {
  const value = getString(formData, key).trim();
  return value ? zonedLocalDateTimeToUtc(value, timeZone).toISOString() : null;
}

export async function VisitInvoicePageImpl({ params, searchParams }: JobInvoicePageProps) {
  const context = await requireCompanyContext();
  const [{ jobId }, query] = await Promise.all([params, searchParams]);
  const returnLabel = query.returnLabel?.trim() ?? "";
  const returnScope = query.returnScope?.trim() ?? "";
  const returnTo = normalizeVisitReturnTo(query.returnTo);
  const visitLinkOptions = { returnLabel, returnScope, returnTo };
  const visitThreadHref = returnScope || returnTo || returnLabel
    ? buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions)
    : buildVisitBillingThreadHref(jobId);
  const [jobResult, invoiceResult, estimateResult] = await Promise.all([
    getVisitById(context.supabase, jobId),
    getInvoiceByVisitId(context.supabase, jobId),
    getEstimateByVisitId(context.supabase, jobId)
  ]);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  if (invoiceResult.error) {
    throw invoiceResult.error;
  }

  if (estimateResult.error) {
    throw estimateResult.error;
  }

  const acceptedEstimate = estimateResult.data?.status === "accepted" ? estimateResult.data : null;

  async function createInvoiceAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createInvoice(actionContext.supabase, {
      companyId: actionContext.companyId,
      jobId,
      estimateId: null,
      invoiceNumber: getString(formData, "invoiceNumber"),
      title: getString(formData, "title"),
      notes: getNullableString(formData, "notes"),
      terms: getNullableString(formData, "terms"),
      taxRateBasisPoints: getPercentBasisPoints(formData, "taxRateBasisPoints"),
      discountCents: getCurrencyCents(formData, "discountCents"),
      dueAt: getNullableDateTime(formData, "dueAt", actionContext.company.timezone),
      createdByUserId: actionContext.currentUserId
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Failed to create invoice.");
    }

    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/invoice`);
    redirect(buildVisitInvoiceEditHref(jobId, visitLinkOptions));
  }

  async function createInvoiceFromEstimateAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const currentEstimate = await getEstimateByVisitId(actionContext.supabase, jobId);

    if (currentEstimate.error || !currentEstimate.data || currentEstimate.data.status !== "accepted") {
      throw currentEstimate.error ?? new Error("Accepted estimate not found.");
    }

    const result = await createInvoiceFromEstimate(actionContext.supabase, {
      companyId: actionContext.companyId,
      jobId,
      estimateId: currentEstimate.data.id,
      invoiceNumber: getString(formData, "invoiceNumber"),
      createdByUserId: actionContext.currentUserId
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Failed to create invoice from estimate.");
    }

    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/invoice`);
    redirect(buildVisitInvoiceEditHref(jobId, visitLinkOptions));
  }

  if (!invoiceResult.data) {
    return (
      <Page className="invoice-workspace-page invoice-workspace-page--empty" layout="command">
        <VisitArtifactIntroCard
          className="invoice-workspace__rail-card"
          eyebrow="Invoice workspace"
          title="Create invoice"
          description={
            <>
              Start the billing file for <strong>{jobResult.data.title}</strong> without leaving this visit workflow.
            </>
          }
          actionsClassName="invoice-workspace__header-actions"
          actions={
            <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
              Open visit thread
            </Link>
          }
        />

        <PageGrid hasSidebar={Boolean(acceptedEstimate)} className="invoice-workspace__layout">
          <div className="invoice-workspace__main">
            {context.canEditRecords ? (
              <InvoiceForm
                action={createInvoiceAction}
                cancelHref={visitThreadHref}
                initialValues={
                  acceptedEstimate
                    ? {
                        id: "",
                        companyId: acceptedEstimate.companyId,
                        jobId: acceptedEstimate.jobId,
                        estimateId: acceptedEstimate.id,
                        status: "draft",
                        invoiceNumber: "",
                        title: acceptedEstimate.title,
                        notes: acceptedEstimate.notes,
                        terms: acceptedEstimate.terms,
                        currencyCode: "USD",
                        paymentUrl: null,
                        paymentUrlExpiresAt: null,
                        stripeCheckoutSessionId: null,
                        taxRateBasisPoints: acceptedEstimate.taxRateBasisPoints,
                        subtotalCents: 0,
                        discountCents: acceptedEstimate.discountCents,
                        taxCents: 0,
                        totalCents: 0,
                        amountPaidCents: 0,
                        balanceDueCents: 0,
                        dueAt: null,
                        issuedAt: null,
                        paidAt: null,
                        voidedAt: null,
                        createdByUserId: context.currentUserId,
                        createdAt: "",
                        updatedAt: ""
                      }
                    : null
                }
                submitLabel="Create manual invoice"
                timeZone={context.company.timezone}
              />
            ) : (
              <Card tone="subtle">
                <CardContent>
                  <EmptyState
                    description="Office staff can create the first invoice for this visit from the web editor."
                    eyebrow="Invoice locked"
                    title="Billing has not started yet"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {acceptedEstimate ? (
            <aside className="ui-sidebar-stack ui-sticky">
              <Card className="invoice-workspace__rail-card" tone="raised">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>Accepted estimate</CardEyebrow>
                    <CardTitle>Create from approved work</CardTitle>
                    <CardDescription>
                      Pull estimate <strong>{acceptedEstimate.estimateNumber}</strong> into the
                      invoice so labor, parts, and terms stay aligned.
                    </CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <div className="invoice-workspace__mini-grid">
                    <div className="invoice-workspace__mini-item">
                      <span>Estimate total</span>
                      <strong>
                        {formatCurrencyFromCents(
                          acceptedEstimate.totalCents,
                          acceptedEstimate.currencyCode
                        )}
                      </strong>
                    </div>
                    <div className="invoice-workspace__mini-item">
                      <span>Tax rate</span>
                      <strong>{acceptedEstimate.taxRateBasisPoints / 100}%</strong>
                    </div>
                  </div>

                  <form action={createInvoiceFromEstimateAction} className="ui-form">
                    <label className="ui-field">
                      <span className="ui-field__label">Invoice number</span>
                      <Input name="invoiceNumber" placeholder="INV-1001" required type="text" />
                    </label>

                    <button className={buttonClassName()} type="submit">
                      Create from estimate
                    </button>
                  </form>
                </CardContent>
              </Card>
            </aside>
          ) : null}
        </PageGrid>
      </Page>
    );
  }

  const detailResult = await getInvoiceDetailById(context.supabase, invoiceResult.data.id);

  if (detailResult.error || !detailResult.data) {
    throw detailResult.error ?? new Error("Invoice detail could not be loaded.");
  }

  const detail = detailResult.data;
  const invoice = detail.invoice;
  const [communicationsResult, paymentHandoffs] = await Promise.all([
    listVisitCommunications(context.supabase, jobId, { limit: 8 }),
    listTechnicianPaymentHandoffsByInvoice(context.supabase as any, invoice.id)
  ]);

  if (communicationsResult.error) {
    throw communicationsResult.error;
  }

  const communicationEntries = (communicationsResult.data ?? []).filter(
    (entry) =>
      entry.invoiceId === invoice.id &&
      ["invoice_notification", "payment_reminder"].includes(entry.communicationType)
  );
  const openPaymentHandoffs = paymentHandoffs.filter((handoff) => handoff.status === "open");
  const resolvedPaymentHandoffs = paymentHandoffs.filter((handoff) => handoff.status === "resolved");
  const hasActivePaymentLink =
    invoice.paymentUrl &&
    invoice.paymentUrlExpiresAt &&
    new Date(invoice.paymentUrlExpiresAt).getTime() > Date.now();
  const customerLinkSummary =
    context.canEditRecords && ["issued", "partially_paid"].includes(invoice.status)
      ? await getInvoiceAccessLinkSummary(invoice.id)
      : null;
  const pagePath = `/dashboard/visits/${jobId}/invoice`;
  const customerName = formatCustomerName(detail.customer);
  const customerThreadHref = buildCustomerWorkspaceHref(detail.customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(detail.customer.id, { tab: "addresses" });
  const vehicleLabel = formatVehicleLabel(detail.vehicle);
  const checkoutCallout = getCheckoutCallout(query.checkout);
  const activePanel = getInvoicePanel(query.panel);
  const closePanelHref = buildInvoicePageHref(pagePath, {
    checkout: query.checkout,
    returnLabel,
    returnScope,
    returnTo
  });

  async function issueInvoiceLinkAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await ensureInvoiceAccessLink({
      invoiceId: invoice.id,
      actorUserId: actionContext.currentUserId
    });

    revalidatePath(pagePath);
    redirect(pagePath);
  }

  async function sendInvoiceNotificationAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const linkSummary = await ensureInvoiceAccessLink({
      invoiceId: invoice.id,
      actorUserId: actionContext.currentUserId,
      rotate: true
    });
    const result = await enqueueInvoiceNotification(actionContext.supabase, {
      invoiceId: invoice.id,
      actorUserId: actionContext.currentUserId,
      actionUrl: linkSummary.publicUrl,
      resend: true
    });

    await processCommunicationMutationResult(result, "Failed to queue invoice notification.");
    await markInvoiceAccessLinkSent(
      linkSummary.linkId,
      result.data?.id ?? null,
      actionContext.currentUserId
    );

    revalidatePath(pagePath);
    redirect(pagePath);
  }

  async function sendPaymentReminderAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const linkSummary = await ensureInvoiceAccessLink({
      invoiceId: invoice.id,
      actorUserId: actionContext.currentUserId
    });
    const result = await enqueuePaymentReminder(actionContext.supabase, {
      invoiceId: invoice.id,
      actorUserId: actionContext.currentUserId,
      actionUrl: linkSummary.publicUrl,
      resend: true
    });

    await processCommunicationMutationResult(result, "Failed to queue payment reminder.");
    await markInvoiceAccessLinkSent(
      linkSummary.linkId,
      result.data?.id ?? null,
      actionContext.currentUserId
    );

    revalidatePath(pagePath);
    redirect(pagePath);
  }

  async function resolvePaymentHandoffAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const handoffId = getString(formData, "handoffId");
    const returnPanel = getString(formData, "returnPanel");
    const resolutionDispositionValue = getString(formData, "resolutionDisposition");
    const resolutionNoteValue = getString(formData, "resolutionNote").trim();

    if (!handoffId.trim()) {
      throw new Error("Payment handoff id is required.");
    }

    if (!isTechnicianPaymentResolutionDisposition(resolutionDispositionValue)) {
      throw new Error("Select how the billing handoff was resolved.");
    }

    const parsedResolutionInput = resolveTechnicianPaymentHandoffInputSchema.safeParse({
      resolutionDisposition: resolutionDispositionValue,
      resolutionNote: resolutionNoteValue || null
    });

    if (!parsedResolutionInput.success) {
      throw new Error(
        parsedResolutionInput.error.issues[0]?.message ??
          "Select how the billing handoff was resolved."
      );
    }

    await resolveTechnicianPaymentHandoff(
      actionContext.supabase as any,
      handoffId,
      actionContext.currentUserId,
      parsedResolutionInput.data
    );

    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(pagePath);
    redirect(
      buildInvoicePageHref(pagePath, {
        checkout: query.checkout,
        panel: getInvoicePanel(returnPanel) ?? null,
        returnLabel,
        returnScope,
        returnTo
      })
    );
  }

  return (
    <Page className="invoice-workspace-page" layout="command">
      <VisitArtifactIntroCard
        className="invoice-workspace__rail-card"
        eyebrow="Invoice file"
        title={invoice.title}
        description={
          <>
            Invoice <strong>{invoice.invoiceNumber}</strong> for this visit. Keep customer billing, collection state, and payment follow-through on the same service thread.
          </>
        }
        headerMetaClassName="invoice-workspace__header-status"
        headerMeta={
          <>
            <StatusBadge status={invoice.status} />
            <Badge tone="brand">{invoice.invoiceNumber}</Badge>
          </>
        }
        actionsClassName="invoice-workspace__header-actions"
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
              Open visit thread
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href={customerThreadHref}>
              Open customer thread
            </Link>
            {context.canEditRecords && !isTerminalInvoiceStatus(invoice.status) && invoice.status === "draft" ? (
              <Link className={buttonClassName()} href={buildVisitInvoiceEditHref(jobId, visitLinkOptions)}>
                Edit invoice
              </Link>
            ) : null}
          </>
        }
      />

      {checkoutCallout ? (
        <Callout tone={checkoutCallout.tone} title={checkoutCallout.title}>
          {checkoutCallout.body}
        </Callout>
      ) : null}

      <section aria-label="Invoice summary" className="invoice-workspace__hero">
        <article className="invoice-workspace__hero-card">
          <div className="invoice-workspace__hero-icon">
            <AppIcon name="money" />
          </div>
          <div className="invoice-workspace__hero-copy">
            <p className="invoice-workspace__hero-label">Balance due</p>
            <strong className="invoice-workspace__hero-value">
              {formatCurrencyFromCents(detail.totals.balanceDueCents, invoice.currencyCode)}
            </strong>
            <p className="invoice-workspace__hero-note">
              {getInvoiceWorkflowCopy(invoice.status, detail.totals.balanceDueCents)}
            </p>
          </div>
        </article>

        <article className="invoice-workspace__hero-card">
          <div className="invoice-workspace__hero-icon">
            <AppIcon name="invoices" />
          </div>
          <div className="invoice-workspace__hero-copy">
            <p className="invoice-workspace__hero-label">Invoice total</p>
            <strong className="invoice-workspace__hero-value">
              {formatCurrencyFromCents(detail.totals.totalCents, invoice.currencyCode)}
            </strong>
            <p className="invoice-workspace__hero-note">
              {detail.lineItems.length} line {detail.lineItems.length === 1 ? "item" : "items"} in
              this billing file.
            </p>
          </div>
        </article>

        <article className="invoice-workspace__hero-card">
          <div className="invoice-workspace__hero-icon">
            <AppIcon name="approval" />
          </div>
          <div className="invoice-workspace__hero-copy">
            <p className="invoice-workspace__hero-label">Collected</p>
            <strong className="invoice-workspace__hero-value">
              {formatCurrencyFromCents(detail.totals.amountPaidCents, invoice.currencyCode)}
            </strong>
            <p className="invoice-workspace__hero-note">
              {detail.payments.length} payment {detail.payments.length === 1 ? "record" : "records"} logged.
            </p>
          </div>
        </article>

        <article className="invoice-workspace__hero-card">
          <div className="invoice-workspace__hero-icon">
            <AppIcon name="today" />
          </div>
          <div className="invoice-workspace__hero-copy">
            <p className="invoice-workspace__hero-label">Due date</p>
            <strong className="invoice-workspace__hero-value invoice-workspace__hero-value--compact">
              {formatDateTime(invoice.dueAt, {
                fallback: "Not scheduled",
                timeZone: context.company.timezone
              })}
            </strong>
            <p className="invoice-workspace__hero-note">
              Updated {formatDateTime(invoice.updatedAt, { timeZone: context.company.timezone })}.
            </p>
          </div>
        </article>
      </section>

      <PageGrid className="invoice-workspace__layout" hasSidebar>
        <div className="invoice-workspace__main">
          <Card className="invoice-workspace__summary-card" tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Billing file</CardEyebrow>
                <CardTitle>{invoice.invoiceNumber}</CardTitle>
                <CardDescription>
                  {customerName} · {vehicleLabel}
                </CardDescription>
              </CardHeaderContent>
              <div className="invoice-workspace__summary-badges">
                {detail.estimate ? (
                  <Badge tone="neutral">Estimate-backed</Badge>
                ) : (
                  <Badge tone="neutral">Manual invoice</Badge>
                )}
                <Badge tone="neutral">{invoice.taxRateBasisPoints / 100}% tax</Badge>
              </div>
            </CardHeader>

            <CardContent className="invoice-workspace__summary-content">
              <div className="invoice-workspace__meta-grid">
                <div className="invoice-workspace__meta-item">
                  <span>Customer</span>
                  <strong>{customerName}</strong>
                </div>
                <div className="invoice-workspace__meta-item">
                  <span>Vehicle</span>
                  <strong>{vehicleLabel}</strong>
                </div>
                <div className="invoice-workspace__meta-item">
                  <span>Visit</span>
                  <strong>{jobResult.data.title}</strong>
                </div>
                <div className="invoice-workspace__meta-item">
                  <span>Estimate source</span>
                  <strong>
                    {detail.estimate ? (
                      <Link href={buildVisitEstimateHref(jobId, visitLinkOptions)}>
                        {detail.estimate.estimateNumber}
                      </Link>
                    ) : (
                      "Manual invoice"
                    )}
                  </strong>
                </div>
                <div className="invoice-workspace__meta-item">
                  <span>Issued</span>
                  <strong>
                    {formatDateTime(invoice.issuedAt, {
                      fallback: "Not issued",
                      timeZone: context.company.timezone
                    })}
                  </strong>
                </div>
                <div className="invoice-workspace__meta-item">
                  <span>Due at</span>
                  <strong>
                    {formatDateTime(invoice.dueAt, {
                      fallback: "Not set",
                      timeZone: context.company.timezone
                    })}
                  </strong>
                </div>
              </div>

              <div className="invoice-workspace__copy-grid">
                <div className="invoice-workspace__copy-card">
                  <p className="invoice-workspace__copy-label">Notes</p>
                  <p className="invoice-workspace__copy-value">
                    {invoice.notes ?? "No invoice notes recorded."}
                  </p>
                </div>
                <div className="invoice-workspace__copy-card">
                  <p className="invoice-workspace__copy-label">Terms</p>
                  <p className="invoice-workspace__copy-value">
                    {invoice.terms ?? "No invoice terms recorded."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <VisitArtifactLineItemsCard
            className="invoice-workspace__section-card"
            currencyCode={invoice.currencyCode}
            description="Keep labor, parts, and fees readable under real billing volume."
            emptyDescription="No invoice line items have been added yet."
            emptyEyebrow="Line items"
            emptyTitle="Nothing billed yet"
            eyebrow="Charge breakdown"
            items={detail.lineItems}
            title="Line items"
          />

          <Card className="invoice-workspace__section-card" tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Collections</CardEyebrow>
                <CardTitle>Payments</CardTitle>
                <CardDescription>
                  Payment history stays visible without leaving the invoice tab.
                </CardDescription>
              </CardHeaderContent>
              <Badge tone="neutral">{detail.payments.length}</Badge>
            </CardHeader>

            <CardContent className="invoice-workspace__payments-content">
              <div className="invoice-workspace__mini-grid">
                <div className="invoice-workspace__mini-item">
                  <span>Paid amount</span>
                  <strong>
                    {formatCurrencyFromCents(detail.totals.amountPaidCents, invoice.currencyCode)}
                  </strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Balance due</span>
                  <strong>
                    {formatCurrencyFromCents(detail.totals.balanceDueCents, invoice.currencyCode)}
                  </strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Payment page</span>
                  <strong>{invoice.paymentUrl ? "Active" : "Not created"}</strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Link expires</span>
                  <strong>
                    {invoice.paymentUrlExpiresAt
                      ? formatDateTime(invoice.paymentUrlExpiresAt, {
                          timeZone: context.company.timezone
                        })
                      : "Not set"}
                  </strong>
                </div>
              </div>

              {detail.payments.length ? (
                <TableWrap className="invoice-workspace__table">
                  <Table>
                    <thead>
                      <tr>
                        <HeaderCell>Paid at</HeaderCell>
                        <HeaderCell>Status</HeaderCell>
                        <HeaderCell>Amount</HeaderCell>
                        <HeaderCell>Receipt</HeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((payment) => (
                        <tr key={payment.id}>
                          <Cell>
                            {formatDateTime(payment.paidAt, {
                              timeZone: context.company.timezone
                            })}
                          </Cell>
                          <Cell>
                            <StatusBadge status={payment.status} />
                          </Cell>
                          <Cell>
                            {formatCurrencyFromCents(payment.amountCents, payment.currencyCode)}
                          </Cell>
                          <Cell>
                            {payment.receiptUrl ? (
                              <a href={payment.receiptUrl} rel="noreferrer" target="_blank">
                                View receipt
                              </a>
                            ) : (
                              "Not available"
                            )}
                          </Cell>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              ) : (
                <EmptyState
                  description="No Stripe payments have been recorded for this invoice yet."
                  eyebrow="Payments"
                  title="No payment activity"
                />
              )}
            </CardContent>
          </Card>

          <Card className="invoice-workspace__section-card" tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Field handoffs</CardEyebrow>
                <CardTitle>Technician billing handoffs</CardTitle>
                <CardDescription>
                  Review field collection outcomes before sending another reminder or closing the billing thread.
                </CardDescription>
              </CardHeaderContent>
              <Badge tone={openPaymentHandoffs.length ? "warning" : "neutral"}>
                {paymentHandoffs.length}
              </Badge>
            </CardHeader>

            <CardContent className="invoice-workspace__payments-content">
              <div className="invoice-workspace__mini-grid">
                <div className="invoice-workspace__mini-item">
                  <span>Open handoffs</span>
                  <strong>{openPaymentHandoffs.length}</strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Resolved</span>
                  <strong>{resolvedPaymentHandoffs.length}</strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Manual tender</span>
                  <strong>
                    {paymentHandoffs.filter((handoff) => handoff.kind === "manual_tender").length}
                  </strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Latest field update</span>
                  <strong>
                    {paymentHandoffs[0]
                      ? formatDateTime(paymentHandoffs[0].createdAt, {
                          timeZone: context.company.timezone
                        })
                      : "None"}
                  </strong>
                </div>
              </div>

              {openPaymentHandoffs.length ? (
                <Callout tone="warning" title="Field billing follow-up is still open">
                  {openPaymentHandoffs.length} technician billing handoff
                  {openPaymentHandoffs.length === 1 ? " is" : "s are"} waiting on office review before
                  the invoice thread is clean.
                </Callout>
              ) : (
                <Callout tone="success" title="Billing handoffs look clear">
                  No open technician billing handoffs are waiting on office review right now.
                </Callout>
              )}

              {paymentHandoffs.length ? (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {paymentHandoffs.slice(0, 3).map((handoff) => (
                    <div
                      key={handoff.id}
                      style={{
                        border: "1px solid var(--border-subtle, #d9dee8)",
                        borderRadius: "1rem",
                        display: "grid",
                        gap: "0.75rem",
                        padding: "1rem"
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        <Badge tone={getPaymentHandoffTone(handoff)}>
                          {formatPaymentHandoffKindLabel(handoff.kind)}
                        </Badge>
                        <Badge tone={handoff.status === "resolved" ? "success" : "warning"}>
                          {handoff.status === "resolved" ? "Resolved" : "Open"}
                        </Badge>
                        {handoff.resolutionDisposition ? (
                          <Badge tone="success">
                            {formatTechnicianPaymentResolutionDispositionLabel(
                              handoff.resolutionDisposition
                            )}
                          </Badge>
                        ) : null}
                        {handoff.tenderType ? (
                          <Badge tone="neutral">
                            {formatPaymentTenderTypeLabel(handoff.tenderType)}
                          </Badge>
                        ) : null}
                      </div>
                      <div style={{ display: "grid", gap: "0.25rem" }}>
                        <strong>
                          {handoff.amountCents
                            ? formatCurrencyFromCents(handoff.amountCents, invoice.currencyCode)
                            : "No field amount captured"}
                        </strong>
                        <span style={{ color: "var(--text-muted, #5f6b7a)" }}>
                          Logged{" "}
                          {formatDateTime(handoff.createdAt, {
                            timeZone: context.company.timezone
                          })}
                        </span>
                      </div>
                      {handoff.note ? <p style={{ margin: 0 }}>{handoff.note}</p> : null}
                      {handoff.resolutionNote ? <p style={{ margin: 0 }}>{handoff.resolutionNote}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="No technician billing handoffs have been recorded for this invoice."
                  eyebrow="Field handoffs"
                  title="No billing handoffs"
                />
              )}

              <Link
                className={buttonClassName({ tone: "secondary" })}
                href={buildInvoicePageHref(pagePath, {
                  checkout: query.checkout,
                  panel: "activity",
                  returnLabel,
                  returnScope,
                  returnTo
                })}
              >
                Review all activity
              </Link>
            </CardContent>
          </Card>

        </div>

        <aside className="invoice-workspace__rail ui-sidebar-stack ui-sticky">
          <InvoiceTotalsCard invoice={invoice} totals={detail.totals} />

          <Card className="invoice-workspace__rail-card" tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Workflow control</CardEyebrow>
                <CardTitle>Next action</CardTitle>
                <CardDescription>
                  {getInvoiceWorkflowCopy(invoice.status, detail.totals.balanceDueCents)}
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>

            <CardContent className="invoice-workspace__action-stack">
              {context.canEditRecords &&
              canInvoiceAcceptPayments(invoice.status) &&
              detail.totals.balanceDueCents > 0 ? (
                <form
                  action="/api/stripe/checkout-session"
                  className="invoice-workspace__action-form"
                  method="post"
                >
                  <input name="invoiceId" type="hidden" value={invoice.id} />
                  <button className={buttonClassName()} type="submit">
                    {hasActivePaymentLink ? "Open current payment page" : "Create payment page"}
                  </button>
                </form>
              ) : null}

              {context.canEditRecords && invoice.status !== "draft" ? (
                <form
                  action={sendInvoiceNotificationAction}
                  className="invoice-workspace__action-form"
                >
                  <button className={buttonClassName({ tone: "secondary" })} type="submit">
                    Send invoice notification
                  </button>
                </form>
              ) : null}

              {context.canEditRecords && isInvoiceEligibleForReminder(invoice) ? (
                <form
                  action={sendPaymentReminderAction}
                  className="invoice-workspace__action-form"
                >
                  <button className={buttonClassName({ tone: "secondary" })} type="submit">
                    Send payment reminder
                  </button>
                </form>
              ) : null}

              {invoice.paymentUrl ? (
                <a
                  className={buttonClassName({ tone: "tertiary" })}
                  href={invoice.paymentUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open public payment page
                </a>
              ) : null}

              <Link
                className={buttonClassName({ tone: "tertiary" })}
                href={visitThreadHref}
              >
                Open visit thread
              </Link>
              <Link
                className={buttonClassName({ tone: "tertiary" })}
                href={customerThreadHref}
              >
                Open customer thread
              </Link>
              <Link
                className={buttonClassName({ tone: "tertiary" })}
                href={siteThreadHref}
              >
                Open site thread
              </Link>
            </CardContent>
          </Card>

          <Card className="invoice-workspace__rail-card" tone="subtle">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Activity</CardEyebrow>
                <CardTitle>Billing follow-up</CardTitle>
                <CardDescription>
                  Keep recent payments and customer outreach in a drawer instead of stretching the page.
                </CardDescription>
              </CardHeaderContent>
              <Badge tone="neutral">
                {detail.payments.length + communicationEntries.length + paymentHandoffs.length}
              </Badge>
            </CardHeader>

            <CardContent className="invoice-workspace__link-stack">
              <div className="invoice-workspace__mini-grid">
                <div className="invoice-workspace__mini-item">
                  <span>Payments</span>
                  <strong>{detail.payments.length}</strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Messages</span>
                  <strong>{communicationEntries.length}</strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Handoffs</span>
                  <strong>{paymentHandoffs.length}</strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Open</span>
                  <strong>{openPaymentHandoffs.length}</strong>
                </div>
              </div>

              <Link
                className={buttonClassName({ tone: "secondary" })}
                href={buildInvoicePageHref(pagePath, {
                  checkout: query.checkout,
                  panel: "activity",
                  returnLabel,
                  returnScope,
                  returnTo
                })}
              >
                Open activity drawer
              </Link>
            </CardContent>
          </Card>

          {context.canEditRecords && ["issued", "partially_paid"].includes(invoice.status) ? (
            <Card className="invoice-workspace__rail-card" tone="subtle">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Customer access</CardEyebrow>
                  <CardTitle>Customer link</CardTitle>
                  <CardDescription>
                    Send, monitor, and reopen the live invoice link without leaving billing.
                  </CardDescription>
                </CardHeaderContent>
                <Badge tone="neutral">{customerLinkSummary?.status ?? "Not issued"}</Badge>
              </CardHeader>

              <CardContent className="invoice-workspace__link-stack">
                {customerLinkSummary ? (
                  <div className="invoice-workspace__mini-grid">
                    <div className="invoice-workspace__mini-item">
                      <span>Views</span>
                      <strong>{customerLinkSummary.viewCount}</strong>
                    </div>
                    <div className="invoice-workspace__mini-item">
                      <span>Last viewed</span>
                      <strong>
                        {formatDateTime(customerLinkSummary.lastViewedAt, {
                          fallback: "Not viewed",
                          timeZone: context.company.timezone
                        })}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <p className="invoice-workspace__quiet-copy">
                    No public customer link has been issued yet. Keep this tucked into a drawer until billing is ready.
                  </p>
                )}

                <Link
                  className={buttonClassName({ tone: "secondary" })}
                href={buildInvoicePageHref(pagePath, {
                  checkout: query.checkout,
                  panel: "customer",
                  returnLabel,
                  returnScope,
                  returnTo
                })}
                >
                  Open customer drawer
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </PageGrid>

      {activePanel === "activity" ? (
        <InvoiceDetailsDrawer
          closeHref={closePanelHref}
          descriptionId="invoice-activity-drawer-description"
          titleId="invoice-activity-drawer-title"
        >
          <Card className="invoice-workspace-drawer__card" padding="spacious" tone="raised">
            <CardContent className="invoice-workspace-drawer__content">
              <div className="invoice-workspace-drawer__header">
                <div className="invoice-workspace-drawer__header-copy">
                  <p className="invoice-workspace-drawer__eyebrow">Billing activity</p>
                  <h2 className="invoice-workspace-drawer__title" id="invoice-activity-drawer-title">
                    Payments and outreach
                  </h2>
                  <p
                    className="invoice-workspace-drawer__description"
                    id="invoice-activity-drawer-description"
                  >
                    Keep recent payment activity, technician billing handoffs, and customer communication close without leaving the invoice workspace.
                  </p>
                </div>
                <button
                  className={buttonClassName({ tone: "secondary" })}
                  data-drawer-close
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="invoice-workspace__action-cluster">
                <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
                  Open visit thread
                </Link>
                <Link className={buttonClassName({ tone: "tertiary" })} href={customerThreadHref}>
                  Open customer thread
                </Link>
                <Link className={buttonClassName({ tone: "tertiary" })} href={siteThreadHref}>
                  Open site thread
                </Link>
              </div>

              <div className="invoice-workspace-drawer__summary-grid">
                <div className="invoice-workspace-drawer__summary-item">
                  <span>Paid amount</span>
                  <strong>
                    {formatCurrencyFromCents(detail.totals.amountPaidCents, invoice.currencyCode)}
                  </strong>
                </div>
                <div className="invoice-workspace-drawer__summary-item">
                  <span>Balance due</span>
                  <strong>
                    {formatCurrencyFromCents(detail.totals.balanceDueCents, invoice.currencyCode)}
                  </strong>
                </div>
                <div className="invoice-workspace-drawer__summary-item">
                  <span>Payments</span>
                  <strong>{detail.payments.length}</strong>
                </div>
                <div className="invoice-workspace-drawer__summary-item">
                  <span>Messages</span>
                  <strong>{communicationEntries.length}</strong>
                </div>
                <div className="invoice-workspace-drawer__summary-item">
                  <span>Handoffs</span>
                  <strong>{paymentHandoffs.length}</strong>
                </div>
                <div className="invoice-workspace-drawer__summary-item">
                  <span>Open handoffs</span>
                  <strong>{openPaymentHandoffs.length}</strong>
                </div>
              </div>

              <section className="invoice-workspace-drawer__section">
                <div className="invoice-workspace-drawer__section-header">
                  <p className="invoice-workspace-drawer__section-label">Payment log</p>
                </div>
                {detail.payments.length ? (
                  <TableWrap className="invoice-workspace__table">
                    <Table>
                      <thead>
                        <tr>
                          <HeaderCell>Paid at</HeaderCell>
                          <HeaderCell>Method</HeaderCell>
                          <HeaderCell>Status</HeaderCell>
                          <HeaderCell>Amount</HeaderCell>
                          <HeaderCell>Receipt</HeaderCell>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.payments.map((payment) => (
                          <tr key={payment.id}>
                            <Cell>
                              {formatDateTime(payment.paidAt, {
                                timeZone: context.company.timezone
                              })}
                            </Cell>
                            <Cell>
                              {payment.provider === "manual"
                                ? payment.manualTenderType
                                  ? `Field ${formatPaymentTenderTypeLabel(payment.manualTenderType)}`
                                  : "Field payment"
                                : "Stripe"}
                            </Cell>
                            <Cell>
                              <StatusBadge status={payment.status} />
                            </Cell>
                            <Cell>
                              <div style={{ display: "grid", gap: "0.25rem" }}>
                                <span>
                                  {formatCurrencyFromCents(payment.amountCents, payment.currencyCode)}
                                </span>
                                {payment.manualReferenceNote ? (
                                  <span style={{ color: "var(--muted-foreground)", fontSize: "0.85rem" }}>
                                    {payment.manualReferenceNote}
                                  </span>
                                ) : null}
                              </div>
                            </Cell>
                            <Cell>
                              {payment.receiptUrl ? (
                                <a href={payment.receiptUrl} rel="noreferrer" target="_blank">
                                  View receipt
                                </a>
                              ) : (
                                "Not available"
                              )}
                            </Cell>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                ) : (
                  <EmptyState
                    description="No payments have been recorded for this invoice yet."
                    eyebrow="Payments"
                    title="No payment activity"
                  />
                )}
              </section>

              <section className="invoice-workspace-drawer__section">
                <div className="invoice-workspace-drawer__section-header">
                  <p className="invoice-workspace-drawer__section-label">Technician billing handoffs</p>
                </div>
                {paymentHandoffs.length ? (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {paymentHandoffs.map((handoff) => (
                      <div
                        key={handoff.id}
                        style={{
                          border: "1px solid var(--border-subtle, #d9dee8)",
                          borderRadius: "1rem",
                          display: "grid",
                          gap: "0.75rem",
                          padding: "1rem"
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          <Badge tone={getPaymentHandoffTone(handoff)}>
                            {formatPaymentHandoffKindLabel(handoff.kind)}
                          </Badge>
                          <Badge tone={handoff.status === "resolved" ? "success" : "warning"}>
                            {handoff.status === "resolved" ? "Resolved" : "Open"}
                          </Badge>
                          {handoff.resolutionDisposition ? (
                            <Badge tone="success">
                              {formatTechnicianPaymentResolutionDispositionLabel(
                                handoff.resolutionDisposition
                              )}
                            </Badge>
                          ) : null}
                          {handoff.tenderType ? (
                            <Badge tone="neutral">
                              {formatPaymentTenderTypeLabel(handoff.tenderType)}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="invoice-workspace-drawer__summary-grid">
                          <div className="invoice-workspace-drawer__summary-item">
                            <span>Logged</span>
                            <strong>
                              {formatDateTime(handoff.createdAt, {
                                timeZone: context.company.timezone
                              })}
                            </strong>
                          </div>
                          <div className="invoice-workspace-drawer__summary-item">
                            <span>Amount</span>
                            <strong>
                              {handoff.amountCents
                                ? formatCurrencyFromCents(
                                    handoff.amountCents,
                                    invoice.currencyCode
                                  )
                                : "No amount"}
                            </strong>
                          </div>
                          <div className="invoice-workspace-drawer__summary-item">
                            <span>Promise</span>
                            <strong>
                              {formatDateTime(handoff.customerPromiseAt, {
                                fallback: "No promise time",
                                timeZone: context.company.timezone
                              })}
                            </strong>
                          </div>
                          <div className="invoice-workspace-drawer__summary-item">
                            <span>Resolved</span>
                            <strong>
                              {formatDateTime(handoff.resolvedAt, {
                                fallback: "Still open",
                                timeZone: context.company.timezone
                              })}
                            </strong>
                          </div>
                          <div className="invoice-workspace-drawer__summary-item">
                            <span>Disposition</span>
                            <strong>
                              {handoff.resolutionDisposition
                                ? formatTechnicianPaymentResolutionDispositionLabel(
                                    handoff.resolutionDisposition
                                  )
                                : "Pending office review"}
                            </strong>
                          </div>
                        </div>

                        {handoff.note ? <p style={{ margin: 0 }}>{handoff.note}</p> : null}
                        {handoff.resolutionNote ? <p style={{ margin: 0 }}>{handoff.resolutionNote}</p> : null}

                        {handoff.status === "open" && context.canEditRecords ? (
                          <form action={resolvePaymentHandoffAction}>
                            <input name="handoffId" type="hidden" value={handoff.id} />
                            <input name="returnPanel" type="hidden" value="activity" />
                            <div style={{ display: "grid", gap: "0.75rem" }}>
                              <label style={{ display: "grid", gap: "0.35rem" }}>
                                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                                  Office disposition
                                </span>
                                <Select
                                  defaultValue={inferTechnicianPaymentHandoffResolutionDisposition(
                                    handoff
                                  )}
                                  name="resolutionDisposition"
                                >
                                  {technicianPaymentResolutionDispositions.map((disposition) => (
                                    <option key={disposition} value={disposition}>
                                      {formatTechnicianPaymentResolutionDispositionLabel(
                                        disposition
                                      )}
                                    </option>
                                  ))}
                                </Select>
                              </label>
                              <label style={{ display: "grid", gap: "0.35rem" }}>
                                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                                  Resolution note
                                </span>
                                <Input
                                  defaultValue=""
                                  name="resolutionNote"
                                  placeholder="Optional note for billing audit trail"
                                  type="text"
                                />
                              </label>
                            </div>
                            <button
                              className={buttonClassName({ tone: "secondary" })}
                              type="submit"
                            >
                              Resolve handoff
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    description="No technician billing handoffs have been recorded for this invoice yet."
                    eyebrow="Field handoffs"
                    title="No billing handoffs"
                  />
                )}
              </section>

              <CommunicationLogPanel
                eyebrow="History"
                emptyMessage="No invoice notifications or reminders have been logged yet."
                entries={communicationEntries}
                timeZone={context.company.timezone}
                title="Invoice communication log"
              />
            </CardContent>
          </Card>
        </InvoiceDetailsDrawer>
      ) : null}

      {activePanel === "customer" && context.canEditRecords && ["issued", "partially_paid"].includes(invoice.status) ? (
        <InvoiceDetailsDrawer
          closeHref={closePanelHref}
          descriptionId="invoice-customer-drawer-description"
          titleId="invoice-customer-drawer-title"
        >
          <Card className="invoice-workspace-drawer__card" padding="spacious" tone="raised">
            <CardContent className="invoice-workspace-drawer__content">
              <div className="invoice-workspace-drawer__header">
                <div className="invoice-workspace-drawer__header-copy">
                  <p className="invoice-workspace-drawer__eyebrow">Customer access</p>
                  <h2 className="invoice-workspace-drawer__title" id="invoice-customer-drawer-title">
                    Invoice link control
                  </h2>
                  <p
                    className="invoice-workspace-drawer__description"
                    id="invoice-customer-drawer-description"
                  >
                    Send, reopen, and monitor the live customer invoice link without leaving the page.
                  </p>
                </div>
                <button
                  className={buttonClassName({ tone: "secondary" })}
                  data-drawer-close
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="invoice-workspace__action-cluster">
                <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
                  Open visit thread
                </Link>
                <Link className={buttonClassName({ tone: "tertiary" })} href={customerThreadHref}>
                  Open customer thread
                </Link>
                <Link className={buttonClassName({ tone: "tertiary" })} href={siteThreadHref}>
                  Open site thread
                </Link>
              </div>

              {customerLinkSummary ? (
                <>
                  <div className="invoice-workspace-drawer__summary-grid">
                    <div className="invoice-workspace-drawer__summary-item">
                      <span>Sent</span>
                      <strong>
                        {formatDateTime(customerLinkSummary.sentAt, {
                          fallback: "Not sent",
                          timeZone: context.company.timezone
                        })}
                      </strong>
                    </div>
                    <div className="invoice-workspace-drawer__summary-item">
                      <span>First viewed</span>
                      <strong>
                        {formatDateTime(customerLinkSummary.firstViewedAt, {
                          fallback: "Not viewed",
                          timeZone: context.company.timezone
                        })}
                      </strong>
                    </div>
                    <div className="invoice-workspace-drawer__summary-item">
                      <span>Last viewed</span>
                      <strong>
                        {formatDateTime(customerLinkSummary.lastViewedAt, {
                          fallback: "Not viewed",
                          timeZone: context.company.timezone
                        })}
                      </strong>
                    </div>
                    <div className="invoice-workspace-drawer__summary-item">
                      <span>Views</span>
                      <strong>{customerLinkSummary.viewCount}</strong>
                    </div>
                    <div className="invoice-workspace-drawer__summary-item invoice-workspace-drawer__summary-item--full">
                      <span>Expires</span>
                      <strong>
                        {formatDateTime(customerLinkSummary.expiresAt, {
                          timeZone: context.company.timezone
                        })}
                      </strong>
                    </div>
                  </div>

                  <div className="invoice-workspace__readonly-field">
                    <span>Public customer link</span>
                    <Input readOnly type="text" value={customerLinkSummary.publicUrl} />
                  </div>

                  {customerLinkSummary.status === "active" ? (
                    <div className="invoice-workspace__action-cluster">
                      <a
                        className={buttonClassName({ tone: "secondary" })}
                        href={customerLinkSummary.publicUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open link
                      </a>
                      <CopyPublicLinkButton
                        linkId={customerLinkSummary.linkId}
                        publicUrl={customerLinkSummary.publicUrl}
                      />
                      <form action={sendInvoiceNotificationAction}>
                        <button className={buttonClassName()} type="submit">
                          Resend link
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form action={issueInvoiceLinkAction}>
                      <button className={buttonClassName()} type="submit">
                        Issue fresh customer link
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <>
                  <p className="invoice-workspace__quiet-copy">
                    No public customer link has been issued yet. Create one explicitly before copying or sending it.
                  </p>

                  <div className="invoice-workspace__action-cluster">
                    <form action={issueInvoiceLinkAction}>
                      <button className={buttonClassName()} type="submit">
                        Issue customer link
                      </button>
                    </form>
                    <form action={sendInvoiceNotificationAction}>
                      <button className={buttonClassName({ tone: "secondary" })} type="submit">
                        Send invoice notification
                      </button>
                    </form>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </InvoiceDetailsDrawer>
      ) : null}
    </Page>
  );
}

export default VisitInvoicePageImpl;
