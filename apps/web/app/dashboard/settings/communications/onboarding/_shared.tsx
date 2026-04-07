import type { ReactNode } from "react";
import Link from "next/link";

import type {
  SmsProviderAccount,
  SmsProviderLastTestResult
} from "@mobile-mechanic/types";
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
  buttonClassName
} from "../../../../../components/ui";
import type { CommunicationOnboardingProfileSummary } from "../../../../../lib/communications/onboarding-profile";
import type { CommunicationReadiness } from "../../../../../lib/communications/readiness";
import { buildSmsOnboardingSteps, type SmsOnboardingStepId } from "../../../../../lib/communications/onboarding";

type CommunicationsOnboardingWorkspace = {
  defaultAccount: SmsProviderAccount | null;
  lastProviderTestResult: SmsProviderLastTestResult | null;
  onboardingProfileSummary: CommunicationOnboardingProfileSummary;
  readiness: CommunicationReadiness;
};

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
    case "ready_for_live":
      return "success" as const;
    case "ready_for_test":
      return "warning" as const;
    case "verification_pending":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

function getTestStatusTone(result: SmsProviderLastTestResult | null) {
  if (!result) {
    return "neutral" as const;
  }

  switch (result.status) {
    case "delivered":
      return "success" as const;
    case "failed":
      return "danger" as const;
    default:
      return "warning" as const;
  }
}

function getTestStatusLabel(result: SmsProviderLastTestResult | null) {
  if (!result) {
    return "not run";
  }

  return result.status.replaceAll("_", " ");
}

export function CommunicationsOnboardingShell(props: {
  children: ReactNode;
  currentStep: SmsOnboardingStepId;
  description: string;
  title: string;
  workspace: CommunicationsOnboardingWorkspace;
}) {
  const steps = buildSmsOnboardingSteps({
    defaultAccount: props.workspace.defaultAccount,
    onboardingProfileSummary: props.workspace.onboardingProfileSummary,
    readiness: props.workspace.readiness
  });

  return (
    <Page>
      <PageHeader
        eyebrow="Communications onboarding"
        title={props.title}
        description={props.description}
        actions={
          <>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/settings/communications"
            >
              Back to communications
            </Link>
            <Link
              className={buttonClassName({ tone: "secondary" })}
              href="/dashboard/settings/communications/onboarding"
            >
              Overview
            </Link>
          </>
        }
      />

      <Callout
        tone={getReadinessTone(props.workspace.readiness.state)}
        title={`Current readiness: ${props.workspace.readiness.state.replaceAll("_", " ")}`}
      >
        {props.workspace.readiness.summary}
      </Callout>

      <div className="ui-page-grid ui-page-grid--sidebar">
        <div style={{ display: "grid", gap: "1.5rem" }}>{props.children}</div>

        <div style={{ display: "grid", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Onboarding flow</CardEyebrow>
                <CardTitle>Step tracker</CardTitle>
                <CardDescription>
                  Use these steps to move a new company from no provider to live customer SMS.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              {steps.map((step) => (
                <article className="ui-list-item" key={step.id}>
                  <div>
                    <p className="ui-card__eyebrow">{step.label}</p>
                    <p className="ui-card__description" style={{ marginBottom: 0 }}>
                      {step.description}
                    </p>
                  </div>
                  <div className="ui-page-actions">
                    {step.id === props.currentStep ? <Badge tone="brand">Current</Badge> : null}
                    <Badge tone={getStepTone(step.status)}>{step.status.replaceAll("_", " ")}</Badge>
                    <Link
                      className={buttonClassName({ size: "sm", tone: "secondary" })}
                      href={step.href}
                    >
                      Open
                    </Link>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Current company state</CardEyebrow>
                <CardTitle>SMS readiness summary</CardTitle>
                <CardDescription>
                  This reflects the actual provider account, verification state, and delivery history.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Default provider</p>
                  <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                    {props.workspace.defaultAccount?.displayName ??
                      props.workspace.defaultAccount?.provider ??
                      "Not configured"}
                  </h3>
                </div>
                {props.workspace.defaultAccount ? (
                  <Badge tone="brand">{props.workspace.defaultAccount.provider}</Badge>
                ) : null}
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Compliance profile</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {props.workspace.onboardingProfileSummary.completeFieldCount} of{" "}
                    {props.workspace.onboardingProfileSummary.totalFieldCount} required details saved
                  </p>
                </div>
                <Badge
                  tone={
                    props.workspace.onboardingProfileSummary.isComplete ? "success" : "warning"
                  }
                >
                  {props.workspace.onboardingProfileSummary.isComplete ? "complete" : "in progress"}
                </Badge>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Last verified</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {formatTimestamp(props.workspace.readiness.lastVerifiedAt)}
                  </p>
                </div>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Last provider test</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {props.workspace.lastProviderTestResult?.phoneNumber ?? "No test number saved"}
                  </p>
                </div>
                <Badge tone={getTestStatusTone(props.workspace.lastProviderTestResult)}>
                  {getTestStatusLabel(props.workspace.lastProviderTestResult)}
                </Badge>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Last delivered SMS</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {formatTimestamp(props.workspace.readiness.lastDeliveredSmsAt)}
                  </p>
                </div>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Enabled automations</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {props.workspace.readiness.enabledAutomationCount}
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
