import { formatCurrencyFromCents } from "@mobile-mechanic/core";
import type { Invoice, InvoiceTotals } from "@mobile-mechanic/types";

import {
  CardEyebrow,
  Card,
  CardContent,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  StatusBadge
} from "../../../../../../components/ui";

type InvoiceTotalsCardProps = {
  invoice: Pick<Invoice, "currencyCode" | "taxRateBasisPoints" | "status">;
  totals: InvoiceTotals;
};

export function InvoiceTotalsCard({ invoice, totals }: InvoiceTotalsCardProps) {
  return (
    <Card className="invoice-totals-card" tone="raised">
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>Financial summary</CardEyebrow>
          <CardTitle>Totals</CardTitle>
        </CardHeaderContent>
        <StatusBadge status={invoice.status} />
      </CardHeader>

      <CardContent className="invoice-totals-card__content">
        <div className="invoice-totals-card__hero">
          <p className="invoice-totals-card__hero-label">Grand total</p>
          <p className="invoice-totals-card__hero-value">
            {formatCurrencyFromCents(totals.totalCents, invoice.currencyCode)}
          </p>
          <p className="invoice-totals-card__hero-copy">
            {totals.balanceDueCents > 0
              ? `${formatCurrencyFromCents(totals.balanceDueCents, invoice.currencyCode)} still open`
              : "No remaining balance"}
          </p>
        </div>

        <div className="ui-detail-grid">
          <div className="ui-detail-item">
            <p className="ui-detail-label">Subtotal</p>
            <p className="ui-detail-value">
              {formatCurrencyFromCents(totals.subtotalCents, invoice.currencyCode)}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Discount</p>
            <p className="ui-detail-value">
              {formatCurrencyFromCents(totals.discountCents, invoice.currencyCode)}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Taxable subtotal</p>
            <p className="ui-detail-value">
              {formatCurrencyFromCents(totals.taxableSubtotalCents, invoice.currencyCode)}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Tax</p>
            <p className="ui-detail-value">
              {formatCurrencyFromCents(totals.taxCents, invoice.currencyCode)} (
              {invoice.taxRateBasisPoints / 100}%)
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Paid amount</p>
            <p className="ui-detail-value">
              {formatCurrencyFromCents(totals.amountPaidCents, invoice.currencyCode)}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Balance due</p>
            <p className="ui-detail-value">
              {formatCurrencyFromCents(totals.balanceDueCents, invoice.currencyCode)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
