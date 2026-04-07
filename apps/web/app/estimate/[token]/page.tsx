import { formatCurrencyFromCents } from "@mobile-mechanic/core";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CustomerDocumentSubmitButton } from "../../../components/customer-document-submit-button";
import { StatusBadge } from "../../../components/ui";
import { EstimateApprovalForm } from "./_components/estimate-approval-form";
import {
  approveEstimateFromAccessLink,
  declineEstimateFromAccessLink,
  isCustomerDocumentActionUnavailableError,
  resolveCustomerDocumentAccess
} from "../../../lib/customer-documents/service";
import { formatCustomerDocumentDateTime } from "../../../lib/customer-documents/formatting";
import { getRequestIpAddress } from "../../../lib/customer-documents/tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  },
  title: "Estimate"
};

type CustomerEstimatePageProps = {
  params: Promise<{
    token: string;
  }>;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getEstimateNextStepCopy(status: string) {
  switch (status) {
    case "accepted":
      return "The shop can now move forward on the approved work. Keep this page for your records until the repair and invoice are complete.";
    case "declined":
      return "No work has been approved from this link. If you still want service, ask the shop for an updated estimate.";
    case "void":
      return "This estimate is no longer active. Use the most recent message from the shop if they send a replacement.";
    default:
      return "Review the items, notes, and terms below before signing. Approval only covers the work listed on this estimate.";
  }
}

function getEstimateSupportCopy(companyName: string) {
  return `If anything on this estimate no longer matches what ${companyName} told you, stop here and use the most recent text or email from the shop. A newer estimate link may have replaced this one.`;
}

export default async function CustomerEstimatePage({ params }: CustomerEstimatePageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const resolved = await resolveCustomerDocumentAccess(
    { token },
    {
      markViewed: true,
      ipAddress: getRequestIpAddress(headerStore),
      userAgent: headerStore.get("user-agent")
    }
  );

  async function approveAction(formData: FormData) {
    "use server";

    try {
      await approveEstimateFromAccessLink({
        token,
        signedByName: getString(formData, "signedByName"),
        statement: getString(formData, "statement"),
        signatureDataUrl: getString(formData, "signatureDataUrl")
      });
    } catch (error) {
      if (!isCustomerDocumentActionUnavailableError(error)) {
        throw error;
      }
    }

    redirect(`/estimate/${token}`);
  }

  async function declineAction() {
    "use server";

    try {
      await declineEstimateFromAccessLink({ token });
    } catch (error) {
      if (!isCustomerDocumentActionUnavailableError(error)) {
        throw error;
      }
    }

    redirect(`/estimate/${token}`);
  }

  if (resolved.unavailable || !resolved.estimate) {
    return (
      <main className="page-shell">
        <section className="panel customer-document-panel">
          <p className="eyebrow">Estimate</p>
          <h1 className="title">Link unavailable</h1>
          <p className="copy">
            {resolved.unavailable?.message ??
              "This estimate link is unavailable."} It may have expired, been replaced, or already completed. Use the most recent message from the shop if you were expecting a newer estimate.
          </p>
        </section>
      </main>
    );
  }

  const estimate = resolved.estimate;
  const link = resolved.link;
  const companyTimeZone = estimate.companyTimeZone;
  const approvalStatement =
    estimate.approvalStatement ??
    "I approve this estimate and authorize the shop to proceed with the listed work.";

  return (
    <main className="customer-document-shell">
      <section className="customer-document-panel">
        <div className="customer-document-header">
          <div>
            <p className="eyebrow">Estimate</p>
            <h1 className="title">{estimate.title}</h1>
            <p className="copy" style={{ marginBottom: 0 }}>
              {estimate.companyName} prepared estimate <strong>{estimate.estimateNumber}</strong> for {estimate.vehicleLabel}.
            </p>
          </div>

          <StatusBadge status={estimate.status} />
        </div>

        <div className="customer-document-grid">
          <div className="workspace-card">
            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">Customer</p>
                <p className="detail-value">{estimate.customerName}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Visit</p>
                <p className="detail-value">{estimate.jobTitle}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Sent</p>
                <p className="detail-value">{formatCustomerDocumentDateTime(estimate.sentAt, companyTimeZone, "Not sent")}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Link expires</p>
                <p className="detail-value">{link ? formatCustomerDocumentDateTime(link.expiresAt, companyTimeZone, "Unavailable") : "Unavailable"}</p>
              </div>
            </div>

            {estimate.notes ? (
              <div className="detail-item">
                <p className="detail-label">Notes</p>
                <p className="detail-value">{estimate.notes}</p>
              </div>
            ) : null}

            <div className="detail-item">
              <p className="detail-label">Terms</p>
              <p className="detail-value">{estimate.terms ?? "No additional estimate terms."}</p>
            </div>
          </div>

          <div className="workspace-card">
            <div className="detail-item">
              <p className="detail-label">Estimated total</p>
              <p className="customer-document-total">{formatCurrencyFromCents(estimate.totals.totalCents)}</p>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">Subtotal</p>
                <p className="detail-value">{formatCurrencyFromCents(estimate.totals.subtotalCents)}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Tax</p>
                <p className="detail-value">{formatCurrencyFromCents(estimate.totals.taxCents)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="workspace-card">
          <p className="eyebrow">{estimate.canApprove ? "Review before approving" : "What happens next"}</p>
          <h2 className="section-title">
            {estimate.canApprove ? "Approval authorizes only this estimate" : "Estimate status updated"}
          </h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            {getEstimateNextStepCopy(estimate.status)}
          </p>
        </div>

        <div className="workspace-card">
          <p className="eyebrow">Need help?</p>
          <h2 className="section-title">Use the latest message from the shop if anything changed</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            {getEstimateSupportCopy(estimate.companyName)}
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
              {estimate.lineItems.length ? (
                estimate.lineItems.map((lineItem) => (
                  <tr key={`${lineItem.itemType}-${lineItem.name}-${lineItem.lineSubtotalCents}`}>
                    <td>{lineItem.name}</td>
                    <td>{lineItem.description ?? "-"}</td>
                    <td>{lineItem.quantity}</td>
                    <td>{formatCurrencyFromCents(lineItem.lineSubtotalCents)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No estimate items are available on this link.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {estimate.canApprove ? (
          <div className="customer-document-actions">
            <div className="workspace-card">
              <EstimateApprovalForm action={approveAction} statement={approvalStatement} />
            </div>

            <form action={declineAction} className="workspace-card stack">
              <div>
                <p className="detail-label">Need more time?</p>
                <p className="copy" style={{ marginBottom: 0 }}>
                  You can decline the estimate for now and ask the shop to resend an updated version later. Nothing is approved until you confirm with a signature.
                </p>
              </div>

              <CustomerDocumentSubmitButton
                className="button secondary-button"
                pendingLabel="Declining estimate..."
              >
                Decline estimate
              </CustomerDocumentSubmitButton>
            </form>
          </div>
        ) : null}

        {estimate.status === "accepted" ? (
          <div className="workspace-card">
            <p className="eyebrow">Approved</p>
            <h2 className="section-title">Estimate approved</h2>
            <p className="copy">
              Approved by <strong>{estimate.approvedByName ?? estimate.customerName}</strong>
              {estimate.acceptedAt ? ` on ${formatCustomerDocumentDateTime(estimate.acceptedAt, companyTimeZone)}` : ""}.
            </p>

            {estimate.signatureImageUrl ? (
              <img
                alt={`Signature for estimate ${estimate.estimateNumber}`}
                className="customer-signature-preview"
                src={estimate.signatureImageUrl}
              />
            ) : null}
          </div>
        ) : null}

        {estimate.status === "declined" ? (
          <div className="workspace-card">
            <p className="eyebrow">Estimate declined</p>
            <h2 className="section-title">No work has been approved</h2>
            <p className="copy" style={{ marginBottom: 0 }}>
              This estimate has been declined. Contact the shop if you need an updated version.
            </p>
          </div>
        ) : null}

        {estimate.status === "void" ? (
          <div className="workspace-card">
            <p className="eyebrow">Estimate unavailable</p>
            <h2 className="section-title">This estimate is no longer active</h2>
            <p className="copy" style={{ marginBottom: 0 }}>
              Contact the shop if you need a current estimate link.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
