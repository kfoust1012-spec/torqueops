import Link from "next/link";

import {
  Badge,
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
} from "../../../components/ui";
import { requireCompanyContext } from "../../../lib/company-context";

export default async function SettingsPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });

  return (
    <Page className="ops-hub" layout="command">
      <PageHeader
        actions={
          <div className="ops-hub__header-actions">
            <Link className={buttonClassName()} href="/dashboard/dispatch">
              Open dispatch
            </Link>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/supply">
              Open supply
            </Link>
          </div>
        }
        description="Keep configuration tied to real desks so dispatch, supply, communications, and migration controls stay close to the operating flow they affect."
        eyebrow="Operating system setup"
        status={
          <>
            <Badge tone="brand">{context.company.name}</Badge>
            <Badge tone="neutral">{context.company.timezone}</Badge>
          </>
        }
        title="Settings"
      />

      <section className="ops-hub__link-grid">
        <Link className="ops-hub__link-card ops-hub__link-card--feature" href="/dashboard/dispatch/settings">
          <strong>Dispatch control</strong>
          <span>Calendar defaults, day windows, and lane behavior for the live dispatch desk.</span>
        </Link>

        <Link className="ops-hub__link-card ops-hub__link-card--feature" href="/dashboard/supply/integrations">
          <strong>Supply providers</strong>
          <span>RepairLink, PartsTech, Amazon Business, and sourcing workflow readiness.</span>
        </Link>

        <Link className="ops-hub__link-card ops-hub__link-card--feature" href="/dashboard/settings/communications">
          <strong>Customer communications</strong>
          <span>SMS onboarding, sender numbers, provider setup, and delivery readiness.</span>
        </Link>

        <Link className="ops-hub__link-card ops-hub__link-card--feature" href="/dashboard/settings/data-imports">
          <strong>Migration control</strong>
          <span>Migration-source credentials and Shopmonkey cutover foundation.</span>
        </Link>

        <Link className="ops-hub__link-card ops-hub__link-card--feature" href="/dashboard/supply/inventory/locations">
          <strong>Inventory network</strong>
          <span>Stock locations, van inventory configuration, and transfer destinations.</span>
        </Link>

        <Link className="ops-hub__link-card ops-hub__link-card--feature" href="/dashboard/supply/suppliers">
          <strong>Supplier accounts</strong>
          <span>Supplier account management and sourcing desk configuration.</span>
        </Link>
      </section>

      <section className="ops-hub__link-grid">
        <Card padding="spacious" tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Setup principle</CardEyebrow>
              <CardTitle>Configuration follows the desks</CardTitle>
              <CardDescription>
                This pass keeps configuration shallow and grouped by workflow surface instead of hiding it behind a generic admin stack.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/dispatch">
              Return to dispatch
            </Link>
          </CardContent>
        </Card>
      </section>
    </Page>
  );
}
