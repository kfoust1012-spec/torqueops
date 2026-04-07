import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  buttonClassName
} from "../../../../../components/ui";
import { requireCompanyContext } from "../../../../../lib/company-context";
import {
  buildSmsOnboardingSteps,
  getSmsOnboardingPrimaryAction
} from "../../../../../lib/communications/onboarding";
import { getCommunicationsDashboardWorkspace } from "../../../../../lib/communications/readiness";

import { CommunicationsOnboardingShell } from "./_shared";

export default async function CommunicationsOnboardingPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getCommunicationsDashboardWorkspace(
    context.supabase,
    context.companyId,
    context.currentUserId
  );
  const steps = buildSmsOnboardingSteps({
    defaultAccount: workspace.defaultAccount,
    onboardingProfileSummary: workspace.onboardingProfileSummary,
    readiness: workspace.readiness
  });
  const primaryAction = getSmsOnboardingPrimaryAction({
    defaultAccount: workspace.defaultAccount,
    onboardingProfileSummary: workspace.onboardingProfileSummary,
    readiness: workspace.readiness
  });

  return (
    <CommunicationsOnboardingShell
      currentStep="provider"
      description="Guide a new company from no SMS provider to safe live automation."
      title="Customer SMS onboarding"
      workspace={workspace}
    >
      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Overview</CardEyebrow>
            <CardTitle>What a new company will do</CardTitle>
            <CardDescription>
              This guided flow turns the current provider settings into a clear onboarding path for self-serve customers.
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
              <Link
                className={buttonClassName({ size: "sm", tone: "secondary" })}
                href={step.href}
              >
                Open step
              </Link>
            </article>
          ))}
          <div className="ui-page-actions">
            <Link className={buttonClassName({ tone: "primary" })} href={primaryAction.href}>
              {primaryAction.label}
            </Link>
          </div>
        </CardContent>
      </Card>
    </CommunicationsOnboardingShell>
  );
}
