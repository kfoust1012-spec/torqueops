import {
  changeInvoiceStatus,
  createInvoice,
  createInvoiceFromEstimate,
  createInvoiceLineItem,
  deleteInvoiceLineItem,
  enqueueInvoiceNotification,
  getEstimateByJobId,
  getInvoiceByJobId,
  getInvoiceDetailById,
  getJobById,
  updateInvoice,
  updateInvoiceLineItem
} from "@mobile-mechanic/api-client";
import type { InvoiceStatus } from "@mobile-mechanic/types";
import {
  formatCurrencyFromCents,
  formatDateTime,
  getCustomerDisplayName,
  getAllowedNextInvoiceStatuses,
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
  EmptyState,
  Form,
  FormField,
  Input,
  Page,
  PageGrid,
  PageHeader,
  StatusBadge,
  SubmitButton,
  buttonClassName
} from "../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../lib/company-context";
import { processCommunicationMutationResult } from "../../../../../../lib/communications/actions";
import { buildCustomerWorkspaceHref } from "../../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../../lib/dashboard/route-alias";
import {
  ensureInvoiceAccessLink,
  markInvoiceAccessLinkSent
} from "../../../../../../lib/customer-documents/service";
import {
  buildVisitBillingThreadHref,
  buildVisitDetailHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref,
  buildVisitInvoiceEditHref,
  buildVisitInvoiceHref
} from "../../../../../../lib/visits/workspace";
import { InvoiceForm } from "../_components/invoice-form";
import { InvoiceDetailsDrawer } from "../_components/invoice-details-drawer";
import { InvoiceLineItemForm } from "../_components/invoice-line-item-form";
import { InvoiceStatusForm } from "../_components/invoice-status-form";
import { InvoiceTotalsCard } from "../_components/invoice-totals-card";

type EditJobInvoicePageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams?: Promise<{
    feedback?: string | string[];
    lineItemId?: string | string[];
    panel?: string | string[];
    returnLabel?: string | string[];
    returnScope?: string | string[];
    returnTo?: string | string[];
  }>;
};

type InvoiceEditorPanel = "line-item" | "status";

const invoiceEditorFeedback = {
  "invoice-create-failed": {
    body: "The invoice could not be created. Check the required fields and try again.",
    title: "Invoice create failed",
    tone: "danger"
  },
  "invoice-created": {
    body: "The invoice was created and is ready for billing review.",
    title: "Invoice created",
    tone: "success"
  },
  "invoice-save-failed": {
    body: "The invoice changes could not be saved. Refresh the page and try again.",
    title: "Invoice save failed",
    tone: "danger"
  },
  "invoice-saved": {
    body: "The invoice details were saved successfully.",
    title: "Invoice saved",
    tone: "success"
  },
  "line-item-delete-failed": {
    body: "The line item could not be removed. Refresh the page and try again.",
    title: "Line item delete failed",
    tone: "danger"
  },
  "line-item-deleted": {
    body: "The invoice line item was removed.",
    title: "Line item deleted",
    tone: "success"
  },
  "line-item-save-failed": {
    body: "The line item could not be saved. Check the entered values and try again.",
    title: "Line item save failed",
    tone: "danger"
  },
  "line-item-saved": {
    body: "The invoice line item was saved.",
    title: "Line item saved",
    tone: "success"
  },
  "status-save-failed": {
    body: "The invoice status could not be updated. Refresh the page and try again.",
    title: "Status update failed",
    tone: "danger"
  },
  "status-saved": {
    body: "The invoice status was updated successfully.",
    title: "Status updated",
    tone: "success"
  }
} as const;

function getQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] ?? null : null;
}

function getInvoiceEditorPanel(value: string | null): InvoiceEditorPanel | null {
  return value === "line-item" || value === "status" ? value : null;
}

function buildEditorHref(
  path: string,
  options: {
    feedback?: string | null | undefined;
    lineItemId?: string | null | undefined;
    panel?: InvoiceEditorPanel | null | undefined;
    returnLabel?: string | null | undefined;
    returnScope?: string | null | undefined;
    returnTo?: string | null | undefined;
  }
) {
  const searchParams = new URLSearchParams();

  if (options.feedback) {
    searchParams.set("feedback", options.feedback);
  }

  if (options.panel) {
    searchParams.set("panel", options.panel);
  }

  if (options.lineItemId) {
    searchParams.set("lineItemId", options.lineItemId);
  }

  const returnLabel = options.returnLabel?.trim();
  if (returnLabel) {
    searchParams.set("returnLabel", returnLabel);
  }

  const returnScope = options.returnScope?.trim();
  if (returnScope) {
    searchParams.set("returnScope", returnScope);
  }

  const returnTo = normalizeVisitReturnTo(options.returnTo);
  if (returnTo) {
    searchParams.set("returnTo", returnTo);
  }

  const search = searchParams.toString();
  return search ? `${path}?${search}` : path;
}

function buildFeedbackHref(
  path: string,
  feedback?: keyof typeof invoiceEditorFeedback,
  options?: {
    returnLabel?: string | null | undefined;
    returnScope?: string | null | undefined;
    returnTo?: string | null | undefined;
  }
) {
  if (!feedback) {
    return buildEditorHref(path, options ?? {});
  }

  return buildEditorHref(path, {
    ...options,
    feedback
  });
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

export async function VisitInvoiceEditPageImpl({
  params,
  searchParams
}: EditJobInvoicePageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { jobId } = await params;
  const returnLabel = getQueryValue(resolvedSearchParams.returnLabel)?.trim() ?? "";
  const returnScope = getQueryValue(resolvedSearchParams.returnScope)?.trim() ?? "";
  const returnTo = normalizeVisitReturnTo(getQueryValue(resolvedSearchParams.returnTo));
  const visitLinkOptions = { returnLabel, returnScope, returnTo };
  const visitThreadHref = returnScope || returnTo || returnLabel
    ? buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions)
    : buildVisitBillingThreadHref(jobId);
  const feedbackKey = getQueryValue(resolvedSearchParams.feedback);
  const feedback =
    feedbackKey && feedbackKey in invoiceEditorFeedback
      ? invoiceEditorFeedback[feedbackKey as keyof typeof invoiceEditorFeedback]
      : null;
  const [jobResult, invoiceResult, estimateResult] = await Promise.all([
    getJobById(context.supabase, jobId),
    getInvoiceByJobId(context.supabase, jobId),
    getEstimateByJobId(context.supabase, jobId)
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
      redirect(buildFeedbackHref(`/dashboard/visits/${jobId}/invoice/edit`, "invoice-create-failed", visitLinkOptions));
    }

    revalidatePath(buildVisitDetailHref(jobId));
    revalidatePath(buildVisitInvoiceHref(jobId));
    revalidatePath(buildVisitInvoiceEditHref(jobId));
    redirect(buildFeedbackHref(`/dashboard/visits/${jobId}/invoice/edit`, "invoice-created", visitLinkOptions));
  }

  async function createInvoiceFromEstimateAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const currentEstimate = await getEstimateByJobId(actionContext.supabase, jobId);

    if (currentEstimate.error || !currentEstimate.data || currentEstimate.data.status !== "accepted") {
      redirect(buildFeedbackHref(`/dashboard/visits/${jobId}/invoice/edit`, "invoice-create-failed", visitLinkOptions));
    }

    const result = await createInvoiceFromEstimate(actionContext.supabase, {
      companyId: actionContext.companyId,
      jobId,
      estimateId: currentEstimate.data.id,
      invoiceNumber: getString(formData, "invoiceNumber"),
      createdByUserId: actionContext.currentUserId
    });

    if (result.error || !result.data) {
      redirect(buildFeedbackHref(`/dashboard/visits/${jobId}/invoice/edit`, "invoice-create-failed", visitLinkOptions));
    }

    revalidatePath(buildVisitDetailHref(jobId));
    revalidatePath(buildVisitInvoiceHref(jobId));
    revalidatePath(buildVisitInvoiceEditHref(jobId));
    redirect(buildFeedbackHref(`/dashboard/visits/${jobId}/invoice/edit`, "invoice-created", visitLinkOptions));
  }

  if (!invoiceResult.data) {
    return (
      <Page layout="command">
        <PageHeader
          actions={
            <Link className={buttonClassName({ tone: "secondary" })} href={visitThreadHref}>
              Open visit thread
            </Link>
          }
          description={
            <>
              Start the invoice for <strong>{jobResult.data.title}</strong>.
            </>
          }
          eyebrow="Invoice file"
          title="Create invoice"
        />

        {feedback ? (
          <Callout tone={feedback.tone} title={feedback.title}>
            {feedback.body}
          </Callout>
        ) : null}

        <PageGrid hasSidebar={Boolean(acceptedEstimate)}>
          <div className="ui-card-list">
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
          </div>

          {acceptedEstimate ? (
            <div className="ui-sidebar-stack ui-sticky">
              <Card tone="subtle">
                <CardHeader>
                  <CardHeaderContent>
                    <CardEyebrow>From estimate</CardEyebrow>
                    <CardTitle>Create from accepted estimate</CardTitle>
                    <CardDescription>
                      Use estimate <strong>{acceptedEstimate.estimateNumber}</strong> as the invoice source snapshot.
                    </CardDescription>
                  </CardHeaderContent>
                </CardHeader>
                <CardContent>
                  <Form action={createInvoiceFromEstimateAction}>
                    <FormField label="Invoice number" required>
                      <Input name="invoiceNumber" placeholder="INV-1001" required type="text" />
                    </FormField>
                    <SubmitButton pendingLabel="Creating invoice...">
                      Create from estimate
                    </SubmitButton>
                  </Form>
                </CardContent>
              </Card>
            </div>
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
  const isReadOnlyInvoice = invoice.status !== "draft";
  const activePanel = getInvoiceEditorPanel(getQueryValue(resolvedSearchParams.panel));
  const selectedLineItemId = getQueryValue(resolvedSearchParams.lineItemId);
  const selectedLineItem =
    selectedLineItemId && selectedLineItemId !== "new"
      ? detail.lineItems.find((lineItem) => lineItem.id === selectedLineItemId) ?? null
      : null;
  const customerName = formatCustomerName(detail.customer);
  const vehicleLabel = formatVehicleLabel(detail.vehicle);
  const customerThreadHref = buildCustomerWorkspaceHref(detail.customer.id);
  const siteThreadHref = buildCustomerWorkspaceHref(detail.customer.id, { tab: "addresses" });

  if (isTerminalInvoiceStatus(invoice.status)) {
    redirect(buildVisitInvoiceHref(jobId, visitLinkOptions));
  }

  const allowedStatuses = getAllowedNextInvoiceStatuses(invoice.status);
  const pagePath = `/dashboard/visits/${jobId}/invoice/edit`;
  const detailPath = buildVisitInvoiceHref(jobId, visitLinkOptions);
  const closePanelHref = buildEditorHref(pagePath, {
    feedback: feedbackKey,
    returnLabel,
    returnScope,
    returnTo
  });

  async function updateInvoiceAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const currentInvoice = await getInvoiceByJobId(actionContext.supabase, jobId);

    if (currentInvoice.error || !currentInvoice.data) {
      redirect(buildFeedbackHref(pagePath, "invoice-save-failed", visitLinkOptions));
    }

    const result = await updateInvoice(actionContext.supabase, currentInvoice.data.id, {
      invoiceNumber: getString(formData, "invoiceNumber"),
      title: getString(formData, "title"),
      notes: getNullableString(formData, "notes"),
      terms: getNullableString(formData, "terms"),
      taxRateBasisPoints: getPercentBasisPoints(formData, "taxRateBasisPoints"),
      discountCents: getCurrencyCents(formData, "discountCents"),
      dueAt: getNullableDateTime(formData, "dueAt", actionContext.company.timezone)
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "invoice-save-failed", visitLinkOptions));
    }

    revalidatePath(buildVisitDetailHref(jobId));
    revalidatePath(buildVisitInvoiceHref(jobId));
    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "invoice-saved", visitLinkOptions));
  }

  async function createLineItemAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const currentInvoice = await getInvoiceByJobId(actionContext.supabase, jobId);

    if (currentInvoice.error || !currentInvoice.data) {
      redirect(buildFeedbackHref(pagePath, "line-item-save-failed", visitLinkOptions));
    }

    const result = await createInvoiceLineItem(actionContext.supabase, currentInvoice.data.id, {
      itemType: getString(formData, "itemType") as "labor" | "part" | "fee",
      name: getString(formData, "name"),
      description: getNullableString(formData, "description"),
      quantity: getNumber(formData, "quantity"),
      unitPriceCents: getCurrencyCents(formData, "unitPriceCents"),
      taxable: formData.get("taxable") === "on"
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "line-item-save-failed", visitLinkOptions));
    }

    revalidatePath(buildVisitInvoiceHref(jobId));
    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "line-item-saved", visitLinkOptions));
  }

  async function updateLineItemAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const lineItemId = getString(formData, "lineItemId");
    const result = await updateInvoiceLineItem(actionContext.supabase, lineItemId, {
      itemType: getString(formData, "itemType") as "labor" | "part" | "fee",
      name: getString(formData, "name"),
      description: getNullableString(formData, "description"),
      quantity: getNumber(formData, "quantity"),
      unitPriceCents: getCurrencyCents(formData, "unitPriceCents"),
      taxable: formData.get("taxable") === "on"
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "line-item-save-failed", visitLinkOptions));
    }

    revalidatePath(buildVisitInvoiceHref(jobId));
    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "line-item-saved", visitLinkOptions));
  }

  async function deleteLineItemAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const lineItemId = getString(formData, "lineItemId");
    const result = await deleteInvoiceLineItem(actionContext.supabase, lineItemId);

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "line-item-delete-failed", visitLinkOptions));
    }

    revalidatePath(buildVisitInvoiceHref(jobId));
    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "line-item-deleted", visitLinkOptions));
  }

  async function changeInvoiceStatusAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const currentInvoice = await getInvoiceByJobId(actionContext.supabase, jobId);
    const nextStatus = getString(formData, "status") as InvoiceStatus;

    if (currentInvoice.error || !currentInvoice.data) {
      redirect(buildFeedbackHref(pagePath, "status-save-failed", visitLinkOptions));
    }

    const result = await changeInvoiceStatus(actionContext.supabase, currentInvoice.data.id, {
      status: nextStatus
    });

    if (result.error) {
      redirect(buildFeedbackHref(pagePath, "status-save-failed", visitLinkOptions));
    }

    if (nextStatus === "issued") {
      const linkSummary = await ensureInvoiceAccessLink({
        invoiceId: currentInvoice.data.id,
        actorUserId: actionContext.currentUserId
      });
      const communicationResult = await enqueueInvoiceNotification(actionContext.supabase, {
        invoiceId: currentInvoice.data.id,
        actorUserId: actionContext.currentUserId,
        actionUrl: linkSummary.publicUrl
      });

      if (communicationResult.error || !communicationResult.data) {
        redirect(buildFeedbackHref(pagePath, "status-save-failed", visitLinkOptions));
      }

      await processCommunicationMutationResult(
        communicationResult,
        "Failed to queue invoice notification."
      );

      await markInvoiceAccessLinkSent(
        linkSummary.linkId,
        communicationResult.data?.id ?? null,
        actionContext.currentUserId
      );
    }

    revalidatePath(buildVisitInvoiceHref(jobId));
    revalidatePath(pagePath);
    redirect(buildFeedbackHref(pagePath, "status-saved", visitLinkOptions));
  }

  return (
    <Page className="invoice-workspace-page invoice-editor-page" layout="command">
      <PageHeader
        actions={
          <div className="invoice-workspace__header-actions">
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href={detailPath}
            >
              View detail
            </Link>
            <Link
              className={buttonClassName({ tone: "secondary" })}
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
          </div>
        }
        description={
          <>
            Edit billing details for <Link href={visitThreadHref}>{jobResult.data.title}</Link> without
            losing invoice totals or service-thread context.
          </>
        }
        eyebrow="Invoice file"
        status={
          <div className="invoice-workspace__header-status">
            <StatusBadge status={invoice.status} />
            <Badge tone="brand">{invoice.invoiceNumber}</Badge>
          </div>
        }
        title={invoice.title}
      />

      {feedback ? (
        <Callout tone={feedback.tone} title={feedback.title}>
          {feedback.body}
        </Callout>
      ) : null}

      <section aria-label="Invoice file summary" className="invoice-workspace__hero">
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
              {detail.lineItems.length} line {detail.lineItems.length === 1 ? "item" : "items"} ready for review.
            </p>
          </div>
        </article>

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
              {isReadOnlyInvoice
                ? "Editing is locked. Only workflow transitions remain available."
                : "Keep totals aligned before the invoice is issued."}
            </p>
          </div>
        </article>

        <article className="invoice-workspace__hero-card">
          <div className="invoice-workspace__hero-icon">
            <AppIcon name="customers" />
          </div>
          <div className="invoice-workspace__hero-copy">
            <p className="invoice-workspace__hero-label">Customer</p>
            <strong className="invoice-workspace__hero-value invoice-workspace__hero-value--compact">
              {customerName || "Customer"}
            </strong>
            <p className="invoice-workspace__hero-note">{vehicleLabel}</p>
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
          {isReadOnlyInvoice ? (
            <Card className="invoice-workspace__summary-card" tone="subtle">
              <CardHeader>
                <CardHeaderContent>
                  <CardEyebrow>Read-only</CardEyebrow>
                  <CardTitle>Invoice editing is locked</CardTitle>
                  <CardDescription>
                    {invoice.status === "issued"
                      ? "This invoice can no longer be edited. Only the next billing-state move is still available from this file."
                      : "This invoice can no longer be edited."}
                  </CardDescription>
                </CardHeaderContent>
              </CardHeader>
            </Card>
          ) : (
            <InvoiceForm
              action={updateInvoiceAction}
              cancelHref={detailPath}
              initialValues={invoice}
              submitLabel="Save invoice"
              timeZone={context.company.timezone}
            />
          )}

          <Card className="invoice-workspace__section-card" tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Line items</CardEyebrow>
                <CardTitle>{detail.lineItems.length ? "Billing breakdown" : "No line items yet"}</CardTitle>
                <CardDescription>
                  Keep the billing file compact in the page body and push edits into the side drawer.
                </CardDescription>
              </CardHeaderContent>
              <div className="invoice-workspace__summary-badges">
                <Badge tone="neutral">{detail.lineItems.length} items</Badge>
                {!isReadOnlyInvoice ? (
                  <Link
                    className={buttonClassName({ tone: "secondary", size: "sm" })}
                    href={buildEditorHref(pagePath, {
                      feedback: feedbackKey,
                      lineItemId: "new",
                      panel: "line-item",
                      returnLabel,
                      returnScope,
                      returnTo
                    })}
                  >
                    Add line item
                  </Link>
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              {detail.lineItems.length ? (
                <div className="invoice-editor__line-list">
                  {detail.lineItems.map((lineItem) => (
                    <Link
                      className="invoice-editor__line-row"
                      href={buildEditorHref(pagePath, {
                        feedback: feedbackKey,
                        lineItemId: lineItem.id,
                        panel: "line-item",
                        returnLabel,
                        returnScope,
                        returnTo
                      })}
                      key={lineItem.id}
                    >
                      <div className="invoice-editor__line-main">
                        <div className="invoice-editor__line-copy">
                          <div className="invoice-editor__line-top">
                            <Badge tone="neutral">{lineItem.itemType}</Badge>
                            {lineItem.taxable ? <Badge tone="brand">Taxable</Badge> : null}
                          </div>
                          <strong className="invoice-editor__line-title">{lineItem.name}</strong>
                          <p className="invoice-editor__line-meta">
                            {lineItem.description ?? "No billing description."}
                          </p>
                        </div>
                        <div className="invoice-editor__line-values">
                          <span>{lineItem.quantity} x {formatCurrencyFromCents(lineItem.unitPriceCents, invoice.currencyCode)}</span>
                          <strong>
                            {formatCurrencyFromCents(lineItem.lineSubtotalCents, invoice.currencyCode)}
                          </strong>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="No line items added yet. Start with labor, parts, or fees."
                  eyebrow="Line items"
                  title="Nothing added yet"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="invoice-workspace__rail ui-sidebar-stack ui-sticky">
          <InvoiceTotalsCard invoice={invoice} totals={detail.totals} />

          <Card className="invoice-workspace__rail-card" tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Billing state</CardEyebrow>
                <CardTitle>Billing state</CardTitle>
                <CardDescription>
                  Advance billing from the side drawer when the service thread is ready.
                </CardDescription>
              </CardHeaderContent>
              <StatusBadge status={invoice.status} />
            </CardHeader>
            <CardContent className="invoice-workspace__action-stack">
              <div className="invoice-workspace__mini-grid">
                <div className="invoice-workspace__mini-item">
                  <span>Current status</span>
                  <strong>{invoice.status.replaceAll("_", " ")}</strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Next options</span>
                  <strong>{allowedStatuses.length || "None"}</strong>
                </div>
              </div>

              <Link
                className={buttonClassName({ tone: "secondary" })}
                href={buildEditorHref(pagePath, {
                  feedback: feedbackKey,
                  panel: "status",
                  returnLabel,
                  returnScope,
                  returnTo
                })}
              >
                Open billing state
              </Link>
            </CardContent>
          </Card>

          <Card className="invoice-workspace__rail-card" tone="subtle">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Workflow timing</CardEyebrow>
                <CardTitle>Payment timing</CardTitle>
                <CardDescription>
                  Keep due date, customer, and vehicle context visible while editing the billing file.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="invoice-workspace__mini-grid">
                <div className="invoice-workspace__mini-item">
                  <span>Due at</span>
                  <strong>
                    {formatDateTime(invoice.dueAt, {
                      fallback: "Not set",
                      timeZone: context.company.timezone
                    })}
                  </strong>
                </div>
                <div className="invoice-workspace__mini-item">
                  <span>Vehicle</span>
                  <strong>{vehicleLabel}</strong>
                </div>
              </div>
              <div className="invoice-workspace__action-stack">
                <Link className={buttonClassName({ tone: "tertiary" })} href={customerThreadHref}>
                  Open customer thread
                </Link>
                <Link className={buttonClassName({ tone: "tertiary" })} href={siteThreadHref}>
                  Open site thread
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageGrid>

      {activePanel === "line-item" ? (
        <InvoiceDetailsDrawer
          closeHref={closePanelHref}
          descriptionId="invoice-editor-line-item-drawer-description"
          titleId="invoice-editor-line-item-drawer-title"
        >
          <Card className="invoice-workspace-drawer__card" padding="spacious" tone="raised">
            <CardContent className="invoice-workspace-drawer__content">
              <div className="invoice-workspace-drawer__header">
                <div className="invoice-workspace-drawer__header-copy">
                  <p className="invoice-workspace-drawer__eyebrow">Line item</p>
                  <h2 className="invoice-workspace-drawer__title" id="invoice-editor-line-item-drawer-title">
                    {selectedLineItemId === "new" ? "Add billing line" : selectedLineItem?.name ?? "Line item"}
                  </h2>
                  <p
                    className="invoice-workspace-drawer__description"
                    id="invoice-editor-line-item-drawer-description"
                  >
                    {selectedLineItemId === "new"
                      ? "Add labor, parts, or fees without expanding the main invoice page."
                      : "Review or edit the selected billing line from a focused side drawer."}
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

              {selectedLineItemId === "new" && !isReadOnlyInvoice ? (
                <InvoiceLineItemForm action={createLineItemAction} submitLabel="Add line item" />
              ) : selectedLineItem ? (
                isReadOnlyInvoice ? (
                  <div className="invoice-workspace-drawer__content">
                    <div className="invoice-workspace-drawer__summary-grid">
                      <div className="invoice-workspace-drawer__summary-item">
                        <span>Type</span>
                        <strong>{selectedLineItem.itemType}</strong>
                      </div>
                      <div className="invoice-workspace-drawer__summary-item">
                        <span>Quantity</span>
                        <strong>{selectedLineItem.quantity}</strong>
                      </div>
                      <div className="invoice-workspace-drawer__summary-item">
                        <span>Unit price</span>
                        <strong>
                          {formatCurrencyFromCents(selectedLineItem.unitPriceCents, invoice.currencyCode)}
                        </strong>
                      </div>
                      <div className="invoice-workspace-drawer__summary-item">
                        <span>Line total</span>
                        <strong>
                          {formatCurrencyFromCents(selectedLineItem.lineSubtotalCents, invoice.currencyCode)}
                        </strong>
                      </div>
                      <div className="invoice-workspace-drawer__summary-item invoice-workspace-drawer__summary-item--full">
                        <span>Description</span>
                        <strong>{selectedLineItem.description ?? "No billing description."}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <InvoiceLineItemForm
                      action={updateLineItemAction}
                      hiddenFields={[{ name: "lineItemId", value: selectedLineItem.id }]}
                      initialValues={selectedLineItem}
                      submitLabel="Save line item"
                    />

                    <form action={deleteLineItemAction}>
                      <input name="lineItemId" type="hidden" value={selectedLineItem.id} />
                      <SubmitButton
                        confirmMessage="Remove this invoice line item?"
                        pendingLabel="Removing item..."
                        tone="secondary"
                      >
                        Remove line item
                      </SubmitButton>
                    </form>
                  </>
                )
              ) : (
                <EmptyState
                  description="Choose a line item from the queue or create a new one."
                  eyebrow="Line items"
                  title="No line item selected"
                />
              )}
            </CardContent>
          </Card>
        </InvoiceDetailsDrawer>
      ) : null}

      {activePanel === "status" ? (
        <InvoiceDetailsDrawer
          closeHref={closePanelHref}
          descriptionId="invoice-editor-status-drawer-description"
          titleId="invoice-editor-status-drawer-title"
        >
          <Card className="invoice-workspace-drawer__card" padding="spacious" tone="raised">
            <CardContent className="invoice-workspace-drawer__content">
              <div className="invoice-workspace-drawer__header">
                <div className="invoice-workspace-drawer__header-copy">
                  <p className="invoice-workspace-drawer__eyebrow">Status flow</p>
                  <h2 className="invoice-workspace-drawer__title" id="invoice-editor-status-drawer-title">
                    Update billing state
                  </h2>
                  <p
                    className="invoice-workspace-drawer__description"
                    id="invoice-editor-status-drawer-description"
                  >
                    Advance the invoice from draft review into customer-facing billing without leaving the billing file.
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
                  <span>Current status</span>
                  <strong>{invoice.status.replaceAll("_", " ")}</strong>
                </div>
                <div className="invoice-workspace-drawer__summary-item">
                  <span>Balance due</span>
                  <strong>
                    {formatCurrencyFromCents(detail.totals.balanceDueCents, invoice.currencyCode)}
                  </strong>
                </div>
              </div>

              <InvoiceStatusForm
                action={changeInvoiceStatusAction}
                allowedStatuses={allowedStatuses}
                currentStatus={invoice.status}
              />
            </CardContent>
          </Card>
        </InvoiceDetailsDrawer>
      ) : null}
    </Page>
  );
}

export default VisitInvoiceEditPageImpl;

