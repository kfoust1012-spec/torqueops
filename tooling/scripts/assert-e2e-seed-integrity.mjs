import {
  buildHeaders,
  getBootstrapEnv,
  getCompanyBySlug,
  listRows,
  requestJson,
  required,
  waitForStorageReady,
  webEnvPath
} from "./lib/bootstrap-utils.mjs";

const DEMO_COMPANY_SLUG = "north-loop-mobile-auto";

const PROFILE_PHOTO_EXPECTATIONS = [
  {
    email: "alex.tech@northloopauto.com",
    bucket: "technician-profile-photos",
    path: "seed/alex-mercer/profile-photo.png"
  },
  {
    email: "sam.tech@northloopauto.com",
    bucket: "technician-profile-photos",
    path: "seed/sam-patel/profile-photo.png"
  }
];

const ATTACHMENT_EXPECTATIONS = [
  {
    fileName: "coolant-leak-before.png",
    bucket: "job-attachments"
  },
  {
    fileName: "engine-bay-overview.png",
    bucket: "job-attachments"
  },
  {
    fileName: "coolant-reservoir.png",
    bucket: "job-attachments"
  },
  {
    fileName: "maintenance-overview.png",
    bucket: "job-attachments"
  }
];

const SIGNATURE_EXPECTATIONS = [
  {
    estimateNumber: "EST-1004",
    approvedByName: "Marcus Hill",
    bucket: "estimate-signatures",
    path: "seed/signatures/est-1004.png"
  }
];

const SERVICE_SITE_EXPECTATIONS = [
  {
    customerEmail: "jamie.carter@example.com",
    label: "service",
    line1: "123 Service Lane",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    gateCode: null,
    parkingNotes: "Driveway parking available",
    jobTitles: ["Front brake inspection and estimate"]
  },
  {
    customerEmail: "priya.shah@example.com",
    label: "home",
    line1: "4102 Barton Creek Blvd",
    city: "Austin",
    state: "TX",
    postalCode: "78735",
    gateCode: "2045",
    parkingNotes: "Visitor parking at building entrance",
    jobTitles: ["No-start battery and charging diagnosis", "Cooling system diagnosis"]
  },
  {
    customerEmail: "marcus.hill@example.com",
    label: "work",
    line1: "9801 Great Hills Trail",
    city: "Austin",
    state: "TX",
    postalCode: "78759",
    gateCode: null,
    parkingNotes: "Check in with front desk",
    jobTitles: ["60k maintenance service", "Front struts and alignment"]
  },
  {
    customerEmail: "ben.turner@example.com",
    label: "service",
    line1: "2500 E Riverside Dr",
    city: "Austin",
    state: "TX",
    postalCode: "78741",
    gateCode: null,
    parkingNotes: "Meet at loading dock entrance",
    jobTitles: ["Wheel bearing and hub replacement"]
  },
  {
    customerEmail: "claire.nguyen@example.com",
    label: "home",
    line1: "1501 S Lamar Blvd",
    city: "Austin",
    state: "TX",
    postalCode: "78704",
    gateCode: null,
    parkingNotes: "Park in spot 17",
    jobTitles: ["Brake pad and rotor replacement"]
  }
];

const INVOICE_STATE_EXPECTATIONS = [
  {
    invoiceNumber: "INV-1003",
    jobTitle: "Cooling system diagnosis",
    status: "draft",
    amountPaidCents: 0,
    balanceDue: "positive",
    paymentCount: 0
  },
  {
    invoiceNumber: "INV-1006",
    jobTitle: "Wheel bearing and hub replacement",
    status: "partially_paid",
    amountPaidCents: 40000,
    balanceDue: "positive",
    paymentCount: 1
  },
  {
    invoiceNumber: "INV-1007",
    jobTitle: "Brake pad and rotor replacement",
    status: "paid",
    amountPaidCents: 71594,
    balanceDue: "zero",
    paymentCount: 1
  }
];

const DISPATCH_STRESS_EXPECTATIONS = {
  laneCount: 6,
  scheduledJobs: 66,
  unassignedScheduledJobs: 4,
  backlogJobs: 6,
  availabilityBlocks: 6
};

const OPERATOR_EXPECTATIONS = [
  {
    email: "dispatch@northloopauto.com",
    role: "dispatcher",
    fullName: "Taylor Brooks",
    phone: "555-210-1003"
  },
  {
    email: "alex.tech@northloopauto.com",
    role: "technician",
    fullName: "Alex Mercer",
    phone: "555-210-1101",
    yearsExperience: 9,
    meetYourMechanicEnabled: true,
    laneOrder: 1,
    laneColor: "#1f6feb"
  },
  {
    email: "sam.tech@northloopauto.com",
    role: "technician",
    fullName: "Sam Patel",
    phone: "555-210-1102",
    yearsExperience: 6,
    meetYourMechanicEnabled: true,
    laneOrder: 2,
    laneColor: "#0ea5a3"
  },
  {
    email: "riley.tech@northloopauto.com",
    role: "technician",
    fullName: "Riley Ortiz",
    phone: "555-210-1103",
    yearsExperience: 8,
    meetYourMechanicEnabled: true,
    laneOrder: 3,
    laneColor: "#f59e0b"
  },
  {
    email: "mia.tech@northloopauto.com",
    role: "technician",
    fullName: "Mia Chen",
    phone: "555-210-1104",
    yearsExperience: 7,
    meetYourMechanicEnabled: true,
    laneOrder: 4,
    laneColor: "#ef4444"
  },
  {
    email: "diego.tech@northloopauto.com",
    role: "technician",
    fullName: "Diego Alvarez",
    phone: "555-210-1105",
    yearsExperience: 11,
    meetYourMechanicEnabled: true,
    laneOrder: 5,
    laneColor: "#7c3aed"
  },
  {
    email: "nora.tech@northloopauto.com",
    role: "technician",
    fullName: "Nora Kim",
    phone: "555-210-1106",
    yearsExperience: 5,
    meetYourMechanicEnabled: true,
    laneOrder: 6,
    laneColor: "#14b8a6"
  }
];

const COMMAND_SEARCH_EXPECTATIONS = [
  {
    label: "Front brake inspection and estimate",
    table: "jobs",
    select: "id,title",
    filters: {
      title: "eq.Front brake inspection and estimate"
    },
    field: "title"
  },
  {
    label: "123 Service Lane",
    table: "customer_addresses",
    select: "id,line1,is_active",
    filters: {
      line1: "eq.123 Service Lane"
    },
    field: "line1"
  },
  {
    label: "INV-1006",
    table: "invoices",
    select: "id,invoice_number",
    filters: {
      invoice_number: "eq.INV-1006"
    },
    field: "invoice_number"
  }
];

const COMMUNICATION_EXPECTATIONS = [
  {
    key: "job1001-appointment-email",
    customerEmail: "jamie.carter@example.com",
    jobTitle: "Front brake inspection and estimate",
    eventType: "appointment_confirmation_requested",
    communicationType: "appointment_confirmation",
    triggerSource: "manual",
    channel: "email",
    status: "delivered",
    provider: "resend",
    subject: "Your North Loop Mobile Auto appointment is confirmed",
    recipientEmail: "jamie.carter@example.com",
    recipientPhone: null,
    payload: {},
    attemptResults: [true],
    attemptErrors: [null]
  },
  {
    key: "job1002-dispatched-sms",
    customerEmail: "priya.shah@example.com",
    jobTitle: "No-start battery and charging diagnosis",
    eventType: "dispatch_update_requested",
    communicationType: "dispatch_update",
    triggerSource: "workflow",
    channel: "sms",
    status: "delivered",
    provider: "twilio",
    subject: null,
    recipientEmail: null,
    recipientPhone: "555-0102",
    payload: {
      dispatchUpdateType: "dispatched"
    },
    attemptResults: [true],
    attemptErrors: [null]
  },
  {
    key: "job1006-reminder-email",
    customerEmail: "ben.turner@example.com",
    jobTitle: "Wheel bearing and hub replacement",
    invoiceNumber: "INV-1006",
    eventType: "payment_reminder_requested",
    communicationType: "payment_reminder",
    triggerSource: "manual",
    channel: "email",
    status: "delivered",
    provider: "resend",
    subject: "Payment reminder from North Loop Mobile Auto",
    recipientEmail: "ben.turner@example.com",
    recipientPhone: null,
    payload: {
      reminderStage: "due"
    },
    attemptResults: [false, true],
    attemptErrors: ["Transient provider timeout", null]
  }
];

async function getSingleRow({ supabaseUrl, serviceRoleKey, table, filters, select, label }) {
  const rows = await listRows({
    supabaseUrl,
    serviceRoleKey,
    table,
    filters,
    select
  });

  if (rows.length !== 1) {
    throw new Error(`${label} expected 1 row in ${table}, found ${rows.length}.`);
  }

  return rows[0];
}

async function assertStorageObjectExists({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  objectPath,
  label
}) {
  const metadata = await requestJson(
    `${supabaseUrl}/storage/v1/object/info/${bucket}/${objectPath}`,
    {
      method: "GET",
      headers: buildHeaders(serviceRoleKey)
    }
  );

  if (!metadata?.id) {
    throw new Error(`${label} is missing storage metadata for ${bucket}/${objectPath}.`);
  }

  if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) <= 0) {
    throw new Error(`${label} has invalid storage size for ${bucket}/${objectPath}.`);
  }
}

async function assertProfilePhotos({ supabaseUrl, serviceRoleKey }) {
  for (const expectation of PROFILE_PHOTO_EXPECTATIONS) {
    const profile = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "profiles",
      filters: {
        email: `eq.${expectation.email}`
      },
      select: "id,email,profile_photo_bucket,profile_photo_path",
      label: `profile ${expectation.email}`
    });

    if (profile.profile_photo_bucket !== expectation.bucket) {
      throw new Error(
        `profile ${expectation.email} expected bucket ${expectation.bucket}, found ${profile.profile_photo_bucket ?? "null"}.`
      );
    }

    if (profile.profile_photo_path !== expectation.path) {
      throw new Error(
        `profile ${expectation.email} expected path ${expectation.path}, found ${profile.profile_photo_path ?? "null"}.`
      );
    }

    await assertStorageObjectExists({
      supabaseUrl,
      serviceRoleKey,
      bucket: expectation.bucket,
      objectPath: expectation.path,
      label: `profile photo for ${expectation.email}`
    });
  }
}

async function assertAttachments({ supabaseUrl, serviceRoleKey }) {
  for (const expectation of ATTACHMENT_EXPECTATIONS) {
    const attachment = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "attachments",
      filters: {
        file_name: `eq.${expectation.fileName}`,
        storage_bucket: `eq.${expectation.bucket}`
      },
      select: "id,job_id,file_name,storage_bucket,storage_path",
      label: `attachment ${expectation.fileName}`
    });

    if (!attachment.job_id) {
      throw new Error(`attachment ${expectation.fileName} is missing job_id linkage.`);
    }

    if (!attachment.storage_path?.endsWith(`/${expectation.fileName}`)) {
      throw new Error(
        `attachment ${expectation.fileName} has unexpected storage path ${attachment.storage_path ?? "null"}.`
      );
    }

    await assertStorageObjectExists({
      supabaseUrl,
      serviceRoleKey,
      bucket: expectation.bucket,
      objectPath: attachment.storage_path,
      label: `attachment ${expectation.fileName}`
    });
  }
}

async function assertSignatures({ supabaseUrl, serviceRoleKey }) {
  for (const expectation of SIGNATURE_EXPECTATIONS) {
    const estimate = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "estimates",
      filters: {
        estimate_number: `eq.${expectation.estimateNumber}`
      },
      select: "id,estimate_number,status,approved_signature_id",
      label: `estimate ${expectation.estimateNumber}`
    });

    if (estimate.status !== "accepted") {
      throw new Error(
        `estimate ${expectation.estimateNumber} expected accepted status, found ${estimate.status}.`
      );
    }

    const signature = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "signatures",
      filters: {
        estimate_id: `eq.${estimate.id}`
      },
      select: "id,estimate_id,signed_by_name,storage_bucket,storage_path",
      label: `signature for ${expectation.estimateNumber}`
    });

    if (estimate.approved_signature_id !== signature.id) {
      throw new Error(
        `estimate ${expectation.estimateNumber} does not point at its signature row.`
      );
    }

    if (signature.signed_by_name !== expectation.approvedByName) {
      throw new Error(
        `signature for ${expectation.estimateNumber} expected signer ${expectation.approvedByName}, found ${signature.signed_by_name ?? "null"}.`
      );
    }

    if (signature.storage_bucket !== expectation.bucket || signature.storage_path !== expectation.path) {
      throw new Error(
        `signature for ${expectation.estimateNumber} has unexpected storage link ${signature.storage_bucket ?? "null"}/${signature.storage_path ?? "null"}.`
      );
    }

    await assertStorageObjectExists({
      supabaseUrl,
      serviceRoleKey,
      bucket: expectation.bucket,
      objectPath: expectation.path,
      label: `signature for ${expectation.estimateNumber}`
    });
  }
}

function assertFieldEquals(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected ?? "null"}, found ${actual ?? "null"}.`);
  }
}

function assertObjectContains(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    assertFieldEquals(actual?.[key] ?? null, value, `${label}.${key}`);
  }
}

async function assertServiceSites({ supabaseUrl, serviceRoleKey }) {
  for (const expectation of SERVICE_SITE_EXPECTATIONS) {
    const customer = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "customers",
      filters: {
        email: `eq.${expectation.customerEmail}`
      },
      select: "id,email",
      label: `customer ${expectation.customerEmail}`
    });

    const site = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "customer_addresses",
      filters: {
        customer_id: `eq.${customer.id}`,
        line1: `eq.${expectation.line1}`
      },
      select:
        "id,label,line1,city,state,postal_code,gate_code,parking_notes,is_primary,is_active",
      label: `service site ${expectation.customerEmail}`
    });

    assertFieldEquals(site.label, expectation.label, `service site label for ${expectation.customerEmail}`);
    assertFieldEquals(site.line1, expectation.line1, `service site line1 for ${expectation.customerEmail}`);
    assertFieldEquals(site.city, expectation.city, `service site city for ${expectation.customerEmail}`);
    assertFieldEquals(site.state, expectation.state, `service site state for ${expectation.customerEmail}`);
    assertFieldEquals(
      site.postal_code,
      expectation.postalCode,
      `service site postal code for ${expectation.customerEmail}`
    );
    assertFieldEquals(
      site.gate_code ?? null,
      expectation.gateCode,
      `service site gate code for ${expectation.customerEmail}`
    );
    assertFieldEquals(
      site.parking_notes ?? null,
      expectation.parkingNotes,
      `service site parking notes for ${expectation.customerEmail}`
    );

    if (!site.is_primary || !site.is_active) {
      throw new Error(`service site ${expectation.customerEmail} must be primary and active.`);
    }

    const jobs = await listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "jobs",
      filters: {
        customer_id: `eq.${customer.id}`
      },
      select: "id,title,service_site_id"
    });

    for (const title of expectation.jobTitles) {
      const job = jobs.find((candidate) => candidate.title === title);

      if (!job) {
        throw new Error(`job ${title} for ${expectation.customerEmail} is missing.`);
      }

      assertFieldEquals(
        job.service_site_id,
        site.id,
        `service_site_id for job ${title}`
      );
    }
  }
}

async function assertInvoiceStates({ supabaseUrl, serviceRoleKey }) {
  for (const expectation of INVOICE_STATE_EXPECTATIONS) {
    const invoice = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "invoices",
      filters: {
        invoice_number: `eq.${expectation.invoiceNumber}`
      },
      select: "id,invoice_number,status,job_id,total_cents,amount_paid_cents,balance_due_cents",
      label: `invoice ${expectation.invoiceNumber}`
    });

    assertFieldEquals(invoice.status, expectation.status, `status for ${expectation.invoiceNumber}`);
    assertFieldEquals(
      invoice.amount_paid_cents,
      expectation.amountPaidCents,
      `amount paid for ${expectation.invoiceNumber}`
    );

    if (expectation.balanceDue === "zero" && invoice.balance_due_cents !== 0) {
      throw new Error(
        `invoice ${expectation.invoiceNumber} expected zero balance, found ${invoice.balance_due_cents}.`
      );
    }

    if (expectation.balanceDue === "positive" && invoice.balance_due_cents <= 0) {
      throw new Error(
        `invoice ${expectation.invoiceNumber} expected positive balance, found ${invoice.balance_due_cents}.`
      );
    }

    if (invoice.total_cents <= 0) {
      throw new Error(`invoice ${expectation.invoiceNumber} must have a positive total.`);
    }

    const job = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "jobs",
      filters: {
        id: `eq.${invoice.job_id}`
      },
      select: "id,title",
      label: `job for invoice ${expectation.invoiceNumber}`
    });

    assertFieldEquals(job.title, expectation.jobTitle, `job title for ${expectation.invoiceNumber}`);

    const payments = await listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "payments",
      filters: {
        invoice_id: `eq.${invoice.id}`
      },
      select: "id,amount_cents,receipt_url,stripe_checkout_session_id"
    });

    assertFieldEquals(
      payments.length,
      expectation.paymentCount,
      `payment count for ${expectation.invoiceNumber}`
    );

    const paidAmount = payments.reduce((sum, payment) => sum + payment.amount_cents, 0);

    assertFieldEquals(
      paidAmount,
      invoice.amount_paid_cents,
      `payment sum for ${expectation.invoiceNumber}`
    );

    if (expectation.paymentCount > 0) {
      for (const payment of payments) {
        if (!payment.receipt_url || !payment.stripe_checkout_session_id) {
          throw new Error(
            `payment ${payment.id} for ${expectation.invoiceNumber} is missing receipt_url or checkout session.`
          );
        }
      }
    }
  }
}

async function assertDispatchStressState({ supabaseUrl, serviceRoleKey }) {
  const company = await getCompanyBySlug({
    supabaseUrl,
    serviceRoleKey,
    slug: DEMO_COMPANY_SLUG
  });

  if (!company) {
    throw new Error(`Company ${DEMO_COMPANY_SLUG} is missing.`);
  }

  const jobs = await listRows({
    supabaseUrl,
    serviceRoleKey,
    table: "jobs",
    filters: {
      company_id: `eq.${company.id}`
    },
    select: "id,title,scheduled_start_at,assigned_technician_user_id"
  });

  const stressJobs = jobs.filter((job) => job.title?.startsWith("Stress"));
  const scheduledJobs = stressJobs.filter((job) => job.scheduled_start_at).length;
  const unassignedScheduledJobs = stressJobs.filter(
    (job) => job.scheduled_start_at && !job.assigned_technician_user_id
  ).length;
  const backlogJobs = stressJobs.filter((job) => !job.scheduled_start_at).length;

  assertFieldEquals(
    scheduledJobs,
    DISPATCH_STRESS_EXPECTATIONS.scheduledJobs,
    "dispatch stress scheduled job count"
  );
  assertFieldEquals(
    unassignedScheduledJobs,
    DISPATCH_STRESS_EXPECTATIONS.unassignedScheduledJobs,
    "dispatch stress unassigned scheduled job count"
  );
  assertFieldEquals(
    backlogJobs,
    DISPATCH_STRESS_EXPECTATIONS.backlogJobs,
    "dispatch stress backlog job count"
  );

  const preferences = await listRows({
    supabaseUrl,
    serviceRoleKey,
    table: "dispatch_resource_preferences",
    filters: {
      company_id: `eq.${company.id}`
    },
    select: "technician_user_id,lane_order,is_visible_by_default"
  });

  const visiblePreferences = preferences.filter((preference) => preference.is_visible_by_default);
  const uniqueLaneOrders = new Set(visiblePreferences.map((preference) => preference.lane_order));

  assertFieldEquals(
    visiblePreferences.length,
    DISPATCH_STRESS_EXPECTATIONS.laneCount,
    "dispatch visible lane count"
  );
  assertFieldEquals(
    uniqueLaneOrders.size,
    DISPATCH_STRESS_EXPECTATIONS.laneCount,
    "dispatch unique lane order count"
  );

  const availabilityBlocks = await listRows({
    supabaseUrl,
    serviceRoleKey,
    table: "technician_availability_blocks",
    filters: {
      company_id: `eq.${company.id}`
    },
    select: "id"
  });

  assertFieldEquals(
    availabilityBlocks.length,
    DISPATCH_STRESS_EXPECTATIONS.availabilityBlocks,
    "dispatch availability block count"
  );

  await getSingleRow({
    supabaseUrl,
    serviceRoleKey,
    table: "dispatch_calendar_settings",
    filters: {
      company_id: `eq.${company.id}`
    },
    select: "company_id,default_view,slot_minutes",
    label: "dispatch calendar settings"
  });
}

async function assertOperatorFixtures({ supabaseUrl, serviceRoleKey }) {
  const company = await getCompanyBySlug({
    supabaseUrl,
    serviceRoleKey,
    slug: DEMO_COMPANY_SLUG
  });

  if (!company) {
    throw new Error(`Company ${DEMO_COMPANY_SLUG} is missing.`);
  }

  for (const expectation of OPERATOR_EXPECTATIONS) {
    const profile = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "profiles",
      filters: {
        email: `eq.${expectation.email}`
      },
      select:
        "id,email,full_name,phone,default_company_id,years_experience,meet_your_mechanic_enabled",
      label: `operator profile ${expectation.email}`
    });

    assertFieldEquals(profile.full_name, expectation.fullName, `full name for ${expectation.email}`);
    assertFieldEquals(profile.phone, expectation.phone, `phone for ${expectation.email}`);
    assertFieldEquals(
      profile.default_company_id,
      company.id,
      `default company for ${expectation.email}`
    );

    if (Object.hasOwn(expectation, "yearsExperience")) {
      assertFieldEquals(
        profile.years_experience,
        expectation.yearsExperience,
        `years experience for ${expectation.email}`
      );
    }

    if (Object.hasOwn(expectation, "meetYourMechanicEnabled")) {
      assertFieldEquals(
        profile.meet_your_mechanic_enabled,
        expectation.meetYourMechanicEnabled,
        `meet your mechanic flag for ${expectation.email}`
      );
    }

    const membership = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "company_memberships",
      filters: {
        company_id: `eq.${company.id}`,
        user_id: `eq.${profile.id}`
      },
      select: "user_id,role,is_active",
      label: `company membership for ${expectation.email}`
    });

    assertFieldEquals(membership.role, expectation.role, `role for ${expectation.email}`);
    assertFieldEquals(membership.is_active, true, `active membership for ${expectation.email}`);

    if (Object.hasOwn(expectation, "laneOrder")) {
      const preference = await getSingleRow({
        supabaseUrl,
        serviceRoleKey,
        table: "dispatch_resource_preferences",
        filters: {
          company_id: `eq.${company.id}`,
          technician_user_id: `eq.${profile.id}`
        },
        select: "technician_user_id,lane_order,lane_color,is_visible_by_default",
        label: `dispatch lane for ${expectation.email}`
      });

      assertFieldEquals(
        preference.lane_order,
        expectation.laneOrder,
        `lane order for ${expectation.email}`
      );
      assertFieldEquals(
        preference.lane_color,
        expectation.laneColor,
        `lane color for ${expectation.email}`
      );
      assertFieldEquals(
        preference.is_visible_by_default,
        true,
        `lane visibility for ${expectation.email}`
      );
    }
  }
}

async function assertCommandSearchFixtures({ supabaseUrl, serviceRoleKey }) {
  for (const expectation of COMMAND_SEARCH_EXPECTATIONS) {
    const row = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: expectation.table,
      filters: expectation.filters,
      select: expectation.select,
      label: `command search fixture ${expectation.label}`
    });

    assertFieldEquals(
      row[expectation.field],
      expectation.label,
      `command search identity ${expectation.label}`
    );

    if (Object.hasOwn(row, "is_active")) {
      assertFieldEquals(
        row.is_active,
        true,
        `command search active flag for ${expectation.label}`
      );
    }
  }
}

async function assertCommunicationFixtures({ supabaseUrl, serviceRoleKey }) {
  for (const expectation of COMMUNICATION_EXPECTATIONS) {
    const customer = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "customers",
      filters: {
        email: `eq.${expectation.customerEmail}`
      },
      select: "id,email",
      label: `communication customer ${expectation.customerEmail}`
    });

    const event = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "communication_events",
      filters: {
        idempotency_key: `eq.seed:${expectation.key}`
      },
      select:
        "id,customer_id,job_id,invoice_id,event_type,communication_type,trigger_source,payload",
      label: `communication event ${expectation.key}`
    });

    assertFieldEquals(event.customer_id, customer.id, `event customer for ${expectation.key}`);
    assertFieldEquals(event.event_type, expectation.eventType, `event type for ${expectation.key}`);
    assertFieldEquals(
      event.communication_type,
      expectation.communicationType,
      `event communication type for ${expectation.key}`
    );
    assertFieldEquals(
      event.trigger_source,
      expectation.triggerSource,
      `event trigger source for ${expectation.key}`
    );
    assertObjectContains(event.payload ?? {}, expectation.payload, `event payload for ${expectation.key}`);

    const job = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "jobs",
      filters: {
        title: `eq.${expectation.jobTitle}`
      },
      select: "id,title",
      label: `communication job ${expectation.jobTitle}`
    });

    assertFieldEquals(event.job_id, job.id, `event job for ${expectation.key}`);

    if (expectation.invoiceNumber) {
      const invoice = await getSingleRow({
        supabaseUrl,
        serviceRoleKey,
        table: "invoices",
        filters: {
          invoice_number: `eq.${expectation.invoiceNumber}`
        },
        select: "id,invoice_number",
        label: `communication invoice ${expectation.invoiceNumber}`
      });

      assertFieldEquals(event.invoice_id, invoice.id, `event invoice for ${expectation.key}`);
    } else {
      assertFieldEquals(event.invoice_id ?? null, null, `event invoice for ${expectation.key}`);
    }

    const communication = await getSingleRow({
      supabaseUrl,
      serviceRoleKey,
      table: "customer_communications",
      filters: {
        event_id: `eq.${event.id}`
      },
      select:
        "id,event_id,job_id,invoice_id,communication_type,channel,status,provider,subject,recipient_email,recipient_phone,provider_metadata",
      label: `customer communication ${expectation.key}`
    });

    assertFieldEquals(
      communication.job_id,
      job.id,
      `communication job for ${expectation.key}`
    );
    assertFieldEquals(
      communication.communication_type,
      expectation.communicationType,
      `communication type for ${expectation.key}`
    );
    assertFieldEquals(communication.channel, expectation.channel, `channel for ${expectation.key}`);
    assertFieldEquals(communication.status, expectation.status, `status for ${expectation.key}`);
    assertFieldEquals(communication.provider, expectation.provider, `provider for ${expectation.key}`);
    assertFieldEquals(communication.subject ?? null, expectation.subject, `subject for ${expectation.key}`);
    assertFieldEquals(
      communication.recipient_email ?? null,
      expectation.recipientEmail,
      `recipient email for ${expectation.key}`
    );
    assertFieldEquals(
      communication.recipient_phone ?? null,
      expectation.recipientPhone,
      `recipient phone for ${expectation.key}`
    );
    assertObjectContains(
      communication.provider_metadata ?? {},
      expectation.payload,
      `provider metadata for ${expectation.key}`
    );

    const attempts = await listRows({
      supabaseUrl,
      serviceRoleKey,
      table: "communication_delivery_attempts",
      filters: {
        communication_id: `eq.${communication.id}`
      },
      select: "attempt_number,succeeded,error_message"
    });

    const sortedAttempts = [...attempts].sort((left, right) => left.attempt_number - right.attempt_number);
    assertFieldEquals(
      sortedAttempts.length,
      expectation.attemptResults.length,
      `attempt count for ${expectation.key}`
    );

    for (const [index, attempt] of sortedAttempts.entries()) {
      assertFieldEquals(
        attempt.attempt_number,
        index + 1,
        `attempt number ${index + 1} for ${expectation.key}`
      );
      assertFieldEquals(
        attempt.succeeded,
        expectation.attemptResults[index],
        `attempt success ${index + 1} for ${expectation.key}`
      );
      assertFieldEquals(
        attempt.error_message ?? null,
        expectation.attemptErrors[index],
        `attempt error ${index + 1} for ${expectation.key}`
      );
    }
  }
}

async function main() {
  const env = getBootstrapEnv();
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Using Supabase: ${supabaseUrl}`);
  console.log(`Using env file: ${webEnvPath}`);
  console.log("Verifying e2e seed integrity...");

  await waitForStorageReady({ supabaseUrl, serviceRoleKey });
  await assertProfilePhotos({ supabaseUrl, serviceRoleKey });
  await assertAttachments({ supabaseUrl, serviceRoleKey });
  await assertSignatures({ supabaseUrl, serviceRoleKey });
  await assertServiceSites({ supabaseUrl, serviceRoleKey });
  await assertInvoiceStates({ supabaseUrl, serviceRoleKey });
  await assertDispatchStressState({ supabaseUrl, serviceRoleKey });
  await assertOperatorFixtures({ supabaseUrl, serviceRoleKey });
  await assertCommandSearchFixtures({ supabaseUrl, serviceRoleKey });
  await assertCommunicationFixtures({ supabaseUrl, serviceRoleKey });

  console.log("");
  console.log("E2E seed integrity verified.");
  console.log(`Profile photos: ${PROFILE_PHOTO_EXPECTATIONS.length}`);
  console.log(`Attachments: ${ATTACHMENT_EXPECTATIONS.length}`);
  console.log(`Signatures: ${SIGNATURE_EXPECTATIONS.length}`);
  console.log(`Service sites: ${SERVICE_SITE_EXPECTATIONS.length}`);
  console.log(`Invoice states: ${INVOICE_STATE_EXPECTATIONS.length}`);
  console.log(`Operator fixtures: ${OPERATOR_EXPECTATIONS.length}`);
  console.log(`Command search fixtures: ${COMMAND_SEARCH_EXPECTATIONS.length}`);
  console.log(`Communications: ${COMMUNICATION_EXPECTATIONS.length}`);
  console.log(
    `Dispatch stress: ${DISPATCH_STRESS_EXPECTATIONS.scheduledJobs} scheduled / ${DISPATCH_STRESS_EXPECTATIONS.unassignedScheduledJobs} unassigned / ${DISPATCH_STRESS_EXPECTATIONS.backlogJobs} backlog`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
