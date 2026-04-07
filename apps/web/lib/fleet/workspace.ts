import {
  listProfilesByIds,
  mapProfileRowToTechnicianProfile,
  listServiceUnitsByCompany,
  listStockLocationsByCompany
} from "@mobile-mechanic/api-client";
import {
  getDispatchLocalDate,
  getPublicTechnicianProfileMissingFields,
  getSafeTimeZone,
  hasPublicTechnicianProfile,
  isTechnicianOnSiteJobStatus
} from "@mobile-mechanic/core";
import type {
  Database,
  DispatchCalendarAvailabilityEvent,
  DispatchCalendarJobEvent,
  DispatchBoardJobItem,
  JobPriority,
  JobStatus
} from "@mobile-mechanic/types";

import type {
  FleetStopView,
  FleetTechnicianView,
  FleetWorkspaceData
} from "../../app/dashboard/fleet/_components/fleet-types";
import { listFleetLiveDevices } from "./live-location-service";
import { geocodeTomTomAddress } from "./tomtom";
import { getTomTomApiKey } from "../server-env";
import { getDispatchCommandCenter } from "../dispatch/service";

type CompanyContext = Parameters<typeof getDispatchCommandCenter>[0];
type CustomerAddressRow = Database["public"]["Tables"]["customer_addresses"]["Row"];
const MAX_FLEET_GEOCODE_ADDRESSES = 16;

function toFleetError(value: unknown, fallbackMessage: string) {
  if (value instanceof Error) {
    return value;
  }

  if (value && typeof value === "object") {
    const candidate = value as {
      details?: unknown;
      hint?: unknown;
      message?: unknown;
    };
    const parts = [
      typeof candidate.message === "string" ? candidate.message : null,
      typeof candidate.details === "string" ? candidate.details : null,
      typeof candidate.hint === "string" ? candidate.hint : null
    ].filter((part): part is string => Boolean(part));

    if (parts.length) {
      return new Error(parts.join(" "));
    }
  }

  if (typeof value === "string" && value.trim()) {
    return new Error(value);
  }

  return new Error(fallbackMessage);
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "MM";
}

function formatTimeLabel(value: string | null, timeZone: string) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

function formatDateHeading(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone
  }).format(new Date(`${value}T12:00:00`));
}

function buildAddressText(address: CustomerAddressRow | null) {
  if (!address) {
    return {
      addressLabel: "Service location unavailable",
      cityStateLabel: "Address not configured",
      lookupKey: null
    };
  }

  return {
    addressLabel: [address.line1, address.line2].filter(Boolean).join(", "),
    cityStateLabel: [address.city, address.state].filter(Boolean).join(", "),
    lookupKey: [
      address.line1,
      address.line2,
      `${address.city}, ${address.state} ${address.postal_code}`,
      address.country
    ]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase()
  };
}

function buildWindowLabel(input: {
  arrivalWindowEndAt: string | null;
  arrivalWindowStartAt: string | null;
  scheduledLabel: string | null;
  timeZone: string;
}) {
  const start = formatTimeLabel(input.arrivalWindowStartAt, input.timeZone);
  const end = formatTimeLabel(input.arrivalWindowEndAt, input.timeZone);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return input.scheduledLabel;
}

function getPriorityRank(priority: JobPriority) {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
    default:
      return 3;
  }
}

function compareScheduledStops(left: FleetStopView, right: FleetStopView) {
  const leftTime = left.scheduledStartAt ? new Date(left.scheduledStartAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.scheduledStartAt
    ? new Date(right.scheduledStartAt).getTime()
    : Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.priority !== right.priority) {
    return getPriorityRank(left.priority) - getPriorityRank(right.priority);
  }

  return left.title.localeCompare(right.title);
}

function pickPrimaryAddress(addresses: CustomerAddressRow[]) {
  return addresses.find((address) => address.is_primary) ?? addresses[0] ?? null;
}

async function loadAddressCoordinates(input: {
  addresses: CustomerAddressRow[];
  apiKey: string | null;
}) {
  const coordinateByLookupKey = new Map<string, { latitude: number; longitude: number } | null>();

  if (!input.apiKey) {
    return coordinateByLookupKey;
  }

  const uniqueAddresses = new Map<string, CustomerAddressRow>();

  input.addresses.forEach((address) => {
    if (uniqueAddresses.size >= MAX_FLEET_GEOCODE_ADDRESSES) {
      return;
    }

    const addressText = buildAddressText(address);

    if (addressText.lookupKey && !uniqueAddresses.has(addressText.lookupKey)) {
      uniqueAddresses.set(addressText.lookupKey, address);
    }
  });

  const entries = [...uniqueAddresses.entries()];
  const batchSize = 4;

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);

    await Promise.all(
      batch.map(async ([lookupKey, address]) => {
        try {
          const result = await geocodeTomTomAddress({
            address: {
              city: address.city,
              country: address.country,
              line1: address.line1,
              line2: address.line2,
              postalCode: address.postal_code,
              state: address.state
            },
            apiKey: input.apiKey as string
          });

          coordinateByLookupKey.set(lookupKey, result);
        } catch {
          coordinateByLookupKey.set(lookupKey, null);
        }
      })
    );
  }

  return coordinateByLookupKey;
}

function buildStopView(input: {
  address: CustomerAddressRow | null;
  assignedTechnicianName: string | null;
  assignedTechnicianUserId: string | null;
  coordinatesByLookupKey: Map<string, { latitude: number; longitude: number } | null>;
  job:
    | DispatchCalendarJobEvent
    | DispatchBoardJobItem;
  now: Date;
  timeZone: string;
}) {
  const addressText = buildAddressText(input.address);
  const lookup = addressText.lookupKey
    ? input.coordinatesByLookupKey.get(addressText.lookupKey) ?? null
    : null;
  const scheduledLabel = formatTimeLabel(input.job.scheduledStartAt, input.timeZone);
  const windowLabel = buildWindowLabel({
    arrivalWindowEndAt: input.job.arrivalWindowEndAt,
    arrivalWindowStartAt: input.job.arrivalWindowStartAt,
    scheduledLabel,
    timeZone: input.timeZone
  });
  const scheduledStartTime = input.job.scheduledStartAt
    ? new Date(input.job.scheduledStartAt).getTime()
    : null;
  const nowTime = input.now.getTime();
  const isCurrent = isTechnicianOnSiteJobStatus(input.job.status);
  const isLate = Boolean(
    scheduledStartTime !== null &&
      scheduledStartTime < nowTime &&
      !isTechnicianOnSiteJobStatus(input.job.status) &&
      input.job.status !== "completed" &&
      input.job.status !== "canceled"
  );

  return {
    addressLabel: addressText.addressLabel,
    arrivalWindowEndAt: input.job.arrivalWindowEndAt,
    arrivalWindowStartAt: input.job.arrivalWindowStartAt,
    assignedTechnicianName: input.assignedTechnicianName,
    assignedTechnicianUserId: input.assignedTechnicianUserId,
    cityStateLabel: addressText.cityStateLabel,
    coords: lookup
      ? {
          label: input.job.customerDisplayName,
          latitude: lookup.latitude,
          longitude: lookup.longitude
        }
      : null,
    customerId: input.job.customerId,
    customerName: input.job.customerDisplayName,
    hasServiceSitePlaybook: Boolean(
      input.address?.access_window_notes ||
        input.address?.gate_code ||
        input.address?.parking_notes ||
        input.address?.service_contact_name ||
        input.address?.service_contact_phone
    ),
    id: input.job.id,
    isCurrent,
    isLate,
    isNext: false,
    isUnscheduled: !input.job.scheduledStartAt,
    jobId: input.job.id,
    priority: input.job.priority,
    scheduledEndAt: input.job.scheduledEndAt,
    scheduledLabel,
    scheduledStartAt: input.job.scheduledStartAt,
    serviceSiteId: input.job.serviceSiteId ?? null,
    status: input.job.status,
    title: input.job.title,
    vehicleDisplayName: input.job.vehicleDisplayName,
    windowLabel
  } satisfies FleetStopView;
}

function getRouteHealthLabel(routeHealth: FleetTechnicianView["routeHealth"]) {
  switch (routeHealth) {
    case "issue":
      return "Needs attention";
    case "watch":
      return "Watch route";
    default:
      return "On track";
  }
}

function getTechnicianStatus(input: {
  activeAvailability: DispatchCalendarAvailabilityEvent | null;
  currentStop: FleetStopView | null;
  liveDevice: FleetWorkspaceData["liveDevices"][number] | null;
  nextStop: FleetStopView | null;
  overdueStops: FleetStopView[];
}) {
  if (input.activeAvailability && !input.currentStop && !input.nextStop) {
    return "offline" as const;
  }

  if (input.currentStop && isTechnicianOnSiteJobStatus(input.currentStop.status)) {
    return "on_job" as const;
  }

  if (input.overdueStops.length > 0) {
    return "delayed" as const;
  }

  if (input.nextStop) {
    return "en_route" as const;
  }

  if (input.liveDevice?.trackingState === "offline") {
    return "offline" as const;
  }

  return "idle" as const;
}

function buildCurrentLocationLabel(input: {
  activeAvailability: DispatchCalendarAvailabilityEvent | null;
  currentStop: FleetStopView | null;
  liveDevice: FleetWorkspaceData["liveDevices"][number] | null;
  nextStop: FleetStopView | null;
}) {
  if (input.currentStop) {
    return `${input.currentStop.customerName}, ${input.currentStop.cityStateLabel}`;
  }

  if (input.liveDevice) {
    return input.liveDevice.trackingSummary;
  }

  if (input.nextStop) {
    return `Next at ${input.nextStop.cityStateLabel}`;
  }

  if (input.activeAvailability) {
    return input.activeAvailability.title;
  }

  return "Waiting for live GPS";
}

export async function getFleetWorkspace(context: CompanyContext, input: { date: string }) {
  const timeZone = getSafeTimeZone(context.company.timezone);
  const commandCenter = await getDispatchCommandCenter(context, {
    date: input.date,
    includeUnassigned: true,
    scope: "all_workers",
    view: "day"
  });
  const [stockLocationsResult, profilesResult, serviceUnitsResult, liveDevicesResult] = await Promise.all([
    listStockLocationsByCompany(context.supabase, context.companyId),
    listProfilesByIds(
      context.supabase,
      commandCenter.technicians.map((technician) => technician.userId)
    ),
    listServiceUnitsByCompany(context.supabase, context.companyId),
    listFleetLiveDevices({
      companyId: context.companyId,
      supabase: context.supabase
    })
  ]);

  if (stockLocationsResult.error) {
    throw toFleetError(stockLocationsResult.error, "Service-unit stock locations could not be loaded.");
  }

  if (profilesResult.error) {
    throw toFleetError(profilesResult.error, "Technician profiles could not be loaded.");
  }

  if (serviceUnitsResult.error) {
    throw toFleetError(serviceUnitsResult.error, "Internal service units could not be loaded.");
  }

  if (liveDevicesResult.error || !liveDevicesResult.data) {
    throw toFleetError(
      liveDevicesResult.error,
      "Live technician locations could not be loaded."
    );
  }

  const allJobs = [
    ...commandCenter.calendar.jobs,
    ...commandCenter.calendar.backlogJobs,
    ...commandCenter.calendar.unassignedScheduledJobs
  ];
  const customerIds = [...new Set(allJobs.map((job) => job.customerId))];
  const serviceSiteIds = [
    ...new Set(
      allJobs
        .map((job) => job.serviceSiteId)
        .filter((serviceSiteId): serviceSiteId is string => Boolean(serviceSiteId))
    )
  ];
  const [addressesResult, serviceSitesResult] = await Promise.all([
    customerIds.length
      ? context.supabase
          .from("customer_addresses")
          .select("*")
          .eq("company_id", context.companyId)
          .in("customer_id", customerIds)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true })
          .returns<CustomerAddressRow[]>()
      : Promise.resolve({ data: [] as CustomerAddressRow[], error: null }),
    serviceSiteIds.length
      ? context.supabase
          .from("customer_addresses")
          .select("*")
          .eq("company_id", context.companyId)
          .in("id", serviceSiteIds)
          .returns<CustomerAddressRow[]>()
      : Promise.resolve({ data: [] as CustomerAddressRow[], error: null })
  ]);

  if (addressesResult.error || serviceSitesResult.error) {
    throw toFleetError(
      addressesResult.error ?? serviceSitesResult.error,
      "Customer service locations could not be loaded."
    );
  }

  const addressesByCustomerId = new Map<string, CustomerAddressRow[]>();

  (addressesResult.data ?? []).forEach((address) => {
    const current = addressesByCustomerId.get(address.customer_id) ?? [];
    current.push(address);
    addressesByCustomerId.set(address.customer_id, current);
  });
  const serviceSiteById = new Map((serviceSitesResult.data ?? []).map((address) => [address.id, address]));

  const primaryAddressByCustomerId = new Map<string, CustomerAddressRow | null>(
    [...addressesByCustomerId.entries()].map(([customerId, addresses]) => [
      customerId,
      pickPrimaryAddress(addresses)
    ])
  );
  const resolveJobServiceSite = (job: (typeof allJobs)[number]) =>
    (job.serviceSiteId ? serviceSiteById.get(job.serviceSiteId) ?? null : null) ??
    primaryAddressByCustomerId.get(job.customerId) ??
    null;
  const coordinatesByLookupKey = await loadAddressCoordinates({
    addresses: allJobs
      .map((job) => resolveJobServiceSite(job))
      .filter(
        (address): address is CustomerAddressRow => Boolean(address)
      ),
    apiKey: getTomTomApiKey()
  });
  const stockLocationByTechnicianId = new Map(
    (stockLocationsResult.data ?? [])
      .filter((location) => location.locationType === "van" && location.technicianUserId)
      .map((location) => [location.technicianUserId as string, location])
  );
  const serviceUnitByStockLocationId = new Map(
    (serviceUnitsResult.data ?? []).map((serviceUnit) => [serviceUnit.stockLocationId, serviceUnit] as const)
  );
  const serviceUnitByTechnicianId = new Map(
    (serviceUnitsResult.data ?? [])
      .filter((serviceUnit) => serviceUnit.assignedTechnicianUserId)
      .map((serviceUnit) => [serviceUnit.assignedTechnicianUserId as string, serviceUnit] as const)
  );
  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const liveDeviceByTechnicianId = new Map(
    liveDevicesResult.data.map((device) => [device.userId, device] as const)
  );
  const liveNow = new Date();
  const assignedScheduledStopsByTechnicianId = new Map<string, FleetStopView[]>();
  const assignedBacklogStopsByTechnicianId = new Map<string, FleetStopView[]>();

  commandCenter.calendar.jobs.forEach((job) => {
    if (!job.resourceTechnicianUserId) {
      return;
    }

    const current = assignedScheduledStopsByTechnicianId.get(job.resourceTechnicianUserId) ?? [];
    current.push(
      buildStopView({
        address: resolveJobServiceSite(job),
        assignedTechnicianName: job.assignedTechnicianName,
        assignedTechnicianUserId: job.resourceTechnicianUserId,
        coordinatesByLookupKey,
        job,
        now: liveNow,
        timeZone
      })
    );
    assignedScheduledStopsByTechnicianId.set(job.resourceTechnicianUserId, current);
  });

  commandCenter.calendar.backlogJobs.forEach((job) => {
    if (!job.assignedTechnicianUserId) {
      return;
    }

    const current = assignedBacklogStopsByTechnicianId.get(job.assignedTechnicianUserId) ?? [];
    current.push(
      buildStopView({
        address: resolveJobServiceSite(job),
        assignedTechnicianName: job.assignedTechnicianName,
        assignedTechnicianUserId: job.assignedTechnicianUserId,
        coordinatesByLookupKey,
        job,
        now: liveNow,
        timeZone
      })
    );
    assignedBacklogStopsByTechnicianId.set(job.assignedTechnicianUserId, current);
  });

  const queueJobs = [...commandCenter.calendar.unassignedScheduledJobs, ...commandCenter.calendar.backlogJobs]
    .filter((job) => !job.assignedTechnicianUserId)
    .map((job) =>
      buildStopView({
        address: resolveJobServiceSite(job),
        assignedTechnicianName: job.assignedTechnicianName,
        assignedTechnicianUserId: null,
        coordinatesByLookupKey,
        job,
        now: liveNow,
        timeZone
      })
    )
    .sort(compareScheduledStops);

  const todayLocalDate = getDispatchLocalDate(liveNow, timeZone);
  const resources = commandCenter.calendar.resources.filter((resource) => {
    const routeStops = [
      ...(assignedScheduledStopsByTechnicianId.get(resource.technicianUserId) ?? []),
      ...(assignedBacklogStopsByTechnicianId.get(resource.technicianUserId) ?? [])
    ];
    const liveDevice = liveDeviceByTechnicianId.get(resource.technicianUserId) ?? null;
    const vanLocation = stockLocationByTechnicianId.get(resource.technicianUserId) ?? null;
    const serviceUnit =
      (vanLocation ? serviceUnitByStockLocationId.get(vanLocation.id) ?? null : null) ??
      serviceUnitByTechnicianId.get(resource.technicianUserId) ??
      null;

    return resource.role === "technician" || Boolean(routeStops.length || liveDevice || vanLocation || serviceUnit);
  });

  const technicians: FleetTechnicianView[] = resources
    .map((resource) => {
      const scheduledStops = [...(assignedScheduledStopsByTechnicianId.get(resource.technicianUserId) ?? [])].sort(
        compareScheduledStops
      );
      const backlogStops = [...(assignedBacklogStopsByTechnicianId.get(resource.technicianUserId) ?? [])].sort(
        compareScheduledStops
      );
      const routeStops = [...scheduledStops, ...backlogStops];
      const currentStop = routeStops.find((stop) => isTechnicianOnSiteJobStatus(stop.status)) ?? null;
      const nextStop = routeStops.find((stop) => stop.id !== currentStop?.id) ?? null;

      if (nextStop) {
        nextStop.isNext = true;
      }

      const activeAvailability =
        commandCenter.calendar.availability.find((availability) => {
          if (availability.technicianUserId !== resource.technicianUserId) {
            return false;
          }

          if (!commandCenter.calendar.query.date || commandCenter.calendar.query.date !== todayLocalDate) {
            return availability.dayDate === input.date;
          }

          const startsAt = new Date(availability.eventStartAt).getTime();
          const endsAt = new Date(availability.eventEndAt).getTime();
          const nowTime = liveNow.getTime();
          return startsAt <= nowTime && endsAt >= nowTime;
        }) ?? null;
      const liveDevice = liveDeviceByTechnicianId.get(resource.technicianUserId) ?? null;
      const overdueStops = routeStops.filter((stop) => stop.isLate);
      const routeIssueCount =
        overdueStops.length +
        resource.conflictCount +
        (activeAvailability && !routeStops.length ? 1 : 0);
      const routeHealth =
        routeIssueCount >= 2 ? "issue" : routeIssueCount === 1 ? "watch" : "healthy";
      const stockLocation = stockLocationByTechnicianId.get(resource.technicianUserId) ?? null;
      const serviceUnit =
        (stockLocation ? serviceUnitByStockLocationId.get(stockLocation.id) ?? null : null) ??
        serviceUnitByTechnicianId.get(resource.technicianUserId) ??
        null;
      const profileRow = profileById.get(resource.technicianUserId) ?? null;
      const profile = profileRow ? mapProfileRowToTechnicianProfile(profileRow) : null;
      const meetYourMechanicReady = hasPublicTechnicianProfile(profile);

      return {
        activeAvailabilityTitle: activeAvailability?.title ?? null,
        currentLocationLabel: buildCurrentLocationLabel({
          activeAvailability,
          currentStop,
          liveDevice,
          nextStop
        }),
        currentStop,
        email: profile?.email ?? resource.email,
        id: resource.technicianUserId,
        initials: getInitials(resource.displayName),
        jobsRemaining: routeStops.length,
        meetYourMechanicMissingFields: meetYourMechanicReady
          ? []
          : getPublicTechnicianProfileMissingFields(profile),
        meetYourMechanicReady,
        name: resource.displayName,
        nextStop,
        phone: profile?.phone ?? null,
        role: resource.role,
        routeHealth,
        routeHealthLabel: getRouteHealthLabel(routeHealth),
        routeIssueCount,
        routeStops,
        status: getTechnicianStatus({
          activeAvailability,
          currentStop,
          liveDevice,
          nextStop,
          overdueStops
        }),
        vehicleLabel:
          serviceUnit?.displayName ??
          stockLocation?.vehicleLabel ??
          null,
        vehicleUnit:
          serviceUnit?.unitCode ??
          stockLocation?.slug?.toUpperCase() ??
          null
      } satisfies FleetTechnicianView;
    })
    .sort((left, right) => {
      if (left.jobsRemaining !== right.jobsRemaining) {
        return right.jobsRemaining - left.jobsRemaining;
      }

      return left.name.localeCompare(right.name);
    });

  return {
    companyTimeZone: timeZone,
    date: input.date,
    dateLabel: formatDateHeading(input.date, timeZone),
    dayEndHour: commandCenter.settings.dayEndHour,
    generatedAt: liveNow.toISOString(),
    isTodayView: input.date === todayLocalDate,
    liveDevices: liveDevicesResult.data,
    queueJobs,
    technicians,
    tomTomConfigured: Boolean(getTomTomApiKey())
  } satisfies FleetWorkspaceData;
}
