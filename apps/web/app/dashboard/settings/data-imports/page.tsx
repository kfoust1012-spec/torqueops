import Link from "next/link";

import {
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
} from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import {
  getDataImportSettingsWorkspace,
  getExportFileName
} from "../../../../lib/data-imports/service";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "not yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default async function DataImportsSettingsPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getDataImportSettingsWorkspace(
    context.supabase,
    context.companyId
  );
  const shopmonkeyAccount =
    workspace.accounts.find((account) => account.provider === "shopmonkey") ?? null;
  const latestRun = shopmonkeyAccount
    ? workspace.runs.find((run) => run.sourceAccountId === shopmonkeyAccount.id) ?? null
    : null;
  const connectedAccounts = workspace.accounts.filter(
    (account) => account.status === "connected"
  ).length;
  const latestExportFileName = latestRun ? getExportFileName(latestRun.summaryJson) : null;

  return (
    <Page>
      <PageHeader
        eyebrow="Settings"
        title="Data imports"
        description="Manage migration-source credentials, verification, import runs, and webhook-backed cutover sync for historical shop data."
        actions={
          <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/settings">
            Back to settings
          </Link>
        }
      />

      <Callout title="Migration slice" tone="warning">
        This pass verifies the Shopmonkey API key, runs the import pipeline, and exposes the
        Shopmonkey webhook endpoint for customer and order delta sync during cutover.
      </Callout>

      <div className="ui-summary-grid">
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Configured sources</CardEyebrow>
          <p className="ui-summary-value">{workspace.accounts.length}</p>
          <p className="ui-summary-meta">Migration providers saved for this company.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Connected sources</CardEyebrow>
          <p className="ui-summary-value">{connectedAccounts}</p>
          <p className="ui-summary-meta">Currently verified migration accounts.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Last verified</CardEyebrow>
          <p className="ui-summary-value">
            {formatTimestamp(shopmonkeyAccount?.lastVerifiedAt ?? null)}
          </p>
          <p className="ui-summary-meta">Latest verification timestamp across the pilot source.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Latest import run</CardEyebrow>
          <p className="ui-summary-value">
            {latestRun ? latestRun.status.replaceAll("_", " ") : "not started"}
          </p>
          <p className="ui-summary-meta">
            {latestRun
              ? latestExportFileName
                ? `Export file ${latestExportFileName}`
                : `Finished ${formatTimestamp(latestRun.finishedAt)}`
              : "No Shopmonkey import run has been recorded yet."}
          </p>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Migration source</CardEyebrow>
              <CardTitle>Shopmonkey</CardTitle>
              <CardDescription>
                Verify the source API key, run imports, and configure the Shopmonkey webhook
                endpoint without changing onboarding again.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <p className="ui-summary-meta">
              {shopmonkeyAccount
                ? `Configured as ${shopmonkeyAccount.displayName}.`
                : "No Shopmonkey account has been configured yet."}
            </p>
            {latestRun ? (
              <p className="ui-summary-meta">
                Latest run: {latestRun.status.replaceAll("_", " ")}
                {latestExportFileName ? `, export ${latestExportFileName}.` : "."}
              </p>
            ) : null}
            <div className="ui-page-actions">
              <Link
                className={buttonClassName({ tone: "secondary" })}
                href="/dashboard/settings/data-imports/shopmonkey/onboarding"
              >
                Guided flow
              </Link>
              <Link
                className={buttonClassName({ tone: "primary" })}
                href="/dashboard/settings/data-imports/shopmonkey"
              >
                {shopmonkeyAccount ? "Manage Shopmonkey" : "Connect Shopmonkey"}
              </Link>
              {latestRun ? (
                <Link
                  className={buttonClassName({ tone: "secondary" })}
                  href={`/dashboard/settings/data-imports/shopmonkey/runs/${latestRun.id}`}
                >
                  View latest run
                </Link>
              ) : null}
              {shopmonkeyAccount ? <StatusBadge status={shopmonkeyAccount.status} /> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
