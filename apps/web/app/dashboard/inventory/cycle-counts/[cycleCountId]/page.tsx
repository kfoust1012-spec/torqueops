import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatDateTime, formatInventoryTransactionTypeLabel } from "@mobile-mechanic/core";

import {
  Card,
  CardContent,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  HeaderCell,
  Page,
  PageHeader,
  Table,
  TableWrap,
  Cell,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import { getInventoryCycleCountDetail } from "../../../../../lib/inventory-operations/service";

type InventoryCycleCountDetailPageProps = {
  params: Promise<{
    cycleCountId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryCycleCountDetailPage({
  params,
  searchParams
}: InventoryCycleCountDetailPageProps) {
  const { cycleCountId } = await params;

  redirect(buildDashboardAliasHref(`/dashboard/supply/inventory/cycle-counts/${cycleCountId}`, (searchParams ? await searchParams : {})));
}

export async function SupplyInventoryCycleCountDetailPageImpl({
  params
}: InventoryCycleCountDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { cycleCountId } = await params;
  const detail = await getInventoryCycleCountDetail(context.supabase, cycleCountId);

  if (!detail || detail.cycleCount.companyId !== context.companyId) {
    notFound();
  }

  const countsWorkspaceHref = `/dashboard/supply/inventory?view=counts&cycleCountId=${cycleCountId}`;
  const locationWorkspaceHref = `/dashboard/supply/inventory?view=locations&locationId=${detail.location.id}`;

  return (
    <Page>
      <PageHeader
        eyebrow="Inventory cycle count"
        title={formatDateTime(detail.cycleCount.countedAt, { timeZone: context.company.timezone })}
        description={detail.location.name}
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href={countsWorkspaceHref}>
              Counts workspace
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href={locationWorkspaceHref}>
              Location workspace
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Count lines</CardEyebrow>
            <CardTitle>Expected vs counted</CardTitle>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {detail.lines.length ? (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <HeaderCell>Item</HeaderCell>
                    <HeaderCell>Expected</HeaderCell>
                    <HeaderCell>Counted</HeaderCell>
                    <HeaderCell>Variance</HeaderCell>
                    <HeaderCell>Result</HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map(({ line, item }) => (
                    <tr key={line.id}>
                      <Cell>
                        <div className="ui-table-cell-title">
                          <strong>{item.sku}</strong>
                          <p className="ui-table-cell-meta">{item.name}</p>
                        </div>
                      </Cell>
                      <Cell>{line.expectedQuantity}</Cell>
                      <Cell>{line.countedQuantity}</Cell>
                      <Cell>{line.varianceQuantity}</Cell>
                      <Cell>
                        {line.varianceQuantity === 0
                          ? "No ledger change"
                          : formatInventoryTransactionTypeLabel(
                              line.varianceQuantity > 0 ? "cycle_count_gain" : "cycle_count_loss"
                            )}
                      </Cell>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState
              eyebrow="No lines"
              title="This cycle count has no lines"
              description="Record a fresh count if this one was created incorrectly."
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
