import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
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
  disconnectAmazonBusinessAccount,
  getAmazonBusinessFallbackModeFromSettings,
  getAmazonBusinessSettingsWorkspace,
  saveAmazonBusinessAccountSettings,
  verifyAmazonBusinessConnection
} from "../../../../../lib/procurement/providers/service";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";

type AmazonBusinessIntegrationPageProps = {
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

function getCalloutTone(status: string | null | undefined) {
  if (status === "connected") {
    return "success" as const;
  }

  if (status === "action_required") {
    return "warning" as const;
  }

  return "danger" as const;
}

function getSettingsValue(
  settingsJson: unknown,
  key: string
) {
  if (
    settingsJson &&
    typeof settingsJson === "object" &&
    !Array.isArray(settingsJson) &&
    key in settingsJson
  ) {
    return settingsJson[key as keyof typeof settingsJson];
  }

  return null;
}

function revalidateAmazonBusinessPaths() {
  revalidatePath("/dashboard/supply");
  revalidatePath("/dashboard/supply/integrations");
  revalidatePath("/dashboard/supply/integrations/amazon-business");
  revalidatePath("/dashboard/parts");
  revalidatePath("/dashboard/parts/integrations");
  revalidatePath("/dashboard/parts/integrations/amazon-business");
}

export default async function AmazonBusinessIntegrationPage({ searchParams }: AmazonBusinessIntegrationPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/integrations/amazon-business", (searchParams ? await searchParams : {})));
}

export async function SupplyAmazonBusinessIntegrationPageImpl() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getAmazonBusinessSettingsWorkspace(
    context.supabase,
    context.companyId
  );
  const account = workspace.account;
  const settingsJson = account?.settingsJson ?? null;
  const fallbackMode = getAmazonBusinessFallbackModeFromSettings(account);
  const accountEmail =
    (typeof getSettingsValue(settingsJson, "accountEmail") === "string"
      ? getSettingsValue(settingsJson, "accountEmail")
      : account?.username) ?? "";
  const region =
    (typeof getSettingsValue(settingsJson, "region") === "string"
      ? getSettingsValue(settingsJson, "region")
      : "US") ?? "US";
  const buyingGroupId =
    (typeof getSettingsValue(settingsJson, "buyingGroupId") === "string"
      ? getSettingsValue(settingsJson, "buyingGroupId")
      : "") ?? "";
  const buyerEmailMode =
    (typeof getSettingsValue(settingsJson, "buyerEmailMode") === "string"
      ? getSettingsValue(settingsJson, "buyerEmailMode")
      : "authorized_user") ?? "authorized_user";
  const buyerEmailOverride =
    (typeof getSettingsValue(settingsJson, "buyerEmailOverride") === "string"
      ? getSettingsValue(settingsJson, "buyerEmailOverride")
      : "") ?? "";
  const defaultShippingAddressText =
    (typeof getSettingsValue(settingsJson, "defaultShippingAddressText") === "string"
      ? getSettingsValue(settingsJson, "defaultShippingAddressText")
      : "") ?? "";

  async function saveAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await saveAmazonBusinessAccountSettings(actionContext.supabase, {
      accountEmail: getString(formData, "accountEmail"),
      buyerEmailMode:
        (getString(formData, "buyerEmailMode") || "authorized_user") as
          | "authorized_user"
          | "override",
      buyerEmailOverride: getNullableString(formData, "buyerEmailOverride"),
      buyingGroupId: getNullableString(formData, "buyingGroupId"),
      companyId: actionContext.companyId,
      defaultFallbackMode:
        (getString(formData, "defaultFallbackMode") || "manual_capture") as
          | "manual_capture"
          | "manual_link_out",
      defaultShippingAddressText: getNullableString(formData, "defaultShippingAddressText"),
      defaultSupplierAccountId: getNullableString(formData, "defaultSupplierAccountId"),
      displayName: "Amazon Business",
      provider: "amazon_business",
      region: (getString(formData, "region") || "US") as
        | "US"
        | "CA"
        | "MX"
        | "UK"
        | "DE"
        | "FR"
        | "IT"
        | "ES"
        | "IN"
        | "JP"
        | "AU"
    });

      revalidateAmazonBusinessPaths();
      redirect("/dashboard/supply/integrations/amazon-business");
  }

  async function verifyAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await verifyAmazonBusinessConnection(actionContext.supabase, actionContext.companyId);

    revalidateAmazonBusinessPaths();
    redirect("/dashboard/supply/integrations/amazon-business");
  }

  async function disconnectAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await disconnectAmazonBusinessAccount(actionContext.supabase, actionContext.companyId);

    revalidateAmazonBusinessPaths();
    redirect("/dashboard/supply/integrations/amazon-business");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Parts"
        title="Amazon Business integration"
        description="Configure supply-oriented sourcing, fallback behavior, and the default internal supplier account used when Amazon Business offers convert into normal procurement carts."
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
              href="/dashboard/supply/supplies"
            >
              Supply lists
            </Link>
          </>
        }
        status={account ? <StatusBadge status={account.status} /> : undefined}
      />

      <Callout
        title="Confirmed vs fallback behavior"
        tone={getCalloutTone(account?.status)}
      >
        Amazon Business is integrated as a supply-oriented provider. Account configuration,
        provider quote provenance, supplier-cart conversion, and provider-order tracking are
        supported. Any unsupported or unconfirmed automation falls back to manual quote capture
        or manual link-out instead of guessing undocumented endpoints.
      </Callout>

      {account ? (
        <Callout
          title={`Current state: ${account.status.replaceAll("_", " ")}`}
          tone={getCalloutTone(account.status)}
        >
          {account.lastErrorMessage ??
            "The account is configured for Amazon Business fallback. Supply search and order provenance stay inside the live supply flow even when automation is not available."}
        </Callout>
      ) : null}

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Account</CardEyebrow>
              <CardTitle>Settings and fallback mode</CardTitle>
              <CardDescription>
                Save the account, region, and default supplier context used for supply purchasing.
                If official automation is unavailable for your setup, the flow remains usable through
                manual capture or manual link-out.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={saveAccountAction}>
              <FormRow>
                <FormField label="Account email" required>
                  <Input defaultValue={accountEmail} name="accountEmail" required />
                </FormField>
                <FormField label="Region" required>
                  <Select defaultValue={region} name="region" required>
                    {["US", "CA", "MX", "UK", "DE", "FR", "IT", "ES", "IN", "JP", "AU"].map(
                      (option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      )
                    )}
                  </Select>
                </FormField>
              </FormRow>

              <FormRow>
                <FormField
                  label="Default supplier account"
                  hint="Amazon Business offers convert into this internal supplier account."
                  required
                >
                  <Select
                    defaultValue={workspace.defaultSupplierAccount?.id ?? ""}
                    name="defaultSupplierAccountId"
                    required
                  >
                    <option value="">Select supplier</option>
                    {workspace.supplierAccounts.map((supplierAccount) => (
                      <option key={supplierAccount.id} value={supplierAccount.id}>
                        {supplierAccount.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Buying group ID">
                  <Input defaultValue={buyingGroupId} name="buyingGroupId" />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="Buyer email mode">
                  <Select defaultValue={buyerEmailMode} name="buyerEmailMode">
                    <option value="authorized_user">Use authorized user</option>
                    <option value="override">Override buyer email</option>
                  </Select>
                </FormField>
                <FormField label="Buyer email override">
                  <Input defaultValue={buyerEmailOverride} name="buyerEmailOverride" />
                </FormField>
              </FormRow>

              <FormField label="Default shipping address">
                <Textarea
                  defaultValue={defaultShippingAddressText}
                  name="defaultShippingAddressText"
                  rows={4}
                />
              </FormField>

              <FormField label="Default fallback mode">
                <Select defaultValue={fallbackMode} name="defaultFallbackMode">
                  <option value="manual_capture">Manual quote capture</option>
                  <option value="manual_link_out">Manual link-out</option>
                </Select>
              </FormField>

              <Button type="submit">Save Amazon Business settings</Button>
            </Form>

            <div className="ui-page-actions" style={{ marginTop: "1rem" }}>
              <form action={verifyAccountAction}>
                <Button disabled={!account} tone="secondary" type="submit">
                  Verify configuration
                </Button>
              </form>
              <form action={disconnectAccountAction}>
                <Button disabled={!account} tone="danger" type="submit">
                  Disconnect
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Attention</CardEyebrow>
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
                title="Nothing is blocking supplies sourcing"
                description="Use Amazon Business for supply-oriented sourcing and keep procurement provenance attached even when the flow falls back to manual handling."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
