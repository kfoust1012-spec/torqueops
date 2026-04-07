import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { formatCurrencyFromCents, formatDateTime } from "@mobile-mechanic/core";

import {
  Button,
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
  FormRow,
  Input,
  Page,
  PageHeader,
  StatusBadge,
  Textarea,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  cancelTransferInventory,
  getInventoryTransferDetail,
  receiveTransferredInventory,
  shipTransferInventory
} from "../../../../../lib/inventory-operations/service";

type InventoryTransferDetailPageProps = {
  params: Promise<{
    transferId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryTransferDetailPage({
  params,
  searchParams
}: InventoryTransferDetailPageProps) {
  const { transferId } = await params;

  redirect(buildDashboardAliasHref(`/dashboard/supply/inventory/transfers/${transferId}`, (searchParams ? await searchParams : {})));
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function getNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? Number(value) : 0;
}

export async function SupplyInventoryTransferDetailPageImpl({
  params
}: InventoryTransferDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { transferId } = await params;
  const detail = await getInventoryTransferDetail(context.supabase, transferId);

  if (!detail || detail.transfer.companyId !== context.companyId) {
    notFound();
  }

  const canShip = detail.transfer.status === "draft";
  const canReceive = detail.transfer.status === "in_transit";
  const canCancel = detail.transfer.status === "draft";
  const transferDetailHref = `/dashboard/supply/inventory/transfers/${transferId}`;
  const movementWorkspaceHref = `/dashboard/supply/inventory?view=movement&transferId=${transferId}`;
  const sourceLocationWorkspaceHref = `/dashboard/supply/inventory?view=locations&locationId=${detail.fromLocation.id}`;

  function revalidateInventoryPaths() {
    revalidatePath("/dashboard/supply/inventory");
    revalidatePath("/dashboard/supply/inventory/transfers");
    revalidatePath(transferDetailHref);
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/inventory/transfers");
    revalidatePath(`/dashboard/inventory/transfers/${transferId}`);
  }

  async function cancelTransferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await cancelTransferInventory(actionContext.supabase, {
      transferId,
      notes: getNullableString(formData, "cancelNotes")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryPaths();
    redirect(transferDetailHref);
  }

  async function shipTransferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await shipTransferInventory(actionContext.supabase, {
      transferId,
      shippedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "notes"),
      lines: detail.lines
        .map(({ line }) => ({
          transferLineId: line.id,
          quantityShipped: getNumber(formData, `quantityShipped_${line.id}`),
          unitCostCents: getNullableString(formData, `unitCostCents_${line.id}`)
            ? getNumber(formData, `unitCostCents_${line.id}`)
            : line.unitCostCents,
          notes: getNullableString(formData, `lineNotes_${line.id}`)
        }))
        .filter((line) => line.quantityShipped > 0)
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryPaths();
    redirect(transferDetailHref);
  }

  async function receiveTransferAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await receiveTransferredInventory(actionContext.supabase, {
      transferId,
      receivedByUserId: actionContext.currentUserId,
      notes: getNullableString(formData, "notes"),
      lines: detail.lines
        .map(({ line }) => ({
          transferLineId: line.id,
          quantityReceived: getNumber(formData, `quantityReceived_${line.id}`),
          notes: getNullableString(formData, `lineNotes_${line.id}`)
        }))
        .filter((line) => line.quantityReceived > 0)
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryPaths();
    redirect(transferDetailHref);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Inventory transfer"
        title={detail.transfer.referenceNumber ?? detail.transfer.id.slice(0, 8).toUpperCase()}
        description={
          <>
            {detail.fromLocation.name} → {detail.toLocation.name}
          </>
        }
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href={movementWorkspaceHref}>
              Open movement ledger
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href={sourceLocationWorkspaceHref}>
              Source location
            </Link>
          </>
        }
        status={<StatusBadge status={detail.transfer.status} />}
      />

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Transfer</CardEyebrow>
              <CardTitle>Ship</CardTitle>
              <CardDescription>Shipping writes `transfer_out` ledger rows at the source location.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={shipTransferAction}>
              {detail.lines.length ? (
                detail.lines.map(({ line, item, fromBalance }) => {
                  const remainingToShip = Math.max(line.quantityRequested - line.quantityShipped, 0);
                  return (
                    <div key={line.id} style={{ marginBottom: "1rem" }}>
                      <p className="ui-card__eyebrow">{item.sku}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {item.name}
                      </h3>
                      <p className="ui-card__description">
                        Requested {line.quantityRequested} · shipped {line.quantityShipped} · source available {fromBalance?.availableQuantity ?? 0}
                      </p>
                      <FormRow>
                        <FormField label="Qty to ship">
                          <Input
                            defaultValue={remainingToShip > 0 ? remainingToShip : ""}
                            disabled={!canShip}
                            min="0.01"
                            max={remainingToShip}
                            name={`quantityShipped_${line.id}`}
                            step="0.01"
                            type="number"
                          />
                        </FormField>
                        <FormField label="Unit cost (cents)">
                          <Input
                            defaultValue={line.unitCostCents ?? ""}
                            disabled={!canShip}
                            min="0"
                            name={`unitCostCents_${line.id}`}
                            type="number"
                          />
                        </FormField>
                      </FormRow>
                      <FormField label="Line notes">
                        <Input disabled={!canShip} name={`lineNotes_${line.id}`} />
                      </FormField>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  eyebrow="No lines"
                  title="This transfer has no lines"
                  description="Transfers need line items before they can move stock."
                />
              )}
              <FormField label="Notes">
                <Textarea disabled={!canShip} name="notes" rows={3} />
              </FormField>
              <Button disabled={!canShip} type="submit">
                {canShip ? "Ship transfer" : "Transfer already shipped"}
              </Button>
            </Form>

            <hr style={{ border: "none", borderTop: "1px solid var(--ui-border-subtle)", margin: "1rem 0" }} />

            <Form action={cancelTransferAction}>
              <FormField label="Cancel notes">
                <Textarea disabled={!canCancel} name="cancelNotes" rows={2} />
              </FormField>
              <Button disabled={!canCancel} tone="danger" type="submit">
                {canCancel ? "Cancel draft transfer" : "Only draft transfers can be canceled"}
              </Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Transfer</CardEyebrow>
              <CardTitle>Receive</CardTitle>
              <CardDescription>Receiving writes `transfer_in` ledger rows at the destination location.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={receiveTransferAction}>
              {detail.lines.length ? (
                detail.lines.map(({ line, item, toBalance }) => {
                  const remainingToReceive = Math.max(line.quantityShipped - line.quantityReceived, 0);
                  return (
                    <div key={line.id} style={{ marginBottom: "1rem" }}>
                      <p className="ui-card__eyebrow">{item.sku}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {item.name}
                      </h3>
                      <p className="ui-card__description">
                        Shipped {line.quantityShipped} · received {line.quantityReceived} · destination on hand {toBalance?.onHandQuantity ?? 0}
                      </p>
                      <FormRow>
                        <FormField label="Qty to receive">
                          <Input
                            defaultValue={remainingToReceive > 0 ? remainingToReceive : ""}
                            disabled={!canReceive}
                            min="0.01"
                            max={remainingToReceive}
                            name={`quantityReceived_${line.id}`}
                            step="0.01"
                            type="number"
                          />
                        </FormField>
                        <FormField label="Unit cost">
                          <Input
                            defaultValue={line.unitCostCents ?? ""}
                            disabled
                            type="number"
                          />
                        </FormField>
                      </FormRow>
                      <FormField label="Line notes">
                        <Input disabled={!canReceive} name={`lineNotes_${line.id}`} />
                      </FormField>
                    </div>
                  );
                })
              ) : null}
              <FormField label="Notes">
                <Textarea disabled={!canReceive} name="notes" rows={3} />
              </FormField>
              <Button disabled={!canReceive} tone="secondary" type="submit">
                {canReceive ? "Receive transfer" : "Transfer not ready to receive"}
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Lines</CardEyebrow>
            <CardTitle>Transfer lines</CardTitle>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {detail.lines.length ? (
            <div className="ui-list">
              {detail.lines.map(({ line, item, fromBalance, toBalance }) => (
                <article key={line.id} className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">{item.sku}</p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      {item.name}
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Requested {line.quantityRequested} · shipped {line.quantityShipped} · received {line.quantityReceived}
                    </p>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Source available {fromBalance?.availableQuantity ?? 0} · destination on hand {toBalance?.onHandQuantity ?? 0}
                    </p>
                    {line.unitCostCents !== null ? (
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        Unit cost {formatCurrencyFromCents(line.unitCostCents)}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={detail.transfer.status} fallbackTone="info" />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="No lines"
              title="No inventory lines on this transfer"
              description="Create a new transfer if stock still needs to move."
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
