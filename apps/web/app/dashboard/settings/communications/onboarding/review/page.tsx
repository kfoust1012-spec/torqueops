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
  buttonClassName
} from "../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../lib/company-context";
import {
  communicationOnboardingFieldLabels
} from "../../../../../../lib/communications/onboarding-profile";
import { getCommunicationsDashboardWorkspace } from "../../../../../../lib/communications/readiness";

import { CommunicationsOnboardingShell } from "../_shared";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function getTestTone(status: string | null | undefined) {
  if (status === "delivered") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  if (status === "sent" || status === "pending") {
    return "warning" as const;
  }

  return "neutral" as const;
}

export default async function CommunicationsOnboardingReviewPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getCommunicationsDashboardWorkspace(
    context.supabase,
    context.companyId,
    context.currentUserId
  );
  const missingFieldLabels = workspace.onboardingProfileSummary.missingFields.map(
    (field) => communicationOnboardingFieldLabels[field]
  );

  return (
    <CommunicationsOnboardingShell
      currentStep="review"
      description="Confirm the provider state and turn on only the live automations this company wants."
      title="Review and enable"
      workspace={workspace}
    >
      {workspace.readiness.isReadyForLiveAutomation ? (
        <Callout tone="success" title="Live activation is available">
          The company has a complete compliance profile, a connected default provider, and delivered SMS proof. You can now enable the desired automations.
        </Callout>
      ) : (
        <Callout tone="warning" title="Live activation is still gated">
          {workspace.readiness.blockReason}
        </Callout>
      )}

      <div className="ui-page-grid ui-page-grid--halves">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Compliance review</CardEyebrow>
              <CardTitle>Provider registration details</CardTitle>
              <CardDescription>
                These saved answers are the internal record for the shop’s SMS consent and campaign setup.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <article className="ui-list-item">
              <div>
                <p className="ui-card__eyebrow">Completion</p>
                <p className="ui-card__description" style={{ marginBottom: 0 }}>
                  {workspace.onboardingProfileSummary.completeFieldCount} of{" "}
                  {workspace.onboardingProfileSummary.totalFieldCount} required fields saved
                </p>
              </div>
              <Badge
                tone={workspace.onboardingProfileSummary.isComplete ? "success" : "warning"}
              >
                {workspace.onboardingProfileSummary.isComplete ? "complete" : "in progress"}
              </Badge>
            </article>
            {workspace.onboardingProfileSummary.isComplete ? (
              <Callout tone="success" title="Compliance profile is complete">
                The required business identity, consent flow, and sample message details are saved.
              </Callout>
            ) : (
              <Callout tone="warning" title="Compliance profile still has gaps">
                Missing: {missingFieldLabels.join(", ")}.
              </Callout>
            )}
            <div className="ui-page-actions">
              <Link
                className={buttonClassName({ tone: "secondary" })}
                href="/dashboard/settings/communications/onboarding/compliance"
              >
                Edit compliance step
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Delivery review</CardEyebrow>
              <CardTitle>Provider test status</CardTitle>
              <CardDescription>
                This is the last known provider test state stored on the current default account.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <article className="ui-list-item">
              <div>
                <p className="ui-card__eyebrow">Latest test</p>
                <p className="ui-card__description" style={{ marginBottom: 0 }}>
                  {workspace.lastProviderTestResult?.phoneNumber ?? "No test number saved"}
                </p>
              </div>
              <Badge tone={getTestTone(workspace.lastProviderTestResult?.status ?? null)}>
                {workspace.lastProviderTestResult?.status?.replaceAll("_", " ") ?? "not run"}
              </Badge>
            </article>
            <article className="ui-list-item">
              <div>
                <p className="ui-card__eyebrow">Observed delivered SMS</p>
                <p className="ui-card__description" style={{ marginBottom: 0 }}>
                  {formatTimestamp(workspace.readiness.lastDeliveredSmsAt)}
                </p>
              </div>
            </article>
            {workspace.lastProviderTestResult?.errorMessage ? (
              <Callout tone="danger" title="Latest test error">
                {workspace.lastProviderTestResult.errorMessage}
              </Callout>
            ) : null}
            <div className="ui-page-actions">
              <Link
                className={buttonClassName({ tone: "secondary" })}
                href="/dashboard/settings/communications/onboarding/test"
              >
                Re-open test step
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Final review</CardEyebrow>
            <CardTitle>What the admin is confirming</CardTitle>
            <CardDescription>
              This is the last step before live customer SMS automations are turned on.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Default provider, sender number, and webhook route are correct.</p></div></article>
          <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>The internal compliance profile matches what the shop will register with the provider.</p></div></article>
          <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>The shop only enables the workflows it actually wants live.</p></div></article>
          <div className="ui-page-actions">
            <Link className={buttonClassName({ tone: "primary" })} href="/dashboard/settings/communications">
              Open automation settings
            </Link>
          </div>
        </CardContent>
      </Card>
    </CommunicationsOnboardingShell>
  );
}
