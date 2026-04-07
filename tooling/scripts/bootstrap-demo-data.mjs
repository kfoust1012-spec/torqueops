import {
  createTinyPngBuffer,
  findSingle,
  formatCurrencyCents,
  getBootstrapEnv,
  getCompanyBySlug,
  getUserIdByEmail,
  insertRow,
  isoAtOffsetDays,
  isoAtOffsetHours,
  listRows,
  patchRows,
  required,
  rpc,
  uploadStorageObject,
  upsertRestRow,
  waitForStorageReady,
  webEnvPath
} from "./lib/bootstrap-utils.mjs";

const IMAGE_BUFFER = createTinyPngBuffer();
const DEFAULT_SIGNATURE_STATEMENT =
  "I approve the estimate and authorize the shop to perform the listed work.";

const INSPECTION_TEMPLATE = [
  ["tires-wheels", [["tire_condition", "Tire condition"], ["tire_tread_depth", "Tire tread depth"], ["wheel_lug_nuts", "Wheel and lug nut condition"]]],
  ["brakes", [["brake_pads", "Brake pad condition"], ["rotors_drums", "Rotor and drum condition"], ["brake_fluid", "Brake fluid condition"]]],
  ["fluids", [["engine_oil", "Engine oil condition"], ["coolant", "Coolant condition"], ["visible_leaks", "Visible fluid leaks"]]],
  ["battery-charging", [["battery_condition", "Battery condition"], ["battery_terminals", "Battery terminals and corrosion"], ["charging_system", "Charging system output"]]],
  ["belts-hoses", [["drive_belt", "Drive belt condition"], ["coolant_hoses", "Coolant hose condition"], ["hose_wear", "Visible hose wear or cracking"]]],
  ["suspension-steering", [["steering_components", "Steering component condition"], ["suspension_components", "Suspension component condition"], ["wear_alignment", "Wear patterns or alignment concerns"]]],
  ["lights-electrical", [["exterior_lights", "Exterior lights operation"], ["interior_warnings", "Interior warning lights"], ["basic_electrical", "Basic electrical operation"]]],
  ["engine-performance", [["start_idle", "Starting and idle quality"], ["abnormal_noises", "Abnormal noises or vibration"], ["performance_concerns", "Visible performance concerns"]]]
];

function calculateLineSubtotalCents(quantity, unitPriceCents) {
  return Math.round(Number(quantity) * unitPriceCents);
}

function calculateTaxCents(taxableSubtotalCents, taxRateBasisPoints) {
  return Math.round((taxableSubtotalCents * taxRateBasisPoints) / 10000);
}

function calculateTotals({ lineItems, taxRateBasisPoints, discountCents = 0 }) {
  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + calculateLineSubtotalCents(item.quantity, item.unitPriceCents),
    0
  );
  const taxableSubtotalCents = lineItems.reduce((sum, item) => {
    return sum + (item.taxable ? calculateLineSubtotalCents(item.quantity, item.unitPriceCents) : 0);
  }, 0);
  const taxCents = calculateTaxCents(Math.max(0, taxableSubtotalCents - discountCents), taxRateBasisPoints);
  return {
    subtotalCents,
    taxCents,
    totalCents: Math.max(0, subtotalCents - discountCents + taxCents)
  };
}

function buildInspectionItems(companyId, jobId) {
  return INSPECTION_TEMPLATE.flatMap(([sectionKey, items]) =>
    items.map(([itemKey, label], position) => ({
      company_id: companyId,
      job_id: jobId,
      section_key: sectionKey,
      item_key: itemKey,
      label,
      position,
      status: "not_checked",
      finding_severity: null,
      technician_notes: null,
      recommendation: null,
      is_required: true
    }))
  );
}

function buildCustomerFilters(companyId, customerSeed) {
  if (customerSeed.email) {
    return {
      company_id: `eq.${companyId}`,
      email: `eq.${customerSeed.email}`
    };
  }

  return {
    company_id: `eq.${companyId}`,
    first_name: `eq.${customerSeed.firstName}`,
    last_name: `eq.${customerSeed.lastName}`
  };
}

function buildVehicleFilters(companyId, vehicleSeed) {
  if (vehicleSeed.vin) {
    return {
      company_id: `eq.${companyId}`,
      vin: `eq.${vehicleSeed.vin}`
    };
  }

  return {
    company_id: `eq.${companyId}`,
    license_plate: `eq.${vehicleSeed.licensePlate}`,
    customer_id: `eq.${vehicleSeed.customerId}`
  };
}

async function ensureCustomer({ supabaseUrl, serviceRoleKey, company, customerSeed }) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "customers",
    filters: buildCustomerFilters(company.id, customerSeed)
  });

  const payload = {
    company_id: company.id,
    first_name: customerSeed.firstName,
    last_name: customerSeed.lastName,
    email: customerSeed.email,
    phone: customerSeed.phone,
    notes: customerSeed.notes,
    is_active: customerSeed.isActive ?? true
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

async function ensureAddress({ supabaseUrl, serviceRoleKey, company, customer, addressSeed }) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "customer_addresses",
    filters: {
      customer_id: `eq.${customer.id}`,
      label: `eq.${addressSeed.label}`
    }
  });

  const payload = {
    customer_id: customer.id,
    company_id: company.id,
    ...addressSeed
  };

  if (!existing) {
    return insertRow({ supabaseUrl, serviceRoleKey, table: "customer_addresses", payload });
  }

  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "customer_addresses",
    filters: { id: `eq.${existing.id}` },
    payload
  });

  return rows[0] ?? existing;
}

async function ensureCommunicationPreference({
  supabaseUrl,
  serviceRoleKey,
  company,
  customer,
  preferenceSeed
}) {
  return upsertRestRow({
    supabaseUrl,
    serviceRoleKey,
    table: "customer_communication_preferences",
    onConflict: "company_id,customer_id",
    payload: {
      company_id: company.id,
      customer_id: customer.id,
      preferred_channel: preferenceSeed.preferredChannel,
      email_enabled: preferenceSeed.emailEnabled,
      sms_enabled: preferenceSeed.smsEnabled,
      allow_estimate_notifications: true,
      allow_invoice_notifications: true,
      allow_payment_reminders: true,
      allow_appointment_confirmations: true,
      allow_dispatch_updates: true
    }
  });
}

async function ensureVehicle({ supabaseUrl, serviceRoleKey, company, vehicleSeed }) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "vehicles",
    filters: buildVehicleFilters(company.id, vehicleSeed)
  });

  const payload = {
    company_id: company.id,
    customer_id: vehicleSeed.customerId,
    year: vehicleSeed.year,
    make: vehicleSeed.make,
    model: vehicleSeed.model,
    trim: vehicleSeed.trim,
    engine: vehicleSeed.engine,
    license_plate: vehicleSeed.licensePlate,
    license_state: vehicleSeed.licenseState,
    vin: vehicleSeed.vin,
    color: vehicleSeed.color,
    odometer: vehicleSeed.odometer,
    notes: vehicleSeed.notes,
    is_active: vehicleSeed.isActive ?? true
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
  company,
  customer,
  vehicle,
  serviceSite,
  jobSeed,
  assignedTechnicianUserId,
  createdByUserId
}) {
  const existing = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "jobs",
    filters: {
      company_id: `eq.${company.id}`,
      customer_id: `eq.${customer.id}`,
      vehicle_id: `eq.${vehicle.id}`,
      title: `eq.${jobSeed.title}`
    }
  });

  const payload = {
    company_id: company.id,
    customer_id: customer.id,
    vehicle_id: vehicle.id,
    status: jobSeed.status,
    title: jobSeed.title,
    description: jobSeed.description,
    customer_concern: jobSeed.customerConcern,
    internal_summary: jobSeed.internalSummary,
    scheduled_start_at: jobSeed.scheduledStartAt ?? null,
    scheduled_end_at: jobSeed.scheduledEndAt ?? null,
    arrival_window_start_at: jobSeed.arrivalWindowStartAt ?? null,
    arrival_window_end_at: jobSeed.arrivalWindowEndAt ?? null,
    started_at: jobSeed.startedAt ?? null,
    completed_at: jobSeed.completedAt ?? null,
    canceled_at: jobSeed.canceledAt ?? null,
    service_site_id: serviceSite?.id ?? null,
    assigned_technician_user_id: assignedTechnicianUserId ?? null,
    priority: jobSeed.priority,
    source: jobSeed.source,
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

async function ensureInspection({
  supabaseUrl,
  serviceRoleKey,
  company,
  job,
  technicianUserId,
  inspectionSeed
}) {
  let inspection = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "inspections",
    filters: {
      job_id: `eq.${job.id}`
    }
  });

  if (!inspection) {
    inspection = await insertRow({
      supabaseUrl,
      serviceRoleKey,
      table: "inspections",
      payload: {
        company_id: company.id,
        job_id: job.id,
        status: "draft",
        template_version: "v1",
        started_by_user_id: technicianUserId,
        started_at: inspectionSeed.startedAt ?? job.started_at ?? new Date().toISOString(),
        completed_by_user_id: null,
        completed_at: null
      }
    });

    for (const item of buildInspectionItems(company.id, job.id)) {
      await insertRow({
        supabaseUrl,
        serviceRoleKey,
        table: "inspection_items",
        payload: {
          inspection_id: inspection.id,
          ...item
        }
      });
    }
  }

  if (!inspection || inspection.status === "completed") {
    return inspection;
  }

  const items = await listRows({
    supabaseUrl,
    serviceRoleKey,
    table: "inspection_items",
    filters: { inspection_id: `eq.${inspection.id}` }
  });
  const itemsByKey = new Map(items.map((item) => [item.item_key, item]));

  for (const [itemKey, nextState] of Object.entries(inspectionSeed.itemStates ?? {})) {
    const item = itemsByKey.get(itemKey);
    if (!item) {
      continue;
    }

    await patchRows({
      supabaseUrl,
      serviceRoleKey,
      table: "inspection_items",
      filters: { id: `eq.${item.id}` },
      payload: {
        status: nextState.status,
        finding_severity: nextState.findingSeverity ?? null,
        technician_notes: nextState.technicianNotes ?? null,
        recommendation: nextState.recommendation ?? null
      }
    });
  }

  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "inspections",
    filters: { id: `eq.${inspection.id}` },
    payload:
      inspectionSeed.status === "completed"
        ? {
            status: "completed",
            started_by_user_id: technicianUserId,
            completed_by_user_id: technicianUserId,
            started_at: inspectionSeed.startedAt ?? inspection.started_at,
            completed_at: inspectionSeed.completedAt ?? inspection.completed_at
          }
        : {
            status: inspectionSeed.status,
            started_by_user_id: technicianUserId,
            started_at: inspectionSeed.startedAt ?? inspection.started_at
          }
  });

  return rows[0] ?? inspection;
}

async function ensureAttachments({
  supabaseUrl,
  serviceRoleKey,
  company,
  job,
  inspection,
  uploadedByUserId,
  files
}) {
  for (const file of files) {
    const storagePath = `seed/${job.id}/${file.fileName}`;
    const existing = await findSingle({
      supabaseUrl,
      serviceRoleKey,
      table: "attachments",
      filters: {
        storage_bucket: "eq.job-attachments",
        storage_path: `eq.${storagePath}`
      }
    });

    await uploadStorageObject({
      supabaseUrl,
      serviceRoleKey,
      bucket: "job-attachments",
      objectPath: storagePath,
      body: IMAGE_BUFFER,
      contentType: "image/png"
    });

    if (!existing) {
      await insertRow({
        supabaseUrl,
        serviceRoleKey,
        table: "attachments",
        payload: {
          company_id: company.id,
          job_id: job.id,
          inspection_id: file.attachToInspection && inspection ? inspection.id : null,
          inspection_item_id: null,
          uploaded_by_user_id: uploadedByUserId,
          storage_bucket: "job-attachments",
          storage_path: storagePath,
          file_name: file.fileName,
          mime_type: "image/png",
          file_size_bytes: IMAGE_BUFFER.length,
          category: file.category,
          caption: file.caption
        }
      });
    }
  }
}

async function ensureEstimate({ supabaseUrl, serviceRoleKey, company, job, createdByUserId, estimateSeed }) {
  let estimate = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "estimates",
    filters: { job_id: `eq.${job.id}` }
  });

  if (!estimate) {
    estimate = await insertRow({
      supabaseUrl,
      serviceRoleKey,
      table: "estimates",
      payload: {
        company_id: company.id,
        job_id: job.id,
        status: "draft",
        estimate_number: estimateSeed.estimateNumber,
        title: estimateSeed.title,
        notes: estimateSeed.notes,
        terms: estimateSeed.terms,
        currency_code: "USD",
        tax_rate_basis_points: estimateSeed.taxRateBasisPoints,
        subtotal_cents: 0,
        discount_cents: estimateSeed.discountCents ?? 0,
        tax_cents: 0,
        total_cents: 0,
        created_by_user_id: createdByUserId
      }
    });
  }

  const existingLineItems = await listRows({
    supabaseUrl,
    serviceRoleKey,
    table: "estimate_line_items",
    filters: { estimate_id: `eq.${estimate.id}` }
  });

  if (!existingLineItems.length && !["accepted", "declined", "void"].includes(estimate.status)) {
    for (const [index, lineItem] of estimateSeed.lineItems.entries()) {
      await insertRow({
        supabaseUrl,
        serviceRoleKey,
        table: "estimate_line_items",
        payload: {
          estimate_id: estimate.id,
          company_id: company.id,
          job_id: job.id,
          position: index,
          item_type: lineItem.itemType,
          name: lineItem.name,
          description: lineItem.description,
          quantity: lineItem.quantity,
          unit_price_cents: lineItem.unitPriceCents,
          line_subtotal_cents: calculateLineSubtotalCents(lineItem.quantity, lineItem.unitPriceCents),
          taxable: lineItem.taxable
        }
      });
    }
  }

  if (estimate.status === "draft") {
    const totals = calculateTotals({
      lineItems: estimateSeed.lineItems,
      taxRateBasisPoints: estimateSeed.taxRateBasisPoints,
      discountCents: estimateSeed.discountCents ?? 0
    });

    const rows = await patchRows({
      supabaseUrl,
      serviceRoleKey,
      table: "estimates",
      filters: { id: `eq.${estimate.id}` },
      payload: {
        estimate_number: estimateSeed.estimateNumber,
        title: estimateSeed.title,
        notes: estimateSeed.notes,
        terms: estimateSeed.terms,
        tax_rate_basis_points: estimateSeed.taxRateBasisPoints,
        discount_cents: estimateSeed.discountCents ?? 0,
        subtotal_cents: totals.subtotalCents,
        tax_cents: totals.taxCents,
        total_cents: totals.totalCents
      }
    });

    estimate = rows[0] ?? estimate;
  }

  if (estimateSeed.status === "draft" || ["accepted", "declined", "void"].includes(estimate.status)) {
    return estimate;
  }

  if (estimate.status === "draft") {
    const rows = await patchRows({
      supabaseUrl,
      serviceRoleKey,
      table: "estimates",
      filters: { id: `eq.${estimate.id}` },
      payload: { status: "sent" }
    });
    estimate = rows[0] ?? estimate;
  }

  if (estimateSeed.status === "sent") {
    return estimate;
  }

  if (estimateSeed.status === "accepted") {
    let signature = await findSingle({
      supabaseUrl,
      serviceRoleKey,
      table: "signatures",
      filters: { estimate_id: `eq.${estimate.id}` }
    });

    const storagePath = `seed/signatures/${estimateSeed.estimateNumber.toLowerCase()}.png`;
    await uploadStorageObject({
      supabaseUrl,
      serviceRoleKey,
      bucket: "estimate-signatures",
      objectPath: storagePath,
      body: IMAGE_BUFFER,
      contentType: "image/png"
    });

    if (!signature) {
      signature = await insertRow({
        supabaseUrl,
        serviceRoleKey,
        table: "signatures",
        payload: {
          company_id: company.id,
          job_id: job.id,
          estimate_id: estimate.id,
          signed_by_name: estimateSeed.approvedByName,
          statement: DEFAULT_SIGNATURE_STATEMENT,
          storage_bucket: "estimate-signatures",
          storage_path: storagePath,
          mime_type: "image/png",
          file_size_bytes: IMAGE_BUFFER.length,
          captured_by_user_id: null
        }
      });
    }

    const rows = await patchRows({
      supabaseUrl,
      serviceRoleKey,
      table: "estimates",
      filters: { id: `eq.${estimate.id}` },
      payload: {
        status: "accepted",
        approved_signature_id: signature.id,
        approved_by_name: estimateSeed.approvedByName,
        approval_statement: DEFAULT_SIGNATURE_STATEMENT
      }
    });

    return rows[0] ?? estimate;
  }

  const rows = await patchRows({
    supabaseUrl,
    serviceRoleKey,
    table: "estimates",
    filters: { id: `eq.${estimate.id}` },
    payload: { status: "declined" }
  });

  return rows[0] ?? estimate;
}

async function ensureInvoice({
  supabaseUrl,
  serviceRoleKey,
  company,
  job,
  estimate,
  createdByUserId,
  invoiceSeed
}) {
  let invoice = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "invoices",
    filters: { job_id: `eq.${job.id}` }
  });

  if (!invoice) {
    invoice = await insertRow({
      supabaseUrl,
      serviceRoleKey,
      table: "invoices",
      payload: {
        company_id: company.id,
        job_id: job.id,
        estimate_id: estimate?.status === "accepted" ? estimate.id : null,
        status: "draft",
        invoice_number: invoiceSeed.invoiceNumber,
        title: invoiceSeed.title,
        notes: invoiceSeed.notes,
        terms: invoiceSeed.terms,
        currency_code: "USD",
        tax_rate_basis_points: invoiceSeed.taxRateBasisPoints,
        subtotal_cents: 0,
        discount_cents: invoiceSeed.discountCents ?? 0,
        tax_cents: 0,
        total_cents: 0,
        amount_paid_cents: 0,
        balance_due_cents: 0,
        due_at: invoiceSeed.dueAt,
        created_by_user_id: createdByUserId
      }
    });
  }

  const existingLineItems = await listRows({
    supabaseUrl,
    serviceRoleKey,
    table: "invoice_line_items",
    filters: { invoice_id: `eq.${invoice.id}` }
  });

  if (!existingLineItems.length && invoice.status === "draft") {
    for (const [index, lineItem] of invoiceSeed.lineItems.entries()) {
      await insertRow({
        supabaseUrl,
        serviceRoleKey,
        table: "invoice_line_items",
        payload: {
          invoice_id: invoice.id,
          company_id: company.id,
          job_id: job.id,
          position: index,
          item_type: lineItem.itemType,
          name: lineItem.name,
          description: lineItem.description,
          quantity: lineItem.quantity,
          unit_price_cents: lineItem.unitPriceCents,
          line_subtotal_cents: calculateLineSubtotalCents(lineItem.quantity, lineItem.unitPriceCents),
          taxable: lineItem.taxable
        }
      });
    }
  }

  if (invoice.status === "draft") {
    await rpc({
      supabaseUrl,
      serviceRoleKey,
      fn: "recalculate_invoice_totals",
      payload: { target_invoice_id: invoice.id }
    });

    invoice = await findSingle({
      supabaseUrl,
      serviceRoleKey,
      table: "invoices",
      filters: { id: `eq.${invoice.id}` }
    });
  }

  if (invoiceSeed.status === "draft") {
    return invoice;
  }

  if (invoice.status === "draft") {
    const rows = await patchRows({
      supabaseUrl,
      serviceRoleKey,
      table: "invoices",
      filters: { id: `eq.${invoice.id}` },
      payload: { status: "issued" }
    });
    invoice = rows[0] ?? invoice;
  }

  for (const payment of invoiceSeed.payments ?? []) {
    await rpc({
      supabaseUrl,
      serviceRoleKey,
      fn: "record_stripe_invoice_payment",
      payload: {
        target_company_id: company.id,
        target_job_id: job.id,
        target_invoice_id: invoice.id,
        target_stripe_checkout_session_id: payment.checkoutSessionId,
        target_stripe_payment_intent_id: payment.paymentIntentId,
        target_stripe_charge_id: payment.chargeId,
        target_stripe_event_id: payment.eventId,
        target_amount_cents: payment.amountCents,
        target_currency_code: "USD",
        target_receipt_url: payment.receiptUrl,
        target_paid_at: payment.paidAt
      }
    });
  }

  return findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "invoices",
    filters: { id: `eq.${invoice.id}` }
  });
}

async function ensureCommunication({
  supabaseUrl,
  serviceRoleKey,
  company,
  customer,
  job,
  estimate,
  invoice,
  actorUserId,
  communicationSeed
}) {
  const eventPayload = {
    company_id: company.id,
    customer_id: customer.id,
    job_id: job?.id ?? null,
    estimate_id: estimate?.id ?? null,
    invoice_id: invoice?.id ?? null,
    payment_id: null,
    event_type: communicationSeed.eventType,
    communication_type: communicationSeed.communicationType,
    trigger_source: communicationSeed.triggerSource,
    actor_user_id: actorUserId,
    idempotency_key: `seed:${communicationSeed.key}`,
    scheduled_for: communicationSeed.occurredAt,
    occurred_at: communicationSeed.occurredAt,
    payload: communicationSeed.payload ?? {},
    processed_at: communicationSeed.failedAt ? null : communicationSeed.sentAt ?? communicationSeed.occurredAt,
    failed_at: communicationSeed.failedAt ?? null,
    failure_message: communicationSeed.failureMessage ?? null
  };

  let event = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "communication_events",
    filters: {
      idempotency_key: `eq.seed:${communicationSeed.key}`
    }
  });

  if (!event) {
    event = await insertRow({
      supabaseUrl,
      serviceRoleKey,
      table: "communication_events",
      payload: eventPayload
    });
  } else {
    const rows = await patchRows({
      supabaseUrl,
      serviceRoleKey,
      table: "communication_events",
      filters: { id: `eq.${event.id}` },
      payload: eventPayload
    });
    event = rows[0] ?? event;
  }

  const communicationPayload = {
    company_id: company.id,
    customer_id: customer.id,
    job_id: job?.id ?? null,
    estimate_id: estimate?.id ?? null,
    invoice_id: invoice?.id ?? null,
    payment_id: null,
    event_id: event.id,
    communication_type: communicationSeed.communicationType,
    channel: communicationSeed.channel,
    status: communicationSeed.status,
    recipient_name: `${customer.first_name} ${customer.last_name}`.trim(),
    recipient_email: communicationSeed.channel === "email" ? customer.email : null,
    recipient_phone: communicationSeed.channel === "sms" ? customer.phone : null,
    subject: communicationSeed.subject ?? null,
    body_text: communicationSeed.bodyText,
    body_html: communicationSeed.subject ? `<p>${communicationSeed.bodyText}</p>` : null,
    provider: communicationSeed.provider,
    provider_message_id: `seed-${communicationSeed.key}`,
    provider_metadata: communicationSeed.payload ?? {},
    error_code: communicationSeed.failedAt ? "seed_delivery_failed" : null,
    error_message: communicationSeed.failureMessage ?? null,
    queued_at: communicationSeed.occurredAt,
    sent_at: communicationSeed.sentAt ?? null,
    delivered_at: communicationSeed.deliveredAt ?? null,
    failed_at: communicationSeed.failedAt ?? null,
    created_by_user_id: actorUserId
  };

  const existingCommunication = await findSingle({
    supabaseUrl,
    serviceRoleKey,
    table: "customer_communications",
    filters: { event_id: `eq.${event.id}` }
  });

  let communication = existingCommunication;
  if (!communication) {
    communication = await insertRow({
      supabaseUrl,
      serviceRoleKey,
      table: "customer_communications",
      payload: communicationPayload
    });
  } else {
    const rows = await patchRows({
      supabaseUrl,
      serviceRoleKey,
      table: "customer_communications",
      filters: { id: `eq.${communication.id}` },
      payload: communicationPayload
    });
    communication = rows[0] ?? communication;
  }

  for (const attempt of communicationSeed.deliveryAttempts ?? [{ attemptNumber: 1, succeeded: !communicationSeed.failedAt, errorMessage: communicationSeed.failureMessage ?? null }]) {
    await upsertRestRow({
      supabaseUrl,
      serviceRoleKey,
      table: "communication_delivery_attempts",
      onConflict: "communication_id,attempt_number",
      payload: {
        communication_id: communication.id,
        attempt_number: attempt.attemptNumber,
        provider: communicationSeed.provider,
        request_payload: { channel: communicationSeed.channel },
        response_payload: attempt.succeeded ? { message: "delivered" } : { message: attempt.errorMessage },
        succeeded: attempt.succeeded,
        error_message: attempt.errorMessage ?? null,
        attempted_at: communicationSeed.sentAt ?? communicationSeed.failedAt ?? communicationSeed.occurredAt
      }
    });
  }
}

const DEMO_TENANT = {
  companySlug: "north-loop-mobile-auto",
  users: {
    owner: "owner@northloopauto.com",
    admin: "admin@northloopauto.com",
    dispatcher: "dispatch@northloopauto.com",
    alex: "alex.tech@northloopauto.com",
    sam: "sam.tech@northloopauto.com"
  },
  customers: [
    {
      key: "jamie",
      firstName: "Jamie",
      lastName: "Carter",
      email: "jamie.carter@example.com",
      phone: "555-0101",
      notes: "Prefers morning appointments and text updates.",
      preferences: { preferredChannel: "sms", emailEnabled: true, smsEnabled: true },
      address: { label: "service", line1: "123 Service Lane", line2: null, city: "Austin", state: "TX", postal_code: "78701", country: "US", gate_code: null, parking_notes: "Driveway parking available", is_primary: true }
    },
    {
      key: "priya",
      firstName: "Priya",
      lastName: "Shah",
      email: "priya.shah@example.com",
      phone: "555-0102",
      notes: "Prefers SMS dispatch updates during work hours.",
      preferences: { preferredChannel: "sms", emailEnabled: true, smsEnabled: true },
      address: { label: "home", line1: "4102 Barton Creek Blvd", line2: null, city: "Austin", state: "TX", postal_code: "78735", country: "US", gate_code: "2045", parking_notes: "Visitor parking at building entrance", is_primary: true }
    },
    {
      key: "marcus",
      firstName: "Marcus",
      lastName: "Hill",
      email: "marcus.hill@example.com",
      phone: "555-0103",
      notes: "Fleet customer with multiple prior visits.",
      preferences: { preferredChannel: "email", emailEnabled: true, smsEnabled: true },
      address: { label: "work", line1: "9801 Great Hills Trail", line2: "Suite 220", city: "Austin", state: "TX", postal_code: "78759", country: "US", gate_code: null, parking_notes: "Check in with front desk", is_primary: true }
    },
    {
      key: "ben",
      firstName: "Ben",
      lastName: "Turner",
      email: "ben.turner@example.com",
      phone: "555-0105",
      notes: "Bookkeeping contact for partial-payment reminder coverage.",
      preferences: { preferredChannel: "email", emailEnabled: true, smsEnabled: true },
      address: { label: "service", line1: "2500 E Riverside Dr", line2: null, city: "Austin", state: "TX", postal_code: "78741", country: "US", gate_code: null, parking_notes: "Meet at loading dock entrance", is_primary: true }
    },
    {
      key: "claire",
      firstName: "Claire",
      lastName: "Nguyen",
      email: "claire.nguyen@example.com",
      phone: "555-0106",
      notes: "Strong happy-path customer-facing invoice demo.",
      preferences: { preferredChannel: "sms", emailEnabled: true, smsEnabled: true },
      address: { label: "home", line1: "1501 S Lamar Blvd", line2: null, city: "Austin", state: "TX", postal_code: "78704", country: "US", gate_code: null, parking_notes: "Park in spot 17", is_primary: true }
    }
  ],
  vehicles: [
    { key: "jamie-f150", customerKey: "jamie", year: 2019, make: "Ford", model: "F-150", trim: "XLT", engine: "5.0L V8", licensePlate: "DEMO123", licenseState: "TX", vin: "1FTFW1E50KFA00001", color: "Blue", odometer: 84500, notes: "Primary scheduled estimate demo vehicle." },
    { key: "priya-crv", customerKey: "priya", year: 2020, make: "Honda", model: "CR-V", trim: "EX", engine: "1.5L Turbo", licensePlate: "CRV220", licenseState: "TX", vin: "2HKRW2H58LH600201", color: "White", odometer: 52100, notes: "Dispatch and in-progress field demo vehicle." },
    { key: "marcus-camry", customerKey: "marcus", year: 2018, make: "Toyota", model: "Camry", trim: "SE", engine: "2.5L I4", licensePlate: "CAM830", licenseState: "TX", vin: "4T1B11HK7JU040301", color: "Gray", odometer: 91200, notes: "Rich service-history demo vehicle." },
    { key: "ben-silverado", customerKey: "ben", year: 2017, make: "Chevrolet", model: "Silverado 1500", trim: "LT", engine: "5.3L V8", licensePlate: "SLV705", licenseState: "TX", vin: "3GCUKREC4HG250501", color: "Black", odometer: 112400, notes: "Partial-payment demo vehicle." },
    { key: "claire-rav4", customerKey: "claire", year: 2022, make: "Toyota", model: "RAV4", trim: "XLE", engine: "2.5L I4", licensePlate: "RAV606", licenseState: "TX", vin: "2T3P1RFV4NW180601", color: "Silver", odometer: 27300, notes: "Clean paid invoice demo vehicle." }
  ],
  jobs: [
    { key: "job-1001", customerKey: "jamie", vehicleKey: "jamie-f150", title: "Front brake inspection and estimate", description: "Scheduled appointment with sent estimate awaiting approval.", customerConcern: "Grinding noise when braking to a stop", internalSummary: "Future appointment, trust surfaces, and public estimate demo.", status: "scheduled", priority: "high", source: "office", assignedTechnician: "alex", scheduledStartAt: isoAtOffsetDays(1, 9, 0), scheduledEndAt: isoAtOffsetDays(1, 11, 0), arrivalWindowStartAt: isoAtOffsetDays(1, 8, 30), arrivalWindowEndAt: isoAtOffsetDays(1, 9, 30) },
    { key: "job-1002", customerKey: "priya", vehicleKey: "priya-crv", title: "No-start battery and charging diagnosis", description: "Dispatched roadside-style diagnostic visit.", customerConcern: "Vehicle will not start consistently after sitting overnight", internalSummary: "Dispatch board and en-route communication demo.", status: "dispatched", priority: "urgent", source: "phone", assignedTechnician: "sam", scheduledStartAt: isoAtOffsetHours(1), scheduledEndAt: isoAtOffsetHours(3), arrivalWindowStartAt: isoAtOffsetHours(0.5), arrivalWindowEndAt: isoAtOffsetHours(1.5) },
    { key: "job-1003", customerKey: "priya", vehicleKey: "priya-crv", title: "Cooling system diagnosis", description: "Active field job with photos, inspection, and draft financials.", customerConcern: "Temperature warning light came on after a short drive", internalSummary: "Primary in-progress mobile workflow demo.", status: "in_progress", priority: "high", source: "office", assignedTechnician: "sam", scheduledStartAt: isoAtOffsetHours(-2), scheduledEndAt: isoAtOffsetHours(1), arrivalWindowStartAt: isoAtOffsetHours(-2.5), arrivalWindowEndAt: isoAtOffsetHours(-1.5), startedAt: isoAtOffsetHours(-1.75) },
    { key: "job-1004", customerKey: "marcus", vehicleKey: "marcus-camry", title: "60k maintenance service", description: "Completed maintenance visit with accepted estimate and paid invoice.", customerConcern: "Routine service before a long highway trip", internalSummary: "Primary completed happy-path service record.", status: "completed", priority: "normal", source: "office", assignedTechnician: "alex", scheduledStartAt: isoAtOffsetDays(-21, 10, 0), scheduledEndAt: isoAtOffsetDays(-21, 12, 0), arrivalWindowStartAt: isoAtOffsetDays(-21, 9, 30), arrivalWindowEndAt: isoAtOffsetDays(-21, 10, 30), startedAt: isoAtOffsetDays(-21, 10, 5), completedAt: isoAtOffsetDays(-21, 12, 10) },
    { key: "job-1005", customerKey: "marcus", vehicleKey: "marcus-camry", title: "Front struts and alignment", description: "Older completed service used to make history feel credible.", customerConcern: "Front-end bounce and uneven tire wear", internalSummary: "Secondary completed history record.", status: "completed", priority: "normal", source: "phone", assignedTechnician: "alex", scheduledStartAt: isoAtOffsetDays(-180, 9, 0), scheduledEndAt: isoAtOffsetDays(-180, 13, 0), arrivalWindowStartAt: isoAtOffsetDays(-180, 8, 30), arrivalWindowEndAt: isoAtOffsetDays(-180, 9, 30), startedAt: isoAtOffsetDays(-180, 9, 10), completedAt: isoAtOffsetDays(-180, 13, 20) },
    { key: "job-1006", customerKey: "ben", vehicleKey: "ben-silverado", title: "Wheel bearing and hub replacement", description: "Completed job with an issued invoice and an outstanding balance.", customerConcern: "Grinding noise from the front wheel at highway speed", internalSummary: "Partial-payment reminder demo.", status: "completed", priority: "high", source: "office", assignedTechnician: "sam", scheduledStartAt: isoAtOffsetDays(-5, 11, 0), scheduledEndAt: isoAtOffsetDays(-5, 15, 0), arrivalWindowStartAt: isoAtOffsetDays(-5, 10, 30), arrivalWindowEndAt: isoAtOffsetDays(-5, 11, 30), startedAt: isoAtOffsetDays(-5, 11, 5), completedAt: isoAtOffsetDays(-5, 15, 15) },
    { key: "job-1007", customerKey: "claire", vehicleKey: "claire-rav4", title: "Brake pad and rotor replacement", description: "Completed and fully paid customer-facing invoice demo.", customerConcern: "Front-end brake pulsation and wear indicator noise", internalSummary: "Happy-path invoice and payment demo.", status: "completed", priority: "normal", source: "office", assignedTechnician: "alex", scheduledStartAt: isoAtOffsetDays(-2, 14, 0), scheduledEndAt: isoAtOffsetDays(-2, 16, 30), arrivalWindowStartAt: isoAtOffsetDays(-2, 13, 30), arrivalWindowEndAt: isoAtOffsetDays(-2, 14, 30), startedAt: isoAtOffsetDays(-2, 14, 5), completedAt: isoAtOffsetDays(-2, 16, 35) }
  ]
};

const QA_TENANT = {
  companySlug: "redwood-test-garage",
  users: {
    owner: "owner@redwoodtestgarage.com",
    dispatcher: "dispatch@redwoodtestgarage.com",
    tech: "tech@redwoodtestgarage.com"
  },
  customers: [
    { key: "casey", firstName: "Casey", lastName: "Walker", email: null, phone: "555-0201", notes: "Phone-only customer for SMS-only QA.", preferences: { preferredChannel: "sms", emailEnabled: false, smsEnabled: true }, address: { label: "home", line1: "3100 Test Drive", line2: null, city: "Austin", state: "TX", postal_code: "78723", country: "US", gate_code: null, parking_notes: "Knock at side gate", is_primary: true } },
    { key: "nora", firstName: "Nora", lastName: "Diaz", email: "nora.diaz@example.com", phone: null, notes: "Email-only customer for fallback QA.", preferences: { preferredChannel: "email", emailEnabled: true, smsEnabled: false }, address: { label: "service", line1: "4050 QA Loop", line2: "Unit 12", city: "Austin", state: "TX", postal_code: "78758", country: "US", gate_code: null, parking_notes: "Use visitor lot near unit 12", is_primary: true } },
    { key: "harper", firstName: "Harper", lastName: "Cole", email: "harper.cole@example.com", phone: "555-0203", notes: "Archived customer for inactive-state checks.", isActive: false, preferences: { preferredChannel: "email", emailEnabled: true, smsEnabled: true }, address: { label: "home", line1: "77 Archive Way", line2: null, city: "Round Rock", state: "TX", postal_code: "78664", country: "US", gate_code: null, parking_notes: "Archived customer", is_primary: true } },
    { key: "jordan", firstName: "Jordan", lastName: "Test", email: null, phone: null, notes: "No-contact customer for blocked communication paths.", preferences: { preferredChannel: null, emailEnabled: false, smsEnabled: false }, address: { label: "service", line1: "500 Missing Data Ave", line2: null, city: "Austin", state: "TX", postal_code: "78702", country: "US", gate_code: null, parking_notes: "Used for edge-state QA", is_primary: true } }
  ],
  vehicles: [
    { key: "casey-kia", customerKey: "casey", year: 2016, make: "Kia", model: "Soul", trim: "Base", engine: "2.0L I4", licensePlate: "QA201", licenseState: "TX", vin: null, color: "Red", odometer: 104200, notes: "No-VIN QA vehicle." },
    { key: "nora-altima", customerKey: "nora", year: 2015, make: "Nissan", model: "Altima", trim: "S", engine: "2.5L I4", licensePlate: "QA202", licenseState: "TX", vin: "1N4AL3AP5FC199999", color: "Gray", odometer: 133500, notes: "Synthetic VIN QA vehicle for decode/fallback testing." },
    { key: "harper-escape", customerKey: "harper", year: 2011, make: "Ford", model: "Escape", trim: "XLT", engine: "3.0L V6", licensePlate: "QA203", licenseState: "TX", vin: "1FMCU0DG1BKB33021", color: "Silver", odometer: 167800, notes: "Inactive QA vehicle.", isActive: false },
    { key: "jordan-compass", customerKey: "jordan", year: 2012, make: "Jeep", model: "Compass", trim: "Sport", engine: "2.4L I4", licensePlate: "QA204", licenseState: "TX", vin: "1C4NJDBB1CD610401", color: "Black", odometer: 142900, notes: "No-contact QA vehicle." }
  ],
  jobs: [
    { key: "job-2001", customerKey: "jordan", vehicleKey: "jordan-compass", title: "Blocked communication intake", description: "Unassigned intake job with no estimate or invoice.", customerConcern: "No contact details on file yet", internalSummary: "Use for office edge-state QA.", status: "new", priority: "normal", source: "web", assignedTechnician: null },
    { key: "job-2002", customerKey: "casey", vehicleKey: "casey-kia", title: "Phone-only appointment", description: "Scheduled SMS-only customer for communications QA.", customerConcern: "Battery light came on after startup", internalSummary: "Use for SMS-only scheduling coverage.", status: "scheduled", priority: "high", source: "phone", assignedTechnician: "tech", scheduledStartAt: isoAtOffsetDays(1, 15, 0), scheduledEndAt: isoAtOffsetDays(1, 16, 30), arrivalWindowStartAt: isoAtOffsetDays(1, 14, 30), arrivalWindowEndAt: isoAtOffsetDays(1, 15, 30) },
    { key: "job-2003", customerKey: "nora", vehicleKey: "nora-altima", title: "Completed QA service", description: "Simple completed job with minimal artifacts.", customerConcern: "Requested a basic vehicle inspection", internalSummary: "History and access-control QA.", status: "completed", priority: "low", source: "office", assignedTechnician: "tech", scheduledStartAt: isoAtOffsetDays(-7, 10, 0), scheduledEndAt: isoAtOffsetDays(-7, 11, 0), arrivalWindowStartAt: isoAtOffsetDays(-7, 9, 30), arrivalWindowEndAt: isoAtOffsetDays(-7, 10, 30), startedAt: isoAtOffsetDays(-7, 10, 5), completedAt: isoAtOffsetDays(-7, 11, 10) },
    { key: "job-2004", customerKey: "casey", vehicleKey: "casey-kia", title: "Canceled QA dispatch", description: "Canceled roadside job for status edge-state checks.", customerConcern: "Vehicle restarted before technician arrival", internalSummary: "Canceled job state.", status: "canceled", priority: "urgent", source: "phone", assignedTechnician: null, scheduledStartAt: isoAtOffsetDays(-2, 8, 30), scheduledEndAt: isoAtOffsetDays(-2, 9, 30), arrivalWindowStartAt: isoAtOffsetDays(-2, 8, 0), arrivalWindowEndAt: isoAtOffsetDays(-2, 9, 0), canceledAt: isoAtOffsetDays(-2, 8, 10) }
  ]
};

const DEMO_INSPECTIONS = [
  {
    jobKey: "job-1003",
    technicianKey: "sam",
    status: "in_progress",
    startedAt: isoAtOffsetHours(-1.75),
    itemStates: {
      tire_tread_depth: {
        status: "attention",
        findingSeverity: "medium",
        technicianNotes: "Front tires are at 4/32.",
        recommendation: "Recommend replacement within 30 days."
      },
      engine_oil: {
        status: "attention",
        findingSeverity: "low",
        technicianNotes: "Oil is dark but at the correct level.",
        recommendation: "Recommend oil service at next visit."
      },
      coolant: {
        status: "fail",
        findingSeverity: "high",
        technicianNotes: "Coolant reservoir low and seepage visible at thermostat housing.",
        recommendation: "Replace thermostat housing and refill cooling system."
      },
      tire_condition: { status: "pass" },
      wheel_lug_nuts: { status: "pass" },
      brake_pads: { status: "pass" },
      rotors_drums: { status: "pass" },
      brake_fluid: { status: "pass" }
    }
  },
  {
    jobKey: "job-1004",
    technicianKey: "alex",
    status: "completed",
    startedAt: isoAtOffsetDays(-21, 10, 5),
    completedAt: isoAtOffsetDays(-21, 11, 45),
    itemStates: {
      tire_condition: { status: "pass" },
      tire_tread_depth: { status: "pass" },
      wheel_lug_nuts: { status: "pass" },
      brake_pads: { status: "attention", findingSeverity: "medium", technicianNotes: "Pads at 5mm remaining.", recommendation: "Plan brake service within 10k miles." },
      rotors_drums: { status: "pass" },
      brake_fluid: { status: "pass" },
      engine_oil: { status: "pass" },
      coolant: { status: "pass" },
      visible_leaks: { status: "pass" },
      battery_condition: { status: "pass" },
      battery_terminals: { status: "pass" },
      charging_system: { status: "pass" },
      drive_belt: { status: "pass" },
      coolant_hoses: { status: "pass" },
      hose_wear: { status: "pass" },
      steering_components: { status: "pass" },
      suspension_components: { status: "pass" },
      wear_alignment: { status: "pass" },
      exterior_lights: { status: "pass" },
      interior_warnings: { status: "pass" },
      basic_electrical: { status: "pass" },
      start_idle: { status: "pass" },
      abnormal_noises: { status: "pass" },
      performance_concerns: { status: "pass" }
    }
  },
  {
    jobKey: "job-1005",
    technicianKey: "alex",
    status: "completed",
    startedAt: isoAtOffsetDays(-180, 9, 10),
    completedAt: isoAtOffsetDays(-180, 12, 50),
    itemStates: {
      tire_condition: { status: "attention", findingSeverity: "medium", technicianNotes: "Outer shoulder wear noted.", recommendation: "Monitor alignment and rotate on schedule." },
      tire_tread_depth: { status: "pass" },
      wheel_lug_nuts: { status: "pass" },
      brake_pads: { status: "pass" },
      rotors_drums: { status: "pass" },
      brake_fluid: { status: "pass" },
      engine_oil: { status: "pass" },
      coolant: { status: "pass" },
      visible_leaks: { status: "pass" },
      battery_condition: { status: "pass" },
      battery_terminals: { status: "pass" },
      charging_system: { status: "pass" },
      drive_belt: { status: "pass" },
      coolant_hoses: { status: "pass" },
      hose_wear: { status: "pass" },
      steering_components: { status: "attention", findingSeverity: "low", technicianNotes: "Minor steering rack seepage.", recommendation: "Monitor at next service." },
      suspension_components: { status: "fail", findingSeverity: "high", technicianNotes: "Front struts leaking.", recommendation: "Replace both front strut assemblies." },
      wear_alignment: { status: "attention", findingSeverity: "medium", technicianNotes: "Alignment correction recommended after strut replacement.", recommendation: "Perform four-wheel alignment." },
      exterior_lights: { status: "pass" },
      interior_warnings: { status: "pass" },
      basic_electrical: { status: "pass" },
      start_idle: { status: "pass" },
      abnormal_noises: { status: "attention", findingSeverity: "medium", technicianNotes: "Front-end clunk over bumps.", recommendation: "Inspect sway bar links at next visit." },
      performance_concerns: { status: "pass" }
    }
  }
];

const DEMO_ATTACHMENTS = [
  {
    jobKey: "job-1003",
    uploadedBy: "sam",
    files: [
      { fileName: "coolant-leak-before.png", category: "issue", caption: "Residue around thermostat housing", attachToInspection: true },
      { fileName: "engine-bay-overview.png", category: "inspection", caption: "Engine bay at arrival", attachToInspection: true },
      { fileName: "coolant-reservoir.png", category: "before", caption: "Low coolant level on arrival", attachToInspection: false }
    ]
  },
  {
    jobKey: "job-1004",
    uploadedBy: "alex",
    files: [{ fileName: "maintenance-overview.png", category: "after", caption: "Vehicle ready after maintenance service", attachToInspection: false }]
  }
];

const DEMO_ESTIMATES = [
  {
    jobKey: "job-1001",
    estimateNumber: "EST-1001",
    title: "Front brake service estimate",
    notes: "Estimate includes premium ceramic front pads and rotor replacement.",
    terms: "Estimate valid for 7 days.",
    taxRateBasisPoints: 825,
    status: "sent",
    lineItems: [
      { itemType: "part", name: "Front brake pads", description: "Premium ceramic pad set", quantity: 1, unitPriceCents: 22995, taxable: true },
      { itemType: "part", name: "Front rotors", description: "Pair of front brake rotors", quantity: 1, unitPriceCents: 27900, taxable: true },
      { itemType: "labor", name: "Brake service labor", description: "Replace front pads and rotors and road test", quantity: 1, unitPriceCents: 13000, taxable: false }
    ]
  },
  {
    jobKey: "job-1004",
    estimateNumber: "EST-1004",
    title: "60k maintenance estimate",
    notes: "Customer approved during the visit.",
    terms: "Approval authorizes listed maintenance services.",
    taxRateBasisPoints: 825,
    discountCents: 2500,
    status: "accepted",
    approvedByName: "Marcus Hill",
    lineItems: [
      { itemType: "labor", name: "60k maintenance labor", description: "Inspection, fluid service, and multi-point check", quantity: 1, unitPriceCents: 16500, taxable: false },
      { itemType: "part", name: "Engine oil service", description: "Synthetic oil and premium filter", quantity: 1, unitPriceCents: 8995, taxable: true },
      { itemType: "part", name: "Cabin air filter", description: "Replacement cabin filter", quantity: 1, unitPriceCents: 3895, taxable: true },
      { itemType: "fee", name: "Shop supplies", description: "Consumables and disposal", quantity: 1, unitPriceCents: 1295, taxable: true }
    ]
  }
];

const DEMO_INVOICES = [
  {
    jobKey: "job-1003",
    invoiceNumber: "INV-1003",
    title: "Cooling system repair invoice draft",
    notes: "Draft invoice while repair scope is still being finalized.",
    terms: "Payment due on completion.",
    taxRateBasisPoints: 825,
    dueAt: isoAtOffsetDays(2, 17, 0),
    status: "draft",
    lineItems: [
      { itemType: "labor", name: "Cooling system diagnosis", description: "Pressure test and confirm leak source", quantity: 1, unitPriceCents: 14500, taxable: false },
      { itemType: "part", name: "Thermostat housing assembly", description: "Replacement thermostat housing", quantity: 1, unitPriceCents: 28400, taxable: true },
      { itemType: "fee", name: "Coolant refill", description: "OEM coolant and bleed procedure", quantity: 1, unitPriceCents: 13650, taxable: true }
    ]
  },
  {
    jobKey: "job-1004",
    estimateJobKey: "job-1004",
    invoiceNumber: "INV-1004",
    title: "60k maintenance invoice",
    notes: "Paid at job completion.",
    terms: "Thank you for your business.",
    taxRateBasisPoints: 825,
    discountCents: 2500,
    dueAt: isoAtOffsetDays(-21, 17, 0),
    status: "paid",
    lineItems: [
      { itemType: "labor", name: "60k maintenance labor", description: "Inspection, fluid service, and multi-point check", quantity: 1, unitPriceCents: 16500, taxable: false },
      { itemType: "part", name: "Engine oil service", description: "Synthetic oil and premium filter", quantity: 1, unitPriceCents: 8995, taxable: true },
      { itemType: "part", name: "Cabin air filter", description: "Replacement cabin filter", quantity: 1, unitPriceCents: 3895, taxable: true },
      { itemType: "fee", name: "Shop supplies", description: "Consumables and disposal", quantity: 1, unitPriceCents: 1295, taxable: true }
    ],
    payments: [{ amountCents: 30778, checkoutSessionId: "cs_demo_job1004_full", paymentIntentId: "pi_demo_job1004_full", chargeId: "ch_demo_job1004_full", eventId: "evt_demo_job1004_full", receiptUrl: "https://dashboard.stripe.com/test/payments/pi_demo_job1004_full", paidAt: isoAtOffsetDays(-21, 12, 12) }]
  },
  {
    jobKey: "job-1006",
    invoiceNumber: "INV-1006",
    title: "Wheel bearing and hub replacement invoice",
    notes: "Customer paid a deposit and still owes the remaining balance.",
    terms: "Balance due within 5 days.",
    taxRateBasisPoints: 825,
    dueAt: isoAtOffsetDays(-1, 17, 0),
    status: "partially_paid",
    lineItems: [
      { itemType: "part", name: "Wheel bearing and hub assembly", description: "Right front hub assembly", quantity: 1, unitPriceCents: 39500, taxable: true },
      { itemType: "labor", name: "Bearing replacement labor", description: "Replace front hub and road test", quantity: 1, unitPriceCents: 32500, taxable: false },
      { itemType: "fee", name: "Shop supplies", description: "Consumables", quantity: 1, unitPriceCents: 950, taxable: true }
    ],
    payments: [{ amountCents: 40000, checkoutSessionId: "cs_demo_job1006_partial", paymentIntentId: "pi_demo_job1006_partial", chargeId: "ch_demo_job1006_partial", eventId: "evt_demo_job1006_partial", receiptUrl: "https://dashboard.stripe.com/test/payments/pi_demo_job1006_partial", paidAt: isoAtOffsetDays(-4, 10, 15) }]
  },
  {
    jobKey: "job-1007",
    invoiceNumber: "INV-1007",
    title: "Brake pad and rotor replacement invoice",
    notes: "Customer paid through the public invoice link.",
    terms: "Paid in full.",
    taxRateBasisPoints: 825,
    dueAt: isoAtOffsetDays(-1, 17, 0),
    status: "paid",
    lineItems: [
      { itemType: "part", name: "Front brake pads", description: "Premium ceramic pad set", quantity: 1, unitPriceCents: 22995, taxable: true },
      { itemType: "part", name: "Front rotors", description: "Pair of front brake rotors", quantity: 1, unitPriceCents: 27900, taxable: true },
      { itemType: "labor", name: "Brake service labor", description: "Replace front pads and rotors and road test", quantity: 1, unitPriceCents: 16500, taxable: false }
    ],
    payments: [{ amountCents: 71594, checkoutSessionId: "cs_demo_job1007_full", paymentIntentId: "pi_demo_job1007_full", chargeId: "ch_demo_job1007_full", eventId: "evt_demo_job1007_full", receiptUrl: "https://dashboard.stripe.com/test/payments/pi_demo_job1007_full", paidAt: isoAtOffsetDays(-2, 16, 50) }]
  }
];

const DEMO_COMMUNICATIONS = [
  { key: "job1001-appointment-email", customerKey: "jamie", jobKey: "job-1001", eventType: "appointment_confirmation_requested", communicationType: "appointment_confirmation", triggerSource: "manual", actorKey: "dispatcher", channel: "email", provider: "resend", status: "delivered", subject: "Your North Loop Mobile Auto appointment is confirmed", bodyText: "Hi Jamie, your mobile brake inspection is confirmed for tomorrow morning.", occurredAt: isoAtOffsetDays(0, 17, 0), sentAt: isoAtOffsetDays(0, 17, 2), deliveredAt: isoAtOffsetDays(0, 17, 3) },
  { key: "job1002-dispatched-sms", customerKey: "priya", jobKey: "job-1002", eventType: "dispatch_update_requested", communicationType: "dispatch_update", triggerSource: "workflow", actorKey: "dispatcher", channel: "sms", provider: "twilio", status: "delivered", subject: null, bodyText: "North Loop Mobile Auto: Sam has been dispatched for your CR-V diagnosis.", occurredAt: isoAtOffsetHours(-0.25), sentAt: isoAtOffsetHours(-0.24), deliveredAt: isoAtOffsetHours(-0.23), payload: { dispatchUpdateType: "dispatched" } },
  { key: "job1006-reminder-email", customerKey: "ben", jobKey: "job-1006", invoiceJobKey: "job-1006", eventType: "payment_reminder_requested", communicationType: "payment_reminder", triggerSource: "manual", actorKey: "dispatcher", channel: "email", provider: "resend", status: "delivered", subject: "Payment reminder from North Loop Mobile Auto", bodyText: "Hi Ben, your remaining balance is still due.", occurredAt: isoAtOffsetDays(-1, 9, 5), sentAt: isoAtOffsetDays(-1, 9, 6), deliveredAt: isoAtOffsetDays(-1, 9, 15), payload: { reminderStage: "due" }, deliveryAttempts: [{ attemptNumber: 1, succeeded: false, errorMessage: "Transient provider timeout" }, { attemptNumber: 2, succeeded: true, errorMessage: null }] }
];

const QA_COMMUNICATIONS = [
  { key: "job2002-sms-failed", customerKey: "casey", jobKey: "job-2002", eventType: "appointment_confirmation_requested", communicationType: "appointment_confirmation", triggerSource: "manual", actorKey: "dispatcher", channel: "sms", provider: "twilio", status: "failed", subject: null, bodyText: "Redwood Test Garage: your appointment is scheduled for tomorrow afternoon.", occurredAt: isoAtOffsetDays(0, 18, 0), failedAt: isoAtOffsetDays(0, 18, 2), failureMessage: "Carrier rejected destination number" }
];

async function seedTenant({
  supabaseUrl,
  serviceRoleKey,
  tenant,
  inspections = [],
  attachments = [],
  estimates = [],
  invoices = [],
  communications = []
}) {
  const company = await getCompanyBySlug({
    supabaseUrl,
    serviceRoleKey,
    slug: tenant.companySlug
  });

  if (!company) {
    throw new Error(`Company not found for slug "${tenant.companySlug}". Run pnpm bootstrap:dev-users first.`);
  }

  const userIds = {};
  for (const [key, email] of Object.entries(tenant.users)) {
    userIds[key] = await getUserIdByEmail({
      supabaseUrl,
      serviceRoleKey,
      email
    });
  }

  const customers = new Map();
  const serviceSites = new Map();
  for (const customerSeed of tenant.customers) {
    const customer = await ensureCustomer({ supabaseUrl, serviceRoleKey, company, customerSeed });
    const serviceSite = await ensureAddress({
      supabaseUrl,
      serviceRoleKey,
      company,
      customer,
      addressSeed: customerSeed.address
    });
    await ensureCommunicationPreference({
      supabaseUrl,
      serviceRoleKey,
      company,
      customer,
      preferenceSeed: customerSeed.preferences
    });
    customers.set(customerSeed.key, customer);
    serviceSites.set(customerSeed.key, serviceSite);
  }

  const vehicles = new Map();
  for (const vehicleSeed of tenant.vehicles) {
    const vehicle = await ensureVehicle({
      supabaseUrl,
      serviceRoleKey,
      company,
      vehicleSeed: {
        ...vehicleSeed,
        customerId: customers.get(vehicleSeed.customerKey).id
      }
    });
    vehicles.set(vehicleSeed.key, vehicle);
  }

  const jobs = new Map();
  for (const jobSeed of tenant.jobs) {
    const job = await ensureJob({
      supabaseUrl,
      serviceRoleKey,
      company,
      customer: customers.get(jobSeed.customerKey),
      vehicle: vehicles.get(jobSeed.vehicleKey),
      serviceSite: serviceSites.get(jobSeed.customerKey) ?? null,
      jobSeed,
      assignedTechnicianUserId: jobSeed.assignedTechnician ? userIds[jobSeed.assignedTechnician] : null,
      createdByUserId: userIds.owner ?? userIds.dispatcher ?? userIds.admin
    });
    jobs.set(jobSeed.key, job);
  }

  const inspectionMap = new Map();
  for (const inspectionSeed of inspections) {
    const inspection = await ensureInspection({
      supabaseUrl,
      serviceRoleKey,
      company,
      job: jobs.get(inspectionSeed.jobKey),
      technicianUserId: userIds[inspectionSeed.technicianKey],
      inspectionSeed
    });
    inspectionMap.set(inspectionSeed.jobKey, inspection);
  }

  for (const attachmentSeed of attachments) {
    await ensureAttachments({
      supabaseUrl,
      serviceRoleKey,
      company,
      job: jobs.get(attachmentSeed.jobKey),
      inspection: inspectionMap.get(attachmentSeed.jobKey) ?? null,
      uploadedByUserId: userIds[attachmentSeed.uploadedBy],
      files: attachmentSeed.files
    });
  }

  const estimateMap = new Map();
  for (const estimateSeed of estimates) {
    const estimate = await ensureEstimate({
      supabaseUrl,
      serviceRoleKey,
      company,
      job: jobs.get(estimateSeed.jobKey),
      createdByUserId: userIds.owner ?? userIds.admin ?? userIds.dispatcher,
      estimateSeed
    });
    estimateMap.set(estimateSeed.jobKey, estimate);
  }

  const invoiceMap = new Map();
  for (const invoiceSeed of invoices) {
    const invoice = await ensureInvoice({
      supabaseUrl,
      serviceRoleKey,
      company,
      job: jobs.get(invoiceSeed.jobKey),
      estimate: invoiceSeed.estimateJobKey ? estimateMap.get(invoiceSeed.estimateJobKey) ?? null : null,
      createdByUserId: userIds.owner ?? userIds.admin ?? userIds.dispatcher,
      invoiceSeed
    });
    invoiceMap.set(invoiceSeed.jobKey, invoice);
  }

  for (const communicationSeed of communications) {
    await ensureCommunication({
      supabaseUrl,
      serviceRoleKey,
      company,
      customer: customers.get(communicationSeed.customerKey),
      job: communicationSeed.jobKey ? jobs.get(communicationSeed.jobKey) ?? null : null,
      estimate: communicationSeed.estimateJobKey ? estimateMap.get(communicationSeed.estimateJobKey) ?? null : null,
      invoice: communicationSeed.invoiceJobKey ? invoiceMap.get(communicationSeed.invoiceJobKey) ?? null : null,
      actorUserId: userIds[communicationSeed.actorKey],
      communicationSeed
    });
  }

  return { company, jobs, estimates: estimateMap, invoices: invoiceMap };
}

async function main() {
  const env = getBootstrapEnv();
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Using Supabase: ${supabaseUrl}`);
  console.log(`Using env file: ${webEnvPath}`);
  console.log("Seeding demo and QA data...");
  await waitForStorageReady({ supabaseUrl, serviceRoleKey });

  const demo = await seedTenant({
    supabaseUrl,
    serviceRoleKey,
    tenant: DEMO_TENANT,
    inspections: DEMO_INSPECTIONS,
    attachments: DEMO_ATTACHMENTS,
    estimates: DEMO_ESTIMATES,
    invoices: DEMO_INVOICES,
    communications: DEMO_COMMUNICATIONS
  });

  await seedTenant({
    supabaseUrl,
    serviceRoleKey,
    tenant: QA_TENANT,
    communications: QA_COMMUNICATIONS
  });

  const featuredJob = demo.jobs.get("job-1001");
  const featuredEstimate = demo.estimates.get("job-1001");
  const featuredInvoice = demo.invoices.get("job-1007");

  console.log("");
  console.log("Demo and QA data ready.");
  console.log(`Demo company: ${demo.company.name} (${demo.company.slug})`);
  console.log(`Featured estimate total: ${formatCurrencyCents(featuredEstimate?.total_cents ?? 0)}`);
  console.log(`Featured invoice total: ${formatCurrencyCents(featuredInvoice?.total_cents ?? 0)}`);
  console.log("");
  console.log(`Demo job page: http://localhost:3000/dashboard/jobs/${featuredJob.id}`);
  console.log(`Dispatch board: http://localhost:3000/dashboard/dispatch`);
  console.log(`Demo invoice page: http://localhost:3000/dashboard/jobs/${demo.jobs.get("job-1007").id}/invoice`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
