import { formatCurrencyFromCents } from "@mobile-mechanic/core";
import type { Estimate, EstimateTotals } from "@mobile-mechanic/types";

import {
  Card,
  CardContent,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  StatusBadge
} from "../../../../../../components/ui";

type EstimateTotalsCardProps = {
  estimate: Pick<Estimate, "currencyCode" | "taxRateBasisPoints" | "status">;
  totals: EstimateTotals;
};

export function EstimateTotalsCard({ estimate, totals }: EstimateTotalsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardHeaderContent>
          <CardTitle>Totals</CardTitle>
        </CardHeaderContent>
        <StatusBadge status={estimate.status} />
      </CardHeader>

      <CardContent>
        <div className="ui-detail-grid">
          <div className="ui-detail-item">
            <p className="ui-detail-label">Subtotal</p>
            <p className="ui-detail-value">
            {formatCurrencyFromCents(totals.subtotalCents, estimate.currencyCode)}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Discount</p>
            <p className="ui-detail-value">
            {formatCurrencyFromCents(totals.discountCents, estimate.currencyCode)}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Taxable subtotal</p>
            <p className="ui-detail-value">
            {formatCurrencyFromCents(totals.taxableSubtotalCents, estimate.currencyCode)}
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Tax</p>
            <p className="ui-detail-value">
            {formatCurrencyFromCents(totals.taxCents, estimate.currencyCode)} ({estimate.taxRateBasisPoints / 100}
            %)
            </p>
          </div>
        </div>

        <div className="ui-callout ui-callout--success">
          <div className="ui-readout">
            <p className="ui-readout__label">Total</p>
            <p className="ui-readout__value">
          {formatCurrencyFromCents(totals.totalCents, estimate.currencyCode)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
