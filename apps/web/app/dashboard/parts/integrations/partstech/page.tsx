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
  Page,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  Input,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import {
  disconnectPartsTechAccount,
  getPartsTechSettingsWorkspace,
  savePartsTechAccountSettings,
  savePartsTechSupplierMapping,
  verifyPartsTechConnection
} from "../../../../../lib/procurement/providers/service";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type PartsTechIntegrationPageProps = {
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

function revalidatePartsTechPaths() {
  revalidatePath("/dashboard/supply");
  revalidatePath("/dashboard/supply/integrations");
  revalidatePath("/dashboard/supply/integrations/partstech");
  revalidatePath("/dashboard/supply/suppliers");
  revalidatePath("/dashboard/parts");
  revalidatePath("/dashboard/parts/integrations");
  revalidatePath("/dashboard/parts/integrations/partstech");
  revalidatePath("/dashboard/parts/suppliers");
}

export default async function PartsTechIntegrationPage({ searchParams }: PartsTechIntegrationPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/integrations/partstech", (searchParams ? await searchParams : {})));
}

export async function SupplyPartsTechIntegrationPageImpl() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getPartsTechSettingsWorkspace(context.supabase, context.companyId);

  async function saveAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await savePartsTechAccountSettings(actionContext.supabase, {
      apiKey: getString(formData, "apiKey"),
      companyId: actionContext.companyId,
      displayName: "PartsTech",
      provider: "partstech",
      username: getString(formData, "username")
    });

    revalidatePartsTechPaths();
    redirect("/dashboard/supply/integrations/partstech");
  }

  async function verifyAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await verifyPartsTechConnection(actionContext.supabase, actionContext.companyId);

    revalidatePartsTechPaths();
    redirect("/dashboard/supply/integrations/partstech");
  }

  async function disconnectAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await disconnectPartsTechAccount(actionContext.supabase, actionContext.companyId);

    revalidatePartsTechPaths();
    redirect("/dashboard/supply/integrations/partstech");
  }

  async function saveMappingAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const accountWorkspace = await getPartsTechSettingsWorkspace(
      actionContext.supabase,
      actionContext.companyId
    );

    if (!accountWorkspace.account) {
      throw new Error("Configure the PartsTech account before saving supplier mappings.");
    }

    await savePartsTechSupplierMapping(actionContext.supabase, {
      companyId: actionContext.companyId,
      providerAccountId: accountWorkspace.account.id,
      providerLocationKey: getNullableString(formData, "providerLocationKey"),
      providerSupplierKey: getString(formData, "providerSupplierKey"),
      providerSupplierName: getString(formData, "providerSupplierName"),
      status: (getString(formData, "status") ||
        "active") as "active" | "pending_approval" | "unmapped" | "disabled",
      supplierAccountId: getString(formData, "supplierAccountId"),
      supportsOrder: getBoolean(formData, "supportsOrder"),
      supportsQuote: getBoolean(formData, "supportsQuote"),
      metadataJson: {
        notes: getNullableString(formData, "notes")
      }
    });

    revalidatePartsTechPaths();
    redirect("/dashboard/supply/integrations/partstech");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Parts"
        title="PartsTech integration"
        description="Store provider credentials, review connection state, and map PartsTech suppliers into the supply desk."
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
        status={
          workspace.account ? <StatusBadge status={workspace.account.status} /> : undefined
        }
      />

      <Callout
        title="Confirmed vs fallback behavior"
        tone={getCalloutTone(workspace.account?.status)}
      >
        The provider connection, supplier mappings, quote persistence, and purchase-order
        provenance are integrated. Any low-level PartsTech API behavior that is not confirmed is
        routed through explicit manual capture or manual ordering fallback instead of guessing.
      </Callout>

      {workspace.account ? (
        <Callout
          title={`Current state: ${workspace.account.status.replaceAll("_", " ")}`}
          tone={getCalloutTone(workspace.account.status)}
        >
          {workspace.account.lastErrorMessage ??
            "The account is saved. Verify the connection any time credentials or provider permissions change."}
        </Callout>
      ) : null}

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Account</CardEyebrow>
              <CardTitle>Credentials and connection</CardTitle>
              <CardDescription>
                PartsTech uses a username and API key. Save them here, then verify the connection
                state before searching from parts requests.
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
                  label="API key"
                  required
                  hint={
                    workspace.account?.credentialHint
                      ? `Currently stored as ${workspace.account.credentialHint}`
                      : "Paste the current PartsTech API key."
                  }
                >
                  <Input name="apiKey" required type="password" />
                </FormField>
              </FormRow>
              <Button type="submit">Save PartsTech credentials</Button>
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
              <CardTitle>Current launch notes</CardTitle>
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
                title="Nothing is blocking the fallback workflow"
                description="You can search from parts requests and capture PartsTech offers into supplier carts."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Supplier mappings</CardEyebrow>
              <CardTitle>Create or update a mapping</CardTitle>
              <CardDescription>
                Map the provider supplier identity to an existing internal supplier account so a
                PartsTech offer can convert into a normal supplier cart.
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
                  <FormField label="Provider supplier key" required>
                    <Input name="providerSupplierKey" required />
                  </FormField>
                  <FormField label="Provider supplier name" required>
                    <Input name="providerSupplierName" required />
                  </FormField>
                </FormRow>
                <FormField label="Provider location key">
                  <Input name="providerLocationKey" />
                </FormField>
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
                <FormField label="Notes">
                  <Textarea
                    name="notes"
                    rows={3}
                    placeholder="Use this when a supplier requires provider-side approval or a manual ordering fallback."
                  />
                </FormField>
                <Button disabled={!workspace.supplierAccounts.length} type="submit">
                  Save mapping
                </Button>
              </Form>
            ) : (
              <EmptyState
                eyebrow="No account"
                title="Save the PartsTech account first"
                description="Supplier mappings depend on a company-level PartsTech account record."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Current mappings</CardEyebrow>
              <CardTitle>Provider supplier coverage</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {workspace.mappings.length ? (
              <div className="ui-list">
                {workspace.mappings.map((mapping) => {
                  const supplierAccount = workspace.supplierAccounts.find(
                    (account) => account.id === mapping.supplierAccountId
                  );

                  return (
                    <article key={mapping.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">{mapping.providerSupplierKey}</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          {mapping.providerSupplierName}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          {supplierAccount?.name ?? "Unknown supplier"}
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
                eyebrow="No mappings"
                title="No provider suppliers are mapped yet"
                description="Create a mapping so a PartsTech quote line can land in an internal supplier cart."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
