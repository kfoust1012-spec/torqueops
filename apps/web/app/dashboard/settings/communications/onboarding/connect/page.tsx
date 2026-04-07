import Link from "next/link";

import {
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

export default async function CommunicationsOnboardingConnectPage() {
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
      currentStep="connect"
      description="Save credentials, sender number, and verify the company SMS provider inside the app."
      title="Connect provider"
      workspace={workspace}
    >
      <div className="ui-page-grid ui-page-grid--halves">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Twilio fields</CardEyebrow>
              <CardTitle>What the admin will enter</CardTitle>
              <CardDescription>
                These fields are required on the Twilio settings page.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {twilioAccount ? <StatusBadge status={twilioAccount.status} /> : null}
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Display name</p></div></article>
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Sender number in E.164 format</p></div></article>
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Account SID</p></div></article>
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Auth token</p></div></article>
            <div className="ui-page-actions">
              <Link className={buttonClassName({ tone: "primary" })} href="/dashboard/settings/communications/twilio">
                Open Twilio settings
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Telnyx fields</CardEyebrow>
              <CardTitle>What the admin will enter</CardTitle>
              <CardDescription>
                These fields are required on the Telnyx settings page.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {telnyxAccount ? <StatusBadge status={telnyxAccount.status} /> : null}
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Display name</p></div></article>
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Sender number in E.164 format</p></div></article>
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>API key</p></div></article>
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Optional messaging profile ID</p></div></article>
            <article className="ui-list-item"><div><p className="ui-card__description" style={{ marginBottom: 0 }}>Webhook signing public key</p></div></article>
            <div className="ui-page-actions">
              <Link className={buttonClassName({ tone: "primary" })} href="/dashboard/settings/communications/telnyx">
                Open Telnyx settings
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </CommunicationsOnboardingShell>
  );
}
