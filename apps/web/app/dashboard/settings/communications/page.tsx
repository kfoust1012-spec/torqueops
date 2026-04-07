import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { upsertCommunicationAutomationSettings } from "@mobile-mechanic/api-client";

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
  EmptyState,
  Form,
  Page,
  PageHeader,
  StatusBadge,
  buttonClassName
} from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import { getCommunicationsDashboardWorkspace } from "../../../../lib/communications/readiness";

type CommunicationsSettingsPageProps = {
  searchParams?: Promise<{
    feedback?: string | string[];
  }>;
};

const communicationsFeedback = {
  "automation-blocked-delivery": {
    body: "A delivered SMS has not been observed on the default provider yet. Send and deliver one SMS before turning on live automations.",
    title: "Live automation is still blocked",
    tone: "warning"
  },
  "automation-blocked-compliance": {
    body: "Complete the saved SMS compliance profile before turning on live automations.",
    title: "Compliance profile is incomplete",
    tone: "warning"
  },
  "automation-blocked-provider": {
    body: "Choose a default SMS provider and save its sender number before turning on live automations.",
    title: "Provider setup is incomplete",
    tone: "warning"
  },
  "automation-blocked-verification": {
    body: "Verify the default SMS provider from its settings page before turning on live automations.",
    title: "Provider verification is incomplete",
    tone: "warning"
  },
  "automation-forbidden": {
    body: "Only company owners and admins can change SMS automation activation settings.",
    title: "Automation settings are restricted",
    tone: "danger"
  },
  "automation-save-failed": {
    body: "The automation activation settings could not be saved. Try again after checking provider readiness.",
    title: "Automation settings failed",
    tone: "danger"
  },
  "automation-saved": {
    body: "The communication automation preferences were saved for this company.",
    title: "Automation settings saved",
    tone: "success"
  }
} as const;

function getFeedback(
  input: string | string[] | undefined
): (typeof communicationsFeedback)[keyof typeof communicationsFeedback] | null {
  const key = typeof input === "string" ? input : Array.isArray(input) ? input[0] : "";

  return key && key in communicationsFeedback
    ? communicationsFeedback[key as keyof typeof communicationsFeedback]
    : null;
}

function buildFeedbackHref(feedback: keyof typeof communicationsFeedback) {
  return `/dashboard/settings/communications?feedback=${feedback}`;
}

function getAutomationBlockFeedbackKey(workspace: Awaited<ReturnType<typeof getCommunicationsDashboardWorkspace>>) {
  if (!workspace.defaultAccount || !workspace.defaultAccount.fromNumber?.trim()) {
    return "automation-blocked-provider";
  }

  if (!workspace.readiness.isComplianceProfileComplete) {
    return "automation-blocked-compliance";
  }

  if (workspace.readiness.state === "verification_pending") {
    return "automation-blocked-verification";
  }

  return "automation-blocked-delivery";
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "1";
}

function getReadinessTone(state: string) {
  if (state === "ready_for_live") {
    return "success" as const;
  }

  if (state === "verification_pending" || state === "ready_for_test") {
    return "warning" as const;
  }

  return "danger" as const;
}

function getReadinessLabel(state: string) {
  switch (state) {
    case "ready_for_live":
      return "ready for live";
    case "ready_for_test":
      return "ready for test";
    case "verification_pending":
      return "verification pending";
    default:
      return "not ready";
  }
}

function getChecklistTone(status: string) {
  if (status === "complete") {
    return "success" as const;
  }

  if (status === "blocked") {
    return "warning" as const;
  }

  return "neutral" as const;
}

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

function formatAutomationCount(count: number) {
  if (!count) {
    return "off";
  }

  return count === 1 ? "1 enabled" : `${count} enabled`;
}

export default async function CommunicationsSettingsPage({
  searchParams
}: CommunicationsSettingsPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const feedback = getFeedback(resolvedSearchParams.feedback);
  const workspace = await getCommunicationsDashboardWorkspace(
    context.supabase,
    context.companyId,
    context.currentUserId
  );
  const twilioAccount = workspace.accounts.find((account) => account.provider === "twilio") ?? null;
  const telnyxAccount = workspace.accounts.find((account) => account.provider === "telnyx") ?? null;
  const canManageAutomations = ["owner", "admin"].includes(context.membership.role);
  const onboardingHref = "/dashboard/settings/communications/onboarding";
  const onboardingLabel = workspace.readiness.isReadyForLiveAutomation
    ? "Review onboarding"
    : "Start onboarding";

  async function saveAutomationSettingsAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });

    if (!["owner", "admin"].includes(actionContext.membership.role)) {
      redirect(buildFeedbackHref("automation-forbidden"));
    }

    const actionWorkspace = await getCommunicationsDashboardWorkspace(
      actionContext.supabase,
      actionContext.companyId,
      actionContext.currentUserId
    );
    const requestedSettings = {
      dispatchEnRouteSmsEnabled: getBoolean(formData, "dispatchEnRouteSmsEnabled"),
      dispatchRunningLateSmsEnabled: getBoolean(formData, "dispatchRunningLateSmsEnabled"),
      invoicePaymentReminderSmsEnabled: getBoolean(formData, "invoicePaymentReminderSmsEnabled")
    };
    const wantsLiveAutomation = Object.values(requestedSettings).some(Boolean);

    if (wantsLiveAutomation && !actionWorkspace.readiness.isReadyForLiveAutomation) {
      redirect(buildFeedbackHref(getAutomationBlockFeedbackKey(actionWorkspace)));
    }

    const result = await upsertCommunicationAutomationSettings(actionContext.supabase, {
      companyId: actionContext.companyId,
      updatedByUserId: actionContext.currentUserId,
      ...requestedSettings
    });

    if (result.error) {
      redirect(buildFeedbackHref("automation-save-failed"));
    }

    revalidatePath("/dashboard/settings/communications");
    redirect(buildFeedbackHref("automation-saved"));
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Settings"
        title="Communications"
        description="Manage supported customer SMS providers, onboarding readiness, and automation activation from one operating surface."
        actions={
          <>
            <Link className={buttonClassName({ tone: "primary" })} href={onboardingHref}>
              {onboardingLabel}
            </Link>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/settings">
              Back to settings
            </Link>
          </>
        }
      />

      {feedback ? (
        <Callout tone={feedback.tone} title={feedback.title}>
          {feedback.body}
        </Callout>
      ) : null}

      <Callout
        title={`SMS readiness: ${getReadinessLabel(workspace.readiness.state)}`}
        tone={getReadinessTone(workspace.readiness.state)}
      >
        {workspace.readiness.summary}
      </Callout>

      <div className="ui-summary-grid">
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Default SMS provider</CardEyebrow>
          <p className="ui-summary-value">{workspace.defaultAccount?.provider ?? "not configured"}</p>
          <p className="ui-summary-meta">Outgoing customer texts use the company default provider.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Readiness</CardEyebrow>
          <p className="ui-summary-value">{getReadinessLabel(workspace.readiness.state)}</p>
          <p className="ui-summary-meta">{workspace.readiness.summary}</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Last verified</CardEyebrow>
          <p className="ui-summary-value">{formatTimestamp(workspace.readiness.lastVerifiedAt)}</p>
          <p className="ui-summary-meta">Pulled from the current default provider account.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Live automations</CardEyebrow>
          <p className="ui-summary-value">
            {formatAutomationCount(workspace.readiness.enabledAutomationCount)}
          </p>
          <p className="ui-summary-meta">
            Saved activation flags for the default customer SMS workflows.
          </p>
        </Card>
      </div>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Readiness checklist</CardEyebrow>
                <CardTitle>Customer SMS onboarding state</CardTitle>
                <CardDescription>
                  Readiness now combines the saved compliance profile, real provider state, and delivered SMS proof instead of relying on a manual checklist alone.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              {workspace.readiness.checklist.map((item) => (
                <article className="ui-list-item" key={item.id}>
                  <div>
                    <p className="ui-card__eyebrow">{item.label}</p>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      {item.description}
                    </p>
                  </div>
                  <div className="ui-page-actions">
                    <Badge tone={getChecklistTone(item.status)}>{item.status.replaceAll("_", " ")}</Badge>
                    {item.href ? (
                      <Link
                        className={buttonClassName({ size: "sm", tone: "secondary" })}
                        href={item.href}
                      >
                        Fix
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Activation</CardEyebrow>
                <CardTitle>SMS automation preferences</CardTitle>
                <CardDescription>
                  Save which live SMS workflows this company wants enabled. Background processing now uses these settings to decide which customer SMS automations can run.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              {!canManageAutomations ? (
                <Callout tone="warning" title="Owner or admin required">
                  Dispatchers can review readiness here, but only owners and admins can change automation activation settings.
                </Callout>
              ) : null}

              {!workspace.readiness.isReadyForLiveAutomation ? (
                <Callout tone={getReadinessTone(workspace.readiness.state)} title="Live activation is gated">
                  {workspace.readiness.blockReason}
                </Callout>
              ) : null}

              <Form action={saveAutomationSettingsAction}>
                <fieldset
                  disabled={!canManageAutomations}
                  style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "1rem" }}
                >
                  <label className="ui-inline-input" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      defaultChecked={workspace.automationSettings.dispatchEnRouteSmsEnabled}
                      name="dispatchEnRouteSmsEnabled"
                      type="checkbox"
                      value="1"
                    />
                    Enable “technician on the way” SMS
                  </label>
                  <label className="ui-inline-input" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      defaultChecked={workspace.automationSettings.dispatchRunningLateSmsEnabled}
                      name="dispatchRunningLateSmsEnabled"
                      type="checkbox"
                      value="1"
                    />
                    Enable “running late” SMS
                  </label>
                  <label className="ui-inline-input" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      defaultChecked={
                        workspace.automationSettings.invoicePaymentReminderSmsEnabled
                      }
                      name="invoicePaymentReminderSmsEnabled"
                      type="checkbox"
                      value="1"
                    />
                    Enable invoice payment reminder SMS
                  </label>
                  <div className="ui-page-actions">
                    <button className={buttonClassName({ tone: "primary" })} type="submit">
                      Save automation settings
                    </button>
                  </div>
                </fieldset>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div style={{ display: "grid", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Supported now</CardEyebrow>
                <CardTitle>Twilio</CardTitle>
                <CardDescription>
                  Connect a Twilio account, set the sender number, and verify status callbacks for customer SMS delivery.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">
                    {twilioAccount?.displayName ?? "Twilio account not configured"}
                  </p>
                  <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                    Twilio customer messaging
                  </h3>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    Use a provider-backed business number for automated appointment, dispatch, and payment texts.
                  </p>
                </div>
                <div className="ui-page-actions">
                  {twilioAccount ? <StatusBadge status={twilioAccount.status} /> : null}
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href="/dashboard/settings/communications/twilio"
                  >
                    Open settings
                  </Link>
                </div>
              </article>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Supported now</CardEyebrow>
                <CardTitle>Telnyx</CardTitle>
                <CardDescription>
                  Connect a Telnyx account, store the signing key, and reconcile customer SMS delivery through signed webhooks.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">
                    {telnyxAccount?.displayName ?? "Telnyx account not configured"}
                  </p>
                  <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                    Telnyx customer messaging
                  </h3>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    Use a company-owned Telnyx account when a shop prefers that transport over Twilio for automated dispatch and invoice texts.
                  </p>
                </div>
                <div className="ui-page-actions">
                  {telnyxAccount ? <StatusBadge status={telnyxAccount.status} /> : null}
                  <Link
                    className={buttonClassName({ size: "sm", tone: "secondary" })}
                    href="/dashboard/settings/communications/telnyx"
                  >
                    Open settings
                  </Link>
                </div>
              </article>
            </CardContent>
          </Card>
        </div>
      </div>

      {!workspace.accounts.length ? (
        <EmptyState
          eyebrow="No SMS providers configured"
          title="Customer texting still falls back to the legacy sender path"
          description="Connect Twilio or Telnyx here to move a shop onto company-owned SMS credentials and account-specific webhook verification."
        />
      ) : null}
    </Page>
  );
}
