import Link from "next/link";

import {
  Badge,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  Page,
  PageHeader,
  StatusBadge,
  buttonClassName
} from "../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../lib/company-context";
import {
  buildShopmonkeyOnboardingSteps,
  getShopmonkeyMigrationSourceSettings,
  getShopmonkeyOnboardingPrimaryAction,
  getShopmonkeyOnboardingReadiness
} from "../../../../../../lib/data-imports/onboarding";
import {
  getExportFileName,
  getShopmonkeyMigrationSourceSettingsWorkspace
} from "../../../../../../lib/data-imports/service";

function getStepTone(status: string) {
  switch (status) {
    case "complete":
      return "success" as const;
    case "blocked":
      return "danger" as const;
    case "in_progress":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function getReadinessTone(state: string) {
  switch (state) {
    case "cutover_ready":
      return "success" as const;
    case "ready_to_import":
    case "import_in_progress":
    case "cutover_sync_pending":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

export default async function ShopmonkeyOnboardingPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getShopmonkeyMigrationSourceSettingsWorkspace(
    context.supabase,
    context.companyId
  );
  const onboardingInput = {
    account: workspace.account,
    latestRun: workspace.latestRun
  };
  const steps = buildShopmonkeyOnboardingSteps(onboardingInput);
  const readiness = getShopmonkeyOnboardingReadiness(onboardingInput);
  const primaryAction = getShopmonkeyOnboardingPrimaryAction(onboardingInput);
  const settings = getShopmonkeyMigrationSourceSettings(workspace.account?.settingsJson);
  const latestExportFileName = workspace.latestRun
    ? getExportFileName(workspace.latestRun.summaryJson)
    : null;

  return (
    <Page>
      <PageHeader
        eyebrow="Data imports onboarding"
        title="Shopmonkey migration"
        description="Guide a new shop from API key setup to imported historical data and webhook-backed cutover sync."
        actions={
          <>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/settings/data-imports/shopmonkey"
            >
              Open Shopmonkey settings
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

      <Callout
        tone={getReadinessTone(readiness.state)}
        title={`Current cutover state: ${readiness.state.replaceAll("_", " ")}`}
      >
        {readiness.summary}
      </Callout>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Overview</CardEyebrow>
                <CardTitle>What a new shop will do</CardTitle>
                <CardDescription>
                  This turns the current Shopmonkey settings surface into a guided migration path for a first-time customer.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-list">
                {steps.map((step, index) => (
                  <article className="ui-list-item" key={step.id}>
                    <div>
                      <p className="ui-card__eyebrow">
                        Step {index + 1} · {step.label}
                      </p>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        {step.description}
                      </p>
                    </div>
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={step.href}
                    >
                      Open step
                    </Link>
                  </article>
                ))}
              </div>
              <div className="ui-page-actions">
                <Link className={buttonClassName({ tone: "primary" })} href={primaryAction.href}>
                  {primaryAction.label}
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Cutover notes</CardEyebrow>
                <CardTitle>Operator checklist</CardTitle>
                <CardDescription>
                  The initial import gets historical data across. The webhook keeps customer, vehicle, and order changes fresh until the shop fully switches over.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-list">
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">Before import</p>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Ask the shop for its Shopmonkey API key and confirm which office user will own the migration run.
                    </p>
                  </div>
                </article>
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">After import</p>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Spot-check imported customers, vehicles, jobs, estimates, invoices, inspections, and attachments before telling the shop it can cut over.
                    </p>
                  </div>
                </article>
                <article className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">During cutover</p>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      Paste the generated webhook URL into Shopmonkey, wait for at least one webhook delivery, then finalize the switch.
                    </p>
                  </div>
                </article>
              </div>
            </CardContent>
          </Card>
        </div>

        <div style={{ display: "grid", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Migration flow</CardEyebrow>
                <CardTitle>Step tracker</CardTitle>
                <CardDescription>
                  Follow these statuses to move a company from no Shopmonkey connection to cutover-ready sync.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-list">
                {steps.map((step) => (
                  <article className="ui-list-item" key={step.id}>
                    <div>
                      <p className="ui-card__eyebrow">{step.label}</p>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        {step.description}
                      </p>
                    </div>
                    <div className="ui-page-actions">
                      <Badge tone={getStepTone(step.status)}>
                        {step.status.replaceAll("_", " ")}
                      </Badge>
                      <Link
                        className={buttonClassName({ size: "sm", tone: "secondary" })}
                        href={step.href}
                      >
                        Open
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Current company state</CardEyebrow>
                <CardTitle>Migration readiness summary</CardTitle>
                <CardDescription>
                  This reflects the saved Shopmonkey account, the latest import run, and webhook sync visibility.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Migration account</p>
                  <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                    {workspace.account?.displayName ?? "Not configured"}
                  </h3>
                </div>
                {workspace.account ? <StatusBadge status={workspace.account.status} /> : null}
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Last verified</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {formatTimestamp(workspace.account?.lastVerifiedAt ?? null)}
                  </p>
                </div>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Latest import run</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {workspace.latestRun
                      ? workspace.latestRun.status.replaceAll("_", " ")
                      : "No import run started"}
                  </p>
                </div>
                {workspace.latestRun ? <StatusBadge status={workspace.latestRun.status} /> : null}
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Latest export file</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {latestExportFileName ?? "No export file recorded yet"}
                  </p>
                </div>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Webhook URL</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {settings.webhookUrl ?? "Save Shopmonkey settings to generate the webhook URL"}
                  </p>
                </div>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Last webhook received</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {formatTimestamp(settings.lastWebhookReceivedAt ?? null)}
                  </p>
                </div>
              </article>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
