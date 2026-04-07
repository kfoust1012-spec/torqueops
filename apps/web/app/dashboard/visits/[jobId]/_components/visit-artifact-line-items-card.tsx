import {
  Badge,
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
  Table,
  TableWrap
} from "../../../../../components/ui";
import { formatCurrencyFromCents } from "@mobile-mechanic/core";

type VisitArtifactLineItem = {
  description?: string | null;
  id: string;
  itemType: string;
  lineSubtotalCents: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

type VisitArtifactLineItemsCardProps = {
  className?: string;
  currencyCode: string;
  description: string;
  emptyDescription: string;
  emptyEyebrow: string;
  emptyTitle: string;
  eyebrow: string;
  items: readonly VisitArtifactLineItem[];
  title: string;
  tone?: "raised" | "subtle";
};

export function VisitArtifactLineItemsCard({
  className,
  currencyCode,
  description,
  emptyDescription,
  emptyEyebrow,
  emptyTitle,
  eyebrow,
  items,
  title,
  tone = "raised"
}: VisitArtifactLineItemsCardProps) {
  return (
    <Card className={className} tone={tone}>
      <CardHeader>
        <CardHeaderContent>
          <CardEyebrow>{eyebrow}</CardEyebrow>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeaderContent>
        <Badge tone="neutral">{items.length}</Badge>
      </CardHeader>

      <CardContent>
        {items.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <HeaderCell>Type</HeaderCell>
                  <HeaderCell>Line item</HeaderCell>
                  <HeaderCell>Qty</HeaderCell>
                  <HeaderCell>Unit price</HeaderCell>
                  <HeaderCell>Line total</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <Cell>
                      <Badge tone="neutral">{item.itemType}</Badge>
                    </Cell>
                    <Cell>
                      <div className="ui-table-cell-title">
                        <strong>{item.name}</strong>
                        <p className="ui-table-cell-meta">
                          {item.description ?? "No billing description."}
                        </p>
                      </div>
                    </Cell>
                    <Cell>{item.quantity}</Cell>
                    <Cell>{formatCurrencyFromCents(item.unitPriceCents, currencyCode)}</Cell>
                    <Cell>{formatCurrencyFromCents(item.lineSubtotalCents, currencyCode)}</Cell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            description={emptyDescription}
            eyebrow={emptyEyebrow}
            title={emptyTitle}
          />
        )}
      </CardContent>
    </Card>
  );
}