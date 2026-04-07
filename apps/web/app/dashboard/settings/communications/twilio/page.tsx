import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import {
  buildTwilioWebhookUrl,
  disconnectTwilioSmsProviderAccount,
  getTwilioSmsProviderSettingsWorkspace,
  saveTwilioSmsProviderAccountSettings,
  verifyTwilioSmsProviderConnection
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

export default async function TwilioCommunicationsSettingsPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getTwilioSmsProviderSettingsWorkspace(
    context.supabase,
    context.companyId
  );
  const webhookUrl = workspace.account ? buildTwilioWebhookUrl(workspace.account.id) : null;

  async function saveAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await saveTwilioSmsProviderAccountSettings(actionContext.supabase, {
      companyId: actionContext.companyId,
      provider: "twilio",
      displayName: getString(formData, "displayName") || "Twilio",
      fromNumber: getString(formData, "fromNumber"),
      accountSid: getString(formData, "accountSid"),
      authToken: getString(formData, "authToken"),
      isDefault: getBoolean(formData, "isDefault")
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/twilio");
    redirect("/dashboard/settings/communications/twilio");
  }

  async function verifyAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await verifyTwilioSmsProviderConnection(actionContext.supabase, actionContext.companyId);

    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/twilio");
    redirect("/dashboard/settings/communications/twilio");
  }

  async function disconnectAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await disconnectTwilioSmsProviderAccount(actionContext.supabase, actionContext.companyId);

    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/twilio");
    redirect("/dashboard/settings/communications/twilio");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Communications"
        title="Twilio"
        description="Store company-owned Twilio credentials and sender configuration for automated customer SMS."
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
        Twilio is the first provider moved onto company-owned SMS credentials. If no company
        account is configured yet, queued Twilio messages still fall back to the legacy server
        environment path.
      </Callout>

      {workspace.account ? (
        <Callout
          title={`Current state: ${workspace.account.status.replaceAll("_", " ")}`}
          tone={getCalloutTone(workspace.account.status)}
        >
          {workspace.account.lastErrorMessage ??
            "The account is saved. Verify the connection after any credential or sender-number change."}
        </Callout>
      ) : null}

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Account</CardEyebrow>
              <CardTitle>Credentials and sender number</CardTitle>
              <CardDescription>
                Save the Twilio account SID, auth token, and outbound number in one company-owned integration record.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={saveAccountAction}>
              <FormRow>
                <FormField label="Display name" required>
                  <Input defaultValue={workspace.account?.displayName ?? "Twilio"} name="displayName" required />
                </FormField>
                <FormField label="Sender number" required hint="Use E.164 format, for example +15125550123.">
                  <Input defaultValue={workspace.account?.fromNumber ?? ""} name="fromNumber" required />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField
                  label="Account SID"
                  required
                  hint={workspace.account?.username ?? "Paste the Twilio account SID."}
                >
                  <Input defaultValue={workspace.account?.username ?? ""} name="accountSid" required />
                </FormField>
                <FormField
                  label="Auth token"
                  required
                  hint={
                    workspace.account?.credentialHint
                      ? `Currently stored as ${workspace.account.credentialHint}`
                      : "Paste the current Twilio auth token."
                  }
                >
                  <Input name="authToken" required type="password" />
                </FormField>
              </FormRow>
              <FormField label="Default SMS provider">
                <label className="ui-inline-input" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    defaultChecked={workspace.account?.isDefault ?? !workspace.defaultAccount}
                    name="isDefault"
                    type="checkbox"
                    value="1"
                  />
                  Make Twilio the default provider for customer SMS
                </label>
              </FormField>
              <div className="ui-page-actions">
                <button className={buttonClassName({ tone: "primary" })} type="submit">
                  Save Twilio settings
                </button>
              </div>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Webhook</CardEyebrow>
              <CardTitle>Status callback URL</CardTitle>
              <CardDescription>
                Configure this URL in Twilio so delivery receipts reconcile against the correct company account.
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
