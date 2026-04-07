import { listSupplierAccountsByCompany } from "@mobile-mechanic/api-client";
import {
  formatCurrencyFromCents,
  formatDateTime,
  formatInventoryTransactionTypeLabel
} from "@mobile-mechanic/core";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  Badge,
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
  HeaderCell,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TableWrap,
  Textarea,
  Cell,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import {
  createInventoryAdjustmentRecord,
  createInventoryAliasRecord,
  getInventoryItemDetail,
  updateInventoryItemRecord,
  upsertInventoryStockSettingRecord
} from "../../../../../lib/inventory/service";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type InventoryItemDetailPageProps = {
  params: Promise<{
    itemId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryItemDetailPage({ params, searchParams }: InventoryItemDetailPageProps) {
  const { itemId } = await params;

  redirect(buildDashboardAliasHref(`/dashboard/supply/inventory/items/${itemId}`, (searchParams ? await searchParams : {})));
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function getNullableNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? Number(value) : null;
}

function getNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? Number(value) : 0;
}

export async function SupplyInventoryItemDetailPageImpl({ params }: InventoryItemDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { itemId } = await params;
  const [detail, supplierAccountsResult] = await Promise.all([
    getInventoryItemDetail(context.supabase, context.companyId, itemId),
    listSupplierAccountsByCompany(context.supabase, context.companyId)
  ]);

  if (supplierAccountsResult.error) {
    throw supplierAccountsResult.error;
  }

  if (!detail.item || detail.item.item.companyId !== context.companyId) {
    notFound();
  }

  const supplierAccounts = supplierAccountsResult.data ?? [];
  const item = detail.item.item;
  const balances = detail.item.balances;
  const aliases = detail.item.aliases;
  const isStockedItem = item.itemType === "stocked";
  const itemDetailHref = `/dashboard/supply/inventory/items/${itemId}`;
  const catalogWorkspaceHref = `/dashboard/supply/inventory?view=catalog&itemId=${itemId}`;
  const activeLocations = detail.locations.filter((location) => location.isActive);
  const balanceByLocationId = new Map(
    balances.map((balance) => [balance.stockLocationId, balance])
  );
  const maxAdjustmentOutQuantity = activeLocations.reduce((maxQuantity, location) => {
    const availableQuantity = balanceByLocationId.get(location.id)?.availableQuantity ?? 0;
    return Math.max(maxQuantity, availableQuantity);
  }, 0);

  function revalidateInventoryPaths() {
    revalidatePath("/dashboard/supply/inventory");
    revalidatePath("/dashboard/supply/inventory/items");
    revalidatePath(itemDetailHref);
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/inventory/items");
    revalidatePath(`/dashboard/inventory/items/${itemId}`);
  }

  async function updateItemAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await updateInventoryItemRecord(actionContext.supabase, itemId, {
      sku: getString(formData, "sku"),
      name: getString(formData, "name"),
      description: getNullableString(formData, "description"),
      manufacturer: getNullableString(formData, "manufacturer"),
      partNumber: getNullableString(formData, "partNumber"),
      supplierAccountId: getNullableString(formData, "supplierAccountId"),
      defaultUnitCostCents: getNullableNumber(formData, "defaultUnitCostCents"),
      itemType: getString(formData, "itemType") === "non_stocked" ? "non_stocked" : "stocked",
      notes: getNullableString(formData, "notes"),
      isActive: formData.get("isActive") === "on"
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryPaths();
    redirect(itemDetailHref);
  }

  async function createAliasAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createInventoryAliasRecord(actionContext.supabase, {
      companyId: actionContext.companyId,
      inventoryItemId: itemId,
      aliasType:
        getString(formData, "aliasType") === "manufacturer_part_number"
          ? "manufacturer_part_number"
          : getString(formData, "aliasType") === "alternate_sku"
            ? "alternate_sku"
            : "supplier_sku",
      value: getString(formData, "value")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryPaths();
    redirect(itemDetailHref);
  }

  async function saveStockSettingAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await upsertInventoryStockSettingRecord(actionContext.supabase, {
      companyId: actionContext.companyId,
      inventoryItemId: itemId,
      stockLocationId: getString(formData, "stockLocationId"),
      reorderPointQuantity: getNumber(formData, "reorderPointQuantity"),
      lowStockThresholdQuantity: getNumber(formData, "lowStockThresholdQuantity"),
      preferredReorderQuantity: getNullableNumber(formData, "preferredReorderQuantity"),
      isStockedHere: formData.get("isStockedHere") === "on"
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryPaths();
    redirect(itemDetailHref);
  }

  async function createAdjustmentAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createInventoryAdjustmentRecord(actionContext.supabase, {
      companyId: actionContext.companyId,
      inventoryItemId: itemId,
      stockLocationId: getString(formData, "stockLocationId"),
      transactionType:
        getString(formData, "transactionType") === "adjustment_out"
          ? "adjustment_out"
          : "adjustment_in",
      quantity: getNumber(formData, "quantity"),
      unitCostCents: getNullableNumber(formData, "unitCostCents"),
      notes: getNullableString(formData, "notes"),
      createdByUserId: actionContext.currentUserId
    });

    if (result.error) {
      throw result.error;
    }

    revalidateInventoryPaths();
    redirect(itemDetailHref);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Inventory item"
        title={`${item.sku} · ${item.name}`}
        description="Maintain canonical SKU details, reorder settings, aliases, and ledger-backed stock history."
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href={catalogWorkspaceHref}>
              Catalog workspace
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href="/dashboard/supply/inventory">
              Inventory control
            </Link>
          </>
        }
        status={<StatusBadge status={item.itemType} fallbackTone={item.isActive ? "success" : "neutral"} />}
      />

      <div className="ui-summary-grid">
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>On hand</CardEyebrow>
          <p className="ui-summary-value">{detail.item.totalOnHandQuantity}</p>
          <p className="ui-summary-meta">Ledger-derived stock across all locations.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Reserved</CardEyebrow>
          <p className="ui-summary-value">{detail.item.totalReservedQuantity}</p>
          <p className="ui-summary-meta">Already committed to live job demand.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Available</CardEyebrow>
          <p className="ui-summary-value">{detail.item.totalAvailableQuantity}</p>
          <p className="ui-summary-meta">Available before a new reservation would overbook stock.</p>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Item settings</CardEyebrow>
              <CardTitle>Item profile</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={updateItemAction}>
              <FormRow>
                <FormField label="SKU" required>
                  <Input defaultValue={item.sku} name="sku" required />
                </FormField>
                <FormField label="Item name" required>
                  <Input defaultValue={item.name} name="name" required />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Manufacturer">
                  <Input defaultValue={item.manufacturer ?? ""} name="manufacturer" />
                </FormField>
                <FormField label="Part number">
                  <Input defaultValue={item.partNumber ?? ""} name="partNumber" />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Supplier">
                  <Select defaultValue={item.supplierAccountId ?? ""} name="supplierAccountId">
                    <option value="">No default supplier</option>
                    {supplierAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Default unit cost (cents)">
                  <Input defaultValue={item.defaultUnitCostCents ?? ""} min="0" name="defaultUnitCostCents" type="number" />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Item type">
                  <Select defaultValue={item.itemType} name="itemType">
                    <option value="stocked">Stocked</option>
                    <option value="non_stocked">Non-stocked</option>
                  </Select>
                </FormField>
                <FormField label="Description">
                  <Input defaultValue={item.description ?? ""} name="description" />
                </FormField>
              </FormRow>
              <label className="ui-field__hint" style={{ display: "flex", gap: "0.5rem" }}>
                <input defaultChecked={item.isActive} name="isActive" type="checkbox" />
                Active item
              </label>
              <FormField label="Notes">
                <Textarea defaultValue={item.notes ?? ""} name="notes" rows={3} />
              </FormField>
              <Button type="submit">Save item</Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Aliases</CardEyebrow>
              <CardTitle>Alternate identifiers</CardTitle>
              <CardDescription>Use aliases to match supplier SKUs and manufacturer part numbers cleanly later.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={createAliasAction}>
              <FormRow>
                <FormField label="Alias type">
                  <Select defaultValue="supplier_sku" name="aliasType">
                    <option value="supplier_sku">Supplier SKU</option>
                    <option value="manufacturer_part_number">Manufacturer part number</option>
                    <option value="alternate_sku">Alternate SKU</option>
                  </Select>
                </FormField>
                <FormField label="Value" required>
                  <Input name="value" required />
                </FormField>
              </FormRow>
              <Button tone="secondary" type="submit">
                Add alias
              </Button>
            </Form>

            {aliases.length ? (
              <div className="ui-list" style={{ marginTop: "1rem" }}>
                {aliases.map((alias) => (
                  <article key={alias.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{alias.aliasType.replaceAll("_", " ")}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {alias.value}
                      </h3>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No aliases"
                title="No alternate identifiers yet"
                description="Add supplier or manufacturer references before external catalog matching is introduced."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Balances</CardEyebrow>
              <CardTitle>By location</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {balances.length ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <HeaderCell>Location</HeaderCell>
                      <HeaderCell>Status</HeaderCell>
                      <HeaderCell>On hand</HeaderCell>
                      <HeaderCell>Reserved</HeaderCell>
                      <HeaderCell>Available</HeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((balance) => {
                      const location = detail.locations.find((entry) => entry.id === balance.stockLocationId);

                      return (
                        <tr key={balance.stockLocationId}>
                          <Cell>{location?.name ?? "Unknown location"}</Cell>
                          <Cell>
                            <StatusBadge status={balance.reorderStatus} />
                          </Cell>
                          <Cell>{balance.onHandQuantity}</Cell>
                          <Cell>{balance.reservedQuantity}</Cell>
                          <Cell>{balance.availableQuantity}</Cell>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState
                eyebrow="No balances"
                title="This item has not moved yet"
                description="Receipts, returns, and manual adjustments will create location balances."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Reorder settings</CardEyebrow>
              <CardTitle>Thresholds by location</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {!isStockedItem ? (
              <EmptyState
                eyebrow="Non-stocked item"
                title="Reorder thresholds only apply to stocked inventory"
                description="This SKU can stay in the catalog, but low-stock and reorder settings are disabled until it is marked as stocked."
              />
            ) : activeLocations.length ? (
              <div className="ui-list">
                {activeLocations.map((location) => {
                  const setting = detail.stockSettings.find((entry) => entry.stockLocationId === location.id);

                  return (
                    <article key={location.id} className="ui-list-item">
                      <div style={{ width: "100%" }}>
                        <Form action={saveStockSettingAction}>
                          <input name="stockLocationId" type="hidden" value={location.id} />
                          <p className="ui-card__eyebrow">{location.slug}</p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            {location.name}
                          </h3>
                          <FormRow>
                            <FormField label="Reorder point">
                              <Input defaultValue={setting?.reorderPointQuantity ?? 0} min="0" name="reorderPointQuantity" step="0.01" type="number" />
                            </FormField>
                            <FormField label="Low-stock threshold">
                              <Input defaultValue={setting?.lowStockThresholdQuantity ?? 0} min="0" name="lowStockThresholdQuantity" step="0.01" type="number" />
                            </FormField>
                          </FormRow>
                          <FormRow>
                            <FormField label="Preferred reorder qty">
                              <Input defaultValue={setting?.preferredReorderQuantity ?? ""} min="0" name="preferredReorderQuantity" step="0.01" type="number" />
                            </FormField>
                            <FormField label="Stocked here">
                              <label className="ui-field__hint" style={{ display: "flex", gap: "0.5rem", minHeight: "44px", alignItems: "center" }}>
                                <input defaultChecked={setting?.isStockedHere ?? true} name="isStockedHere" type="checkbox" />
                                Track this item at {location.name}
                              </label>
                            </FormField>
                          </FormRow>
                          <Button tone="secondary" type="submit">
                            Save settings
                          </Button>
                        </Form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                eyebrow="No locations"
                title="Add an active location before setting thresholds"
                description="Location-specific reorder settings depend on active stock locations."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Adjustment</CardEyebrow>
              <CardTitle>Manual ledger entry</CardTitle>
              <CardDescription>Use only for controlled corrections when receipts or returns are not the source event.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {!isStockedItem ? (
              <EmptyState
                eyebrow="Non-stocked item"
                title="Manual stock adjustments are disabled"
                description="Convert this SKU to stocked inventory before creating ledger-backed quantity adjustments."
              />
            ) : activeLocations.length ? (
              <Form action={createAdjustmentAction}>
                <FormRow>
                  <FormField label="Location">
                    <Select defaultValue={activeLocations[0]?.id ?? ""} name="stockLocationId">
                      {activeLocations.map((location) => {
                        const locationBalance = balanceByLocationId.get(location.id);

                        return (
                          <option key={location.id} value={location.id}>
                            {location.name} · available {locationBalance?.availableQuantity ?? 0}
                          </option>
                        );
                      })}
                    </Select>
                  </FormField>
                  <FormField label="Adjustment type">
                    <Select defaultValue="adjustment_in" name="transactionType">
                      <option value="adjustment_in">Adjustment in</option>
                      <option value="adjustment_out">Adjustment out</option>
                    </Select>
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Quantity" required>
                    <Input
                      max={maxAdjustmentOutQuantity > 0 ? maxAdjustmentOutQuantity : undefined}
                      min="0.01"
                      name="quantity"
                      required
                      step="0.01"
                      type="number"
                    />
                  </FormField>
                  <FormField label="Unit cost (cents)">
                    <Input min="0" name="unitCostCents" type="number" />
                  </FormField>
                </FormRow>
                <p className="ui-field__hint" style={{ marginTop: "-0.25rem" }}>
                  Adjustment out cannot exceed the current available quantity for the selected location.
                </p>
                <FormField label="Notes">
                  <Textarea name="notes" rows={3} />
                </FormField>
                <Button tone="secondary" type="submit">
                  Create adjustment
                </Button>
              </Form>
            ) : (
              <EmptyState
                eyebrow="No active locations"
                title="Reactivate or add a stock location first"
                description="Manual adjustments need an active stock location to record the ledger entry."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Ledger</CardEyebrow>
              <CardTitle>Recent transactions</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {detail.transactions.length ? (
              <div className="ui-list">
                {detail.transactions.map((transaction) => (
                  <article key={transaction.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">
                        {formatDateTime(transaction.effectiveAt, { timeZone: context.company.timezone })}
                      </p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {formatInventoryTransactionTypeLabel(transaction.transactionType)}
                      </h3>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        Qty delta {transaction.quantityDelta}
                        {transaction.unitCostCents !== null ? ` · ${formatCurrencyFromCents(transaction.unitCostCents)}` : ""}
                      </p>
                    </div>
                    <Badge tone="brand">{transaction.sourceType.replaceAll("_", " ")}</Badge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No ledger history"
                title="No transactions have hit this item yet"
                description="Receiving purchased items or recording an adjustment will create the first stock movement."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
