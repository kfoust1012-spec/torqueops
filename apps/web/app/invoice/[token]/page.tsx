import { formatCurrencyFromCents } from "@mobile-mechanic/core";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CustomerDocumentSubmitButton } from "../../../components/customer-document-submit-button";
import { StatusBadge } from "../../../components/ui";
import {
  createInvoiceCheckoutFromAccessLink,
  isCustomerDocumentActionUnavailableError,
  isInvoiceCheckoutRotationError,
  isInvoiceCheckoutPendingError,
  resolveCustomerDocumentAccess
} from "../../../lib/customer-documents/service";
import { formatCustomerDocumentDateTime } from "../../../lib/customer-documents/formatting";
import { getRequestIpAddress } from "../../../lib/customer-documents/tokens";
import { isStripeUnavailableError } from "../../../lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  },
  title: "Invoice"
};

type CustomerInvoicePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    checkout?: string;
  }>;
};

function getInvoiceGuidanceCopy(status: string, canPay: boolean) {
  if (status === "paid") {
    return "Payment is complete. Keep this page for your records and receipt history.";
  }

  if (status === "void") {
    return "This invoice is no longer active. Use the latest message from the shop if they issue a replacement.";
  }

  if (canPay) {
    return "Use the Pay invoice button to open secure Stripe checkout. After submitting payment, return here and wait for the final paid status to finish reconciling.";
  }

  return "Review the balance, due date, and invoice items below. Contact the shop if you need an updated payment request.";
}

function getInvoiceSupportCopy(companyName: string, checkoutState?: string) {
  if (checkoutState === "success") {
    return `If the balance still appears here after a short delay, reopen the original invoice link from ${companyName} and refresh there before attempting another payment. Do not start a second payment unless the shop confirms the first one failed.`;
  }

  return `If anything on this invoice no longer matches what ${companyName} told you, use the most recent text or email from the shop before trying payment again. A newer invoice link may have replaced this one.`;
}

export default async function CustomerInvoicePage({ params, searchParams }: CustomerInvoicePageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const headerStore = await headers();
  const resolved = await resolveCustomerDocumentAccess(
    { token },
    {
      markViewed: true,
      ipAddress: getRequestIpAddress(headerStore),
      userAgent: headerStore.get("user-agent")
    }
  );

  async function startCheckoutAction() {
    "use server";

    try {
      const checkoutUrl = await createInvoiceCheckoutFromAccessLink({ token });
      redirect(checkoutUrl);
    } catch (error) {
      if (isCustomerDocumentActionUnavailableError(error)) {
        redirect(`/invoice/${token}`);
      }

      if (isInvoiceCheckoutPendingError(error)) {
        redirect(`/invoice/${token}?checkout=success`);
      }

      if (isInvoiceCheckoutRotationError(error)) {
        redirect(`/invoice/${token}?checkout=unavailable`);
      }

      if (!isStripeUnavailableError(error)) {
        throw error;
      }

      redirect(`/invoice/${token}?checkout=unavailable`);
    }
  }

  if (resolved.unavailable || !resolved.invoice) {
    return (
      <main className="page-shell">
        <section className="panel customer-document-panel">
          <p className="eyebrow">Invoice</p>
          <h1 className="title">Link unavailable</h1>
          <p className="copy">
            {resolved.unavailable?.message ?? "This invoice link is unavailable."} It may have expired, been replaced, or already completed. Use the most recent message from the shop if you expected a fresh payment link.
          </p>
        </section>
      </main>
    );
  }

  const invoice = resolved.invoice;
  const link = resolved.link;
  const companyTimeZone = invoice.companyTimeZone;

  return (
    <main className="customer-document-shell">
      <section className="customer-document-panel">
        <div className="customer-document-header">
          <div>
            <p className="eyebrow">Invoice</p>
            <h1 className="title">{invoice.title}</h1>
            <p className="copy" style={{ marginBottom: 0 }}>
              {invoice.companyName} issued invoice <strong>{invoice.invoiceNumber}</strong> for {invoice.vehicleLabel}.
            </p>
          </div>

          <StatusBadge status={invoice.status} />
        </div>

        {query.checkout === "success" ? (
          <div className="workspace-card">
            <p className="eyebrow">Payment submitted</p>
            <p className="copy" style={{ marginBottom: 0 }}>
              Your payment was submitted. You do not need to pay again. This page will reflect the final paid status once Stripe reconciliation completes.
            </p>
          </div>
        ) : null}

        {query.checkout === "canceled" ? (
          <div className="workspace-card">
            <p className="eyebrow">Payment canceled</p>
            <p className="copy" style={{ marginBottom: 0 }}>
              No payment was completed. You can try again whenever you are ready.
            </p>
          </div>
        ) : null}

        {query.checkout === "unavailable" ? (
          <div className="workspace-card">
            <p className="eyebrow">Payment unavailable</p>
            <p className="copy" style={{ marginBottom: 0 }}>
              Online payment is not available right now. Contact the shop to complete payment or request a fresh payment link later.
            </p>
          </div>
        ) : null}

        <div className="customer-document-grid">
          <div className="workspace-card">
            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">Customer</p>
                <p className="detail-value">{invoice.customerName}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Visit</p>
                <p className="detail-value">{invoice.jobTitle}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Issued</p>
                <p className="detail-value">{formatCustomerDocumentDateTime(invoice.issuedAt, companyTimeZone, "Not issued")}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Due</p>
                <p className="detail-value">{formatCustomerDocumentDateTime(invoice.dueAt, companyTimeZone, "No due date")}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Link expires</p>
                <p className="detail-value">{link ? formatCustomerDocumentDateTime(link.expiresAt, companyTimeZone, "Unavailable") : "Unavailable"}</p>
              </div>
            </div>

            {invoice.notes ? (
              <div className="detail-item">
                <p className="detail-label">Notes</p>
                <p className="detail-value">{invoice.notes}</p>
              </div>
            ) : null}

            <div className="detail-item">
              <p className="detail-label">Terms</p>
              <p className="detail-value">{invoice.terms ?? "No additional invoice terms."}</p>
            </div>
          </div>

          <div className="workspace-card">
            <div className="detail-item">
              <p className="detail-label">Balance due</p>
              <p className="customer-document-total">{formatCurrencyFromCents(invoice.totals.balanceDueCents)}</p>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">Total</p>
                <p className="detail-value">{formatCurrencyFromCents(invoice.totals.totalCents)}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Paid</p>
                <p className="detail-value">{formatCurrencyFromCents(invoice.totals.amountPaidCents)}</p>
              </div>
            </div>

            {invoice.canPay && query.checkout !== "success" ? (
              <form action={startCheckoutAction} className="stack">
                <CustomerDocumentSubmitButton pendingLabel="Redirecting to secure checkout...">
                  Pay invoice
                </CustomerDocumentSubmitButton>
                <p className="muted" style={{ margin: 0 }}>
                  Secure checkout is powered by Stripe. Keep this page open until you return here.
                </p>
              </form>
            ) : null}
          </div>
        </div>

        <div className="workspace-card">
          <p className="eyebrow">{invoice.canPay ? "Secure payment" : "What happens next"}</p>
          <h2 className="section-title">
            {invoice.canPay ? "Stripe handles checkout" : "Invoice status updated"}
          </h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            {getInvoiceGuidanceCopy(invoice.status, invoice.canPay)}
          </p>
        </div>

        <div className="workspace-card">
          <p className="eyebrow">Need help?</p>
          <h2 className="section-title">Avoid duplicate payments if the status is still updating</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            {getInvoiceSupportCopy(invoice.companyName, query.checkout)}
          </p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.length ? (
                invoice.lineItems.map((lineItem) => (
                  <tr key={`${lineItem.itemType}-${lineItem.name}-${lineItem.lineSubtotalCents}`}>
                    <td>{lineItem.name}</td>
                    <td>{lineItem.description ?? "-"}</td>
                    <td>{lineItem.quantity}</td>
                    <td>{formatCurrencyFromCents(lineItem.lineSubtotalCents)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No invoice items are available on this link.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {invoice.status === "paid" ? (
          <div className="workspace-card">
            <p className="eyebrow">Paid</p>
            <h2 className="section-title">Invoice paid</h2>
            <p className="copy" style={{ marginBottom: 0 }}>
              This invoice has been paid in full{invoice.paidAt ? ` on ${formatCustomerDocumentDateTime(invoice.paidAt, companyTimeZone)}` : ""}.
            </p>
          </div>
        ) : null}

        {invoice.status === "void" ? (
          <div className="workspace-card">
            <p className="eyebrow">Invoice unavailable</p>
            <h2 className="section-title">This invoice is no longer active</h2>
            <p className="copy" style={{ marginBottom: 0 }}>
              Contact the shop if you need an updated invoice or payment request.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
