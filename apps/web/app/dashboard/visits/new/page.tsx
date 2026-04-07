import {
  createJob,
  createJobNote,
  getCustomerById,
  getJobById,
  getVehicleById,
  listAddressesByCompany,
  listAssignableTechniciansByCompany,
  listCustomersByCompany,
  listVehiclesByCompany
} from "@mobile-mechanic/api-client";
import { getDispatchLocalDate } from "@mobile-mechanic/core";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EmptyState, Page, PageHeader, buttonClassName } from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import { buildCustomerWorkspaceHref } from "../../../../lib/customers/workspace";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";
import { getVisitWorkflowLabel, getVisitWorkflowState } from "../../../../lib/jobs/workflow";
import { sendTechnicianJobPushNotification } from "../../../../lib/mobile-push-notifications";
import { NewJobWorkflow } from "../_components/new-job-workflow";

type NewJobPageProps = {
  searchParams?: Promise<{
    customerId?: string | string[];
    followUpJobId?: string | string[];
    mode?: string | string[];
    vehicleId?: string | string[];
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

export async function NewVisitPageImpl({ searchParams }: NewJobPageProps) {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedCustomerId = getSearchParam(resolvedSearchParams.customerId).trim();
  const requestedVehicleId = getSearchParam(resolvedSearchParams.vehicleId).trim();
  const followUpJobId = getSearchParam(resolvedSearchParams.followUpJobId).trim();
  const entryMode = getSearchParam(resolvedSearchParams.mode).trim() === "estimate" ? "estimate" : "job";
  const [customersResult, techniciansResult, vehiclesResult, addressesResult] = await Promise.all([
    listCustomersByCompany(context.supabase, context.companyId),
    listAssignableTechniciansByCompany(context.supabase, context.companyId),
    listVehiclesByCompany(context.supabase, context.companyId),
    listAddressesByCompany(context.supabase, context.companyId)
  ]);

  if (customersResult.error) {
    throw customersResult.error;
  }

  if (techniciansResult.error) {
    throw techniciansResult.error;
  }

  if (vehiclesResult.error) {
    throw vehiclesResult.error;
  }

  if (addressesResult.error) {
    throw addressesResult.error;
  }

  const customers = customersResult.data ?? [];

  if (!customers.length) {
    return (
      <section className="workspace-section">
        <div className="empty-state">
          <p className="eyebrow">Customers required</p>
          <h1 className="page-title">Create a customer first</h1>
          <p className="copy">Visits start from an active customer and vehicle.</p>
          <Link className="button button-link" href="/dashboard/customers/new">
            New customer
          </Link>
        </div>
      </section>
    );
  }

  const activeVehicles = (vehiclesResult.data ?? [])
    .filter((vehicle) => vehicle.isActive)
    .map((vehicle) => ({
      ...vehicle,
      customerName:
        customers.find((customer) => customer.id === vehicle.customerId)?.displayName ?? "Customer"
      }));
  const activeServiceSites = (addressesResult.data ?? [])
    .filter((address) => address.isActive)
    .map((address) => ({
      ...address,
      customerName:
        customers.find((customer) => customer.id === address.customerId)?.displayName ?? "Customer"
    }));
  const requestedVehicle =
    activeVehicles.find((vehicle) => vehicle.id === requestedVehicleId) ?? null;
  const followUpJobResult = followUpJobId
    ? await getJobById(context.supabase, followUpJobId)
    : { data: null, error: null };

  if (
    followUpJobResult.error ||
    (followUpJobResult.data && followUpJobResult.data.companyId !== context.companyId)
  ) {
    throw followUpJobResult.error ?? new Error("Follow-up visit context could not be loaded.");
  }

  const followUpJob =
    followUpJobResult.data && followUpJobResult.data.companyId === context.companyId
      ? followUpJobResult.data
      : null;
  const resolvedCustomerId =
    requestedVehicle?.customerId ?? followUpJob?.customerId ?? requestedCustomerId;
  const defaultCustomer =
    customers.find((customer) => customer.id === resolvedCustomerId) ?? customers[0] ?? null;

  if (!defaultCustomer) {
    notFound();
  }

  const defaultVehicle =
    (requestedVehicle && requestedVehicle.customerId === defaultCustomer.id
      ? requestedVehicle
      : null) ??
    (followUpJob
      ? activeVehicles.find(
          (vehicle) =>
            vehicle.id === followUpJob.vehicleId && vehicle.customerId === defaultCustomer.id
        ) ?? null
      : null) ??
    activeVehicles.find(
      (vehicle) => vehicle.isActive && vehicle.customerId === defaultCustomer.id
    ) ??
    null;
  const customerVehicleCount = activeVehicles.filter(
    (vehicle) => vehicle.customerId === defaultCustomer.id
  ).length;
  const customerServiceSiteCount = activeServiceSites.filter(
    (site) => site.customerId === defaultCustomer.id
  ).length;
  const preferredStartStep =
    entryMode === "estimate"
      ? defaultVehicle && (requestedVehicleId || customerVehicleCount <= 1)
        ? customerServiceSiteCount <= 1
          ? 3
          : 2
        : resolvedCustomerId
          ? 1
          : 0
      : 0;
  const followUpContext = followUpJob
    ? {
        sourceJobId: followUpJob.id,
        sourceTitle: followUpJob.title,
        sourceWorkflowLabel: getVisitWorkflowLabel(getVisitWorkflowState(followUpJob)),
        vehicleDisplayName:
          activeVehicles.find((vehicle) => vehicle.id === followUpJob.vehicleId)?.displayName ??
          defaultVehicle?.displayName ??
          "vehicle"
      }
    : null;
  const initialTitle =
    followUpJob && entryMode !== "estimate" ? `Follow-up: ${followUpJob.title}` : "";
  const initialCustomerConcern = followUpJob?.customerConcern ?? "";
  const initialInternalSummary = followUpJob
    ? [followUpJob.internalSummary, `Follow-up visit from ${followUpJob.title}.`]
        .filter(Boolean)
        .join("\n\n")
    : "";

  async function createJobAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const customerId = getString(formData, "customerId");
    const vehicleId = getString(formData, "vehicleId");
    const scheduleIntent = getString(formData, "scheduleIntent");
    const assignmentIntent = getString(formData, "assignmentIntent");
    const submitMode = getString(formData, "submitMode");
    const sourceFollowUpJobId = getString(formData, "followUpJobId");
    const serviceSiteId = getNullableString(formData, "serviceSiteId");
    const scheduledStartAt =
      scheduleIntent === "specific_time" ? getNullableString(formData, "scheduledStartAt") : null;
    const scheduledEndAt =
      scheduleIntent === "specific_time" ? getNullableString(formData, "scheduledEndAt") : null;
    const arrivalWindowStartAt =
      scheduleIntent === "arrival_window" ? getNullableString(formData, "arrivalWindowStartAt") : null;
    const arrivalWindowEndAt =
      scheduleIntent === "arrival_window" ? getNullableString(formData, "arrivalWindowEndAt") : null;
    const assignedTechnicianUserId =
      assignmentIntent === "assign_now"
        ? getNullableString(formData, "assignedTechnicianUserId")
        : null;
    const [customerResult, vehicleResult, serviceSiteResult] = await Promise.all([
      getCustomerById(actionContext.supabase, customerId),
      getVehicleById(actionContext.supabase, vehicleId),
      serviceSiteId
        ? actionContext.supabase
            .from("customer_addresses")
            .select("*")
            .eq("id", serviceSiteId)
            .single()
        : Promise.resolve({ data: null, error: new Error("Select a service site before creating a visit.") })
    ]);

    if (
      customerResult.error ||
      !customerResult.data ||
      customerResult.data.companyId !== actionContext.companyId ||
      !customerResult.data.isActive
    ) {
      throw new Error("Select an active customer before creating a visit.");
    }

    if (
      vehicleResult.error ||
      !vehicleResult.data ||
      vehicleResult.data.companyId !== actionContext.companyId ||
      vehicleResult.data.customerId !== customerId ||
      !vehicleResult.data.isActive
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

    const result = await createJob(actionContext.supabase, {
      assignedTechnicianUserId,
      arrivalWindowEndAt,
      arrivalWindowStartAt,
      companyId: actionContext.companyId,
      createdByUserId: actionContext.currentUserId,
      customerConcern: getNullableString(formData, "customerConcern"),
      customerId,
      description: getNullableString(formData, "description"),
      internalSummary: getNullableString(formData, "internalSummary"),
      isActive: formData.get("isActive") === "on",
      priority: (getString(formData, "priority") || "normal") as "low" | "normal" | "high" | "urgent",
      scheduledEndAt,
      scheduledStartAt,
      serviceSiteId,
      source: (getString(formData, "source") || "office") as "office" | "phone" | "web",
      title: getString(formData, "title"),
      vehicleId
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Failed to create visit.");
    }

    await sendTechnicianJobPushNotification({
      companyId: actionContext.companyId,
      companyTimeZone: actionContext.company.timezone,
      nextJob: result.data,
      previousJob: null
    }).catch(() => undefined);

    if (sourceFollowUpJobId) {
      const sourceJobResult = await getJobById(actionContext.supabase, sourceFollowUpJobId);

      if (
        !sourceJobResult.error &&
        sourceJobResult.data &&
        sourceJobResult.data.companyId === actionContext.companyId &&
        sourceJobResult.data.customerId === customerId &&
        sourceJobResult.data.vehicleId === vehicleId
      ) {
        await Promise.all([
          createJobNote(actionContext.supabase, {
            authorUserId: actionContext.currentUserId,
            body: `Follow-up visit created from ${sourceJobResult.data.title} (${sourceJobResult.data.id}).`,
            companyId: actionContext.companyId,
            isInternal: true,
            jobId: result.data.id
          }),
          createJobNote(actionContext.supabase, {
            authorUserId: actionContext.currentUserId,
            body: `Created follow-up visit ${result.data.title} (${result.data.id}).`,
            companyId: actionContext.companyId,
            isInternal: true,
            jobId: sourceJobResult.data.id
          })
        ]);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/visits");
    revalidatePath("/dashboard/dispatch");
    revalidatePath(`/dashboard/visits/${result.data.id}`);
    if (sourceFollowUpJobId) {
      revalidatePath(`/dashboard/visits/${sourceFollowUpJobId}`);
    }

    const workflowState = getVisitWorkflowState(result.data);

    if (submitMode === "estimate") {
      revalidatePath(`/dashboard/visits/${result.data.id}/estimate`);
      revalidatePath(`/dashboard/visits/${result.data.id}/estimate/workspace`);
      redirect(`/dashboard/visits/${result.data.id}/estimate/workspace?autostart=1`);
    }

    if (submitMode === "ready" && workflowState === "ready_to_dispatch") {
      const dispatchDate = getDispatchLocalDate(
        result.data.scheduledStartAt ?? new Date(),
        actionContext.company.timezone
      );

      redirect(`/dashboard/dispatch?view=day&date=${dispatchDate}`);
    }

    if (submitMode === "ready") {
      redirect(`/dashboard/visits?workflowState=${workflowState}`);
    }

    redirect("/dashboard/visits?workflowState=intake");
  }

  if (!activeVehicles.length) {
    return (
      <Page className="job-intake-page" layout="command">
        <PageHeader
          description={
            entryMode === "estimate"
              ? "Create one active vehicle first so the estimate-first flow has something real to quote."
              : "Create one active vehicle first so intake can move into a real visit queue."
          }
          eyebrow={entryMode === "estimate" ? "Estimate intake" : "Visit intake"}
          title={entryMode === "estimate" ? "New estimate" : "New visit"}
        />
        <EmptyState
          actions={
            <Link
              className={buttonClassName()}
              href={buildCustomerWorkspaceHref(defaultCustomer.id, {
                newVehicle: true,
                tab: "vehicles"
              })}
            >
              Add customer vehicle
            </Link>
          }
          description="No active vehicles are available for this company yet."
          eyebrow="Vehicles required"
          title={entryMode === "estimate" ? "Add a vehicle before creating an estimate" : "Add a vehicle before creating a visit"}
        />
      </Page>
    );
  }

  return (
    <Page className={entryMode === "estimate" ? "job-intake-page job-intake-page--estimate" : "job-intake-page"} layout="command">
      <PageHeader
        description={
          entryMode === "estimate"
            ? "Capture customer, vehicle, and concern, then hand the work straight into the estimate builder."
            : "Guided intake for customer, vehicle, concern, schedule intent, and assignment."
        }
        eyebrow={entryMode === "estimate" ? "Estimate intake" : "Visit intake"}
        status={<Link className={buttonClassName({ size: "sm", tone: "tertiary" })} href="/dashboard/visits">Back to visits</Link>}
        title={entryMode === "estimate" ? "New estimate" : "New visit"}
      />

      <NewJobWorkflow
        action={createJobAction}
        cancelHref="/dashboard/visits"
        customers={customers}
        defaultCustomerId={defaultCustomer.id}
        defaultVehicleId={defaultVehicle?.id ?? ""}
        entryMode={entryMode}
        followUpContext={followUpContext}
        initialCustomerConcern={initialCustomerConcern}
        initialInternalSummary={initialInternalSummary}
        initialTitle={initialTitle}
      preferredStartStep={preferredStartStep}
      serviceSites={activeServiceSites}
      technicians={techniciansResult.data ?? []}
      vehicles={activeVehicles}
    />
    </Page>
  );
}

export default NewVisitPageImpl;

