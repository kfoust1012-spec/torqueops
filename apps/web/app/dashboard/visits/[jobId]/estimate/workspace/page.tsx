import {
  getEstimateByJobId as getEstimateByVisitId,
  getJobById as getVisitById,
  getVehicleById
} from "@mobile-mechanic/api-client";
import { getVehicleDisplayName } from "@mobile-mechanic/core";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  Badge,
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
  Page,
  PageHeader,
  SubmitButton,
  Textarea,
  buttonClassName
} from "../../../../../../components/ui";
import { requireCompanyContext } from "../../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../../lib/dashboard/route-alias";
import {
  buildDefaultEstimateWorkspaceSeed,
  createEstimateWorkspace,
  getEstimateWorkspaceByJobId
} from "../../../../../../lib/estimates/workspace/service";
import {
  buildVisitEstimateHref,
  buildVisitEstimateThreadHref,
  normalizeVisitReturnTo,
  buildVisitReturnThreadHref,
  buildVisitPartsHref
} from "../../../../../../lib/visits/workspace";
import { EstimateWorkspaceShell } from "./_components/estimate-workspace-shell";

type EstimateWorkspacePageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams?: Promise<{
    autostart?: string | string[];
    returnLabel?: string | string[];
    returnScope?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value ? value : null;
}

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function VisitEstimateWorkspacePageImpl({
  params,
  searchParams
}: EstimateWorkspacePageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const shouldAutostart = getSearchParam(resolvedSearchParams.autostart) === "1";
  const returnLabel = getSearchParam(resolvedSearchParams.returnLabel);
  const returnScope = getSearchParam(resolvedSearchParams.returnScope);
  const returnTo = normalizeVisitReturnTo(getSearchParam(resolvedSearchParams.returnTo));
  const visitLinkOptions = { returnLabel, returnScope, returnTo };
  const visitThreadHref = returnScope || returnTo || returnLabel
    ? buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions)
    : buildVisitEstimateThreadHref(jobId);
  const [jobResult, estimateResult] = await Promise.all([
    getVisitById(context.supabase, jobId),
    getEstimateByVisitId(context.supabase, jobId)
  ]);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  if (estimateResult.error) {
    throw estimateResult.error;
  }

  if (estimateResult.data && estimateResult.data.status !== "draft") {
    redirect(buildVisitEstimateHref(jobId, visitLinkOptions));
  }

  const vehicleResult = await getVehicleById(context.supabase, jobResult.data.vehicleId);

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle could not be loaded.");
  }

  const vehicleLabel = getVehicleDisplayName({
    year: vehicleResult.data.year,
    make: vehicleResult.data.make,
    model: vehicleResult.data.model
  });
  const customerThreadHref = buildCustomerWorkspaceHref(jobResult.data.customerId);
  const siteThreadHref = buildCustomerWorkspaceHref(jobResult.data.customerId, { tab: "addresses" });
  const seed = buildDefaultEstimateWorkspaceSeed({
    jobId,
    jobTitle: jobResult.data.title,
    vehicleLabel
  });

  if (!estimateResult.data && shouldAutostart) {
    await createEstimateWorkspace(context.supabase, {
      companyId: context.companyId,
      createdByUserId: context.currentUserId,
      jobId,
      estimateNumber: seed.estimateNumber,
      title: seed.title,
      notes: null,
      terms: null
    });

    redirect(
      buildVisitEstimateHref(jobId, {
        ...visitLinkOptions,
        workspace: true
      })
    );
  }

  async function createWorkspaceAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const latestVisitResult = await getVisitById(actionContext.supabase, jobId);

    if (
      latestVisitResult.error ||
      !latestVisitResult.data ||
      latestVisitResult.data.companyId !== actionContext.companyId
    ) {
      throw latestVisitResult.error ?? new Error("Visit could not be loaded.");
    }

    const latestVehicleResult = await getVehicleById(actionContext.supabase, latestVisitResult.data.vehicleId);

    if (latestVehicleResult.error || !latestVehicleResult.data) {
      throw latestVehicleResult.error ?? new Error("Vehicle could not be loaded.");
    }

    const latestSeed = buildDefaultEstimateWorkspaceSeed({
      jobId,
      jobTitle: latestVisitResult.data.title,
      vehicleLabel: getVehicleDisplayName({
        year: latestVehicleResult.data.year,
        make: latestVehicleResult.data.make,
        model: latestVehicleResult.data.model
      })
    });

    await createEstimateWorkspace(actionContext.supabase, {
      companyId: actionContext.companyId,
      createdByUserId: actionContext.currentUserId,
      jobId,
      estimateNumber: getFormString(formData, "estimateNumber") || latestSeed.estimateNumber,
      title: getFormString(formData, "title") || latestSeed.title,
      notes: getNullableFormString(formData, "notes"),
      terms: null
    });

    revalidatePath(`/dashboard/visits/${jobId}`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate`);
    revalidatePath(`/dashboard/visits/${jobId}/estimate/workspace`);
    redirect(
      buildVisitEstimateHref(jobId, {
        ...visitLinkOptions,
        workspace: true
      })
    );
  }

  if (!estimateResult.data) {
    return (
      <Page className="estimate-workspace-page" layout="command">
        <PageHeader
          eyebrow="Estimate thread"
          title="Start the estimate thread"
          description={`Create the draft estimate once, then keep labor, parts, totals, and notes on the same service thread.`}
          actions={
            <>
              <Link className={buttonClassName({ tone: "secondary" })} href={buildVisitPartsHref(jobId, visitLinkOptions)}>
                Source parts
              </Link>
              <Link className={buttonClassName({ tone: "tertiary" })} href={customerThreadHref}>
                Open customer thread
              </Link>
              <Link className={buttonClassName({ tone: "tertiary" })} href={siteThreadHref}>
                Open site thread
              </Link>
              <Link className={buttonClassName({ tone: "tertiary" })} href={visitThreadHref}>
                Open visit thread
              </Link>
            </>
          }
          status={<Badge tone="brand">{vehicleLabel}</Badge>}
        />

        <div className="estimate-workspace-boot">
          <Card className="estimate-workspace-boot__hero" tone="raised">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>What this unlocks</CardEyebrow>
                <CardTitle>One estimating flow on the live service thread</CardTitle>
                <CardDescription>
                  The estimate file keeps labor selection, parts sourcing, live totals, and notes attached to the same visit, customer, and site thread.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent className="estimate-workspace-boot__summary-grid">
              <div className="estimate-workspace-boot__summary-item">
                <span className="estimate-workspace__hero-label">Vehicle</span>
                <strong>{vehicleLabel}</strong>
                <span>{vehicleResult.data.vin ?? "VIN not decoded yet"}</span>
              </div>
              <div className="estimate-workspace-boot__summary-item">
                <span className="estimate-workspace__hero-label">Estimate seed</span>
                <strong>{seed.estimateNumber}</strong>
                <span>{seed.title}</span>
              </div>
              <div className="estimate-workspace-boot__summary-item">
                <span className="estimate-workspace__hero-label">Workflow</span>
                <strong>Visit thread + estimate file</strong>
                <span>Supplier comparison and release readiness stay attached to the visit.</span>
              </div>
            </CardContent>
          </Card>

          <Card tone="subtle">
            <CardHeader>
              <CardHeaderContent>
                <CardEyebrow>Draft bootstrap</CardEyebrow>
                <CardTitle>Create the draft estimate thread</CardTitle>
                <CardDescription>
                  Keep the defaults for a fast start, or rename the draft before opening the estimate file.
                </CardDescription>
              </CardHeaderContent>
            </CardHeader>
            <CardContent>
              <Form action={createWorkspaceAction}>
                <FormRow>
                  <FormField label="Estimate number" required>
                    <Input defaultValue={seed.estimateNumber} name="estimateNumber" required />
                  </FormField>
                  <FormField label="Draft title" required>
                    <Input defaultValue={seed.title} name="title" required />
                  </FormField>
                </FormRow>
                <FormField
                  hint="Optional customer-facing or internal setup note. Pricing, terms, and totals stay editable inside the estimate file."
                  label="Opening note"
                >
                  <Textarea name="notes" placeholder="Optional note for the estimate draft." rows={4} />
                </FormField>
                <SubmitButton pendingLabel="Creating draft...">Open estimate thread</SubmitButton>
              </Form>
            </CardContent>
          </Card>
        </div>
      </Page>
    );
  }

  const workspace = await getEstimateWorkspaceByJobId(context.supabase, context.companyId, jobId);

  if (!workspace) {
    notFound();
  }

  return (
    <Page className="estimate-workspace-page" layout="command">
      <EstimateWorkspaceShell
        initialWorkspace={workspace}
        jobId={jobId}
        returnLabel={returnLabel}
        returnScope={returnScope}
        returnTo={returnTo}
        timeZone={context.company.timezone}
      />
    </Page>
  );
}

export default VisitEstimateWorkspacePageImpl;
