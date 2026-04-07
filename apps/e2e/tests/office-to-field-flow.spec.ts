import { expect, test, type Page } from "@playwright/test";

import {
  getAuthenticatedUserIdFromAuthCookie,
  getSingleSupabaseRow,
  insertSupabaseRows,
  listSupabaseRows,
  loginOffice,
  loginTechnician,
  mobileWebBaseUrl,
  patchSupabaseRows,
  technicianCredentials,
  webBaseUrl
} from "./helpers";

type EstimateSeedJobRow = {
  company_id: string;
  created_by_user_id: string;
  customer_id: string;
  id: string;
  is_active: boolean;
  priority: string;
  service_site_id: string | null;
  source: string;
  status: string;
  title: string;
  vehicle_id: string;
};

type CustomerAddressRow = {
  customer_id: string;
  id: string;
  is_active: boolean;
};

type EstimateRow = {
  id: string;
  job_id: string;
  status: string;
};

type InspectionRow = {
  id: string;
  job_id: string;
  status: string;
};

type InvoiceRow = {
  amount_paid_cents: number;
  balance_due_cents: number;
  id: string;
  job_id: string;
  status: string;
};

type JobRow = {
  arrival_window_end_at: string | null;
  arrival_window_start_at: string | null;
  assigned_technician_user_id: string | null;
  id: string;
  scheduled_end_at: string | null;
  scheduled_start_at: string | null;
  status: string;
  title: string;
};

type PaymentRow = {
  amount_cents: number;
  id: string;
  invoice_id: string;
  status: string;
};

type ProfileRow = {
  default_company_id: string | null;
  email: string;
  id: string;
};

function formatLocalDateTimeInput(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findPressableByLabel(page: Page, label: string) {
  const button = page.getByRole("button", { name: label });

  if (await button.first().isVisible().catch(() => false)) {
    return button.first();
  }

  return page.getByText(new RegExp(`^${escapeForRegExp(label)}$`, "u")).last();
}

async function openInvoiceWorkspace(page: Page) {
  const candidateLabels = [/^Open invoice$/u, /^Payment$/u, /^Invoice$/u, /^Create invoice$/u];

  for (const label of candidateLabels) {
    const candidate = page.getByText(label).last();

    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }

  throw new Error("Could not find the invoice action on the technician workboard.");
}

async function seedOfficeToFieldVisit(page: Page) {
  const officeUserId = await getAuthenticatedUserIdFromAuthCookie(page);
  const officeProfile = await getSingleSupabaseRow<ProfileRow>("profiles", {
    label: `office profile ${officeUserId}`,
    filters: {
      id: `eq.${officeUserId}`
    },
    select: "id,email,default_company_id"
  });
  const technicianProfile = await getSingleSupabaseRow<ProfileRow>("profiles", {
    label: `technician profile ${technicianCredentials.email}`,
    filters: {
      email: `eq.${technicianCredentials.email}`
    },
    select: "id,email,default_company_id"
  });
  const companyId = officeProfile.default_company_id;

  expect(companyId, "Expected the office user to have a default company.").toBeTruthy();

  const [jobTemplates, companyServiceSites] = await Promise.all([
    listSupabaseRows<EstimateSeedJobRow>("jobs", {
      filters: {
        company_id: `eq.${companyId}`,
        is_active: "eq.true"
      },
      limit: 24,
      order: "updated_at.desc",
      select:
        "id,title,company_id,created_by_user_id,customer_id,vehicle_id,service_site_id,priority,source,status,is_active"
    }),
    listSupabaseRows<CustomerAddressRow>("customer_addresses", {
      filters: {
        company_id: `eq.${companyId}`,
        is_active: "eq.true"
      },
      limit: 100,
      select: "id,customer_id,is_active"
    })
  ]);
  const serviceSitesByCustomerId = new Map<string, CustomerAddressRow[]>();

  for (const serviceSite of companyServiceSites) {
    const existing = serviceSitesByCustomerId.get(serviceSite.customer_id) ?? [];
    existing.push(serviceSite);
    serviceSitesByCustomerId.set(serviceSite.customer_id, existing);
  }

  const jobTemplate =
    jobTemplates.find(
      (candidate) =>
        candidate.customer_id &&
        candidate.vehicle_id &&
        (candidate.service_site_id || (serviceSitesByCustomerId.get(candidate.customer_id)?.length ?? 0) > 0)
    ) ?? null;

  expect(
    jobTemplate,
    "Expected an active visit template with customer and vehicle context for the office-to-field flow."
  ).toBeTruthy();
  const serviceSiteId =
    jobTemplate!.service_site_id ?? serviceSitesByCustomerId.get(jobTemplate!.customer_id)?.[0]?.id ?? null;

  expect(
    serviceSiteId,
    "Expected the seeded office-to-field visit to have an active service site so the edit form can assign it."
  ).toBeTruthy();

  const createdJobs = await insertSupabaseRows<JobRow>("jobs", {
    arrival_window_end_at: null,
    arrival_window_start_at: null,
    assigned_technician_user_id: null,
    company_id: jobTemplate!.company_id,
    created_by_user_id: jobTemplate!.created_by_user_id,
    customer_concern: "E2E office-to-field workflow verification",
    customer_id: jobTemplate!.customer_id,
    description: null,
    internal_summary: "Seeded for the office-to-field mobile completion flow.",
    is_active: true,
    priority: jobTemplate!.priority || "normal",
    scheduled_end_at: null,
    scheduled_start_at: null,
    service_site_id: serviceSiteId,
    source: jobTemplate!.source || "office",
    status: "scheduled",
    title: `E2E office-to-field stop ${Date.now()}`,
    vehicle_id: jobTemplate!.vehicle_id
  });
  const job = createdJobs[0];
  const estimateNumber = `EST-O2F-${Date.now()}`;
  const approvalStatement =
    "I approve the estimate and authorize the listed work for this field service visit.";
  const approvedByName = "E2E Mobile Customer";

  const createdEstimates = await insertSupabaseRows<EstimateRow>("estimates", {
    company_id: jobTemplate!.company_id,
    created_by_user_id: officeUserId,
    estimate_number: estimateNumber,
    job_id: job.id,
    status: "draft",
    title: "E2E office-to-field estimate"
  });
  const estimate = createdEstimates[0];

  await insertSupabaseRows("estimate_line_items", {
    company_id: jobTemplate!.company_id,
    estimate_id: estimate.id,
    item_type: "labor",
    job_id: job.id,
    line_subtotal_cents: 12500,
    name: "Cooling fan relay diagnosis",
    position: 0,
    quantity: 1,
    taxable: false,
    unit_price_cents: 12500
  });

  const createdSignatures = await insertSupabaseRows<{ id: string }>("signatures", {
    company_id: jobTemplate!.company_id,
    estimate_id: estimate.id,
    file_size_bytes: 128,
    job_id: job.id,
    mime_type: "image/png",
    signed_by_name: approvedByName,
    statement: approvalStatement,
    storage_bucket: "customer-assets",
    storage_path: `e2e/signatures/${estimate.id}.png`
  });

  await patchSupabaseRows<EstimateRow>("estimates", {
    filters: {
      id: `eq.${estimate.id}`
    },
    payload: {
      sent_at: new Date().toISOString(),
      status: "sent"
    }
  });

  await patchSupabaseRows<EstimateRow>("estimates", {
    filters: {
      id: `eq.${estimate.id}`
    },
    payload: {
      accepted_at: new Date().toISOString(),
      approval_statement: approvalStatement,
      approved_by_name: approvedByName,
      approved_signature_id: createdSignatures[0]?.id ?? null,
      status: "accepted"
    }
  });

  const createdInspections = await insertSupabaseRows<InspectionRow>("inspections", {
    company_id: jobTemplate!.company_id,
    job_id: job.id,
    started_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    started_by_user_id: technicianProfile.id,
    status: "in_progress",
    template_version: 1
  });
  const inspection = createdInspections[0];
  const createdInspectionItems = await insertSupabaseRows<{ id: string }>("inspection_items", {
    company_id: jobTemplate!.company_id,
    inspection_id: inspection.id,
    item_key: `e2e-office-to-field-${Date.now()}`,
    job_id: job.id,
    label: "Visual check complete",
    position: 0,
    recommendation: "No additional issues noted during the seeded verification inspection.",
    section_key: "overview",
    status: "pass",
    technician_notes: "Seeded closeout evidence item."
  });

  await insertSupabaseRows("attachments", {
    caption: "Seeded closeout evidence",
    category: "after",
    company_id: jobTemplate!.company_id,
    file_name: "seeded-closeout-photo.jpg",
    file_size_bytes: 2048,
    inspection_id: inspection.id,
    inspection_item_id: createdInspectionItems[0]?.id ?? null,
    job_id: job.id,
    mime_type: "image/jpeg",
    storage_bucket: "customer-assets",
    storage_path: `e2e/attachments/${job.id}/seeded-closeout-photo.jpg`,
    uploaded_by_user_id: technicianProfile.id
  });

  await patchSupabaseRows<InspectionRow>("inspections", {
    filters: {
      id: `eq.${inspection.id}`
    },
    payload: {
      completed_at: new Date().toISOString(),
      completed_by_user_id: technicianProfile.id,
      status: "completed"
    }
  });

  return {
    jobId: job.id,
    jobTitle: job.title,
    technicianUserId: technicianProfile.id
  };
}

test.describe("office-to-field workflow", () => {
  test("assigns a scheduled stop from the office and lets the technician finish it on mobile", async ({
    page
  }) => {
    await loginOffice(page);
    const seededVisit = await seedOfficeToFieldVisit(page);
    const scheduledStart = new Date(Date.now() + 90 * 60 * 1000);
    const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);
    const arrivalWindowStart = new Date(scheduledStart.getTime() - 15 * 60 * 1000);
    const arrivalWindowEnd = new Date(scheduledStart.getTime() + 15 * 60 * 1000);

    await page.goto(`${webBaseUrl}/dashboard/visits/${seededVisit.jobId}/edit`);
    await expect(page.getByRole("button", { name: "Save visit" })).toBeVisible();

    await page.getByLabel("Technician").selectOption(seededVisit.technicianUserId);
    await page.getByLabel("Scheduled start").fill(formatLocalDateTimeInput(scheduledStart));
    await page.getByLabel("Scheduled end").fill(formatLocalDateTimeInput(scheduledEnd));
    await page.getByLabel("Arrival window start").fill(formatLocalDateTimeInput(arrivalWindowStart));
    await page.getByLabel("Arrival window end").fill(formatLocalDateTimeInput(arrivalWindowEnd));
    await page.getByRole("button", { name: "Save visit" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/dashboard/visits\\?jobId=${seededVisit.jobId}(?:&.*)?$`)
    );

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobRow>("jobs", {
          label: `office-assigned job ${seededVisit.jobId}`,
          filters: {
            id: `eq.${seededVisit.jobId}`
          },
          select:
            "id,title,status,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });

        return {
          arrivalWindowEndAt: job.arrival_window_end_at,
          arrivalWindowStartAt: job.arrival_window_start_at,
          assignedTechnicianUserId: job.assigned_technician_user_id,
          scheduledEndAt: job.scheduled_end_at,
          scheduledStartAt: job.scheduled_start_at,
          status: job.status
        };
      })
      .toEqual({
        arrivalWindowEndAt: expect.any(String),
        arrivalWindowStartAt: expect.any(String),
        assignedTechnicianUserId: seededVisit.technicianUserId,
        scheduledEndAt: expect.any(String),
        scheduledStartAt: expect.any(String),
        status: "scheduled"
      });

    await loginTechnician(page);
    await page.goto(`${mobileWebBaseUrl}/jobs`);
    await expect(page.getByText(seededVisit.jobTitle)).toBeVisible();
    await page.getByText(seededVisit.jobTitle).click();

    await expect(page.getByText("Field workboard")).toBeVisible();
    await expect(await findPressableByLabel(page, "Mark en route")).toBeVisible();

    await (await findPressableByLabel(page, "Mark en route")).click();
    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobRow>("jobs", {
          label: `en route job ${seededVisit.jobId}`,
          filters: {
            id: `eq.${seededVisit.jobId}`
          },
          select:
            "id,title,status,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });

        return job.status;
      })
      .toBe("en_route");

    await (await findPressableByLabel(page, "Mark arrived")).click();
    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobRow>("jobs", {
          label: `arrived job ${seededVisit.jobId}`,
          filters: {
            id: `eq.${seededVisit.jobId}`
          },
          select:
            "id,title,status,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });

        return job.status;
      })
      .toBe("arrived");

    await (await findPressableByLabel(page, "Start diagnosis")).click();
    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobRow>("jobs", {
          label: `diagnosing job ${seededVisit.jobId}`,
          filters: {
            id: `eq.${seededVisit.jobId}`
          },
          select:
            "id,title,status,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });

        return job.status;
      })
      .toBe("diagnosing");

    await (await findPressableByLabel(page, "Start repair")).click();
    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobRow>("jobs", {
          label: `repairing job ${seededVisit.jobId}`,
          filters: {
            id: `eq.${seededVisit.jobId}`
          },
          select:
            "id,title,status,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });

        return job.status;
      })
      .toBe("repairing");

    await openInvoiceWorkspace(page);
    await expect(page.getByText("Invoice not started yet")).toBeVisible();
    await (await findPressableByLabel(page, "Create invoice draft")).click();

    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<InvoiceRow>("invoices", {
          filters: {
            job_id: `eq.${seededVisit.jobId}`
          },
          order: "created_at.desc",
          select: "id,job_id,status,balance_due_cents,amount_paid_cents"
        });

        return rows[0]
          ? {
              amountPaidCents: rows[0].amount_paid_cents,
              balanceDueCents: rows[0].balance_due_cents,
              id: rows[0].id,
              jobId: rows[0].job_id,
              status: rows[0].status
            }
          : null;
      })
      .toEqual({
        amountPaidCents: 0,
        balanceDueCents: 12500,
        id: expect.any(String),
        jobId: seededVisit.jobId,
        status: "draft"
      });

    const draftInvoice = await getSingleSupabaseRow<InvoiceRow>("invoices", {
      label: `draft invoice for ${seededVisit.jobId}`,
      filters: {
        job_id: `eq.${seededVisit.jobId}`
      },
      order: "created_at.desc",
      select: "id,job_id,status,balance_due_cents,amount_paid_cents"
    });

    await expect(await findPressableByLabel(page, "Issue invoice")).toBeVisible();
    await (await findPressableByLabel(page, "Issue invoice")).click();

    await expect
      .poll(async () => {
        const invoice = await getSingleSupabaseRow<InvoiceRow>("invoices", {
          label: `issued invoice for ${seededVisit.jobId}`,
          filters: {
            id: `eq.${draftInvoice.id}`
          },
          select: "id,job_id,status,balance_due_cents,amount_paid_cents"
        });
        const job = await getSingleSupabaseRow<JobRow>("jobs", {
          label: `ready for payment job ${seededVisit.jobId}`,
          filters: {
            id: `eq.${seededVisit.jobId}`
          },
          select:
            "id,title,status,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });

        return {
          invoiceStatus: invoice.status,
          jobStatus: job.status
        };
      })
      .toEqual({
        invoiceStatus: "issued",
        jobStatus: "ready_for_payment"
      });

    await expect(page.getByText("Record cash or check")).toBeVisible();
    await page.getByText(/^Cash$/).first().click();
    await page.getByPlaceholder("Optional payment reference.").fill("E2E cash collection");
    await (await findPressableByLabel(page, "Record field payment")).click();

    await expect
      .poll(async () => {
        const invoice = await getSingleSupabaseRow<InvoiceRow>("invoices", {
          label: `paid invoice for ${seededVisit.jobId}`,
          filters: {
            id: `eq.${draftInvoice.id}`
          },
          select: "id,job_id,status,balance_due_cents,amount_paid_cents"
        });
        const job = await getSingleSupabaseRow<JobRow>("jobs", {
          label: `completed job ${seededVisit.jobId}`,
          filters: {
            id: `eq.${seededVisit.jobId}`
          },
          select:
            "id,title,status,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });
        const payments = await listSupabaseRows<PaymentRow>("payments", {
          filters: {
            invoice_id: `eq.${draftInvoice.id}`
          },
          order: "created_at.desc",
          select: "id,invoice_id,amount_cents,status"
        });

        return {
          amountPaidCents: invoice.amount_paid_cents,
          balanceDueCents: invoice.balance_due_cents,
          invoiceStatus: invoice.status,
          jobStatus: job.status,
          paymentAmountCents: payments[0]?.amount_cents ?? null,
          paymentCount: payments.length,
          paymentStatus: payments[0]?.status ?? null
        };
      })
      .toEqual({
        amountPaidCents: 12500,
        balanceDueCents: 0,
        invoiceStatus: "paid",
        jobStatus: "completed",
        paymentAmountCents: 12500,
        paymentCount: 1,
        paymentStatus: "succeeded"
      });

    await expect(page.getByText("Payment complete")).toBeVisible();
  });
});
