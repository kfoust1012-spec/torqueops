import {
  findSingle,
  getBootstrapEnv,
  getCompanyBySlug,
  insertRow,
  isoAtOffsetDays,
  patchRows,
  required,
  upsertAuthUser,
  upsertMembership,
  upsertRestRow,
  updateProfileByEmail
} from "./lib/bootstrap-utils.mjs";

const DEFAULT_PASSWORD = "Password123!";
const COMPANY_SLUG = "north-loop-mobile-auto";

const TECHNICIANS = [
  {
    label: "alex",
    email: "alex.tech@northloopauto.com",
    fullName: "Alex Mercer",
    phone: "555-210-1101",
    bio: "ASE-certified mobile technician focused on brakes, drivability, and fleet service.",
    certifications: ["ASE Brakes", "ASE Suspension & Steering", "EPA 609"],
    yearsExperience: 9,
    laneOrder: 1,
    laneColor: "#1f6feb"
  },
  {
    label: "sam",
    email: "sam.tech@northloopauto.com",
    fullName: "Sam Patel",
    phone: "555-210-1102",
    bio: "Diagnostic-first field technician specializing in electrical and no-start calls.",
    certifications: ["ASE Electrical/Electronic Systems"],
    yearsExperience: 6,
    laneOrder: 2,
    laneColor: "#0ea5a3"
  },
  {
    label: "riley",
    email: "riley.tech@northloopauto.com",
    fullName: "Riley Ortiz",
    phone: "555-210-1103",
    bio: "High-throughput mobile service tech for maintenance, cooling, and suspension work.",
    certifications: ["ASE Engine Repair", "ASE Heating & Air Conditioning"],
    yearsExperience: 8,
    laneOrder: 3,
    laneColor: "#f59e0b"
  },
  {
    label: "mia",
    email: "mia.tech@northloopauto.com",
    fullName: "Mia Chen",
    phone: "555-210-1104",
    bio: "Field-service technician strong in battery, charging, and same-day roadside triage.",
    certifications: ["ASE Electrical/Electronic Systems", "ASE Engine Performance"],
    yearsExperience: 7,
    laneOrder: 4,
    laneColor: "#ef4444"
  },
  {
    label: "diego",
    email: "diego.tech@northloopauto.com",
    fullName: "Diego Alvarez",
    phone: "555-210-1105",
    bio: "Mobile repair technician for steering, suspension, and heavier light-truck jobs.",
    certifications: ["ASE Suspension & Steering", "ASE Brakes"],
    yearsExperience: 11,
    laneOrder: 5,
    laneColor: "#7c3aed"
  },
  {
    label: "nora",
    email: "nora.tech@northloopauto.com",
    fullName: "Nora Kim",
    phone: "555-210-1106",
    bio: "Customer-facing mobile technician optimized for premium service follow-through and inspections.",
    certifications: ["ASE Maintenance & Light Repair"],
    yearsExperience: 5,
    laneOrder: 6,
    laneColor: "#14b8a6"
  }
];

const CUSTOMER_SEEDS = [
  ["Avery", "Cole", "2018 Ford Transit Connect"],
  ["Brooke", "Ramirez", "2021 Toyota Tacoma"],
  ["Cameron", "Price", "2017 BMW X3"],
  ["Dana", "Foster", "2020 Honda Accord"],
  ["Elliot", "Reed", "2019 Chevrolet Tahoe"],
  ["Farah", "Ali", "2022 Subaru Outback"],
  ["Gavin", "Ross", "2016 Jeep Wrangler"],
  ["Hannah", "Scott", "2023 Kia Telluride"],
  ["Isaac", "Nguyen", "2015 Nissan Altima"],
  ["Jules", "Bennett", "2020 Tesla Model 3"],
  ["Keira", "Owens", "2018 Lexus RX 350"],
  ["Logan", "Murphy", "2019 Ram 1500"],
  ["Maya", "Sullivan", "2021 Hyundai Palisade"],
  ["Noah", "Diaz", "2017 Toyota Camry"],
  ["Olivia", "Harper", "2022 Chevrolet Traverse"],
  ["Parker", "Shaw", "2016 Honda Pilot"],
  ["Quinn", "Brooks", "2018 GMC Sierra"],
  ["Reese", "Powell", "2020 Mazda CX-5"],
  ["Sofia", "Turner", "2019 Audi Q5"],
  ["Theo", "Watson", "2021 Ford F-150"]
];

const SERVICE_TITLES = [
  "Brake vibration diagnosis",
  "Battery draw and charging test",
  "Cooling system pressure test",
  "Starter circuit diagnosis",
  "Front suspension noise inspection",
  "Check-engine drivability scan",
  "Mobile pre-purchase inspection",
  "Serpentine belt and tensioner replacement",
  "Oil leak source inspection",
  "A/C performance diagnosis",
  "Front pad and rotor service",
  "Wheel speed sensor diagnosis",
  "Alternator output confirmation",
  "Thermostat housing replacement",
  "Steering shake road-force balance check",
  "CV axle and boot inspection"
];

function buildCustomerEmail(index) {
  return `dispatch.stress.${String(index + 1).padStart(2, "0")}@example.com`;
}

function buildCustomerPhone(index) {
  return `555-310-${String(index + 1).padStart(4, "0")}`;
}

function buildVehicleSeed(index, customerId, descriptor) {
  const [yearText, ...rest] = descriptor.split(" ");
  const year = Number(yearText);
  const make = rest[0];
  const model = rest.slice(1).join(" ");

  return {
    customerId,
    year,
    make,
    model,
    trim: "Stress Demo",
    engine: "2.0L Demo",
    licensePlate: `STR${String(index + 101).padStart(3, "0")}`,
    licenseState: "TX",
    vin: `S${String(index + 1).padStart(16, "0")}`,
    color: ["Silver", "Blue", "White", "Gray", "Black"][index % 5],
    odometer: 32000 + index * 4850,
    notes: "Seeded for dispatch stress testing.",
    isActive: true
  };
}

function buildTitle(index, serviceTitle, firstName, lastName) {
  return `Stress ${String(index + 1).padStart(2, "0")} - ${serviceTitle} for ${firstName} ${lastName}`;
}

function buildIso(dayOffset, hour, minute = 0) {
  return isoAtOffsetDays(dayOffset, hour, minute);
}

function addMinutes(isoString, minutes) {
  return new Date(new Date(isoString).getTime() + minutes * 60_000).toISOString();
}

function buildScheduledJobSeeds() {
  const seeds = [];
  let jobIndex = 0;

  for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
    for (let technicianIndex = 0; technicianIndex < TECHNICIANS.length; technicianIndex += 1) {
      const customerIndex = (dayOffset * TECHNICIANS.length + technicianIndex) % CUSTOMER_SEEDS.length;
      const [firstName, lastName] = CUSTOMER_SEEDS[customerIndex];
      const serviceTitle = SERVICE_TITLES[(dayOffset * 3 + technicianIndex) % SERVICE_TITLES.length];
      const middayStart = buildIso(dayOffset, 9 + (technicianIndex % 3), technicianIndex % 2 ? 30 : 0);
      const middayDuration = technicianIndex % 2 === 0 ? 120 : 90;
      const secondStart = buildIso(
        dayOffset,
        13 + ((technicianIndex + dayOffset) % 3),
        technicianIndex % 2 === 0 ? 0 : 30
      );
      const secondDuration = technicianIndex % 3 === 0 ? 150 : 120;

      seeds.push({
        key: `scheduled-${jobIndex}`,
        customerIndex,
        vehicleIndex: customerIndex,
        technicianLabel: TECHNICIANS[technicianIndex].label,
        status:
          dayOffset === 0 && technicianIndex === 0
            ? "in_progress"
            : dayOffset === 0 && technicianIndex === 1
              ? "dispatched"
              : "scheduled",
        priority: technicianIndex % 4 === 0 ? "urgent" : technicianIndex % 3 === 0 ? "high" : "normal",
        source: technicianIndex % 2 === 0 ? "office" : "phone",
        title: buildTitle(jobIndex, serviceTitle, firstName, lastName),
        description: "Seeded mobile service visit for dispatch stress testing.",
        customerConcern: `${serviceTitle} requested during seeded dispatch load testing.`,
        internalSummary: "Synthetic live-dispatch load used to evaluate dense board states.",
        scheduledStartAt: middayStart,
        scheduledEndAt: addMinutes(middayStart, middayDuration),
        arrivalWindowStartAt: addMinutes(middayStart, -30),
        arrivalWindowEndAt: addMinutes(middayStart, 30)
      });
      jobIndex += 1;

      seeds.push({
        key: `scheduled-${jobIndex}`,
        customerIndex: (customerIndex + 7) % CUSTOMER_SEEDS.length,
        vehicleIndex: (customerIndex + 7) % CUSTOMER_SEEDS.length,
        technicianLabel: TECHNICIANS[technicianIndex].label,
        status: dayOffset === 0 && technicianIndex === 2 ? "dispatched" : "scheduled",
        priority: technicianIndex % 2 === 0 ? "high" : "normal",
        source: technicianIndex % 2 === 0 ? "web" : "office",
        title: buildTitle(
          jobIndex,
          SERVICE_TITLES[(jobIndex + 4) % SERVICE_TITLES.length],
          CUSTOMER_SEEDS[(customerIndex + 7) % CUSTOMER_SEEDS.length][0],
          CUSTOMER_SEEDS[(customerIndex + 7) % CUSTOMER_SEEDS.length][1]
        ),
        description: "Afternoon seeded stop used to stress week and month views.",
        customerConcern: "Seeded routing load for premium dispatch evaluation.",
        internalSummary: "Secondary seeded stop.",
        scheduledStartAt: secondStart,
        scheduledEndAt: addMinutes(secondStart, secondDuration),
        arrivalWindowStartAt: addMinutes(secondStart, -45),
        arrivalWindowEndAt: addMinutes(secondStart, 30)
      });
      jobIndex += 1;
    }
  }

  seeds.push({
    key: `scheduled-${jobIndex++}`,
    customerIndex: 2,
    vehicleIndex: 2,
    technicianLabel: "alex",
    status: "scheduled",
    priority: "urgent",
    source: "phone",
    title: "Stress overlap - Brake revisit squeeze-in",
    description: "Intentional overlap to force dense lane and conflict handling.",
    customerConcern: "Customer requested same-day revisit before leaving town.",
    internalSummary: "Overlap conflict seed.",
    scheduledStartAt: buildIso(0, 10, 30),
    scheduledEndAt: buildIso(0, 12, 0),
    arrivalWindowStartAt: buildIso(0, 10, 0),
    arrivalWindowEndAt: buildIso(0, 11, 0)
  });

  seeds.push({
    key: `scheduled-${jobIndex++}`,
    customerIndex: 9,
    vehicleIndex: 9,
    technicianLabel: "mia",
    status: "scheduled",
    priority: "high",
    source: "office",
    title: "Stress outside-hours - Evening fleet recovery",
    description: "Intentional late stop to validate outside-hours signaling.",
    customerConcern: "Fleet unit only available after store close.",
    internalSummary: "Outside-hours seed.",
    scheduledStartAt: buildIso(0, 18, 30),
    scheduledEndAt: buildIso(0, 20, 0),
    arrivalWindowStartAt: buildIso(0, 18, 0),
    arrivalWindowEndAt: buildIso(0, 19, 0)
  });

  for (let i = 0; i < 4; i += 1) {
    const customerIndex = (i * 3 + 5) % CUSTOMER_SEEDS.length;
    const serviceTitle = SERVICE_TITLES[(i * 5 + 2) % SERVICE_TITLES.length];
    const [firstName, lastName] = CUSTOMER_SEEDS[customerIndex];
    const scheduledStartAt = buildIso(i < 2 ? 0 : 1, 8 + i, i % 2 === 0 ? 0 : 30);

    seeds.push({
      key: `scheduled-${jobIndex++}`,
      customerIndex,
      vehicleIndex: customerIndex,
      technicianLabel: null,
      status: "scheduled",
      priority: i % 2 === 0 ? "high" : "normal",
      source: "web",
      title: buildTitle(jobIndex, `${serviceTitle} (unassigned)`, firstName, lastName),
      description: "Scheduled but unassigned seeded queue work.",
      customerConcern: "Customer needs a promised window but no lane has been chosen yet.",
      internalSummary: "Unassigned scheduled queue seed.",
      scheduledStartAt,
      scheduledEndAt: addMinutes(scheduledStartAt, 90),
      arrivalWindowStartAt: addMinutes(scheduledStartAt, -30),
      arrivalWindowEndAt: addMinutes(scheduledStartAt, 30)
    });
  }

  for (let i = 0; i < 6; i += 1) {
    const customerIndex = (i * 2 + 1) % CUSTOMER_SEEDS.length;
    const [firstName, lastName] = CUSTOMER_SEEDS[customerIndex];

    seeds.push({
      key: `backlog-${i}`,
      customerIndex,
      vehicleIndex: customerIndex,
      technicianLabel: i < 2 ? TECHNICIANS[i + 2].label : null,
      status: "new",
      priority: i % 3 === 0 ? "high" : "normal",
      source: i % 2 === 0 ? "web" : "phone",
      title: buildTitle(100 + i, `${SERVICE_TITLES[(i + 8) % SERVICE_TITLES.length]} intake`, firstName, lastName),
      description: "Unscheduled seeded backlog item for queue pressure.",
      customerConcern: "Waiting for lane assignment and route placement.",
      internalSummary: "Backlog seed.",
      scheduledStartAt: null,
      scheduledEndAt: null,
      arrivalWindowStartAt: null,
      arrivalWindowEndAt: null
    });
  }

  return seeds;
}

function buildAvailabilitySeeds(technicianIds, createdByUserId) {
  return [
    {
      technicianUserId: technicianIds.alex,
      title: "Lunch hold",
      blockType: "break",
      startsAt: buildIso(0, 12, 0),
      endsAt: buildIso(0, 12, 30),
      notes: "Seeded lunch hold",
      createdByUserId
    },
    {
      technicianUserId: technicianIds.sam,
      title: "Morning parts pickup",
      blockType: "unavailable",
      startsAt: buildIso(1, 9, 30),
      endsAt: buildIso(1, 10, 30),
      notes: "Seeded availability conflict",
      createdByUserId
    },
    {
      technicianUserId: technicianIds.riley,
      title: "Shop huddle",
      blockType: "training",
      startsAt: buildIso(2, 8, 0),
      endsAt: buildIso(2, 9, 0),
      notes: "Seeded training block",
      createdByUserId
    },
    {
      technicianUserId: technicianIds.mia,
      title: "Fleet paperwork window",
      blockType: "unavailable",
      startsAt: buildIso(0, 15, 0),
      endsAt: buildIso(0, 16, 0),
      notes: "Seeded overlap block",
      createdByUserId
    },
    {
      technicianUserId: technicianIds.diego,
      title: "Lunch hold",
      blockType: "break",
      startsAt: buildIso(3, 12, 0),
      endsAt: buildIso(3, 12, 30),
      notes: "Seeded lunch hold",
      createdByUserId
    },
    {
      technicianUserId: technicianIds.nora,
      title: "Warranty callback",
      blockType: "time_off",
      startsAt: buildIso(4, 14, 0),
      endsAt: buildIso(4, 15, 30),
      notes: "Seeded calendar pressure block",
      createdByUserId
    }
  ];
}

async function ensureCustomer({ supabaseUrl, serviceRoleKey, companyId, seed }) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "customers",
    filters: {
      company_id: `eq.${companyId}`,
      email: `eq.${seed.email}`
    }
  });

  const payload = {
    company_id: companyId,
    first_name: seed.firstName,
    last_name: seed.lastName,
    email: seed.email,
    phone: seed.phone,
    notes: seed.notes,
    is_active: true
  };

  if (!existing) {
    return insertRow({ supabaseUrl, serviceRoleKey, table: "customers", payload });
  }

  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "customers",
    filters: { id: `eq.${existing.id}` },
    payload
  });

  return rows[0] ?? existing;
}

async function ensureVehicle({ supabaseUrl, serviceRoleKey, companyId, seed }) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "vehicles",
    filters: {
      company_id: `eq.${companyId}`,
      vin: `eq.${seed.vin}`
    }
  });

  const payload = {
    company_id: companyId,
    customer_id: seed.customerId,
    year: seed.year,
    make: seed.make,
    model: seed.model,
    trim: seed.trim,
    engine: seed.engine,
    license_plate: seed.licensePlate,
    license_state: seed.licenseState,
    vin: seed.vin,
    color: seed.color,
    odometer: seed.odometer,
    notes: seed.notes,
    is_active: true
  };

  if (!existing) {
    return insertRow({ supabaseUrl, serviceRoleKey, table: "vehicles", payload });
  }

  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "vehicles",
    filters: { id: `eq.${existing.id}` },
    payload
  });

  return rows[0] ?? existing;
}

async function ensureJob({
  supabaseUrl,
  serviceRoleKey,
  companyId,
  customerId,
  vehicleId,
  createdByUserId,
  assignedTechnicianUserId,
  seed
}) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "jobs",
    filters: {
      company_id: `eq.${companyId}`,
      customer_id: `eq.${customerId}`,
      vehicle_id: `eq.${vehicleId}`,
      title: `eq.${seed.title}`
    }
  });

  const payload = {
    company_id: companyId,
    customer_id: customerId,
    vehicle_id: vehicleId,
    status: seed.status,
    title: seed.title,
    description: seed.description,
    customer_concern: seed.customerConcern,
    internal_summary: seed.internalSummary,
    scheduled_start_at: seed.scheduledStartAt,
    scheduled_end_at: seed.scheduledEndAt,
    arrival_window_start_at: seed.arrivalWindowStartAt,
    arrival_window_end_at: seed.arrivalWindowEndAt,
    assigned_technician_user_id: assignedTechnicianUserId,
    priority: seed.priority,
    source: seed.source,
    is_active: true,
    created_by_user_id: createdByUserId
  };

  if (!existing) {
    return insertRow({ supabaseUrl, serviceRoleKey, table: "jobs", payload });
  }

  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "jobs",
    filters: { id: `eq.${existing.id}` },
    payload
  });

  return rows[0] ?? existing;
}

async function ensureAvailabilityBlock({
  supabaseUrl,
  serviceRoleKey,
  companyId,
  seed
}) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "technician_availability_blocks",
    filters: {
      company_id: `eq.${companyId}`,
      technician_user_id: `eq.${seed.technicianUserId}`,
      title: `eq.${seed.title}`,
      starts_at: `eq.${seed.startsAt}`
    }
  });

  const payload = {
    company_id: companyId,
    technician_user_id: seed.technicianUserId,
    block_type: seed.blockType,
    title: seed.title,
    starts_at: seed.startsAt,
    ends_at: seed.endsAt,
    is_all_day: false,
    notes: seed.notes,
    created_by_user_id: seed.createdByUserId
  };

  if (!existing) {
    return insertRow({
      supabaseUrl,
      serviceRoleKey,
      table: "technician_availability_blocks",
      payload
    });
  }

  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "technician_availability_blocks",
    filters: { id: `eq.${existing.id}` },
    payload
  });

  return rows[0] ?? existing;
}

async function main() {
  const env = getBootstrapEnv();
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);

  const company = await getCompanyBySlug({
    supabaseUrl,
    serviceRoleKey,
    slug: COMPANY_SLUG
  });

  if (!company) {
    throw new Error(
      `Company ${COMPANY_SLUG} was not found. Run pnpm bootstrap:dev-users first.`
    );
  }

  const dispatcherUserId = await upsertAuthUser({
    supabaseUrl,
    serviceRoleKey,
    email: "dispatch@northloopauto.com",
    password: DEFAULT_PASSWORD
  });

  await upsertMembership({
    supabaseUrl,
    serviceRoleKey,
    companyId: company.id,
    userId: dispatcherUserId,
    role: "dispatcher"
  });

  const technicianIds = {};

  for (const technician of TECHNICIANS) {
    const userId = await upsertAuthUser({
      supabaseUrl,
      serviceRoleKey,
      email: technician.email,
      password: DEFAULT_PASSWORD
    });

    technicianIds[technician.label] = userId;

    await upsertMembership({
      supabaseUrl,
      serviceRoleKey,
      companyId: company.id,
      userId,
      role: "technician"
    });

    await updateProfileByEmail({
      supabaseUrl,
      serviceRoleKey,
      email: technician.email,
      payload: {
        full_name: technician.fullName,
        phone: technician.phone,
        technician_bio: technician.bio,
        technician_certifications: technician.certifications,
        years_experience: technician.yearsExperience,
        meet_your_mechanic_enabled: true,
        default_company_id: company.id
      }
    });

    await upsertRestRow({
      supabaseUrl,
      serviceRoleKey,
      table: "dispatch_resource_preferences",
      onConflict: "company_id,technician_user_id",
      payload: {
        company_id: company.id,
        technician_user_id: userId,
        lane_order: technician.laneOrder,
        lane_color: technician.laneColor,
        is_visible_by_default: true
      }
    });
  }

  await upsertRestRow({
    supabaseUrl,
    serviceRoleKey,
    table: "dispatch_calendar_settings",
    onConflict: "company_id",
    payload: {
      company_id: company.id,
      week_starts_on: 1,
      day_start_hour: 7,
      day_end_hour: 19,
      slot_minutes: 30,
      show_saturday: true,
      show_sunday: true,
      default_view: "day",
      updated_by_user_id: dispatcherUserId
    }
  });

  const customers = [];
  const vehicles = [];

  for (let index = 0; index < CUSTOMER_SEEDS.length; index += 1) {
    const [firstName, lastName, descriptor] = CUSTOMER_SEEDS[index];
    const customer = await ensureCustomer({
      supabaseUrl,
      serviceRoleKey,
      companyId: company.id,
      seed: {
        firstName,
        lastName,
        email: buildCustomerEmail(index),
        phone: buildCustomerPhone(index),
        notes: "Seeded customer for dispatch stress testing."
      }
    });
    customers.push(customer);

    const vehicle = await ensureVehicle({
      supabaseUrl,
      serviceRoleKey,
      companyId: company.id,
      seed: buildVehicleSeed(index, customer.id, descriptor)
    });
    vehicles.push(vehicle);
  }

  const scheduledJobSeeds = buildScheduledJobSeeds();
  let scheduledCount = 0;
  let unassignedScheduledCount = 0;
  let backlogCount = 0;

  for (const seed of scheduledJobSeeds) {
    await ensureJob({
      supabaseUrl,
      serviceRoleKey,
      companyId: company.id,
      customerId: customers[seed.customerIndex].id,
      vehicleId: vehicles[seed.vehicleIndex].id,
      createdByUserId: dispatcherUserId,
      assignedTechnicianUserId: seed.technicianLabel ? technicianIds[seed.technicianLabel] : null,
      seed
    });

    if (seed.scheduledStartAt) {
      scheduledCount += 1;

      if (!seed.technicianLabel) {
        unassignedScheduledCount += 1;
      }
    } else {
      backlogCount += 1;
    }
  }

  for (const blockSeed of buildAvailabilitySeeds(technicianIds, dispatcherUserId)) {
    await ensureAvailabilityBlock({
      supabaseUrl,
      serviceRoleKey,
      companyId: company.id,
      seed: blockSeed
    });
  }

  console.log("");
  console.log(`Seeded dispatch stress data for ${company.name}.`);
  console.log(`Technician lanes: ${TECHNICIANS.length}`);
  console.log(`Scheduled jobs in active week: ${scheduledCount}`);
  console.log(`Scheduled but unassigned queue jobs: ${unassignedScheduledCount}`);
  console.log(`Backlog jobs: ${backlogCount}`);
  console.log("Availability blocks: 6");
  console.log("");
  console.log("Login: dispatch@northloopauto.com / Password123!");
  console.log("Dispatch: http://localhost:3000/dashboard/dispatch");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
