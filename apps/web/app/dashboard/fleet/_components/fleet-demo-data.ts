export type FleetStatus = "en_route" | "on_job" | "idle" | "delayed" | "offline";

export type FleetRouteMode = "optimized" | "manual";

export type FleetMaintenanceStatus = "ok" | "due" | "inspection";

export type FleetStopPriority = "routine" | "priority" | "vip" | "emergency";

export type FleetStopType = "service" | "parts_pickup";

export type FleetStopState = "current" | "next" | "queued";

export type FleetPoint = {
  latitude: number;
  label: string;
  longitude: number;
};

export type FleetStop = {
  address: string;
  city: string;
  coords: FleetPoint;
  customerName: string;
  durationMinutes: number;
  id: string;
  jobCode: string;
  locked: boolean;
  notes?: string | undefined;
  priority: FleetStopPriority;
  remainingServiceMinutes?: number | undefined;
  title: string;
  type: FleetStopType;
  windowEnd: string;
  windowStart: string;
  state: FleetStopState;
};

export type FleetTechnician = {
  completedJobsToday: number;
  completedMilesToday: number;
  currentJobTitle: string | null;
  id: string;
  idleMinutesToday: number;
  initials: string;
  lastKnownLocation: string;
  lastPingMinutes: number;
  maintenanceNote: string;
  maintenanceStatus: FleetMaintenanceStatus;
  name: string;
  position: FleetPoint;
  region: string;
  route: FleetStop[];
  routeMode: FleetRouteMode;
  shiftEnd: string;
  shiftStart: string;
  skills: string[];
  status: FleetStatus;
  utilizationTarget: number;
  vehicleLabel: string;
  vehicleUnit: string;
};

export type FleetProjectedStop = FleetStop & {
  delayMinutes: number;
  departureLabel: string;
  departureMinutes: number;
  driveMinutes: number;
  etaLabel: string;
  etaMinutes: number;
  legMiles: number;
  windowLabel: string;
};

export type FleetProjection = {
  currentStop: FleetProjectedStop | null;
  endOfRouteLabel: string;
  nextStop: FleetProjectedStop | null;
  overtimeMinutes: number;
  projectedStops: FleetProjectedStop[];
  routeDelayMinutes: number;
  routeHealth: "issue" | "watch" | "healthy";
  totalRemainingDriveMinutes: number;
  totalRemainingJobs: number;
  totalRemainingMiles: number;
  totalRouteMinutes: number;
  totalServiceMinutes: number;
};

export const FLEET_TODAY = "2026-03-13";
export const FLEET_NOW_MINUTES = 14 * 60 + 12;
export const FLEET_NOW_LABEL = "2:12 PM CT";

const PRIORITY_SCORE: Record<FleetStopPriority, number> = {
  emergency: -70,
  vip: -45,
  priority: -20,
  routine: 0
};

const STATUS_META: Record<
  FleetStatus,
  {
    accent: string;
    label: string;
    shortLabel: string;
  }
> = {
  en_route: {
    accent: "#4d86ff",
    label: "En route",
    shortLabel: "Blue"
  },
  on_job: {
    accent: "#2ca46d",
    label: "On job",
    shortLabel: "Green"
  },
  idle: {
    accent: "#8794aa",
    label: "Idle",
    shortLabel: "Gray"
  },
  delayed: {
    accent: "#d28a22",
    label: "Delayed",
    shortLabel: "Amber"
  },
  offline: {
    accent: "#c5504a",
    label: "Offline",
    shortLabel: "Red"
  }
};

const initialTechnicians: FleetTechnician[] = [
  {
    completedJobsToday: 2,
    completedMilesToday: 24,
    currentJobTitle: null,
    id: "tech-avery-stone",
    idleMinutesToday: 18,
    initials: "AS",
    lastKnownLocation: "I-90 eastbound near Ogden Ave",
    lastPingMinutes: 1,
    maintenanceNote: "Oil service due in 9 days.",
    maintenanceStatus: "ok",
    name: "Avery Stone",
    position: {
      latitude: 41.8837,
      label: "West Loop",
      longitude: -87.6526
    },
    region: "City Core",
    route: [
      {
        address: "118 N Peoria St",
        city: "Chicago",
        coords: {
          latitude: 41.8897,
          label: "River West",
          longitude: -87.6496
        },
        customerName: "Brenda Cook",
        durationMinutes: 70,
        id: "stop-214",
        jobCode: "FL-214",
        locked: false,
        priority: "priority",
        title: "BMW X5 brake pulse inspection",
        type: "service",
        windowEnd: "15:30",
        windowStart: "14:30",
        state: "next"
      },
      {
        address: "905 W Fulton Market",
        city: "Chicago",
        coords: {
          latitude: 41.8865,
          label: "Fulton Market",
          longitude: -87.648
        },
        customerName: "Lawson Dental",
        durationMinutes: 20,
        id: "stop-219",
        jobCode: "FL-219",
        locked: false,
        notes: "Quick stock pickup before final diagnostic.",
        priority: "priority",
        title: "Parts pickup - front pad set",
        type: "parts_pickup",
        windowEnd: "16:30",
        windowStart: "16:00",
        state: "queued"
      },
      {
        address: "2332 W Jackson Blvd",
        city: "Chicago",
        coords: {
          latitude: 41.8778,
          label: "Near West Side",
          longitude: -87.6809
        },
        customerName: "Adrian Moore",
        durationMinutes: 80,
        id: "stop-223",
        jobCode: "FL-223",
        locked: false,
        priority: "routine",
        title: "Ford Transit battery draw diagnostic",
        type: "service",
        windowEnd: "17:45",
        windowStart: "16:45",
        state: "queued"
      }
    ],
    routeMode: "optimized",
    shiftEnd: "18:00",
    shiftStart: "08:00",
    skills: ["Electrical", "Brake", "Transit vans"],
    status: "en_route",
    utilizationTarget: 79,
    vehicleLabel: "Transit Service Van",
    vehicleUnit: "V12"
  },
  {
    completedJobsToday: 1,
    completedMilesToday: 19,
    currentJobTitle: "Ram 2500 no-start diagnosis",
    id: "tech-marco-bennett",
    idleMinutesToday: 8,
    initials: "MB",
    lastKnownLocation: "On-site at O'Hare cargo district",
    lastPingMinutes: 1,
    maintenanceNote: "Rotate tires within the next 320 miles.",
    maintenanceStatus: "due",
    name: "Marco Bennett",
    position: {
      latitude: 41.9808,
      label: "O'Hare",
      longitude: -87.9045
    },
    region: "North Corridor",
    route: [
      {
        address: "4800 Cargo Rd",
        city: "Chicago",
        coords: {
          latitude: 41.9808,
          label: "O'Hare cargo district",
          longitude: -87.9045
        },
        customerName: "Harper Logistics",
        durationMinutes: 95,
        id: "stop-208",
        jobCode: "FL-208",
        locked: true,
        priority: "emergency",
        remainingServiceMinutes: 42,
        title: "Ram 2500 no-start diagnosis",
        type: "service",
        windowEnd: "15:00",
        windowStart: "13:00",
        state: "current"
      },
      {
        address: "1400 N Mittel Blvd",
        city: "Elk Grove Village",
        coords: {
          latitude: 42.0057,
          label: "Elk Grove parts hub",
          longitude: -87.9588
        },
        customerName: "MotorHub",
        durationMinutes: 18,
        id: "stop-226",
        jobCode: "FL-226",
        locked: false,
        notes: "Pick up ignition relay and battery hold-down.",
        priority: "priority",
        title: "Parts pickup - relay kit",
        type: "parts_pickup",
        windowEnd: "15:50",
        windowStart: "15:30",
        state: "next"
      },
      {
        address: "805 E Golf Rd",
        city: "Schaumburg",
        coords: {
          latitude: 42.0481,
          label: "Schaumburg",
          longitude: -88.047
        },
        customerName: "Sandra Velasquez",
        durationMinutes: 75,
        id: "stop-229",
        jobCode: "FL-229",
        locked: false,
        priority: "routine",
        title: "Silverado coolant leak inspection",
        type: "service",
        windowEnd: "17:15",
        windowStart: "16:15",
        state: "queued"
      }
    ],
    routeMode: "manual",
    shiftEnd: "18:00",
    shiftStart: "08:30",
    skills: ["Diagnostics", "Heavy duty", "Electrical"],
    status: "on_job",
    utilizationTarget: 86,
    vehicleLabel: "Sprinter Diagnostic Van",
    vehicleUnit: "V08"
  },
  {
    completedJobsToday: 2,
    completedMilesToday: 33,
    currentJobTitle: null,
    id: "tech-nia-patel",
    idleMinutesToday: 11,
    initials: "NP",
    lastKnownLocation: "Route 88 near Naperville Rd",
    lastPingMinutes: 2,
    maintenanceNote: "DOT inspection packet expires this week.",
    maintenanceStatus: "inspection",
    name: "Nia Patel",
    position: {
      latitude: 41.7859,
      label: "Naperville",
      longitude: -88.1473
    },
    region: "West Corridor",
    route: [
      {
        address: "1550 W 22nd St",
        city: "Oak Brook",
        coords: {
          latitude: 41.8489,
          label: "Oak Brook",
          longitude: -87.953
        },
        customerName: "Northshore Pediatrics",
        durationMinutes: 85,
        id: "stop-231",
        jobCode: "FL-231",
        locked: true,
        notes: "VIP fleet van. Keep this appointment fixed.",
        priority: "vip",
        title: "Sprinter A/C performance inspection",
        type: "service",
        windowEnd: "15:00",
        windowStart: "14:00",
        state: "next"
      },
      {
        address: "1500 Butterfield Rd",
        city: "Downers Grove",
        coords: {
          latitude: 41.8239,
          label: "Downers Grove",
          longitude: -88.0107
        },
        customerName: "Elena Rossi",
        durationMinutes: 65,
        id: "stop-235",
        jobCode: "FL-235",
        locked: false,
        priority: "routine",
        title: "Audi Q7 check engine diagnosis",
        type: "service",
        windowEnd: "16:30",
        windowStart: "15:30",
        state: "queued"
      },
      {
        address: "180 Yorktown Center",
        city: "Lombard",
        coords: {
          latitude: 41.881,
          label: "Lombard hub",
          longitude: -88.0166
        },
        customerName: "Warehouse 18",
        durationMinutes: 22,
        id: "stop-240",
        jobCode: "FL-240",
        locked: false,
        priority: "priority",
        title: "Parts pickup - pressure switch",
        type: "parts_pickup",
        windowEnd: "16:35",
        windowStart: "16:15",
        state: "queued"
      },
      {
        address: "900 N York St",
        city: "Elmhurst",
        coords: {
          latitude: 41.8995,
          label: "Elmhurst",
          longitude: -87.9403
        },
        customerName: "Hilton Suites",
        durationMinutes: 60,
        id: "stop-242",
        jobCode: "FL-242",
        locked: false,
        priority: "routine",
        title: "Transit fleet van pre-trip inspection",
        type: "service",
        windowEnd: "18:00",
        windowStart: "17:00",
        state: "queued"
      }
    ],
    routeMode: "manual",
    shiftEnd: "18:30",
    shiftStart: "08:00",
    skills: ["A/C", "European", "Fleet inspections"],
    status: "delayed",
    utilizationTarget: 91,
    vehicleLabel: "Metris Field Van",
    vehicleUnit: "V17"
  },
  {
    completedJobsToday: 3,
    completedMilesToday: 21,
    currentJobTitle: null,
    id: "tech-jonah-kim",
    idleMinutesToday: 42,
    initials: "JK",
    lastKnownLocation: "Oak Park service zone",
    lastPingMinutes: 1,
    maintenanceNote: "Vehicle healthy. No open service items.",
    maintenanceStatus: "ok",
    name: "Jonah Kim",
    position: {
      latitude: 41.885,
      label: "Oak Park",
      longitude: -87.7845
    },
    region: "West Corridor",
    route: [
      {
        address: "7137 Ogden Ave",
        city: "Berwyn",
        coords: {
          latitude: 41.8348,
          label: "Berwyn",
          longitude: -87.7937
        },
        customerName: "Priya Desai",
        durationMinutes: 45,
        id: "stop-238",
        jobCode: "FL-238",
        locked: false,
        priority: "routine",
        title: "Honda Odyssey battery replacement",
        type: "service",
        windowEnd: "16:00",
        windowStart: "15:00",
        state: "next"
      },
      {
        address: "4801 W Roosevelt Rd",
        city: "Cicero",
        coords: {
          latitude: 41.851,
          label: "Cicero",
          longitude: -87.76
        },
        customerName: "Oakline Fitness",
        durationMinutes: 55,
        id: "stop-244",
        jobCode: "FL-244",
        locked: false,
        priority: "priority",
        title: "Trailer light circuit repair",
        type: "service",
        windowEnd: "17:30",
        windowStart: "16:30",
        state: "queued"
      }
    ],
    routeMode: "optimized",
    shiftEnd: "18:00",
    shiftStart: "07:30",
    skills: ["Battery", "Electrical", "Rapid response"],
    status: "idle",
    utilizationTarget: 63,
    vehicleLabel: "Service SUV",
    vehicleUnit: "S04"
  },
  {
    completedJobsToday: 1,
    completedMilesToday: 14,
    currentJobTitle: null,
    id: "tech-elise-warren",
    idleMinutesToday: 65,
    initials: "EW",
    lastKnownLocation: "Last ping near Hyde Park service zone",
    lastPingMinutes: 19,
    maintenanceNote: "Starter battery is under watch and needs a bench test.",
    maintenanceStatus: "due",
    name: "Elise Warren",
    position: {
      latitude: 41.7943,
      label: "Hyde Park",
      longitude: -87.5907
    },
    region: "South Route",
    route: [
      {
        address: "3600 S Lake Park Ave",
        city: "Chicago",
        coords: {
          latitude: 41.8313,
          label: "Bronzeville",
          longitude: -87.6188
        },
        customerName: "City Harbor",
        durationMinutes: 70,
        id: "stop-236",
        jobCode: "FL-236",
        locked: false,
        priority: "emergency",
        title: "Transit boost issue diagnosis",
        type: "service",
        windowEnd: "15:00",
        windowStart: "14:15",
        state: "next"
      },
      {
        address: "11200 S Western Ave",
        city: "Chicago",
        coords: {
          latitude: 41.6895,
          label: "Morgan Park",
          longitude: -87.6667
        },
        customerName: "Beverly Auto Spa",
        durationMinutes: 50,
        id: "stop-241",
        jobCode: "FL-241",
        locked: false,
        priority: "routine",
        title: "Equipment relay replacement",
        type: "service",
        windowEnd: "17:00",
        windowStart: "16:00",
        state: "queued"
      }
    ],
    routeMode: "manual",
    shiftEnd: "17:30",
    shiftStart: "08:00",
    skills: ["Ford vans", "Boost systems", "Battery"],
    status: "offline",
    utilizationTarget: 52,
    vehicleLabel: "Transit Connect",
    vehicleUnit: "V03"
  }
];

const initialBacklogStops: FleetStop[] = [
  {
    address: "7801 S Harlem Ave",
    city: "Bridgeview",
    coords: {
      latitude: 41.7508,
      label: "Bridgeview",
      longitude: -87.8063
    },
    customerName: "Metro Glass",
    durationMinutes: 75,
    id: "backlog-em-12",
    jobCode: "EM-12",
    locked: false,
    notes: "Roadside no-start. High-priority hotline call.",
    priority: "emergency",
    title: "Roadside no-start diagnostic",
    type: "service",
    windowEnd: "15:00",
    windowStart: "14:30",
    state: "queued"
  },
  {
    address: "501 W Lake St",
    city: "Addison",
    coords: {
      latitude: 41.9315,
      label: "Addison warehouse",
      longitude: -87.9886
    },
    customerName: "Parts Depot",
    durationMinutes: 20,
    id: "backlog-pk-07",
    jobCode: "PK-07",
    locked: false,
    priority: "priority",
    title: "Parts pickup - wheel speed sensor",
    type: "parts_pickup",
    windowEnd: "15:40",
    windowStart: "15:10",
    state: "queued"
  },
  {
    address: "401 E Illinois St",
    city: "Chicago",
    coords: {
      latitude: 41.892,
      label: "Streeterville",
      longitude: -87.6205
    },
    customerName: "Lakeshore Executive",
    durationMinutes: 65,
    id: "backlog-vip-03",
    jobCode: "VIP-03",
    locked: true,
    notes: "VIP appointment. Keep the requested window intact.",
    priority: "vip",
    title: "Mercedes battery and charging check",
    type: "service",
    windowEnd: "17:00",
    windowStart: "16:00",
    state: "queued"
  }
];

function cloneStop(stop: FleetStop): FleetStop {
  return {
    ...stop,
    coords: { ...stop.coords }
  };
}

export function createFleetDemoTechnicians() {
  return initialTechnicians.map((technician) => ({
    ...technician,
    position: { ...technician.position },
    route: technician.route.map(cloneStop)
  }));
}

export function createFleetBacklogStops() {
  return initialBacklogStops.map(cloneStop);
}

export function getFleetStatusMeta(status: FleetStatus) {
  return STATUS_META[status];
}

export function getFleetStatusLabel(status: FleetStatus) {
  return STATUS_META[status].label;
}

export function getFleetPriorityLabel(priority: FleetStopPriority) {
  switch (priority) {
    case "emergency":
      return "Emergency";
    case "vip":
      return "VIP";
    case "priority":
      return "Priority";
    default:
      return "Routine";
  }
}

export function getFleetMaintenanceLabel(status: FleetMaintenanceStatus) {
  switch (status) {
    case "due":
      return "Service due";
    case "inspection":
      return "Inspection watch";
    default:
      return "Healthy";
  }
}

export function getFleetRouteModeLabel(mode: FleetRouteMode) {
  return mode === "manual" ? "Manual override" : "AI optimized";
}

export function formatMinutesDuration(minutes: number) {
  if (minutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) {
    return `${remainder}m`;
  }

  if (!remainder) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function formatMiles(value: number) {
  return `${value.toFixed(1)} mi`;
}

export function parseTimeToMinutes(value: string) {
  const [hours = 0, minutes = 0] = value
    .split(":")
    .map((segment) => Number.parseInt(segment, 10));
  return hours * 60 + minutes;
}

export function formatMinutesToTime(value: number) {
  const normalized = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export function syncTechnicianRouteStates(technician: FleetTechnician): FleetTechnician {
  const currentStop = technician.route.find((stop) => stop.state === "current") ?? null;
  const remainingStops = technician.route.filter((stop) => stop.id !== currentStop?.id);

  const orderedStops = currentStop ? [currentStop, ...remainingStops] : remainingStops;
  let nextAssigned = false;
  const route = orderedStops.map((stop) => {
    if (currentStop && stop.id === currentStop.id) {
      return {
        ...stop,
        state: "current" as const
      };
    }

    if (!nextAssigned) {
      nextAssigned = true;
      return {
        ...stop,
        state: "next" as const
      };
    }

    return {
      ...stop,
      state: "queued" as const
    };
  });

  return {
    ...technician,
    route
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function estimateDriveMinutes(from: FleetPoint, to: FleetPoint, trafficEnabled: boolean) {
  const miles = estimateDriveMiles(from, to);
  const averageSpeedMph = trafficEnabled ? 22 : 29;
  return Math.max(6, Math.round((miles / averageSpeedMph) * 60));
}

export function estimateDriveMiles(from: FleetPoint, to: FleetPoint) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversineDistance =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const crowFlightMiles =
    2 * earthRadiusMiles * Math.atan2(Math.sqrt(haversineDistance), Math.sqrt(1 - haversineDistance));

  return Math.max(0.8, crowFlightMiles * 1.22);
}

export function buildTechnicianProjection(
  technician: FleetTechnician,
  nowMinutes: number,
  trafficEnabled: boolean
): FleetProjection {
  let cursor = technician.position;
  let timelineMinute = nowMinutes;
  let routeDelayMinutes = technician.status === "delayed" ? 8 : 0;
  let totalRemainingDriveMinutes = 0;
  let totalRemainingMiles = 0;
  let totalServiceMinutes = 0;

  const projectedStops = technician.route.map((stop) => {
    const isCurrentStop = stop.state === "current";
    const driveMinutes = isCurrentStop ? 0 : estimateDriveMinutes(cursor, stop.coords, trafficEnabled);
    const legMiles = isCurrentStop ? 0 : estimateDriveMiles(cursor, stop.coords);
    totalRemainingDriveMinutes += driveMinutes;
    totalRemainingMiles += legMiles;
    timelineMinute += driveMinutes;

    const windowStart = parseTimeToMinutes(stop.windowStart);
    const windowEnd = parseTimeToMinutes(stop.windowEnd);
    const etaMinutes = timelineMinute;
    const startServiceMinute = isCurrentStop ? etaMinutes : Math.max(etaMinutes, windowStart);
    const serviceMinutes = isCurrentStop
      ? stop.remainingServiceMinutes ?? stop.durationMinutes
      : stop.durationMinutes;
    const departureMinutes = startServiceMinute + serviceMinutes;
    const delayMinutes = Math.max(etaMinutes - windowEnd, 0);

    routeDelayMinutes += delayMinutes;
    totalServiceMinutes += serviceMinutes;
    timelineMinute = departureMinutes;
    cursor = stop.coords;

    return {
      ...stop,
      delayMinutes,
      departureLabel: formatMinutesToTime(departureMinutes),
      departureMinutes,
      driveMinutes,
      etaLabel: formatMinutesToTime(etaMinutes),
      etaMinutes,
      legMiles,
      windowLabel: `${formatMinutesToTime(windowStart)} - ${formatMinutesToTime(windowEnd)}`
    };
  });

  const currentStop = projectedStops.find((stop) => stop.state === "current") ?? null;
  const nextStop =
    projectedStops.find((stop) => stop.state === "next") ??
    (currentStop ? projectedStops[1] ?? null : projectedStops[0] ?? null);
  const totalRouteMinutes = totalRemainingDriveMinutes + totalServiceMinutes;
  const overtimeMinutes = Math.max(
    timelineMinute - parseTimeToMinutes(technician.shiftEnd),
    0
  );

  let routeHealth: FleetProjection["routeHealth"] = "healthy";

  if (technician.status === "offline") {
    routeHealth = "issue";
  } else if (routeDelayMinutes >= 20 || overtimeMinutes >= 20) {
    routeHealth = "issue";
  } else if (routeDelayMinutes >= 8 || technician.status === "delayed" || overtimeMinutes > 0) {
    routeHealth = "watch";
  }

  return {
    currentStop,
    endOfRouteLabel: formatMinutesToTime(timelineMinute),
    nextStop,
    overtimeMinutes,
    projectedStops,
    routeDelayMinutes,
    routeHealth,
    totalRemainingDriveMinutes,
    totalRemainingJobs: projectedStops.filter((stop) => stop.state !== "current").length,
    totalRemainingMiles,
    totalRouteMinutes,
    totalServiceMinutes
  };
}

function scoreStopForOptimization(
  stop: FleetStop,
  origin: FleetPoint,
  trafficEnabled: boolean
) {
  const windowStart = parseTimeToMinutes(stop.windowStart);
  const driveMinutes = estimateDriveMinutes(origin, stop.coords, trafficEnabled);
  const partsBias = stop.type === "parts_pickup" ? -8 : 0;

  return (
    driveMinutes * 1.15 +
    windowStart / 18 +
    stop.durationMinutes / 14 +
    PRIORITY_SCORE[stop.priority] +
    partsBias
  );
}

function optimizeUnlockedStops(
  unlockedStops: FleetStop[],
  origin: FleetPoint,
  trafficEnabled: boolean
) {
  const queue = unlockedStops.map(cloneStop);
  const ordered: FleetStop[] = [];
  let cursor = origin;

  while (queue.length) {
    queue.sort(
      (left, right) =>
        scoreStopForOptimization(left, cursor, trafficEnabled) -
        scoreStopForOptimization(right, cursor, trafficEnabled)
    );
    const nextStop = queue.shift();

    if (!nextStop) {
      break;
    }

    ordered.push(nextStop);
    cursor = nextStop.coords;
  }

  return ordered;
}

export function optimizeTechnicianRoute(
  technician: FleetTechnician,
  trafficEnabled: boolean
) {
  const normalized = syncTechnicianRouteStates(technician);
  const currentStop = normalized.route.find((stop) => stop.state === "current") ?? null;
  const remainingStops = normalized.route.filter((stop) => stop.id !== currentStop?.id);
  const rebuilt: FleetStop[] = [];
  let availableUnlocked = remainingStops.filter((stop) => !stop.locked);
  let cursor = currentStop?.coords ?? normalized.position;
  let openSlots = 0;

  for (const stop of remainingStops) {
    if (stop.locked) {
      if (openSlots > 0) {
        const optimizedSegment = optimizeUnlockedStops(availableUnlocked, cursor, trafficEnabled).slice(
          0,
          openSlots
        );
        const consumedIds = new Set(optimizedSegment.map((segmentStop) => segmentStop.id));
        rebuilt.push(...optimizedSegment);
        availableUnlocked = availableUnlocked.filter((segmentStop) => !consumedIds.has(segmentStop.id));
        cursor = optimizedSegment.at(-1)?.coords ?? cursor;
        openSlots = 0;
      }

      rebuilt.push(cloneStop(stop));
      cursor = stop.coords;
      continue;
    }

    openSlots += 1;
  }

  if (openSlots > 0) {
    const optimizedSegment = optimizeUnlockedStops(availableUnlocked, cursor, trafficEnabled).slice(
      0,
      openSlots
    );
    rebuilt.push(...optimizedSegment);
  }

  return syncTechnicianRouteStates({
    ...normalized,
    route: currentStop ? [cloneStop(currentStop), ...rebuilt] : rebuilt,
    routeMode: "optimized"
  });
}

export function reorderTechnicianRoute(
  technician: FleetTechnician,
  movingStopId: string,
  targetStopId: string
) {
  const normalized = syncTechnicianRouteStates(technician);
  const currentStop = normalized.route.find((stop) => stop.state === "current") ?? null;
  const remainingStops = normalized.route.filter((stop) => stop.id !== currentStop?.id);
  const movingIndex = remainingStops.findIndex((stop) => stop.id === movingStopId);
  const targetIndex = remainingStops.findIndex((stop) => stop.id === targetStopId);

  if (movingIndex === -1 || targetIndex === -1) {
    return normalized;
  }

  if (remainingStops[movingIndex]?.locked || remainingStops[targetIndex]?.locked) {
    return normalized;
  }

  const reorderedStops = remainingStops.map(cloneStop);
  const [movingStop] = reorderedStops.splice(movingIndex, 1);

  if (!movingStop) {
    return normalized;
  }

  reorderedStops.splice(targetIndex, 0, movingStop);

  return syncTechnicianRouteStates({
    ...normalized,
    route: currentStop ? [cloneStop(currentStop), ...reorderedStops] : reorderedStops,
    routeMode: "manual"
  });
}

export function toggleTechnicianStopLock(technician: FleetTechnician, stopId: string) {
  return syncTechnicianRouteStates({
    ...technician,
    route: technician.route.map((stop) =>
      stop.id === stopId && stop.state !== "current"
        ? {
            ...stop,
            locked: !stop.locked
          }
        : cloneStop(stop)
    ),
    routeMode: "manual"
  });
}

export function appendStopToTechnician(technician: FleetTechnician, stop: FleetStop) {
  return syncTechnicianRouteStates({
    ...technician,
    route: [...technician.route.map(cloneStop), cloneStop(stop)],
    routeMode: "manual"
  });
}

export function findClosestTechnician(
  technicians: FleetTechnician[],
  stop: FleetStop,
  trafficEnabled: boolean,
  excludedTechnicianId?: string | undefined
) {
  const statusPenalty: Record<FleetStatus, number> = {
    delayed: 16,
    en_route: 8,
    idle: 0,
    offline: Number.MAX_SAFE_INTEGER,
    on_job: 24
  };

  const ranked = technicians
    .filter((technician) => technician.id !== excludedTechnicianId)
    .map((technician) => ({
      etaMinutes:
        estimateDriveMinutes(technician.position, stop.coords, trafficEnabled) +
        statusPenalty[technician.status],
      technician
    }))
    .sort((left, right) => left.etaMinutes - right.etaMinutes);

  return ranked[0] ?? null;
}

export function getFleetRegions(technicians: FleetTechnician[]) {
  return [...new Set(technicians.map((technician) => technician.region))].sort();
}
