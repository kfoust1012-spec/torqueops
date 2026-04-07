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
import { processDataImportRunById } from "../../../../../lib/data-imports/processor";
import {
  getShopmonkeyMigrationSourceSettings,
  getShopmonkeyOnboardingPrimaryAction,
  getShopmonkeyOnboardingReadiness
} from "../../../../../lib/data-imports/onboarding";
import {
  disconnectShopmonkeyMigrationSourceAccount,
  getExportFileName,
  getShopmonkeyMigrationSourceSettingsWorkspace,
  queueShopmonkeyInitialImportRun,
  saveShopmonkeyMigrationSourceAccountSettings,
  verifyShopmonkeyMigrationSourceConnection
} from "../../../../../lib/data-imports/service";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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

function getRunTone(status: string | null | undefined) {
  if (status === "completed") {
    return "success" as const;
  }

  if (status === "queued" || status === "processing" || status === "paused") {
    return "warning" as const;
  }

  return "danger" as const;
}

function getReadinessTone(state: string) {
  if (state === "cutover_ready") {
    return "success" as const;
  }

  if (
    state === "ready_to_import" ||
    state === "import_in_progress" ||
    state === "cutover_sync_pending"
  ) {
    return "warning" as const;
  }

  return "danger" as const;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not verified yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not verified yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default async function ShopmonkeyDataImportSettingsPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getShopmonkeyMigrationSourceSettingsWorkspace(
    context.supabase,
    context.companyId
  );
  const latestExportFileName = workspace.latestRun
    ? getExportFileName(workspace.latestRun.summaryJson)
    : null;
  const onboardingInput = {
    account: workspace.account,
    latestRun: workspace.latestRun
  };
  const readiness = getShopmonkeyOnboardingReadiness(onboardingInput);
  const primaryAction = getShopmonkeyOnboardingPrimaryAction(onboardingInput);
  const settings = getShopmonkeyMigrationSourceSettings(workspace.account?.settingsJson);
  const webhookUrl = settings.webhookUrl ?? null;
  const recentRuns = workspace.recentRuns.slice(0, 5);

  async function saveAccountAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await saveShopmonkeyMigrationSourceAccountSettings(actionContext.supabase, {
      companyId: actionContext.companyId,
      provider: "shopmonkey",
      displayName: getString(formData, "displayName") || "Shopmonkey",
      apiKey: getString(formData, "apiKey")
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/data-imports");
    revalidatePath("/dashboard/settings/data-imports/shopmonkey");
    redirect("/dashboard/settings/data-imports/shopmonkey");
  }

  async function disconnectAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await disconnectShopmonkeyMigrationSourceAccount(
      actionContext.supabase,
      actionContext.companyId
    );

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/data-imports");
    revalidatePath("/dashboard/settings/data-imports/shopmonkey");
    redirect("/dashboard/settings/data-imports/shopmonkey");
  }

  async function verifyAccountAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await verifyShopmonkeyMigrationSourceConnection(
      actionContext.supabase,
      actionContext.companyId
    );

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/data-imports");
    revalidatePath("/dashboard/settings/data-imports/shopmonkey");
    redirect("/dashboard/settings/data-imports/shopmonkey");
  }

  async function startImportRunAction() {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const run = await queueShopmonkeyInitialImportRun(actionContext.supabase, {
      companyId: actionContext.companyId,
      startedByUserId: actionContext.currentUserId
    });
    await processDataImportRunById(run.id);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings/data-imports");
    revalidatePath("/dashboard/settings/data-imports/shopmonkey");
    redirect("/dashboard/settings/data-imports/shopmonkey");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Data imports"
        title="Shopmonkey"
        description="Store the source API key and migration account record that the import pipeline will use during cutover."
        actions={
          <>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/settings/data-imports/shopmonkey/onboarding"
            >
              Guided flow
            </Link>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/settings/data-imports"
            >
              Back to data imports
            </Link>
          </>
        }
        status={workspace.account ? <StatusBadge status={workspace.account.status} /> : undefined}
      />

      <Callout title="Migration flow" tone={getCalloutTone(workspace.account?.status)}>
        This page now stores the Shopmonkey credential, verifies the API key, runs the import
        pipeline, and exposes the webhook URL for customer or order delta sync during cutover.
      </Callout>

      <Callout
        title={`Cutover readiness: ${readiness.state.replaceAll("_", " ")}`}
        tone={getReadinessTone(readiness.state)}
      >
        {readiness.summary}
      </Callout>

      {workspace.account ? (
        <Callout
          title={`Current state: ${workspace.account.status.replaceAll("_", " ")}`}
          tone={getCalloutTone(workspace.account.status)}
        >
          {workspace.account.lastErrorMessage ??
            "The account is saved. Verification and import execution will use this stored source credential."}
        </Callout>
      ) : null}

      {workspace.latestRun ? (
        <Callout
          title={`Latest import run: ${workspace.latestRun.status.replaceAll("_", " ")}`}
          tone={getRunTone(workspace.latestRun.status)}
        >
          {workspace.latestRun.lastErrorMessage ??
            (latestExportFileName
              ? `Latest export file: ${latestExportFileName}`
              : "The latest Shopmonkey import run completed without an export file name in the summary.")}
        </Callout>
      ) : null}

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card id="connect-step">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Account</CardEyebrow>
              <CardTitle>Credential and display name</CardTitle>
              <CardDescription>
                Save the Shopmonkey API key in an encrypted company-owned record. Verification and
                export-backed import runs read from this record instead of direct operator credentials.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={saveAccountAction}>
              <FormRow>
                <FormField label="Display name" required>
                  <Input
                    defaultValue={workspace.account?.displayName ?? "Shopmonkey"}
                    name="displayName"
                    required
                  />
                </FormField>
                <FormField
                  label="API key"
                  required
                  hint={
                    workspace.account?.credentialHint
                      ? `Currently stored as ${workspace.account.credentialHint}`
                      : "Paste the Shopmonkey API key."
                  }
                >
                  <Input name="apiKey" required type="password" />
                </FormField>
              </FormRow>
              <div className="ui-page-actions">
                <button className={buttonClassName({ tone: "primary" })} type="submit">
                  Save Shopmonkey settings
                </button>
              </div>
            </Form>
            <div className="ui-page-actions">
              <Link className={buttonClassName({ tone: "secondary" })} href={primaryAction.href}>
                {primaryAction.label}
              </Link>
              {workspace.account ? (
                <Form action={verifyAccountAction}>
                  <button className={buttonClassName({ tone: "secondary" })} type="submit">
                    Verify connection
                  </button>
                </Form>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card id="import-step">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Status</CardEyebrow>
              <CardTitle>Current migration account</CardTitle>
              <CardDescription>
                Review the stored credential hint, verification state, webhook endpoint, and the
                latest import run.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <FormField label="Stored credential hint">
              <Input
                defaultValue={workspace.account?.credentialHint ?? "No API key has been saved yet."}
                readOnly
              />
            </FormField>
            <FormField label="Last verified">
              <Input defaultValue={formatTimestamp(workspace.account?.lastVerifiedAt ?? null)} readOnly />
            </FormField>
            <FormField label="Last error">
              <Input
                defaultValue={workspace.account?.lastErrorMessage ?? "No verification error recorded."}
                readOnly
              />
            </FormField>
            <FormField label="Latest import run">
              <Input
                defaultValue={
                  workspace.latestRun
                    ? workspace.latestRun.status.replaceAll("_", " ")
                    : "No import run has been started yet."
                }
                readOnly
              />
            </FormField>
            <FormField label="Latest export file">
              <Input
                defaultValue={latestExportFileName ?? "No export file has been recorded yet."}
                readOnly
              />
            </FormField>
            <div id="webhook-step">
              <FormField label="Webhook URL">
                <Input
                  defaultValue={webhookUrl ?? "Save Shopmonkey settings to generate the webhook URL."}
                  readOnly
                />
              </FormField>
            </div>
            <div className="ui-page-actions">
              {workspace.latestRun ? (
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={`/dashboard/settings/data-imports/shopmonkey/runs/${workspace.latestRun.id}`}
                >
                  View latest run
                </Link>
              ) : null}
              {workspace.account?.status === "connected" ? (
                <Form action={startImportRunAction}>
                  <button className={buttonClassName({ tone: "primary" })} type="submit">
                    Start initial import run
                  </button>
                </Form>
              ) : null}
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

        <Card id="history-step">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Recent runs</CardEyebrow>
              <CardTitle>Import history</CardTitle>
              <CardDescription>
                Review the latest Shopmonkey runs, their status, and the recorded export file.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {recentRuns.length ? (
              <div className="ui-list">
                {recentRuns.map((run) => {
                  const runExportFileName = getExportFileName(run.summaryJson);

                  return (
                    <article key={run.id} className="ui-list-item">
                      <div>
                        <p className="ui-card__eyebrow">{formatTimestamp(run.createdAt)}</p>
                        <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                          Run {run.id.slice(0, 8)}
                        </h3>
                        <p className="ui-card__description" style={{ marginBottom: 0 }}>
                          {run.lastErrorMessage ??
                            (runExportFileName
                              ? `Export ${runExportFileName}`
                              : `Finished ${formatTimestamp(run.finishedAt)}`)}
                        </p>
                      </div>
                      <div className="ui-page-actions">
                        <StatusBadge status={run.status} />
                        <Link
                          className={buttonClassName({ tone: "secondary" })}
                          href={`/dashboard/settings/data-imports/shopmonkey/runs/${run.id}`}
                        >
                          View
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="ui-summary-meta">No Shopmonkey import runs have been recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
