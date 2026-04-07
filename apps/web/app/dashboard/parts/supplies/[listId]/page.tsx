import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { listInventoryItemsByCompany } from "@mobile-mechanic/api-client";

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
  Input,
  Page,
  PageHeader,
  Select,
  Textarea,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import {
  getSupplyListDetail,
  removeSupplyListLine,
  saveSupplyList,
  saveSupplyListLine
} from "../../../../../lib/procurement/supplies/service";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type SupplyListDetailPageProps = {
  params: Promise<{
    listId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function revalidateSupplyListPaths(listId: string) {
  revalidatePath("/dashboard/supply/supplies");
  revalidatePath(`/dashboard/supply/supplies/${listId}`);
  revalidatePath("/dashboard/parts/supplies");
  revalidatePath(`/dashboard/parts/supplies/${listId}`);
}

export default async function SupplyListDetailPage({ params, searchParams }: SupplyListDetailPageProps) {
  const { listId } = await params;

  redirect(buildDashboardAliasHref(`/dashboard/supply/supplies/${listId}`, (searchParams ? await searchParams : {})));
}

export async function SupplyListDetailPageImpl({ params }: SupplyListDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { listId } = await params;
  const [detail, inventoryItemsResult] = await Promise.all([
    getSupplyListDetail(context.supabase, listId),
    listInventoryItemsByCompany(context.supabase, context.companyId)
  ]);

  if (!detail) {
    notFound();
  }

  if (inventoryItemsResult.error) {
    throw inventoryItemsResult.error;
  }

  const inventoryItems = inventoryItemsResult.data ?? [];

  async function updateSupplyListAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await saveSupplyList(actionContext.supabase, {
      supplyListId: listId,
      update: {
        description: getNullableString(formData, "description"),
        isActive: getString(formData, "isActive") === "true",
        name: getString(formData, "name")
      }
    });

    revalidateSupplyListPaths(listId);
    redirect(`/dashboard/supply/supplies/${listId}`);
  }

  async function saveSupplyListLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await saveSupplyListLine(actionContext.supabase, {
      companyId: actionContext.companyId,
      defaultQuantity: getNumber(formData, "defaultQuantity") || 1,
      description: getString(formData, "description"),
      expectedUnitCostCents: getNullableString(formData, "expectedUnitCostCents")
        ? getNumber(formData, "expectedUnitCostCents")
        : null,
      inventoryItemId: getNullableString(formData, "inventoryItemId"),
      lineId: getNullableString(formData, "lineId") ?? undefined,
      notes: getNullableString(formData, "notes"),
      provider: "amazon_business",
      providerOfferKey: getNullableString(formData, "providerOfferKey"),
      providerProductKey: getNullableString(formData, "providerProductKey"),
      searchQuery: getNullableString(formData, "searchQuery"),
      supplyListId: listId
    });

    revalidateSupplyListPaths(listId);
    redirect(`/dashboard/supply/supplies/${listId}`);
  }

  async function deleteSupplyListLineAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await removeSupplyListLine(actionContext.supabase, getString(formData, "lineId"));

    revalidateSupplyListPaths(listId);
    redirect(`/dashboard/supply/supplies/${listId}`);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Supply file"
        title={detail.list.name}
        description={detail.list.description ?? "Reusable supply file for repeat unblock work."}
        actions={
          <>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/supply/supplies"
            >
              Back to supply lists
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href="/dashboard/supply">
              Supply desk
            </Link>
          </>
        }
      />

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>File settings</CardEyebrow>
              <CardTitle>Supply file details</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={updateSupplyListAction}>
              <FormField label="Name" required>
                <Input defaultValue={detail.list.name} name="name" required />
              </FormField>
              <FormField label="Description">
                <Textarea defaultValue={detail.list.description ?? ""} name="description" rows={4} />
              </FormField>
              <FormField label="Status">
                <Select defaultValue={detail.list.isActive ? "true" : "false"} name="isActive">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </FormField>
              <Button type="submit">Save supply list</Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Add line</CardEyebrow>
              <CardTitle>Reusable supply item</CardTitle>
              <CardDescription>
                Store the preferred product keys or search query so repeat demand can be seeded quickly.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={saveSupplyListLineAction}>
              <FormField label="Description" required>
                <Input name="description" required />
              </FormField>
              <FormRow>
                <FormField label="Default quantity" required>
                  <Input defaultValue="1" min="0.01" name="defaultQuantity" step="0.01" type="number" />
                </FormField>
                <FormField label="Expected unit cost (cents)">
                  <Input min="0" name="expectedUnitCostCents" type="number" />
                </FormField>
              </FormRow>
              <FormField label="Linked inventory item">
                <Select defaultValue="" name="inventoryItemId">
                  <option value="">No linked inventory item</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Search query">
                <Input name="searchQuery" />
              </FormField>
              <FormRow>
                <FormField label="Preferred product key">
                  <Input name="providerProductKey" />
                </FormField>
                <FormField label="Preferred offer key">
                  <Input name="providerOfferKey" />
                </FormField>
              </FormRow>
              <FormField label="Notes">
                <Textarea name="notes" rows={3} />
              </FormField>
              <Button type="submit">Add supply line</Button>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Reusable lines</CardEyebrow>
            <CardTitle>Saved supply file</CardTitle>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {detail.lines.length ? (
            <div className="ui-list">
              {detail.lines.map((line) => (
                <article key={line.id} className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">
                      Qty {line.defaultQuantity}
                      {line.inventoryItemId ? " · Inventory-linked" : ""}
                    </p>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      {line.description}
                    </h3>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      {line.searchQuery ? `Search: ${line.searchQuery}` : "No saved search query"}
                      {line.providerProductKey ? ` · Product ${line.providerProductKey}` : ""}
                      {line.providerOfferKey ? ` · Offer ${line.providerOfferKey}` : ""}
                    </p>
                  </div>
                  <div className="ui-page-actions">
                    <Badge tone="neutral">{line.provider.replaceAll("_", " ")}</Badge>
                    <Form action={deleteSupplyListLineAction}>
                      <input name="lineId" type="hidden" value={line.id} />
                      <Button size="sm" tone="danger" type="submit">
                        Delete
                      </Button>
                    </Form>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="No supply lines"
              title="Add the first reusable supply line"
              description="Store recurring shop consumables here so they can seed visit-linked request lines later."
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
