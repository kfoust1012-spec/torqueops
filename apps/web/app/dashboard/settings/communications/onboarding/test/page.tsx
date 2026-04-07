import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { smsProviderPhoneSchema } from "@mobile-mechanic/validation";

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
  Form,
  FormField,
  Input,
  SubmitButton,
  Textarea,
  buttonClassName
} from "../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../lib/company-context";
import { getCommunicationsDashboardWorkspace } from "../../../../../../lib/communications/readiness";
import {
  buildSmsProviderTestMessageText,
  sendSmsProviderTestMessage
} from "../../../../../../lib/communications/sms-providers/service";

import { CommunicationsOnboardingShell } from "../_shared";

type CommunicationsOnboardingTestPageProps = {
  searchParams?: Promise<{
    feedback?: string | string[];
  }>;
};

const testFeedback = {
  forbidden: {
    body: "Only company owners and admins can send SMS provider test messages.",
    title: "Test send is restricted",
    tone: "danger"
  },
  invalid_phone: {
    body: "Enter the test phone number in E.164 format, for example +15125550123.",
    title: "Test number is invalid",
    tone: "danger"
  },
  provider_not_ready: {
    body: "Connect and verify the default SMS provider before sending a test message.",
    title: "Provider is not ready",
    tone: "warning"
  },
  test_failed: {
    body: "The provider test message could not be sent. Recheck the provider settings and try again.",
    title: "Test send failed",
    tone: "danger"
  },
  test_sent: {
    body: "The test SMS was sent. Delivery readiness will unlock once the provider callback marks it delivered.",
    title: "Test send started",
    tone: "success"
  }
} as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFeedback(
  input: string | string[] | undefined
): (typeof testFeedback)[keyof typeof testFeedback] | null {
  const key = typeof input === "string" ? input : Array.isArray(input) ? input[0] : "";

  return key && key in testFeedback ? testFeedback[key as keyof typeof testFeedback] : null;
}

function buildFeedbackHref(feedback: keyof typeof testFeedback) {
  return `/dashboard/settings/communications/onboarding/test?feedback=${feedback}`;
}

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

export default async function CommunicationsOnboardingTestPage({
  searchParams
}: CommunicationsOnboardingTestPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const feedback = getFeedback(resolvedSearchParams.feedback);
  const workspace = await getCommunicationsDashboardWorkspace(
    context.supabase,
    context.companyId,
    context.currentUserId
  );
  const canSendTest = ["owner", "admin"].includes(context.membership.role);
  const defaultAccount = workspace.defaultAccount;
  const providerReady =
    defaultAccount?.status === "connected" && Boolean(defaultAccount.lastVerifiedAt);
  const testResult = workspace.lastProviderTestResult;
  const testMessagePreview = buildSmsProviderTestMessageText(context.company.name);

  async function sendTestAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });

    if (!["owner", "admin"].includes(actionContext.membership.role)) {
      redirect(buildFeedbackHref("forbidden"));
    }

    const actionWorkspace = await getCommunicationsDashboardWorkspace(
      actionContext.supabase,
      actionContext.companyId,
      actionContext.currentUserId
    );
    const phoneNumber = getString(formData, "phoneNumber");

    if (!smsProviderPhoneSchema.safeParse(phoneNumber).success) {
      redirect(buildFeedbackHref("invalid_phone"));
    }

    if (
      !actionWorkspace.defaultAccount ||
      actionWorkspace.defaultAccount.status !== "connected" ||
      !actionWorkspace.defaultAccount.lastVerifiedAt
    ) {
      redirect(buildFeedbackHref("provider_not_ready"));
    }

    try {
      await sendSmsProviderTestMessage(actionContext.supabase, {
        companyId: actionContext.companyId,
        companyName: actionContext.company.name,
        phoneNumber
      });
    } catch {
      redirect(buildFeedbackHref("test_failed"));
    }

    revalidatePath("/dashboard/settings/communications");
    revalidatePath("/dashboard/settings/communications/onboarding");
    revalidatePath("/dashboard/settings/communications/onboarding/test");
    revalidatePath("/dashboard/settings/communications/onboarding/review");
    redirect(buildFeedbackHref("test_sent"));
  }

  return (
    <CommunicationsOnboardingShell
      currentStep="test"
      description="Verify that outbound delivery and callbacks work before live automations are enabled."
      title="Run test delivery"
      workspace={workspace}
    >
      {feedback ? (
        <Callout tone={feedback.tone} title={feedback.title}>
          {feedback.body}
        </Callout>
      ) : null}

      {workspace.readiness.lastDeliveredSmsAt ? (
        <Callout tone="success" title="Delivered SMS has already been observed">
          The company has already recorded a delivered SMS on the default provider. Sending another provider test is optional.
        </Callout>
      ) : providerReady ? (
        <Callout tone="warning" title="One delivered test is still required">
          Send a test SMS to a real mobile number and wait for the provider callback to mark it delivered.
        </Callout>
      ) : (
        <Callout tone="danger" title="Provider verification comes first">
          Save the default provider credentials, sender number, and verify the connection before sending a test SMS.
        </Callout>
      )}

      {!canSendTest ? (
        <Callout tone="warning" title="Owner or admin required">
          Dispatchers can review the latest test result here, but only owners and admins can send test SMS messages.
        </Callout>
      ) : null}

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Send test SMS</CardEyebrow>
            <CardTitle>Use a real mobile number you can check</CardTitle>
            <CardDescription>
              The test message goes out through the current default provider and waits for its normal delivery callback.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <Form action={sendTestAction}>
            <fieldset
              disabled={!canSendTest || !providerReady}
              style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "1rem" }}
            >
              <FormField
                label="Current default provider"
                hint={defaultAccount ? `Sender number: ${defaultAccount.fromNumber}` : "Choose a default provider first."}
              >
                <Input
                  defaultValue={defaultAccount?.displayName ?? defaultAccount?.provider ?? ""}
                  readOnly
                />
              </FormField>
              <FormField
                label="Test mobile number"
                required
                hint="Use E.164 format, for example +15125550123."
              >
                <Input
                  defaultValue={testResult?.phoneNumber ?? ""}
                  name="phoneNumber"
                  placeholder="+15125550123"
                  required
                />
              </FormField>
              <FormField label="Message preview">
                <Textarea defaultValue={testMessagePreview} readOnly rows={3} />
              </FormField>
              <div className="ui-page-actions">
                <SubmitButton tone="primary">Send test SMS</SubmitButton>
                {defaultAccount ? (
                  <Link
                    className={buttonClassName({ tone: "secondary" })}
                    href={`/dashboard/settings/communications/${defaultAccount.provider}`}
                  >
                    Open provider settings
                  </Link>
                ) : null}
              </div>
            </fieldset>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Latest provider test</CardEyebrow>
            <CardTitle>Current delivery state</CardTitle>
            <CardDescription>
              This reflects the last test number and provider message ID stored on the default provider account.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          {testResult ? (
            <>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Status</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    Last test to {testResult.phoneNumber}
                  </p>
                </div>
                <Badge tone={getTestTone(testResult.status)}>
                  {testResult.status.replaceAll("_", " ")}
                </Badge>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Requested at</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {formatTimestamp(testResult.requestedAt)}
                  </p>
                </div>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Provider message ID</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {testResult.providerMessageId ?? "Not available"}
                  </p>
                </div>
              </article>
              <article className="ui-list-item">
                <div>
                  <p className="ui-card__eyebrow">Delivered at</p>
                  <p className="ui-card__description" style={{ marginBottom: 0 }}>
                    {formatTimestamp(testResult.deliveredAt)}
                  </p>
                </div>
              </article>
              {testResult.errorMessage ? (
                <Callout tone="danger" title="Latest provider error">
                  {testResult.errorMessage}
                </Callout>
              ) : null}
            </>
          ) : (
            <Callout tone="warning" title="No provider test has been run yet">
              Use the form above after the provider is verified. This page will track whether the callback reaches the platform and marks the test as delivered.
            </Callout>
          )}
        </CardContent>
      </Card>
    </CommunicationsOnboardingShell>
  );
}
