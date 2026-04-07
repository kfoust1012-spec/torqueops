import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatDateTime, formatInventoryTransactionTypeLabel } from "@mobile-mechanic/core";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  HeaderCell,
  Page,
  PageHeader,
  StatusBadge,
  Table,
  TableWrap,
  Cell,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import { getInventoryLocationDetail } from "../../../../../lib/inventory-operations/service";

type InventoryLocationDetailPageProps = {
  params: Promise<{
    locationId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryLocationDetailPage({
  params,
  searchParams
}: InventoryLocationDetailPageProps) {
  const { locationId } = await params;

  redirect(buildDashboardAliasHref(`/dashboard/supply/inventory/locations/${locationId}`, (searchParams ? await searchParams : {})));
}

export async function SupplyInventoryLocationDetailPageImpl({
  params
}: InventoryLocationDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { locationId } = await params;
  const detail = await getInventoryLocationDetail(context.supabase, context.companyId, locationId);

  if (!detail.location || detail.location.companyId !== context.companyId) {
    notFound();
  }

  const totalOnHand = detail.balances.reduce((total, balance) => total + balance.onHandQuantity, 0);
  const totalReserved = detail.balances.reduce(
    (total, balance) => total + balance.reservedQuantity,
    0
  );
  const totalAvailable = detail.balances.reduce(
    (total, balance) => total + balance.availableQuantity,
    0
  );
  const lowStockCount = detail.balances.filter((balance) => balance.reorderStatus !== "ok").length;
  const locationWorkspaceHref = `/dashboard/supply/inventory?view=locations&locationId=${locationId}`;

  return (
    <Page>
      <PageHeader
        eyebrow="Inventory location"
        title={detail.location.name}
        description={
          <>
            {detail.location.slug} · {detail.location.locationType}
            {detail.location.vehicleLabel ? ` · ${detail.location.vehicleLabel}` : ""}
          </>
        }
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href={locationWorkspaceHref}>
              Open location record
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href="/dashboard/supply/inventory?view=movement">
              Open movement ledger
            </Link>
          </>
        }
        status={<StatusBadge status={detail.location.locationType} fallbackTone="info" />}
      />

      <div className="ui-summary-grid">
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>On hand</CardEyebrow>
          <p className="ui-summary-value">{totalOnHand}</p>
          <p className="ui-summary-meta">Ledger-derived stock at this location.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Reserved</CardEyebrow>
          <p className="ui-summary-value">{totalReserved}</p>
          <p className="ui-summary-meta">Current job demand already holding stock here.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Available</CardEyebrow>
          <p className="ui-summary-value">{totalAvailable}</p>
          <p className="ui-summary-meta">Stock left after reservations.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Low stock rows</CardEyebrow>
          <p className="ui-summary-value">{lowStockCount}</p>
          <p className="ui-summary-meta">SKU/location balances below threshold.</p>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Stock at location</CardEyebrow>
              <CardTitle>Location balances</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.balanceRows.length ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <HeaderCell>Item</HeaderCell>
                      <HeaderCell>Status</HeaderCell>
                      <HeaderCell>On hand</HeaderCell>
                      <HeaderCell>Reserved</HeaderCell>
                      <HeaderCell>Available</HeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.balanceRows.map((row) => (
                      <tr key={row.balance.inventoryItemId}>
                        <Cell>
                          <div className="ui-table-cell-title">
                            <strong>{row.item?.sku ?? "Unknown item"}</strong>
                            <p className="ui-table-cell-meta">{row.item?.name ?? "Missing inventory item"}</p>
                          </div>
                        </Cell>
                        <Cell>
                          <StatusBadge status={row.balance.reorderStatus} />
                        </Cell>
                        <Cell>{row.balance.onHandQuantity}</Cell>
                        <Cell>{row.balance.reservedQuantity}</Cell>
                        <Cell>{row.balance.availableQuantity}</Cell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState
                eyebrow="No stock"
                title="Nothing is stored here yet"
                description="Transfers, receipts, and adjustments will create balances for this location."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Activity</CardEyebrow>
              <CardTitle>Recent transactions</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.transactions.length ? (
              <div className="ui-list">
                {detail.transactions.slice(0, 12).map((transaction) => (
                  <article key={transaction.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">
                        {formatDateTime(transaction.effectiveAt, {
                          timeZone: context.company.timezone
                        })}
                      </p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {formatInventoryTransactionTypeLabel(transaction.transactionType)}
                      </h3>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        Qty delta {transaction.quantityDelta}
                      </p>
                    </div>
                    <Badge tone="brand">{transaction.sourceType.replaceAll("_", " ")}</Badge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No activity"
                title="No transactions have hit this location"
                description="Receipts, transfers, adjustments, and job issues will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Transfers</CardEyebrow>
              <CardTitle>Location transfer history</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.transfers.length ? (
              <div className="ui-list">
                {detail.transfers.slice(0, 8).map((transfer) => (
                  <article key={transfer.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{transfer.referenceNumber ?? transfer.id.slice(0, 8).toUpperCase()}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {formatDateTime(transfer.requestedAt, { timeZone: context.company.timezone })}
                      </h3>
                    </div>
                    <StatusBadge status={transfer.status} />
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No transfers"
                title="No transfer activity yet"
                description="Transfers to and from this location will show here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Cycle counts</CardEyebrow>
              <CardTitle>Recent counts</CardTitle>
              <CardDescription>Counts create gain/loss ledger entries when actual quantity differs from expected.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.cycleCounts.length ? (
              <div className="ui-list">
                {detail.cycleCounts.slice(0, 8).map((cycleCount) => (
                  <article key={cycleCount.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">
                        {formatDateTime(cycleCount.countedAt, { timeZone: context.company.timezone })}
                      </p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        Cycle count
                      </h3>
                    </div>
                    <Link
                      className={buttonClassName({ tone: "tertiary", size: "sm" })}
                      href={`/dashboard/supply/inventory?view=counts&cycleCountId=${cycleCount.id}`}
                    >
                      View
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No cycle counts"
                title="No counts recorded for this location"
                description="Use cycle counts for clean stock corrections instead of manual guesswork."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
