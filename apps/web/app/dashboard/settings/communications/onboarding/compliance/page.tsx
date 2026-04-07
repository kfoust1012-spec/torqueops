import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { upsertCommunicationOnboardingProfile } from "@mobile-mechanic/api-client";

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
  Select,
  SubmitButton,
  Textarea
} from "../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../lib/company-context";
import {
  communicationOnboardingFieldLabels
} from "../../../../../../lib/communications/onboarding-profile";
import { getCommunicationsDashboardWorkspace } from "../../../../../../lib/communications/readiness";

import { CommunicationsOnboardingShell } from "../_shared";

type CommunicationsOnboardingCompliancePageProps = {
  searchParams?: Promise<{
    feedback?: string | string[];
  }>;
};

const complianceFeedback = {
  failed: {
    body: "The compliance profile could not be saved. Review the fields and try again.",
    title: "Compliance profile failed",
    tone: "danger"
  },
  forbidden: {
    body: "Only company owners and admins can save SMS compliance preparation details.",
    title: "Changes are restricted",
    tone: "danger"
  },
  saved: {
    body: "The SMS compliance preparation details were saved for this company.",
    title: "Compliance profile saved",
    tone: "success"
  }
} as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getPreferredSenderType(formData: FormData) {
  const value = getString(formData, "preferredSenderType");

  return value === "local_10dlc" || value === "toll_free" ? value : null;
}

function getFeedback(
  input: string | string[] | undefined
): (typeof complianceFeedback)[keyof typeof complianceFeedback] | null {
  const key = typeof input === "string" ? input : Array.isArray(input) ? input[0] : "";

  return key && key in complianceFeedback
    ? complianceFeedback[key as keyof typeof complianceFeedback]
    : null;
}

function buildFeedbackHref(feedback: keyof typeof complianceFeedback) {
  return `/dashboard/settings/communications/onboarding/compliance?feedback=${feedback}`;
}

export default async function CommunicationsOnboardingCompliancePage({
  searchParams
}: CommunicationsOnboardingCompliancePageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const feedback = getFeedback(resolvedSearchParams.feedback);
  const workspace = await getCommunicationsDashboardWorkspace(
    context.supabase,
    context.companyId,
    context.currentUserId
  );
  const canManageOnboarding = ["owner", "admin"].includes(context.membership.role);
  const completion = workspace.onboardingProfileSummary;
  const missingFieldLabels = completion.missingFields.map(
    (field) => communicationOnboardingFieldLabels[field]
  );

  async function saveComplianceAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });

    if (!["owner", "admin"].includes(actionContext.membership.role)) {
      redirect(buildFeedbackHref("forbidden"));
    }

    const result = await upsertCommunicationOnboardingProfile(actionContext.supabase, {
      companyId: actionContext.companyId,
      legalBusinessName: getString(formData, "legalBusinessName"),
      doingBusinessAs: getString(formData, "doingBusinessAs"),
      businessAddress: getString(formData, "businessAddress"),
      businessPhone: getString(formData, "businessPhone"),
      websiteUrl: getString(formData, "websiteUrl"),
      privacyPolicyUrl: getString(formData, "privacyPolicyUrl"),
      termsUrl: getString(formData, "termsUrl"),
      supportEmail: getString(formData, "supportEmail"),
      optInWorkflow: getString(formData, "optInWorkflow"),
      preferredSenderType: getPreferredSenderType(formData),
      campaignDescription: getString(formData, "campaignDescription"),
      sampleOnTheWayMessage: getString(formData, "sampleOnTheWayMessage"),
      sampleRunningLateMessage: getString(formData, "sampleRunningLateMessage"),
      sampleInvoiceReminderMessage: getString(formData, "sampleInvoiceReminderMessage"),
      helpReplyText: getString(formData, "helpReplyText"),
      stopReplyText: getString(formData, "stopReplyText"),
      updatedByUserId: actionContext.currentUserId
    });

    if (result.error) {
      redirect(buildFeedbackHref("failed"));
    }

    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/onboarding");
    revalidatePath("/dashboard/settings/communications/onboarding/compliance");
    revalidatePath("/dashboard/settings/communications/onboarding/review");
    redirect(buildFeedbackHref("saved"));
  }

  return (
    <CommunicationsOnboardingShell
      currentStep="compliance"
      description="Prepare the business and consent details the provider will require before customer SMS goes live."
      title="Prepare compliance"
      workspace={workspace}
    >
      {feedback ? (
        <Callout title={feedback.title} tone={feedback.tone}>
          {feedback.body}
        </Callout>
      ) : null}

      <Callout
        tone={completion.isComplete ? "success" : "warning"}
        title={`${completion.completeFieldCount} of ${completion.totalFieldCount} required details saved`}
      >
        {completion.isComplete
          ? "The shop has the core business identity, consent, and sample-message details needed for provider registration."
          : `Still missing: ${missingFieldLabels.slice(0, 4).join(", ")}${missingFieldLabels.length > 4 ? ", and more." : "."}`}
      </Callout>

      <Callout tone="warning" title="Provider-side requirement">
        Carrier registration, consent collection, and approved sender usage are still the shop’s responsibility.
      </Callout>

      {!canManageOnboarding ? (
        <Callout tone="warning" title="Owner or admin required">
          Dispatchers can review the saved compliance profile here, but only owners and admins can edit it.
        </Callout>
      ) : null}

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Company compliance profile</CardEyebrow>
            <CardTitle>Save the provider-prep details here</CardTitle>
            <CardDescription>
              This keeps the business identity, consent flow, and sample SMS copy inside the platform instead of relying on provider-portal memory.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <Form action={saveComplianceAction}>
            <fieldset
              disabled={!canManageOnboarding}
              style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "1rem" }}
            >
              <FormRow>
                <FormField label="Legal business name" required>
                  <Input
                    defaultValue={workspace.onboardingProfile?.legalBusinessName ?? ""}
                    name="legalBusinessName"
                  />
                </FormField>
                <FormField label="DBA / public shop name">
                  <Input
                    defaultValue={workspace.onboardingProfile?.doingBusinessAs ?? ""}
                    name="doingBusinessAs"
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="Business phone" required>
                  <Input
                    defaultValue={workspace.onboardingProfile?.businessPhone ?? ""}
                    name="businessPhone"
                  />
                </FormField>
                <FormField label="Support email" required>
                  <Input
                    defaultValue={workspace.onboardingProfile?.supportEmail ?? ""}
                    name="supportEmail"
                    type="email"
                  />
                </FormField>
              </FormRow>

              <FormField label="Business address" required>
                <Textarea
                  defaultValue={workspace.onboardingProfile?.businessAddress ?? ""}
                  name="businessAddress"
                  rows={3}
                />
              </FormField>

              <FormRow>
                <FormField label="Website URL" required>
                  <Input
                    defaultValue={workspace.onboardingProfile?.websiteUrl ?? ""}
                    name="websiteUrl"
                    placeholder="https://"
                    type="url"
                  />
                </FormField>
                <FormField label="Privacy policy URL" required>
                  <Input
                    defaultValue={workspace.onboardingProfile?.privacyPolicyUrl ?? ""}
                    name="privacyPolicyUrl"
                    placeholder="https://"
                    type="url"
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField
                  label="Terms URL"
                  hint="Optional, but useful when the provider asks for a public terms page."
                >
                  <Input
                    defaultValue={workspace.onboardingProfile?.termsUrl ?? ""}
                    name="termsUrl"
                    placeholder="https://"
                    type="url"
                  />
                </FormField>
                <FormField label="Preferred sender type" required>
                  <Select
                    defaultValue={workspace.onboardingProfile?.preferredSenderType ?? ""}
                    name="preferredSenderType"
                  >
                    <option value="">Select a sender type</option>
                    <option value="local_10dlc">Local 10DLC</option>
                    <option value="toll_free">Toll-free</option>
                  </Select>
                </FormField>
              </FormRow>

              <FormField
                label="Opt-in workflow"
                required
                hint="Describe how customers consent to receive service texts."
              >
                <Textarea
                  defaultValue={workspace.onboardingProfile?.optInWorkflow ?? ""}
                  name="optInWorkflow"
                  rows={4}
                />
              </FormField>

              <FormField
                label="Campaign description"
                required
                hint="Explain which messages this shop sends and when customers should expect them."
              >
                <Textarea
                  defaultValue={workspace.onboardingProfile?.campaignDescription ?? ""}
                  name="campaignDescription"
                  rows={4}
                />
              </FormField>

              <FormRow columns={1}>
                <FormField label="Sample on-the-way SMS" required>
                  <Textarea
                    defaultValue={workspace.onboardingProfile?.sampleOnTheWayMessage ?? ""}
                    name="sampleOnTheWayMessage"
                    rows={3}
                  />
                </FormField>
                <FormField label="Sample running-late SMS" required>
                  <Textarea
                    defaultValue={workspace.onboardingProfile?.sampleRunningLateMessage ?? ""}
                    name="sampleRunningLateMessage"
                    rows={3}
                  />
                </FormField>
                <FormField label="Sample invoice reminder SMS" required>
                  <Textarea
                    defaultValue={workspace.onboardingProfile?.sampleInvoiceReminderMessage ?? ""}
                    name="sampleInvoiceReminderMessage"
                    rows={3}
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="STOP reply text" required>
                  <Textarea
                    defaultValue={workspace.onboardingProfile?.stopReplyText ?? ""}
                    name="stopReplyText"
                    rows={3}
                  />
                </FormField>
                <FormField label="HELP reply text" required>
                  <Textarea
                    defaultValue={workspace.onboardingProfile?.helpReplyText ?? ""}
                    name="helpReplyText"
                    rows={3}
                  />
                </FormField>
              </FormRow>

              <div className="ui-page-actions">
                <SubmitButton tone="primary">Save compliance profile</SubmitButton>
              </div>
            </fieldset>
          </Form>
        </CardContent>
      </Card>
    </CommunicationsOnboardingShell>
  );
}
