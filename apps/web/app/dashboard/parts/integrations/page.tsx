import Link from "next/link";
import { redirect } from "next/navigation";

import {
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
} from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";
import { getProcurementIntegrationsWorkspace } from "../../../../lib/procurement/providers/service";

type PartsIntegrationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PartsIntegrationsPage({ searchParams }: PartsIntegrationsPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/integrations", (searchParams ? await searchParams : {})));
}

export async function SupplyIntegrationsPageImpl() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getProcurementIntegrationsWorkspace(
    context.supabase,
    context.companyId
  );
  const partstechAccount = workspace.partsTech.account;
  const repairLinkAccount = workspace.repairLink.account;
  const amazonBusinessAccount = workspace.amazonBusiness.account;

  return (
    <Page>
      <PageHeader
        eyebrow="Parts"
        title="Integrations"
        description="Manage provider-backed sourcing connections without changing the live supply flow."
        actions={
          <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/supply">
            Back to supply desk
          </Link>
        }
      />

      <div className="ui-summary-grid">
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>PartsTech status</CardEyebrow>
          <p className="ui-summary-value">
            {partstechAccount ? partstechAccount.status.replaceAll("_", " ") : "not configured"}
          </p>
          <p className="ui-summary-meta">Connection state for the first aftermarket provider.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>RepairLink status</CardEyebrow>
          <p className="ui-summary-value">
            {repairLinkAccount ? repairLinkAccount.status.replaceAll("_", " ") : "not configured"}
          </p>
          <p className="ui-summary-meta">VIN-linked OEM sourcing falls back to manual handoff when automation is not confirmed.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Amazon Business status</CardEyebrow>
          <p className="ui-summary-value">
            {amazonBusinessAccount ? amazonBusinessAccount.status.replaceAll("_", " ") : "not configured"}
          </p>
          <p className="ui-summary-meta">Supply-oriented sourcing falls back to manual capture or link-out when automation is unavailable.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Supplier mappings</CardEyebrow>
          <p className="ui-summary-value">
            {workspace.partsTech.mappings.length + workspace.repairLink.mappings.length}
          </p>
          <p className="ui-summary-meta">Mapped provider suppliers available for cart conversion.</p>
        </Card>
        <Card className="ui-summary-card" padding="compact">
          <CardEyebrow>Attention items</CardEyebrow>
          <p className="ui-summary-value">{workspace.attentionItems.length}</p>
          <p className="ui-summary-meta">Items that still require manual review or fallback handling.</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Aftermarket</CardEyebrow>
            <CardTitle>PartsTech</CardTitle>
            <CardDescription>
              Credentials, supplier mappings, and fallback behavior for aftermarket sourcing.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <article className="ui-list-item">
            <div>
              <p className="ui-card__eyebrow">
                {partstechAccount?.displayName ?? "PartsTech account not configured"}
              </p>
              <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                PartsTech integration
              </h3>
              <p className="ui-card__description" style={{ marginBottom: 0 }}>
                The provider boundary is ready, but any unconfirmed API behavior falls back to
                manual capture or manual ordering instead of guessing unsupported endpoints.
              </p>
            </div>
            <div className="ui-page-actions">
              {partstechAccount ? <StatusBadge status={partstechAccount.status} /> : null}
              <Link
                className={buttonClassName({ size: "sm", tone: "secondary" })}
                href="/dashboard/supply/integrations/partstech"
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
            <CardEyebrow>OEM</CardEyebrow>
            <CardTitle>RepairLink</CardTitle>
            <CardDescription>
              VIN-linked OEM sourcing with dealer mappings, manual quote capture, and manual-order fallback.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <article className="ui-list-item">
            <div>
              <p className="ui-card__eyebrow">
                {repairLinkAccount?.displayName ?? "RepairLink account not configured"}
              </p>
              <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                RepairLink integration
              </h3>
              <p className="ui-card__description" style={{ marginBottom: 0 }}>
                VIN-gated OEM sourcing stays inside the live supply flow. Any unconfirmed
                provider automation falls back to manual quote capture or manual order handoff.
              </p>
            </div>
            <div className="ui-page-actions">
              {repairLinkAccount ? <StatusBadge status={repairLinkAccount.status} /> : null}
              <Link
                className={buttonClassName({ size: "sm", tone: "secondary" })}
                href="/dashboard/supply/integrations/repairlink"
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
            <CardEyebrow>Supplies</CardEyebrow>
            <CardTitle>Amazon Business</CardTitle>
            <CardDescription>
              Supply-oriented purchasing for oils, shop rags, and non-core consumables, tracked
              inside internal procurement records with graceful manual fallback.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <article className="ui-list-item">
            <div>
              <p className="ui-card__eyebrow">
                {amazonBusinessAccount?.displayName ?? "Amazon Business account not configured"}
              </p>
              <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                Amazon Business integration
              </h3>
              <p className="ui-card__description" style={{ marginBottom: 0 }}>
                Supply search, quote provenance, supplier-cart conversion, and provider-order
                tracking are supported. Unsupported behavior stays in explicit manual fallback.
              </p>
            </div>
            <div className="ui-page-actions">
              {amazonBusinessAccount ? <StatusBadge status={amazonBusinessAccount.status} /> : null}
              <Link
                className={buttonClassName({ size: "sm", tone: "secondary" })}
                href="/dashboard/supply/integrations/amazon-business"
              >
                Open settings
              </Link>
            </div>
          </article>
        </CardContent>
      </Card>

      {workspace.attentionItems.length ? (
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Attention</CardEyebrow>
              <CardTitle>Provider fallback queue</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <div className="ui-list">
              {workspace.attentionItems.map((item) => (
                <article key={item} className="ui-list-item">
                  <div>
                    <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                      {item}
                    </h3>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          eyebrow="No attention items"
          title="Provider setup looks stable"
          description="You can keep sourcing through the regular supply flow and fall back to manual capture when provider automation is unavailable."
        />
      )}
    </Page>
  );
}
