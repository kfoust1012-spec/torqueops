import {
  getEstimateByJobId,
  getCustomerById,
  getInvoiceByJobId,
  getJobById,
  getVehicleById,
  listJobCommunications,
  listAssignableTechniciansByCompany,
  listAddressesByCustomer,
  listCustomersByCompany,
  listProfilesByIds,
  listVehiclesByCustomer,
  updateJob
} from "@mobile-mechanic/api-client";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isTechnicianActiveFieldJobStatus } from "@mobile-mechanic/core";

import { listVehicleCarfaxSummaryMapForVehicles } from "../../../../../lib/carfax/service";
import { requireCompanyContext } from "../../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../../lib/dashboard/route-alias";
import {
  getVisitPromiseSummary,
  getVisitReadinessSummary,
  getVisitTrustSummary
} from "../../../../../lib/jobs/operational-health";
import {
  buildServiceSiteThreadSummary,
  derivePromiseConfidenceSnapshot,
  deriveReleaseRunwayState,
  deriveVisitRouteConfidenceSnapshot,
  hasServiceSitePlaybook
} from "../../../../../lib/service-thread/continuity";
import {
  buildVisitReturnThreadHref,
  normalizeVisitReturnTo,
  buildVisitEditHref
} from "../../../../../lib/visits/workspace";
import { sendTechnicianJobPushNotification } from "../../../../../lib/mobile-push-notifications";
import { JobForm } from "../../_components/job-form";

type EditJobPageProps = {
  params: Promise<{
    jobId: string;
  }>;
  searchParams?: Promise<{
    customerId?: string | string[];
    returnLabel?: string | string[];
    returnScope?: string | string[];
    returnTo?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string): string | null {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

export async function VisitEditPageImpl({ params, searchParams }: EditJobPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedCustomerId = getSearchParam(resolvedSearchParams.customerId).trim();
  const returnLabel = getSearchParam(resolvedSearchParams.returnLabel).trim();
  const returnScope = getSearchParam(resolvedSearchParams.returnScope).trim();
  const returnTo = normalizeVisitReturnTo(getSearchParam(resolvedSearchParams.returnTo));
  const visitLinkOptions = { returnLabel, returnScope, returnTo };
  const visitThreadHref = buildVisitReturnThreadHref(jobId, returnScope, visitLinkOptions);

  const [jobResult, customersResult, techniciansResult] = await Promise.all([
    getJobById(context.supabase, jobId),
    listCustomersByCompany(context.supabase, context.companyId, { includeInactive: true }),
    listAssignableTechniciansByCompany(context.supabase, context.companyId)
  ]);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== context.companyId) {
    notFound();
  }

  if (customersResult.error) {
    throw customersResult.error;
  }

  if (techniciansResult.error) {
    throw techniciansResult.error;
  }

  const currentJob = jobResult.data;

  if (!currentJob.isActive) {
    redirect(visitThreadHref);
  }

  const assignedProfilesResult = currentJob.assignedTechnicianUserId
    ? await listProfilesByIds(context.supabase, [currentJob.assignedTechnicianUserId])
    : { data: [], error: null };

  if (assignedProfilesResult.error) {
    throw assignedProfilesResult.error;
  }

  const customers = customersResult.data ?? [];
  const selectedCustomer =
    customers.find((customer) => customer.id === requestedCustomerId) ??
    customers.find((customer) => customer.id === currentJob.customerId) ??
    customers[0];

  if (!selectedCustomer) {
    notFound();
  }

  const [vehiclesResult, serviceSitesResult] = await Promise.all([
    listVehiclesByCustomer(context.supabase, selectedCustomer.id),
    listAddressesByCustomer(context.supabase, selectedCustomer.id)
  ]);

  if (vehiclesResult.error) {
    throw vehiclesResult.error;
  }

  if (serviceSitesResult.error) {
    throw serviceSitesResult.error;
  }

  const vehicles = (vehiclesResult.data ?? []).filter((vehicle) => {
    if (selectedCustomer.id === currentJob.customerId) {
      return vehicle.isActive || vehicle.id === currentJob.vehicleId;
    }

    return vehicle.isActive;
  });
  const carfaxSummariesByVehicleId = await listVehicleCarfaxSummaryMapForVehicles(
    context.supabase,
    vehicles.map((vehicle) => ({
      id: vehicle.id,
      vin: vehicle.vin
    }))
  );
  const vehiclesWithCarfax = vehicles.map((vehicle) => ({
    ...vehicle,
    carfaxSummary: carfaxSummariesByVehicleId.get(vehicle.id) ?? null
  }));
  const serviceSites = (serviceSitesResult.data ?? []).filter(
    (serviceSite) =>
      selectedCustomer.id === currentJob.customerId ? serviceSite.isActive || serviceSite.id === currentJob.serviceSiteId : serviceSite.isActive
  );
  const [estimateResult, invoiceResult, communicationsResult] = await Promise.all([
    getEstimateByJobId(context.supabase, jobId),
    getInvoiceByJobId(context.supabase, jobId),
    listJobCommunications(context.supabase, jobId, { limit: 10 })
  ]);

  if (estimateResult.error) {
    throw estimateResult.error;
  }

  if (invoiceResult.error) {
    throw invoiceResult.error;
  }

  if (communicationsResult.error) {
    throw communicationsResult.error;
  }

  const continuityCommunications = (communicationsResult.data ?? []).map((entry) => ({
    communicationType: entry.communicationType,
    createdAt: entry.createdAt
  }));
  const selectedServiceSite =
    serviceSites.find((serviceSite) => serviceSite.id === currentJob.serviceSiteId) ?? null;
  const serviceSiteThreadSummary = buildServiceSiteThreadSummary({
    activeVisitCount:
      currentJob.status === "scheduled" || isTechnicianActiveFieldJobStatus(currentJob.status) ? 1 : 0,
    commercialAccountMode:
      selectedCustomer.relationshipType === "fleet_account" ? "fleet_account" : "retail_customer",
    linkedAssetCount: vehiclesWithCarfax.length,
    linkedVisitCount: 1,
    site: selectedServiceSite
  });
  const promiseSummary = getVisitPromiseSummary({
    communications: continuityCommunications,
    job: currentJob
  });
  const readinessSummary = getVisitReadinessSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job: currentJob
  });
  const releaseRunwayState = deriveReleaseRunwayState({
    estimateStatus: estimateResult.data?.status ?? null,
    hasBlockingIssues: false,
    hasOwner: Boolean(currentJob.assignedTechnicianUserId),
    hasPromise: Boolean(currentJob.arrivalWindowStartAt ?? currentJob.scheduledStartAt),
    readinessReadyCount: readinessSummary.readyCount,
    readinessTotalCount: readinessSummary.totalCount,
    visitStatus: currentJob.status
  });
  const trustSummary = getVisitTrustSummary({
    communications: continuityCommunications,
    estimate: estimateResult.data,
    invoice: invoiceResult.data,
    job: currentJob
  });
  const promiseConfidence = derivePromiseConfidenceSnapshot({
    hasServiceSitePlaybook: hasServiceSitePlaybook(selectedServiceSite),
    hasSupplyRisk: false,
    promiseSummary,
    readinessSummary,
    releaseRunwayState,
    trustSummary
  });
  const routeConfidence = deriveVisitRouteConfidenceSnapshot({
    assignedTechnicianUserId: currentJob.assignedTechnicianUserId,
    hasServiceSitePlaybook: hasServiceSitePlaybook(selectedServiceSite),
    hasSupplyRisk: false,
    promiseConfidencePercent: promiseConfidence.confidencePercent,
    visitStatus: currentJob.status
  });
  const customerThreadHref = buildCustomerWorkspaceHref(selectedCustomer.id);
  const serviceSiteThreadHref = buildCustomerWorkspaceHref(selectedCustomer.id, { tab: "addresses" });
  const assignedProfile = assignedProfilesResult.data?.[0] ?? null;
  const technicianOptions =
    currentJob.assignedTechnicianUserId &&
    !(techniciansResult.data ?? []).some(
      (technician) => technician.userId === currentJob.assignedTechnicianUserId
    )
      ? [
          {
            userId: currentJob.assignedTechnicianUserId,
            displayName: `${
              assignedProfile?.full_name ??
              assignedProfile?.email ??
              currentJob.assignedTechnicianUserId
            } (inactive)`,
            email: assignedProfile?.email ?? null,
            role: "technician" as const
          },
          ...(techniciansResult.data ?? [])
        ]
      : (techniciansResult.data ?? []);

  async function updateJobAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const customerId = getString(formData, "customerId");
    const vehicleId = getString(formData, "vehicleId");
    const serviceSiteId = getNullableString(formData, "serviceSiteId");
    const [customerResult, vehicleResult, serviceSiteResult] = await Promise.all([
      getCustomerById(actionContext.supabase, customerId),
      getVehicleById(actionContext.supabase, vehicleId),
      serviceSiteId
        ? actionContext.supabase
            .from("customer_addresses")
            .select("*")
            .eq("id", serviceSiteId)
            .single()
        : Promise.resolve({ data: null, error: new Error("Select a service site before updating the visit.") })
    ]);

    if (
      customerResult.error ||
      !customerResult.data ||
      customerResult.data.companyId !== actionContext.companyId ||
      (!customerResult.data.isActive && customerId !== currentJob.customerId)
    ) {
      throw new Error("Select an active customer when changing the job customer.");
    }

    if (
      vehicleResult.error ||
      !vehicleResult.data ||
      vehicleResult.data.companyId !== actionContext.companyId ||
      vehicleResult.data.customerId !== customerId ||
      (!vehicleResult.data.isActive && vehicleId !== currentJob.vehicleId)
    ) {
      throw new Error("Select an active vehicle for the chosen customer.");
    }

    if (
      serviceSiteResult.error ||
      !serviceSiteResult.data ||
      serviceSiteResult.data.company_id !== actionContext.companyId ||
      serviceSiteResult.data.customer_id !== customerId ||
      serviceSiteResult.data.is_active !== true
    ) {
      throw new Error("Select an active service site for the chosen customer.");
    }

    const result = await updateJob(actionContext.supabase, jobId, {
      customerId,
      vehicleId,
      serviceSiteId,
      title: getString(formData, "title"),
      description: getNullableString(formData, "description"),
      customerConcern: getNullableString(formData, "customerConcern"),
      internalSummary: getNullableString(formData, "internalSummary"),
      scheduledStartAt: getNullableString(formData, "scheduledStartAt"),
      scheduledEndAt: getNullableString(formData, "scheduledEndAt"),
      arrivalWindowStartAt: getNullableString(formData, "arrivalWindowStartAt"),
      arrivalWindowEndAt: getNullableString(formData, "arrivalWindowEndAt"),
      assignedTechnicianUserId: getNullableString(formData, "assignedTechnicianUserId"),
      priority: (getString(formData, "priority") || "normal") as "low" | "normal" | "high" | "urgent",
      source: (getString(formData, "source") || "office") as "office" | "phone" | "web",
      isActive: formData.get("isActive") === "on"
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Failed to update visit.");
    }

    await sendTechnicianJobPushNotification({
      companyId: actionContext.companyId,
      companyTimeZone: actionContext.company.timezone,
      nextJob: result.data,
      previousJob: currentJob
    }).catch(() => undefined);

    revalidatePath("/dashboard/visits");
    revalidatePath(buildVisitReturnThreadHref(jobId, returnScope));
    revalidatePath(buildVisitEditHref(jobId));
    redirect(visitThreadHref);
  }

  return (
    <section className="workspace-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Visits</p>
          <h1 className="page-title">Edit visit</h1>
          <p className="copy" style={{ marginBottom: 0 }}>
            Update schedule, assignment, and customer-linked visit details.
          </p>
        </div>
      </div>

      <div className="workspace-card inline-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Active service thread</p>
            <h2 className="section-title">Keep visit, customer, and site context attached while editing</h2>
          </div>
        </div>
        <div className="detail-grid">
          <div className="detail-item">
            <p className="detail-label">Promise confidence</p>
            <p className="detail-value">{promiseConfidence.label} · {promiseConfidence.confidencePercent}%</p>
          </div>
          <div className="detail-item">
            <p className="detail-label">
              {releaseRunwayState.state !== "placed" ? "Release runway" : "Route confidence"}
            </p>
            <p className="detail-value">
              {releaseRunwayState.state !== "placed"
                ? releaseRunwayState.label
                : `${routeConfidence.label} · ${routeConfidence.confidencePercent}%`}
            </p>
          </div>
          <div className="detail-item">
            <p className="detail-label">Site thread</p>
            <p className="detail-value">{serviceSiteThreadSummary.siteLabel}</p>
          </div>
          <div className="detail-item">
            <p className="detail-label">Next thread move</p>
            <p className="detail-value">{trustSummary.nextActionLabel}</p>
          </div>
        </div>
        <p className="copy" style={{ marginBottom: 0 }}>
          {promiseConfidence.copy} {serviceSiteThreadSummary.copy}
        </p>
        <div className="header-actions">
          <Link className="button button-link" href={visitThreadHref}>
            Open visit thread
          </Link>
          <Link className="button secondary-button button-link" href={customerThreadHref}>
            {selectedCustomer.relationshipType === "fleet_account" ? "Open account thread" : "Open customer thread"}
          </Link>
          <Link className="button secondary-button button-link" href={serviceSiteThreadHref}>
            Open site thread
          </Link>
        </div>
      </div>

      <div className="workspace-card inline-panel">
        <form className="filter-grid" method="get">
          {returnLabel ? <input name="returnLabel" type="hidden" value={returnLabel} /> : null}
          {returnScope ? <input name="returnScope" type="hidden" value={returnScope} /> : null}
          {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
          <label className="label">
            Customer
            <select className="input" defaultValue={selectedCustomer.id} name="customerId">
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="action-row align-end">
            <button className="button" type="submit">
              Load vehicles
            </button>
          </div>
        </form>
      </div>

      {vehicles.length && serviceSites.length ? (
        <JobForm
          action={updateJobAction}
          cancelHref={visitThreadHref}
          customer={selectedCustomer}
          serviceSites={serviceSites}
          technicians={technicianOptions}
          vehicles={vehiclesWithCarfax}
          initialValues={{
            ...currentJob,
            customerId: selectedCustomer.id,
            vehicleId:
              selectedCustomer.id === currentJob.customerId
                ? currentJob.vehicleId
                : (vehiclesWithCarfax[0]?.id ?? currentJob.vehicleId)
          }}
          submitLabel="Save visit"
        />
      ) : !vehicles.length ? (
        <div className="empty-state">
          <p className="eyebrow">Vehicles required</p>
          <h2 className="section-title">No vehicles for this customer</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            Select a different customer or add a vehicle before reassigning this visit.
          </p>
          <Link
            className="button button-link"
            href={buildCustomerWorkspaceHref(selectedCustomer.id, {
              newVehicle: true,
              tab: "vehicles"
            })}
          >
            Add customer vehicle
          </Link>
        </div>
      ) : (
        <div className="empty-state">
          <p className="eyebrow">Service locations required</p>
          <h2 className="section-title">No service locations for this customer</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            Add a service location before reassigning this visit.
          </p>
          <Link
            className="button button-link"
            href={buildCustomerWorkspaceHref(selectedCustomer.id, {
              newAddress: true,
              tab: "addresses"
            })}
          >
            Add service location
          </Link>
        </div>
      )}
    </section>
  );
}

export default VisitEditPageImpl;

