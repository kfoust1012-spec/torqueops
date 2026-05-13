import Link from "next/link";
import { Badge, Page, PageHeader, buttonClassName } from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import { InvoiceBuilder } from "./invoice-builder";

export default async function InvoiceBuilderPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });

  return (
    <Page className="finance-view finance-view--invoice-builder" layout="command">
      <PageHeader
        description="Create a custom TorqueOps invoice for one-off software work, then print or save it as a PDF from the browser."
        eyebrow="Internal finance tool"
        status={
          <>
            <Badge tone="neutral">Owner-only workflow</Badge>
            <Badge tone="neutral">{context.company.timezone}</Badge>
          </>
        }
        title="Invoice builder"
      />

      <nav aria-label="Finance workspace navigation" className="finance-shell-nav">
        <div className="finance-shell-nav__row">
          <Link className={buttonClassName({ className: "finance-shell-nav__item", size: "sm", tone: "secondary" })} href="/dashboard/finance">
            Finance overview
          </Link>
          <Link className={buttonClassName({ className: "finance-shell-nav__item", size: "sm", tone: "secondary" })} href="/dashboard/finance/collections">
            Collections
          </Link>
          <Link className={buttonClassName({ className: "finance-shell-nav__item", size: "sm", tone: "primary" })} href="/dashboard/finance/invoice-builder">
            Invoice builder
          </Link>
        </div>
      </nav>

      <InvoiceBuilder />
    </Page>
  );
}
