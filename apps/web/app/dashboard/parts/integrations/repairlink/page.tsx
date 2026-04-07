import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  Badge,
  Button,
  Callout,
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
  StatusBadge,
  Textarea,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import {
  disconnectRepairLinkAccount,
  getRepairLinkFallbackModeFromSettings,
  getRepairLinkPreferredDealerIdsFromSettings,
  getRepairLinkSettingsWorkspace,
  saveRepairLinkAccountSettings,
  saveRepairLinkDealerMapping,
  verifyRepairLinkConnection
} from "../../../../../lib/procurement/providers/service";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type RepairLinkIntegrationPageProps = {
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

function getBoolean(formData: FormData, key: string) {
  return getString(formData, key) === "true";
}

function getCalloutTone(status: string | null | undefined) {
  if (status === "connected") {
    return "success" as const;
  }

  if (status === "action_required") {
    return "warning" as const;
  }

  return "danger" as const;
}

function revalidateRepairLinkPaths() {
  revalidatePath("/dashboard/supply");
  revalidatePath("/dashboard/supply/integrations");
  revalidatePath("/dashboard/supply/integrations/repairlink");
  revalidatePath("/dashboard/supply/suppliers");
  revalidatePath("/dashboard/parts");
  revalidatePath("/dashboard/parts/integrations");
  revalidatePath("/dashboard/parts/integrations/repairlink");
  revalidatePath("/dashboard/parts/suppliers");
}

export default async function RepairLinkIntegrationPage({ searchParams }: RepairLinkIntegrationPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/integrations/repairlink", (searchParams ? await searchParams : {})));
}

export async function SupplyRepairLinkIntegrationPageImpl() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getRepairLinkSettingsWorkspace(context.supabase, context.companyId);
  const fallbackMode = getRepairLinkFallbackModeFromSettings(workspace.account);
  const preferredDealerMappingIds = new Set(
    getRepairLinkPreferredDealerIdsFromSettings(workspace.account)
  );
  const eligiblePreferredDealerMappings = workspace.mappings.filter(
    (mapping) =>
      !["disabled", "unmapped"].includes(mapping.status) && mapping.supportsQuote
  );

  async function saveAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await saveRepairLinkAccountSettings(actionContext.supabase, {
      companyId: actionContext.companyId,
      defaultFallbackMode: (getString(formData, "defaultFallbackMode") ||
        "manual_capture") as "manual_capture" | "manual_link_out",
      displayName: "RepairLink",
      password: getString(formData, "password"),
      preferredDealerMappingIds: formData
        .getAll("preferredDealerMappingIds")
        .map((value) => (typeof value === "string" ? value : ""))
        .filter(Boolean),
      provider: "repairlink",
      username: getString(formData, "username")
    });

    revalidateRepairLinkPaths();
    redirect("/dashboard/supply/integrations/repairlink");
  }

  async function verifyAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await verifyRepairLinkConnection(actionContext.supabase, actionContext.companyId);

    revalidateRepairLinkPaths();
    redirect("/dashboard/supply/integrations/repairlink");
  }

  async function disconnectAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await disconnectRepairLinkAccount(actionContext.supabase, actionContext.companyId);

    revalidateRepairLinkPaths();
    redirect("/dashboard/supply/integrations/repairlink");
  }

  async function saveMappingAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const accountWorkspace = await getRepairLinkSettingsWorkspace(
      actionContext.supabase,
      actionContext.companyId
    );

    if (!accountWorkspace.account) {
      throw new Error("Configure the RepairLink account before saving dealer mappings.");
    }

    await saveRepairLinkDealerMapping(actionContext.supabase, {
      companyId: actionContext.companyId,
      providerAccountId: accountWorkspace.account.id,
      providerLocationKey: getNullableString(formData, "providerLocationKey"),
      providerSupplierKey: getString(formData, "providerSupplierKey"),
      providerSupplierName: getString(formData, "providerSupplierName"),
      status: (getString(formData, "status") ||
        "active") as "active" | "pending_approval" | "disabled",
      supplierAccountId: getString(formData, "supplierAccountId"),
      supportsOrder: getBoolean(formData, "supportsOrder"),
      supportsQuote: getBoolean(formData, "supportsQuote"),
      metadataJson: {
        dealerCode: getNullableString(formData, "dealerCode"),
        notes: getNullableString(formData, "notes"),
        supportedBrands: getString(formData, "supportedBrands")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      }
    });

    revalidateRepairLinkPaths();
    redirect("/dashboard/supply/integrations/repairlink");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Parts"
        title="RepairLink integration"
        description="Store OEM account credentials, configure dealer mappings, and keep VIN-linked OEM sourcing inside the live supply flow."
        actions={
          <>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/supply/integrations"
            >
              Back to integrations
            </Link>
            <Link
              className={buttonClassName({ tone: "tertiary" })}
              href="/dashboard/supply/suppliers"
            >
              Supplier settings
            </Link>
          </>
        }
        status={workspace.account ? <StatusBadge status={workspace.account.status} /> : undefined}
      />

      <Callout
        title="Confirmed vs fallback behavior"
        tone={getCalloutTone(workspace.account?.status)}
      >
        RepairLink is configured as a VIN-linked OEM handoff. Account state, dealer mappings,
        quote provenance, and purchase-order provenance are integrated. Any undocumented API
        behavior falls back to manual quote capture or manual order handoff instead of guessing
        unsupported endpoints.
      </Callout>

      {workspace.account ? (
        <Callout
          title={`Current state: ${workspace.account.status.replaceAll("_", " ")}`}
          tone={getCalloutTone(workspace.account.status)}
        >
          {workspace.account.lastErrorMessage ??
            (workspace.account.status === "connected"
              ? "The account is configured for VIN-linked OEM fallback. RepairLink credentials and dealer mappings are ready for manual quote capture and manual order handoff."
              : "The account is saved. Verify the connection any time credentials or dealer access changes.")}
        </Callout>
      ) : null}

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Account</CardEyebrow>
              <CardTitle>Credentials and fallback mode</CardTitle>
              <CardDescription>
                RepairLink uses a username and password on the confirmed public shop login surface.
                Save them here, then choose how OEM sourcing should fall back when automation is
                not confirmed.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={saveAccountAction}>
              <FormRow>
                <FormField label="Username" required>
                  <Input defaultValue={workspace.account?.username ?? ""} name="username" required />
                </FormField>
                <FormField
                  label="Password"
                  hint={
                    workspace.account?.credentialHint
                      ? `Currently stored as ${workspace.account.credentialHint}. Leave blank to keep the current password.`
                      : "Paste the current RepairLink password."
                  }
                >
                  <Input
                    name="password"
                    required={!workspace.account}
                    type="password"
                  />
                </FormField>
              </FormRow>
              <FormField label="Default fallback mode">
                <Select defaultValue={fallbackMode} name="defaultFallbackMode">
                  <option value="manual_capture">Manual quote capture</option>
                  <option value="manual_link_out">Manual link-out</option>
                </Select>
              </FormField>
              <FormField
                label="Preferred dealer defaults"
                hint={
                  eligiblePreferredDealerMappings.length
                    ? "Preferred dealers are checked by default on the request OEM search form."
                    : "Save dealer mappings that support quote capture before setting preferred defaults."
                }
              >
                {eligiblePreferredDealerMappings.length ? (
                  <div className="ui-list">
                    {eligiblePreferredDealerMappings.map((mapping) => (
                      <label
                        key={mapping.id}
                        className="ui-list-item"
                        style={{ alignItems: "center", display: "flex", gap: "0.75rem" }}
                      >
                        <input
                          defaultChecked={preferredDealerMappingIds.has(mapping.id)}
                          name="preferredDealerMappingIds"
                          type="checkbox"
                          value={mapping.id}
                        />
                        <div>
                          <strong>{mapping.providerSupplierName}</strong>
                          <p className="ui-card__description" style={{ marginBottom: 0 }}>
                            {mapping.providerSupplierKey}
                            {mapping.providerLocationKey ? ` · ${mapping.providerLocationKey}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="ui-field__hint">No active quote-capable dealer mappings yet.</p>
                )}
              </FormField>
              <Button type="submit">Save RepairLink credentials</Button>
            </Form>

            <div className="ui-page-actions" style={{ marginTop: "1rem" }}>
              <form action={verifyAccountAction}>
                <Button disabled={!workspace.account} tone="secondary" type="submit">
                  Verify connection
                </Button>
              </form>
              <form action={disconnectAccountAction}>
                <Button disabled={!workspace.account} tone="danger" type="submit">
                  Disconnect
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Provider attention</CardEyebrow>
              <CardTitle>Current OEM launch notes</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {workspace.attentionItems.length ? (
              <div className="ui-list">
                {workspace.attentionItems.map((item) => (
                  <article key={item} className="ui-list-item">
                    <div>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {item}
                      </h3>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No attention items"
                title="Nothing is blocking OEM fallback"
                description="You can start VIN-linked RepairLink handoffs from parts requests and capture OEM quotes manually into supplier carts."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Dealer mappings</CardEyebrow>
              <CardTitle>Create or update a dealer mapping</CardTitle>
              <CardDescription>
                Map a RepairLink dealer identity to an internal supplier account so VIN-linked OEM
                quote lines can convert into normal supplier carts and purchase orders.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {workspace.account ? (
              <Form action={saveMappingAction}>
                <FormRow>
                  <FormField label="Internal supplier" required>
                    <Select name="supplierAccountId" required>
                      <option value="">Select supplier</option>
                      {workspace.supplierAccounts.map((supplierAccount) => (
                        <option key={supplierAccount.id} value={supplierAccount.id}>
                          {supplierAccount.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Status" required>
                    <Select defaultValue="active" name="status" required>
                      <option value="active">Active</option>
                      <option value="pending_approval">Pending approval</option>
                      <option value="disabled">Disabled</option>
                    </Select>
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Dealer key" required>
                    <Input name="providerSupplierKey" required />
                  </FormField>
                  <FormField label="Dealer name" required>
                    <Input name="providerSupplierName" required />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Dealer code">
                    <Input name="dealerCode" />
                  </FormField>
                  <FormField label="Provider location key">
                    <Input name="providerLocationKey" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Supports quote">
                    <Select defaultValue="true" name="supportsQuote">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                  </FormField>
                  <FormField label="Supports order">
                    <Select defaultValue="false" name="supportsOrder">
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                  </FormField>
                </FormRow>
                <FormField label="Supported brands">
                  <Input name="supportedBrands" placeholder="Ford, Lincoln, Mazda" />
                </FormField>
                <FormField label="Notes">
                  <Textarea
                    name="notes"
                    rows={3}
                    placeholder="Use this for dealer constraints, supported brands, or manual-order instructions."
                  />
                </FormField>
                <Button disabled={!workspace.supplierAccounts.length} type="submit">
                  Save dealer mapping
                </Button>
              </Form>
            ) : (
              <EmptyState
                eyebrow="No account"
                title="Save the RepairLink account first"
                description="Dealer mappings depend on a company-level RepairLink account record."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Current mappings</CardEyebrow>
              <CardTitle>Dealer coverage</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {workspace.mappings.length ? (
              <div className="ui-list">
                {workspace.mappings.map((mapping) => {
                  const supplierAccount = workspace.supplierAccounts.find(
                    (account) => account.id === mapping.supplierAccountId
                  );
                  const metadata =
                    mapping.metadataJson && typeof mapping.metadataJson === "object"
                      ? mapping.metadataJson
                      : null;
                  const dealerCode =
                    metadata && "dealerCode" in metadata && typeof metadata.dealerCode === "string"
                      ? metadata.dealerCode
                      : null;

                  return (
                    <article key={mapping.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">{mapping.providerSupplierKey}</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {mapping.providerSupplierName}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          {supplierAccount?.name ?? "Unknown supplier"}
                          {dealerCode ? ` · Dealer code ${dealerCode}` : ""}
                          {mapping.providerLocationKey ? ` · ${mapping.providerLocationKey}` : ""}
                        </p>
                      </div>
                      <div className="ui-page-actions">
                        <StatusBadge status={mapping.status} />
                        <Badge tone={mapping.supportsOrder ? "success" : "warning"}>
                          {mapping.supportsOrder ? "quote + order" : "manual fallback"}
                        </Badge>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                eyebrow="No dealer mappings"
                title="No RepairLink dealers are mapped yet"
                description="Create a dealer mapping so a VIN-linked OEM quote line can land in an internal supplier cart."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
