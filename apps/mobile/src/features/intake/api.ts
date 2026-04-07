import {
  createCustomer,
  createCustomerAddress,
  createJob,
  createVehicle,
  listAddressesByCompany,
  listAssignableTechniciansByCompany,
  listCustomersByCompany,
  listVehiclesByCompany
} from "@mobile-mechanic/api-client";
import type {
  AssignableTechnicianOption,
  CustomerAddress,
  CustomerListItem,
  Job,
  JobPriority,
  VehicleListItem
} from "@mobile-mechanic/types";

import type { MobileAppContext } from "../../lib/app-context";
import { canRunFieldWorkflowFromMobile } from "../../lib/mobile-capabilities";
import { supabase } from "../../lib/supabase";

export type MobileOwnerIntakeOptions = {
  customers: CustomerListItem[];
  serviceSites: CustomerAddress[];
  technicians: AssignableTechnicianOption[];
  vehicles: VehicleListItem[];
};

export type CreateMobileOwnerJobWorkflowInput = {
  assignmentMode: "self" | "technician" | "unassigned";
  assignedTechnicianUserId?: string | null | undefined;
  existingCustomerId?: string | null | undefined;
  existingServiceSiteId?: string | null | undefined;
  existingVehicleId?: string | null | undefined;
  job: {
    customerConcern?: string | null | undefined;
    internalSummary?: string | null | undefined;
    priority: JobPriority;
    scheduledStartAt?: string | null | undefined;
    title: string;
  };
  newCustomer?: {
    email?: string | null | undefined;
    firstName: string;
    lastName: string;
    phone?: string | null | undefined;
  } | null | undefined;
  newServiceSite?: {
    city: string;
    line1: string;
    postalCode: string;
    siteName?: string | null | undefined;
    state: string;
  } | null | undefined;
  newVehicle?: {
    licensePlate?: string | null | undefined;
    licenseState?: string | null | undefined;
    make: string;
    model: string;
    year?: number | null | undefined;
  } | null | undefined;
};

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function loadMobileOwnerIntakeOptions(
  companyId: string
): Promise<MobileOwnerIntakeOptions> {
  const [customersResult, serviceSitesResult, techniciansResult, vehiclesResult] = await Promise.all([
    listCustomersByCompany(supabase, companyId),
    listAddressesByCompany(supabase, companyId),
    listAssignableTechniciansByCompany(supabase, companyId),
    listVehiclesByCompany(supabase, companyId)
  ]);

  if (customersResult.error) {
    throw customersResult.error;
  }

  if (serviceSitesResult.error) {
    throw serviceSitesResult.error;
  }

  if (techniciansResult.error) {
    throw techniciansResult.error;
  }

  if (vehiclesResult.error) {
    throw vehiclesResult.error;
  }

  return {
    customers: customersResult.data ?? [],
    serviceSites: (serviceSitesResult.data ?? []).filter((site) => site.isActive),
    technicians: techniciansResult.data ?? [],
    vehicles: (vehiclesResult.data ?? []).filter((vehicle) => vehicle.isActive)
  };
}

export async function createMobileOwnerJobWorkflow(
  appContext: MobileAppContext,
  input: CreateMobileOwnerJobWorkflowInput
): Promise<{
  assignedToCurrentUser: boolean;
  job: Job;
}> {
  let customerId = input.existingCustomerId ?? null;

  if (!customerId) {
    if (!input.newCustomer) {
      throw new Error("Customer details are required before creating a mobile job.");
    }

    const customerResult = await createCustomer(supabase, {
      companyId: appContext.companyId,
      email: trimToNull(input.newCustomer.email),
      firstName: input.newCustomer.firstName.trim(),
      lastName: input.newCustomer.lastName.trim(),
      phone: trimToNull(input.newCustomer.phone)
    });

    if (customerResult.error || !customerResult.data) {
      throw customerResult.error ?? new Error("Customer could not be created.");
    }

    customerId = customerResult.data.id;
  }

  let vehicleId = input.existingVehicleId ?? null;

  if (!vehicleId) {
    if (!input.newVehicle) {
      throw new Error("Vehicle details are required before creating a mobile job.");
    }

    const vehicleResult = await createVehicle(supabase, {
      companyId: appContext.companyId,
      customerId,
      licensePlate: trimToNull(input.newVehicle.licensePlate),
      licenseState: trimToNull(input.newVehicle.licenseState),
      make: input.newVehicle.make.trim(),
      model: input.newVehicle.model.trim(),
      year: input.newVehicle.year ?? null
    });

    if (vehicleResult.error || !vehicleResult.data) {
      throw vehicleResult.error ?? new Error("Vehicle could not be created.");
    }

    vehicleId = vehicleResult.data.id;
  }

  let serviceSiteId = input.existingServiceSiteId ?? null;

  if (!serviceSiteId) {
    if (!input.newServiceSite) {
      throw new Error("Service location details are required before creating a mobile job.");
    }

    const serviceSiteResult = await createCustomerAddress(supabase, {
      city: input.newServiceSite.city.trim(),
      companyId: appContext.companyId,
      customerId,
      line1: input.newServiceSite.line1.trim(),
      postalCode: input.newServiceSite.postalCode.trim(),
      siteName: trimToNull(input.newServiceSite.siteName),
      state: input.newServiceSite.state.trim().toUpperCase()
    });

    if (serviceSiteResult.error || !serviceSiteResult.data) {
      throw serviceSiteResult.error ?? new Error("Service location could not be created.");
    }

    serviceSiteId = serviceSiteResult.data.id;
  }

  const assignedTechnicianUserId =
    input.assignmentMode === "self" && canRunFieldWorkflowFromMobile(appContext.membership.role)
      ? appContext.userId
      : input.assignmentMode === "technician"
        ? trimToNull(input.assignedTechnicianUserId)
        : null;

  const jobResult = await createJob(supabase, {
    assignedTechnicianUserId,
    companyId: appContext.companyId,
    createdByUserId: appContext.userId,
    customerConcern: trimToNull(input.job.customerConcern),
    customerId,
    internalSummary: trimToNull(input.job.internalSummary),
    priority: input.job.priority,
    scheduledStartAt: input.job.scheduledStartAt ?? null,
    serviceSiteId,
    source: "phone",
    title: input.job.title.trim(),
    vehicleId
  });

  if (jobResult.error || !jobResult.data) {
    throw jobResult.error ?? new Error("Job could not be created.");
  }

  return {
    assignedToCurrentUser: assignedTechnicianUserId === appContext.userId,
    job: jobResult.data
  };
}
