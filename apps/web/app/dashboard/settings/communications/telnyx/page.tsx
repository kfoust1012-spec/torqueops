import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Json, SmsProviderAccount } from "@mobile-mechanic/types";
import {
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
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
import {
  buildTelnyxWebhookUrl,
  disconnectTelnyxSmsProviderAccount,
  getTelnyxSmsProviderSettingsWorkspace,
  saveTelnyxSmsProviderAccountSettings,
  verifyTelnyxSmsProviderConnection
} from "../../../../../lib/communications/sms-providers/service";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getBoolean(formData: FormData, key: string) {
  return getString(formData, key) === "1";
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

function toJsonObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }

  return {};
}

function getTelnyxSettings(account: SmsProviderAccount | null) {
  const settings = toJsonObject(account?.settingsJson);

  return {
    messagingProfileId:
      typeof settings.messagingProfileId === "string"
        ? settings.messagingProfileId
        : account?.username ?? "",
    webhookSigningPublicKey:
      typeof settings.webhookSigningPublicKey === "string"
        ? settings.webhookSigningPublicKey
        : ""
  };
}

export default async function TelnyxCommunicationsSettingsPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getTelnyxSmsProviderSettingsWorkspace(
    context.supabase,
    context.companyId
  );
  const settings = getTelnyxSettings(workspace.account);
  const webhookUrl = workspace.account ? buildTelnyxWebhookUrl(workspace.account.id) : null;

  async function saveAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await saveTelnyxSmsProviderAccountSettings(actionContext.supabase, {
      companyId: actionContext.companyId,
      provider: "telnyx",
      displayName: getString(formData, "displayName") || "Telnyx",
      fromNumber: getString(formData, "fromNumber"),
      apiKey: getString(formData, "apiKey"),
      messagingProfileId: getString(formData, "messagingProfileId") || null,
      webhookSigningPublicKey: getString(formData, "webhookSigningPublicKey"),
      isDefault: getBoolean(formData, "isDefault")
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/telnyx");
    redirect("/dashboard/settings/communications/telnyx");
  }

  async function verifyAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await verifyTelnyxSmsProviderConnection(actionContext.supabase, actionContext.companyId);

    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/telnyx");
    redirect("/dashboard/settings/communications/telnyx");
  }

  async function disconnectAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await disconnectTelnyxSmsProviderAccount(actionContext.supabase, actionContext.companyId);

    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/telnyx");
    redirect("/dashboard/settings/communications/telnyx");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Communications"
        title="Telnyx"
        description="Store company-owned Telnyx credentials and webhook verification keys for automated customer SMS."
        actions={
          <Link
            className={buttonClassName({ tone: "secondary" })}
            href="/dashboard/settings/communications"
          >
            Back to communications
          </Link>
        }
        status={workspace.account ? <StatusBadge status={workspace.account.status} /> : undefined}
      />

      <Callout
        title="Provider-backed customer texting"
        tone={getCalloutTone(workspace.account?.status)}
      >
        Telnyx is now a first-class SMS transport. The integration stores the API key, sender
        number, optional messaging profile, and signed webhook verification key per company.
      </Callout>

      {workspace.account ? (
        <Callout
          title={`Current state: ${workspace.account.status.replaceAll("_", " ")}`}
          tone={getCalloutTone(workspace.account.status)}
        >
          {workspace.account.lastErrorMessage ??
            "The account is saved. Verify the connection after any credential, sender-number, or signing-key change."}
        </Callout>
      ) : null}

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Account</CardEyebrow>
              <CardTitle>Credentials and sender number</CardTitle>
              <CardDescription>
                Save the Telnyx API key, sender number, and signing public key in one company-owned integration record.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={saveAccountAction}>
              <FormRow>
                <FormField label="Display name" required>
                  <Input defaultValue={workspace.account?.displayName ?? "Telnyx"} name="displayName" required />
                </FormField>
                <FormField label="Sender number" required hint="Use E.164 format, for example +15125550123.">
                  <Input defaultValue={workspace.account?.fromNumber ?? ""} name="fromNumber" required />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField
                  label="API key"
                  required
                  hint={
                    workspace.account?.credentialHint
                      ? `Currently stored as ${workspace.account.credentialHint}`
                      : "Paste the current Telnyx API key."
                  }
                >
                  <Input name="apiKey" required type="password" />
                </FormField>
                <FormField
                  label="Messaging profile ID"
                  hint="Optional. Paste the profile ID if this sender is managed through a specific Telnyx messaging profile."
                >
                  <Input defaultValue={settings.messagingProfileId} name="messagingProfileId" />
                </FormField>
              </FormRow>
              <FormField
                label="Webhook signing public key"
                required
                hint="Paste the Telnyx public key used to verify signed delivery webhooks."
              >
                <Textarea
                  defaultValue={settings.webhookSigningPublicKey}
                  name="webhookSigningPublicKey"
                  required
                  rows={5}
                />
              </FormField>
              <FormField label="Default SMS provider">
                <label className="ui-inline-input" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    defaultChecked={workspace.account?.isDefault ?? !workspace.defaultAccount}
                    name="isDefault"
                    type="checkbox"
                    value="1"
                  />
                  Make Telnyx the default provider for customer SMS
                </label>
              </FormField>
              <div className="ui-page-actions">
                <button className={buttonClassName({ tone: "primary" })} type="submit">
                  Save Telnyx settings
                </button>
              </div>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Webhook</CardEyebrow>
              <CardTitle>Delivery callback URL</CardTitle>
              <CardDescription>
                Configure this URL in Telnyx so signed delivery receipts reconcile against the correct company account.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <FormField label="Expected callback URL">
              <Input
                defaultValue={webhookUrl ?? "Save the account first to generate the account-specific callback URL."}
                readOnly
              />
            </FormField>
            <div className="ui-page-actions">
              <Form action={verifyAccountAction}>
                <button className={buttonClassName({ tone: "secondary" })} type="submit">
                  Verify connection
                </button>
              </Form>
              {workspace.account ? (
                <Form action={disconnectAccountAction}>
                  <button className={buttonClassName({ tone: "danger" })} type="submit">
                    Disconnect
                  </button>
                </Form>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
