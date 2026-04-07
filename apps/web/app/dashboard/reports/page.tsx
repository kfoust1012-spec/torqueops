import {
  listEstimatesByCompany,
  listInvoicesByCompany,
  listJobsByCompany
} from "@mobile-mechanic/api-client";
import { formatCurrencyFromCents, getDispatchLocalDate, getSafeTimeZone } from "@mobile-mechanic/core";
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
import { toServerError } from "../../../lib/server-error";

export default async function ReportsPage() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const timeZone = getSafeTimeZone(context.company.timezone);
  const today = getDispatchLocalDate(new Date(), timeZone);

  const [jobsResult, estimatesResult, invoicesResult] = await Promise.all([
    listJobsByCompany(context.supabase, context.companyId, { includeInactive: true }),
    listEstimatesByCompany(context.supabase, context.companyId),
    listInvoicesByCompany(context.supabase, context.companyId)
  ]);

  if (jobsResult.error) {
    throw toServerError(jobsResult.error, "Reports could not load visits.");
  }

  if (estimatesResult.error) {
    throw toServerError(estimatesResult.error, "Reports could not load estimates.");
  }

  if (invoicesResult.error) {
    throw toServerError(invoicesResult.error, "Reports could not load invoices.");
  }

  const jobs = jobsResult.data ?? [];
  const estimates = estimatesResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const scheduledTodayCount = jobs.filter(
    (job) => job.scheduledStartAt && getDispatchLocalDate(job.scheduledStartAt, timeZone) === today
  ).length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  const acceptedEstimates = estimates.filter((estimate) => estimate.status === "accepted");
  const approvalRate = estimates.length
    ? Math.round((acceptedEstimates.length / estimates.length) * 100)
    : 0;
  const openBalance = invoices.reduce((total, invoice) => total + invoice.balanceDueCents, 0);
  const approvedRevenue = acceptedEstimates.reduce((total, estimate) => total + estimate.totalCents, 0);

  return (
    <Page className="ops-hub" layout="command">
      <PageHeader
        actions={
          <div className="ops-hub__header-actions">
            <Link className={buttonClassName()} href="/dashboard/visits">
              Open visits
            </Link>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/finance">
              Open finance
            </Link>
          </div>
        }
        description="Keep throughput, approval conversion, and revenue drag tied to the live operating desks instead of burying signal in passive reporting."
        eyebrow="Operating signal desk"
        status={
          <>
            <Badge tone="brand">{context.company.timezone}</Badge>
            <Badge tone="neutral">{today}</Badge>
          </>
        }
        title="Reports"
      />

      <section className="ops-hub__metrics" aria-label="Operational report metrics">
        <article className="ops-hub__metric">
          <p className="ops-hub__metric-label">Visits scheduled today</p>
          <strong className="ops-hub__metric-value">{scheduledTodayCount}</strong>
          <p className="ops-hub__metric-copy">Service threads expected to release or run on the current dispatch date.</p>
        </article>
        <article className="ops-hub__metric">
          <p className="ops-hub__metric-label">Closed visits</p>
          <strong className="ops-hub__metric-value">{completedCount}</strong>
          <p className="ops-hub__metric-copy">Completed visit threads already closed through the operating system.</p>
        </article>
        <article className="ops-hub__metric">
          <p className="ops-hub__metric-label">Approval conversion</p>
          <strong className="ops-hub__metric-value">{approvalRate}%</strong>
          <p className="ops-hub__metric-copy">Accepted estimates as a share of quoting demand entering the desk.</p>
        </article>
        <article className="ops-hub__metric">
          <p className="ops-hub__metric-label">Revenue still open</p>
          <strong className="ops-hub__metric-value">{formatCurrencyFromCents(openBalance)}</strong>
          <p className="ops-hub__metric-copy">Invoice balance still waiting on closeout and collections follow-through.</p>
        </article>
      </section>

      <section className="ops-hub__link-grid">
        <Card padding="spacious" tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Approval pipeline</CardEyebrow>
              <CardTitle>{formatCurrencyFromCents(approvedRevenue)}</CardTitle>
              <CardDescription>Accepted estimate value ready to become scheduled work, released visits, or billed closeout.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/visits?scope=awaiting_approval">
              Review approval flow
            </Link>
          </CardContent>
        </Card>

        <Card padding="spacious" tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Production load</CardEyebrow>
              <CardTitle>{jobs.filter((job) => job.isActive).length}</CardTitle>
              <CardDescription>Open service threads still moving through intake, dispatch, field work, supply, or billing.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/visits">
              Review production queue
            </Link>
          </CardContent>
        </Card>

        <Card padding="spacious" tone="raised">
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Collections drag</CardEyebrow>
              <CardTitle>{invoices.filter((invoice) => invoice.status === "partially_paid").length}</CardTitle>
              <CardDescription>Invoice threads with money in motion but closeout still unresolved.</CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/finance">
              Review closeout desk
            </Link>
          </CardContent>
        </Card>
      </section>
    </Page>
  );
}
