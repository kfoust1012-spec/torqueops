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
  StatusBadge,
  buttonClassName
} from "../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../lib/company-context";
import { getCommunicationsDashboardWorkspace } from "../../../../../../lib/communications/readiness";

import { CommunicationsOnboardingShell } from "../_shared";

export default async function CommunicationsOnboardingProviderPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getCommunicationsDashboardWorkspace(
    context.supabase,
    context.companyId,
    context.currentUserId
  );
  const twilioAccount = workspace.accounts.find((account) => account.provider === "twilio") ?? null;
  const telnyxAccount = workspace.accounts.find((account) => account.provider === "telnyx") ?? null;

  return (
    <CommunicationsOnboardingShell
      currentStep="provider"
      description="Choose the supported SMS transport this company will use for automated customer texting."
      title="Choose provider"
      workspace={workspace}
    >
      <Callout tone="warning" title="Supported providers only">
        Automated customer SMS is supported with Twilio and Telnyx. Google Voice is intentionally excluded.
      </Callout>

      <div className="ui-page-grid ui-page-grid--halves">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Recommended default</CardEyebrow>
              <CardTitle>Twilio</CardTitle>
              <CardDescription>
                Fastest path if the company wants the most straightforward setup in this app.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {twilioAccount ? <StatusBadge status={twilioAccount.status} /> : null}
            <p className="ui-card__description">
              Use Twilio for company-owned customer SMS, delivery callbacks, and automation.
            </p>
            <div className="ui-page-actions">
              <Link
                className={buttonClassName({ tone: "primary" })}
                href="/dashboard/settings/communications/twilio"
              >
                Open Twilio settings
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Alternative</CardEyebrow>
              <CardTitle>Telnyx</CardTitle>
              <CardDescription>
                Good fit when the company already uses Telnyx or prefers that provider relationship.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {telnyxAccount ? <StatusBadge status={telnyxAccount.status} /> : null}
            <p className="ui-card__description">
              Use Telnyx for company-owned SMS and signed delivery webhook verification.
            </p>
            <div className="ui-page-actions">
              <Link
                className={buttonClassName({ tone: "primary" })}
                href="/dashboard/settings/communications/telnyx"
              >
                Open Telnyx settings
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </CommunicationsOnboardingShell>
  );
}
