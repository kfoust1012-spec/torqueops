import {
  listAssignableTechniciansByCompany,
  listProfilesByIds,
  listServiceHistoryJobsForCustomer,
  listServiceHistoryJobsForVehicle,
  mapProfileRowToTechnicianProfile,
  type AppSupabaseClient
} from "@mobile-mechanic/api-client";
import type { Database, Job } from "@mobile-mechanic/types";

import { listFleetLiveDevices } from "../fleet/live-location-service";
import { geocodeTomTomAddress } from "../fleet/tomtom";
import { getTomTomApiKey } from "../server-env";

type CustomerAddressRow = Database["public"]["Tables"]["customer_addresses"]["Row"];

export type DispatchTechnicianFitSignal = {
  distanceMiles: number | null;
  repeatCustomerVisits: number;
  repeatVehicleVisits: number;
  specialtyMatches: string[];
  technicianName: string;
  technicianUserId: string;
  trackingState: string | null;
  yearsExperience: number | null;
};

const SPECIALTY_STOP_WORDS = new Set([
  "and",
  "battery",
  "brake",
  "car",
  "customer",
  "diagnostic",
  "engine",
  "for",
  "from",
  "inspection",
  "job",
  "need",
  "needs",
  "repair",
  "service",
  "stop",
  "the",
  "vehicle",
  "with"
]);

function pickPrimaryAddress(addresses: CustomerAddressRow[]) {
  return addresses.find((address) => address.is_primary) ?? addresses[0] ?? null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMiles(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

function extractSpecialtyKeywords(job: Job) {
  return [...new Set(
    [job.title, job.customerConcern, job.internalSummary]
      .filter(Boolean)
      .flatMap((value) =>
        (value ?? "")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .map((token) => token.trim())
          .filter(
            (token) =>
              token.length >= 4 &&
              !SPECIALTY_STOP_WORDS.has(token)
          )
      )
  )];
}

function getSpecialtyMatches(input: {
  certifications: string[];
  keywords: string[];
  technicianBio: string | null;
}) {
  if (!input.keywords.length) {
    return [];
  }

  const certificationMatches = input.certifications.filter((certification) => {
    const haystack = certification.toLowerCase();
    return input.keywords.some((keyword) => haystack.includes(keyword));
  });

  if (certificationMatches.length) {
    return certificationMatches.slice(0, 2);
  }

  const bioText = input.technicianBio?.toLowerCase() ?? "";

  if (!bioText) {
    return [];
  }

  return input.keywords.filter((keyword) => bioText.includes(keyword)).slice(0, 2);
}

export async function getDispatchTechnicianFitSignals(input: {
  companyId: string;
  job: Job;
  supabase: AppSupabaseClient;
}) {
  const [techniciansResult, profilesResult, customerHistoryResult, vehicleHistoryResult, liveDevicesResult, addressesResult, serviceSiteResult] =
    await Promise.all([
      listAssignableTechniciansByCompany(input.supabase, input.companyId),
      listAssignableTechniciansByCompany(input.supabase, input.companyId).then(async (technicians) => {
        if (technicians.error || !technicians.data) {
          return { data: null, error: technicians.error ?? new Error("Technicians could not be loaded.") };
        }

        return listProfilesByIds(
          input.supabase,
          technicians.data.map((technician) => technician.userId)
        );
      }),
      listServiceHistoryJobsForCustomer(input.supabase, input.companyId, input.job.customerId),
      listServiceHistoryJobsForVehicle(input.supabase, input.companyId, input.job.vehicleId),
      listFleetLiveDevices({
        companyId: input.companyId,
        supabase: input.supabase
      }),
      input.supabase
        .from("customer_addresses")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("customer_id", input.job.customerId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .returns<CustomerAddressRow[]>(),
      input.job.serviceSiteId
        ? input.supabase
            .from("customer_addresses")
            .select("*")
            .eq("company_id", input.companyId)
            .eq("id", input.job.serviceSiteId)
            .single<CustomerAddressRow>()
        : Promise.resolve({ data: null as CustomerAddressRow | null, error: null })
    ]);

  if (techniciansResult.error || !techniciansResult.data) {
    throw techniciansResult.error ?? new Error("Assignable technicians could not be loaded.");
  }

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (customerHistoryResult.error) {
    throw customerHistoryResult.error;
  }

  if (vehicleHistoryResult.error) {
    throw vehicleHistoryResult.error;
  }

  if (liveDevicesResult.error || !liveDevicesResult.data) {
    throw liveDevicesResult.error ?? new Error("Live technician locations could not be loaded.");
  }

  if (addressesResult.error) {
    throw addressesResult.error;
  }

  if (serviceSiteResult.error) {
    throw serviceSiteResult.error;
  }

  const primaryAddress = pickPrimaryAddress(addressesResult.data ?? []);
  const serviceSite = serviceSiteResult.data ?? primaryAddress;
  const tomTomApiKey = getTomTomApiKey();
  const jobCoordinates =
    tomTomApiKey && serviceSite
      ? await geocodeTomTomAddress({
          address: {
            city: serviceSite.city,
            country: serviceSite.country,
            line1: serviceSite.line1,
            line2: serviceSite.line2,
            postalCode: serviceSite.postal_code,
            state: serviceSite.state
          },
          apiKey: tomTomApiKey
        }).catch(() => null)
      : null;
  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, mapProfileRowToTechnicianProfile(profile)])
  );
  const liveDeviceByUserId = new Map(
    liveDevicesResult.data.map((device) => [device.userId, device] as const)
  );
  const repeatCustomerVisitsByTechnicianId = new Map<string, number>();
  const repeatVehicleVisitsByTechnicianId = new Map<string, number>();
  const specialtyKeywords = extractSpecialtyKeywords(input.job);

  (customerHistoryResult.data ?? []).forEach((visit) => {
    if (!visit.assignedTechnicianUserId || visit.id === input.job.id) {
      return;
    }

    repeatCustomerVisitsByTechnicianId.set(
      visit.assignedTechnicianUserId,
      (repeatCustomerVisitsByTechnicianId.get(visit.assignedTechnicianUserId) ?? 0) + 1
    );
  });

  (vehicleHistoryResult.data ?? []).forEach((visit) => {
    if (!visit.assignedTechnicianUserId || visit.id === input.job.id) {
      return;
    }

    repeatVehicleVisitsByTechnicianId.set(
      visit.assignedTechnicianUserId,
      (repeatVehicleVisitsByTechnicianId.get(visit.assignedTechnicianUserId) ?? 0) + 1
    );
  });

  return techniciansResult.data.map<DispatchTechnicianFitSignal>((technician) => {
    const profile = profileById.get(technician.userId) ?? null;
    const liveDevice = liveDeviceByUserId.get(technician.userId) ?? null;
    const distanceMiles =
      liveDevice &&
      liveDevice.latitude !== null &&
      liveDevice.longitude !== null &&
      jobCoordinates
        ? Math.round(
            haversineMiles(
              {
                latitude: liveDevice.latitude,
                longitude: liveDevice.longitude
              },
              jobCoordinates
            ) * 10
          ) / 10
        : null;

    return {
      distanceMiles,
      repeatCustomerVisits: repeatCustomerVisitsByTechnicianId.get(technician.userId) ?? 0,
      repeatVehicleVisits: repeatVehicleVisitsByTechnicianId.get(technician.userId) ?? 0,
      specialtyMatches: getSpecialtyMatches({
        certifications: profile?.technicianCertifications ?? [],
        keywords: specialtyKeywords,
        technicianBio: profile?.technicianBio ?? null
      }),
      technicianName: profile?.fullName ?? technician.displayName,
      technicianUserId: technician.userId,
      trackingState: liveDevice?.trackingState ?? null,
      yearsExperience: profile?.yearsExperience ?? null
    };
  });
}
