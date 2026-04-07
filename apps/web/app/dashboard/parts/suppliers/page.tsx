import {
  createSupplierAccount,
  createSupplierRoutingRule,
  listSupplierAccountsByCompany,
  listSupplierRoutingRulesByCompany,
  updateSupplierAccount,
  updateSupplierRoutingRule
} from "@mobile-mechanic/api-client";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  FormSection,
  Input,
  Page,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  buttonClassName
} from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type PartsSuppliersPageProps = {
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
  const raw = getString(formData, key).trim();
  return raw ? Number(raw) : 0;
}

function getBoolean(formData: FormData, key: string) {
  return getString(formData, key) === "true";
}

function revalidateSupplierPaths() {
  revalidatePath("/dashboard/supply");
  revalidatePath("/dashboard/supply/suppliers");
  revalidatePath("/dashboard/parts");
  revalidatePath("/dashboard/parts/suppliers");
}

export default async function PartsSuppliersPage({ searchParams }: PartsSuppliersPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/suppliers", (searchParams ? await searchParams : {})));
}

export async function SupplySuppliersPageImpl() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const [accountsResult, rulesResult] = await Promise.all([
    listSupplierAccountsByCompany(context.supabase, context.companyId),
    listSupplierRoutingRulesByCompany(context.supabase, context.companyId)
  ]);

  if (accountsResult.error) {
    throw accountsResult.error;
  }
  if (rulesResult.error) {
    throw rulesResult.error;
  }

  const supplierAccounts = accountsResult.data ?? [];
  const routingRules = rulesResult.data ?? [];

  async function createSupplierAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createSupplierAccount(actionContext.supabase, {
      companyId: actionContext.companyId,
      name: getString(formData, "name"),
      slug: getString(formData, "slug"),
      mode: (getString(formData, "mode") || "manual") as "manual" | "link_out",
      externalUrl: getNullableString(formData, "externalUrl"),
      contactEmail: getNullableString(formData, "contactEmail"),
      contactName: getNullableString(formData, "contactName"),
      contactPhone: getNullableString(formData, "contactPhone"),
      notes: getNullableString(formData, "notes"),
      sortOrder: getNumber(formData, "sortOrder")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateSupplierPaths();
    redirect("/dashboard/supply/suppliers");
  }

  async function createRoutingRuleAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const result = await createSupplierRoutingRule(actionContext.supabase, {
      companyId: actionContext.companyId,
      supplierAccountId: getString(formData, "supplierAccountId"),
      name: getString(formData, "name"),
      priority: getNumber(formData, "priority"),
      matchJobPriority: getNullableString(formData, "matchJobPriority"),
      matchVehicleMake: getNullableString(formData, "matchVehicleMake"),
      matchHasCore:
        getString(formData, "matchHasCore") === ""
          ? null
          : getString(formData, "matchHasCore") === "true",
      matchPartTerm: getNullableString(formData, "matchPartTerm")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateSupplierPaths();
    redirect("/dashboard/supply/suppliers");
  }

  async function updateSupplierAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const supplierAccountId = getString(formData, "supplierAccountId");
    const result = await updateSupplierAccount(actionContext.supabase, supplierAccountId, {
      name: getString(formData, "name"),
      slug: getString(formData, "slug"),
      mode: (getString(formData, "mode") || "manual") as "manual" | "link_out",
      externalUrl: getNullableString(formData, "externalUrl"),
      contactEmail: getNullableString(formData, "contactEmail"),
      contactName: getNullableString(formData, "contactName"),
      contactPhone: getNullableString(formData, "contactPhone"),
      notes: getNullableString(formData, "notes"),
      isActive: getBoolean(formData, "isActive"),
      sortOrder: getNumber(formData, "sortOrder")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateSupplierPaths();
    redirect("/dashboard/supply/suppliers");
  }

  async function updateRoutingRuleAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const ruleId = getString(formData, "ruleId");
    const result = await updateSupplierRoutingRule(actionContext.supabase, ruleId, {
      supplierAccountId: getString(formData, "supplierAccountId"),
      name: getString(formData, "name"),
      priority: getNumber(formData, "priority"),
      isActive: getBoolean(formData, "isActive"),
      matchJobPriority: getNullableString(formData, "matchJobPriority"),
      matchVehicleMake: getNullableString(formData, "matchVehicleMake"),
      matchHasCore:
        getString(formData, "matchHasCore") === ""
          ? null
          : getString(formData, "matchHasCore") === "true",
      matchPartTerm: getNullableString(formData, "matchPartTerm")
    });

    if (result.error) {
      throw result.error;
    }

    revalidateSupplierPaths();
    redirect("/dashboard/supply/suppliers");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Parts"
        title="Suppliers and routing"
        description="Configure manual and link-out vendors, then define the routing rules used when requests are bucketed into carts."
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/supply">
              Back to supply desk
            </Link>
            <Link className={buttonClassName({ tone: "tertiary" })} href="/dashboard/supply/integrations/partstech">
              PartsTech settings
            </Link>
          </>
        }
      />

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Supplier Accounts</CardEyebrow>
              <CardTitle>Add supplier</CardTitle>
              <CardDescription>Manual suppliers can be called or emailed; link-out suppliers can open their web catalog.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={createSupplierAccountAction}>
              <FormSection title="Supplier details">
                <FormRow>
                  <FormField label="Name" required>
                    <Input name="name" required />
                  </FormField>
                  <FormField label="Slug" required hint="Use lowercase letters, numbers, and dashes.">
                    <Input name="slug" pattern="[a-z0-9\\-]+" required />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Mode">
                    <Select defaultValue="manual" name="mode">
                      <option value="manual">Manual</option>
                      <option value="link_out">Link out</option>
                    </Select>
                  </FormField>
                  <FormField label="Sort order">
                    <Input defaultValue="0" name="sortOrder" type="number" />
                  </FormField>
                </FormRow>
                <FormField
                  label="External URL"
                  hint="Required when the supplier is in link-out mode."
                >
                  <Input name="externalUrl" placeholder="https://supplier.example.com" type="url" />
                </FormField>
                <FormRow>
                  <FormField label="Contact name">
                    <Input name="contactName" />
                  </FormField>
                  <FormField label="Contact email">
                    <Input name="contactEmail" type="email" />
                  </FormField>
                </FormRow>
                <FormField label="Contact phone">
                  <Input name="contactPhone" />
                </FormField>
                <FormField label="Notes">
                  <Textarea name="notes" rows={4} />
                </FormField>
              </FormSection>
              <Button type="submit">Save supplier</Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Routing Rules</CardEyebrow>
              <CardTitle>Add routing rule</CardTitle>
              <CardDescription>
                Automatic routing only uses matching rules. Add a broad fallback rule with no filters if you want a
                manual or link-out supplier to catch unmatched lines.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={createRoutingRuleAction}>
              <FormSection title="Rule definition">
                <FormField label="Supplier" required>
                  <Select name="supplierAccountId" required>
                    <option value="">Select supplier</option>
                    {supplierAccounts.map((supplierAccount) => (
                      <option key={supplierAccount.id} value={supplierAccount.id}>
                        {supplierAccount.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormRow>
                  <FormField label="Rule name" required>
                    <Input name="name" required />
                  </FormField>
                  <FormField label="Priority">
                    <Input defaultValue="0" name="priority" type="number" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Visit priority">
                    <Input name="matchJobPriority" placeholder="urgent" />
                  </FormField>
                  <FormField label="Vehicle make">
                    <Input name="matchVehicleMake" placeholder="Ford" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Core required">
                    <Select defaultValue="" name="matchHasCore">
                      <option value="">Either</option>
                      <option value="true">Core due</option>
                      <option value="false">No core</option>
                    </Select>
                  </FormField>
                  <FormField label="Part term">
                    <Input name="matchPartTerm" placeholder="brake pad" />
                  </FormField>
                </FormRow>
              </FormSection>
              <Button disabled={!supplierAccounts.length} type="submit">
                Save routing rule
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Configured Suppliers</CardEyebrow>
              <CardTitle>Accounts</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {supplierAccounts.length ? (
              <div className="ui-list">
                {supplierAccounts.map((supplierAccount) => (
                  <article key={supplierAccount.id} className="ui-list-item">
                    <div style={{ width: "100%" }}>
                      <div className="ui-page-actions" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
                        <div>
                          <p className="ui-card__eyebrow">{supplierAccount.slug}</p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            {supplierAccount.name}
                          </h3>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            {supplierAccount.externalUrl ?? "Manual ordering workflow"}
                          </p>
                        </div>
                        <div className="ui-page-actions">
                          <StatusBadge status={supplierAccount.isActive ? "active" : "archived"} />
                          <StatusBadge status={supplierAccount.mode} />
                        </div>
                      </div>

                      <Form action={updateSupplierAccountAction}>
                        <input name="supplierAccountId" type="hidden" value={supplierAccount.id} />
                        <FormRow>
                          <FormField label="Name" required>
                            <Input defaultValue={supplierAccount.name} name="name" required />
                          </FormField>
                          <FormField label="Slug" required>
                            <Input defaultValue={supplierAccount.slug} name="slug" pattern="[a-z0-9\\-]+" required />
                          </FormField>
                        </FormRow>
                        <FormRow>
                          <FormField label="Mode">
                            <Select defaultValue={supplierAccount.mode} name="mode">
                              <option value="manual">Manual</option>
                              <option value="link_out">Link out</option>
                            </Select>
                          </FormField>
                          <FormField label="Status">
                            <Select defaultValue={supplierAccount.isActive ? "true" : "false"} name="isActive">
                              <option value="true">Active</option>
                              <option value="false">Archived</option>
                            </Select>
                          </FormField>
                          <FormField label="Sort order">
                            <Input defaultValue={supplierAccount.sortOrder} name="sortOrder" type="number" />
                          </FormField>
                        </FormRow>
                        <FormField
                          label="External URL"
                          hint="Required when the supplier is in link-out mode."
                        >
                          <Input defaultValue={supplierAccount.externalUrl ?? ""} name="externalUrl" type="url" />
                        </FormField>
                        <FormRow>
                          <FormField label="Contact name">
                            <Input defaultValue={supplierAccount.contactName ?? ""} name="contactName" />
                          </FormField>
                          <FormField label="Contact email">
                            <Input defaultValue={supplierAccount.contactEmail ?? ""} name="contactEmail" type="email" />
                          </FormField>
                        </FormRow>
                        <FormField label="Contact phone">
                          <Input defaultValue={supplierAccount.contactPhone ?? ""} name="contactPhone" />
                        </FormField>
                        <FormField label="Notes">
                          <Textarea defaultValue={supplierAccount.notes ?? ""} name="notes" rows={3} />
                        </FormField>
                        <Button tone="secondary" type="submit">
                          Save supplier changes
                        </Button>
                      </Form>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No suppliers"
                title="Add the first supplier account"
                description="The sourcing flow needs at least one supplier before requests can be routed into carts."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Routing Rules</CardEyebrow>
              <CardTitle>Current rules</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {routingRules.length ? (
              <div className="ui-list">
                {routingRules.map((rule) => (
                  <article key={rule.id} className="ui-list-item">
                    <div style={{ width: "100%" }}>
                      <div className="ui-page-actions" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
                        <div>
                          <p className="ui-card__eyebrow">Priority {rule.priority}</p>
                          <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                            {rule.name}
                          </h3>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            {[
                              rule.matchJobPriority ? `Priority: ${rule.matchJobPriority}` : null,
                              rule.matchVehicleMake ? `Make: ${rule.matchVehicleMake}` : null,
                              rule.matchPartTerm ? `Term: ${rule.matchPartTerm}` : null,
                              rule.matchHasCore === null ? null : rule.matchHasCore ? "Core due" : "No core"
                            ]
                              .filter(Boolean)
                              .join(" · ") || "No filters"}
                          </p>
                        </div>
                        <StatusBadge status={rule.isActive ? "active" : "archived"} />
                      </div>

                      <Form action={updateRoutingRuleAction}>
                        <input name="ruleId" type="hidden" value={rule.id} />
                        <FormField label="Supplier" required>
                          <Select defaultValue={rule.supplierAccountId} name="supplierAccountId" required>
                            <option value="">Select supplier</option>
                            {supplierAccounts.map((supplierAccount) => (
                              <option key={supplierAccount.id} value={supplierAccount.id}>
                                {supplierAccount.name}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <FormRow>
                          <FormField label="Rule name" required>
                            <Input defaultValue={rule.name} name="name" required />
                          </FormField>
                          <FormField label="Priority">
                            <Input defaultValue={rule.priority} name="priority" type="number" />
                          </FormField>
                          <FormField label="Status">
                            <Select defaultValue={rule.isActive ? "true" : "false"} name="isActive">
                              <option value="true">Active</option>
                              <option value="false">Archived</option>
                            </Select>
                          </FormField>
                        </FormRow>
                        <FormRow>
                          <FormField label="Visit priority">
                            <Input defaultValue={rule.matchJobPriority ?? ""} name="matchJobPriority" />
                          </FormField>
                          <FormField label="Vehicle make">
                            <Input defaultValue={rule.matchVehicleMake ?? ""} name="matchVehicleMake" />
                          </FormField>
                        </FormRow>
                        <FormRow>
                          <FormField label="Core required">
                            <Select
                              defaultValue={
                                rule.matchHasCore === null ? "" : rule.matchHasCore ? "true" : "false"
                              }
                              name="matchHasCore"
                            >
                              <option value="">Either</option>
                              <option value="true">Core due</option>
                              <option value="false">No core</option>
                            </Select>
                          </FormField>
                          <FormField label="Part term">
                            <Input defaultValue={rule.matchPartTerm ?? ""} name="matchPartTerm" />
                          </FormField>
                        </FormRow>
                        <Button tone="secondary" type="submit">
                          Save rule changes
                        </Button>
                      </Form>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No rules"
                title="No routing rules yet"
                description="Without routing rules, unmatched request lines stay in the manual-attention queue until you add a fallback rule or route them intentionally."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
