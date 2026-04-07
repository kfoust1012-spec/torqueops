import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Page,
  PageHeader,
  StatusBadge,
  buttonClassName
} from "../../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../../lib/company-context";
import {
  getExportFileName,
  getImportRunEntitySummaries,
  getImportRunExportRequestError,
  getImportRunFailures,
  getImportRunMode,
  getImportRunRequestedTables,
  getImportRunWebhookSummary,
  getShopmonkeyImportRunDetailWorkspace
} from "../../../../../../../lib/data-imports/service";

type ShopmonkeyImportRunDetailPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatRunStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatRequestedTables(requestedTables: string[]) {
  if (!requestedTables.length) {
    return "No table filter";
  }

  return requestedTables.map((table) => table.replaceAll("_", " ")).join(", ");
}

function formatCountBreakdown(created: number, updated: number) {
  if (!created && !updated) {
    return "No records touched.";
  }

  if (created && updated) {
    return `${created} created, ${updated} updated.`;
  }

  if (created) {
    return `${created} created.`;
  }

  return `${updated} updated.`;
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

export default async function ShopmonkeyImportRunDetailPage({
  params
}: ShopmonkeyImportRunDetailPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { runId } = await params;
  const workspace = await getShopmonkeyImportRunDetailWorkspace(
    context.supabase,
    context.companyId,
    runId
  );

  if (!workspace) {
    notFound();
  }

  const entitySummaries = getImportRunEntitySummaries(workspace.run.summaryJson);
  const exportFileName = getExportFileName(workspace.run.summaryJson);
  const exportRequestError = getImportRunExportRequestError(workspace.run.summaryJson);
  const failures = getImportRunFailures(workspace.run.summaryJson);
  const mode = getImportRunMode(workspace.run.optionsJson);
  const requestedTables = getImportRunRequestedTables(
    workspace.run.summaryJson,
    workspace.run.optionsJson
  );
  const webhook = getImportRunWebhookSummary(workspace.run.optionsJson);
  const shortRunId = workspace.run.id.slice(0, 8);
  const recentRuns = workspace.recentRuns.slice(0, 5);
  const statusMessage =
    workspace.run.lastErrorMessage ??
    exportRequestError ??
    (workspace.run.status === "completed"
      ? "This import run completed without a recorded failure."
      : "This import run has not recorded a terminal error message yet.");

  return (
    <Page>
      <PageHeader
        eyebrow="Data imports"
        title={`Shopmonkey run ${shortRunId}`}
        description="Inspect per-entity counts, failure details, and the run metadata captured during migration processing."
        details={`Started ${formatTimestamp(workspace.run.startedAt)} · Last heartbeat ${formatTimestamp(workspace.run.lastHeartbeatAt)}`}
        actions={
          <>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/settings/data-imports/shopmonkey"
            >
              Back to Shopmonkey
            </Link>
            <Link
              className={buttonClassName({ tone: "tertiary" })}
              href="/dashboard/settings/data-imports"
            >
              Data imports
            </Link>
          </>
        }
        status={<StatusBadge status={workspace.run.status} />}
      />

      <Callout
        title={`Run state: ${formatRunStatus(workspace.run.status)}`}
        tone={getRunTone(workspace.run.status)}
      >
        {statusMessage}
      </Callout>

      <div className="ui-summary-grid">
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Mode</CardEyebrow>
          <p className="ui-summary-value">{mode}</p>
          <p className="ui-summary-meta">
            {webhook
              ? `Webhook-triggered ${webhook.operation ?? "delta"} sync.`
              : "Manual full-history import run."}
          </p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Requested tables</CardEyebrow>
          <p className="ui-summary-value">{requestedTables.length}</p>
          <p className="ui-summary-meta">{formatRequestedTables(requestedTables)}</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Export file</CardEyebrow>
          <p className="ui-summary-value">{exportFileName ? "recorded" : "none"}</p>
          <p className="ui-summary-meta">
            {exportFileName ?? exportRequestError ?? "No export filename was stored for this run."}
          </p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Finished</CardEyebrow>
          <p className="ui-summary-value">{workspace.run.finishedAt ? "yes" : "no"}</p>
          <p className="ui-summary-meta">{formatTimestamp(workspace.run.finishedAt)}</p>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Entity counts</CardEyebrow>
              <CardTitle>Import activity</CardTitle>
              <CardDescription>
                Created and updated totals captured in the run summary.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <div className="ui-summary-grid">
              {entitySummaries.map((summary) => (
                <Card key={summary.id} padding="compact" tone="subtle">
                  <CardEyebrow>{summary.label}</CardEyebrow>
                  <p className="ui-summary-value">{summary.total}</p>
                  <p className="ui-summary-meta">
                    {formatCountBreakdown(summary.created, summary.updated)}
                  </p>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <div>
          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Run metadata</CardEyebrow>
                <CardTitle>Execution details</CardTitle>
              </CardHeaderContent>
            </CardHeader>
            <CardContent className="ui-detail-grid">
              <div className="ui-detail-item">
                <p className="ui-detail-label">Run ID</p>
                <p className="ui-detail-value">{workspace.run.id}</p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Started</p>
                <p className="ui-detail-value">{formatTimestamp(workspace.run.startedAt)}</p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Finished</p>
                <p className="ui-detail-value">{formatTimestamp(workspace.run.finishedAt)}</p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Requested tables</p>
                <p className="ui-detail-value">{formatRequestedTables(requestedTables)}</p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Webhook table</p>
                <p className="ui-detail-value">
                  {webhook?.table ? webhook.table.replaceAll("_", " ") : "Not webhook-triggered"}
                </p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Webhook operation</p>
                <p className="ui-detail-value">
                  {webhook?.operation ?? "Not webhook-triggered"}
                </p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Webhook received</p>
                <p className="ui-detail-value">{formatTimestamp(webhook?.receivedAt ?? null)}</p>
              </div>
              <div className="ui-detail-item">
                <p className="ui-detail-label">Export request error</p>
                <p className="ui-detail-value">{exportRequestError ?? "None recorded"}</p>
              </div>
            </CardContent>
          </Card>

          <Card style={{ marginTop: "1rem" }}>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Recent runs</CardEyebrow>
                <CardTitle>Shopmonkey history</CardTitle>
                <CardDescription>
                  Jump between the latest import attempts without leaving settings.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <div className="ui-list">
                {recentRuns.map((run) => (
                  <article key={run.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{formatTimestamp(run.createdAt)}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        Run {run.id.slice(0, 8)}
                      </h3>
                      <p className="ui-card__description" style={{ marginBottom: 0 }}>
                        {run.lastErrorMessage ?? `Finished ${formatTimestamp(run.finishedAt)}`}
                      </p>
                    </div>
                    <div className="ui-page-actions">
                      <StatusBadge status={run.status} />
                      {run.id === workspace.run.id ? (
                        <span className="ui-summary-meta">Viewing</span>
                      ) : (
                        <Link
                          className={buttonClassName({ tone: "secondary" })}
                          href={`/dashboard/settings/data-imports/shopmonkey/runs/${run.id}`}
                        >
                          View
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Failure log</CardEyebrow>
            <CardTitle>Recorded issues</CardTitle>
            <CardDescription>
              The processor appends run-level failures here as they occur.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {failures.length ? (
            <div className="ui-list">
              {failures.map((failure, index) => (
                <article key={`${index}-${failure}`} className="ui-list-item">
                  <div>
                    <p className="ui-card__eyebrow">Failure {index + 1}</p>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      {failure}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="No failures"
              title="This run did not record any processor failures"
              description="If a run still looks incomplete, inspect the entity counts and export request metadata first."
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
