import { expect, test, type Page } from "@playwright/test";

import {
  chooseCommandResult,
  getAuthenticatedUserIdFromAuthCookie,
  getSingleSupabaseRow,
  insertSupabaseRows,
  getUrlSearchParam,
  listSupabaseRows,
  loginOffice,
  openCommandPalette,
  patchSupabaseRows,
  webBaseUrl
} from "./helpers";

type CommunicationEventRow = {
  communication_type: string;
  created_at: string;
  event_type: string;
  id: string;
  invoice_id: string | null;
  job_id: string | null;
  payload: Record<string, unknown> | null;
  trigger_source: string;
};

type CustomerCommunicationRow = {
  channel: string;
  communication_type: string;
  created_at: string;
  event_id: string | null;
  id: string;
  invoice_id: string | null;
  job_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: string;
};

type CustomerAddressRow = {
  access_window_notes: string | null;
  city: string;
  customer_id: string;
  gate_code: string | null;
  id: string;
  is_active: boolean;
  line1: string;
  parking_notes: string | null;
  postal_code: string;
  service_contact_name: string | null;
  site_name: string | null;
  state: string;
};

type InvoiceContextRow = {
  id: string;
  invoice_number: string;
  job_id: string;
};

type JobScheduleRow = {
  arrival_window_end_at: string | null;
  arrival_window_start_at: string | null;
  assigned_technician_user_id?: string | null;
  id: string;
  is_active?: boolean;
  scheduled_end_at: string | null;
  scheduled_start_at: string | null;
  status?: string;
  title: string;
};

type EstimateContextRow = {
  approval_statement?: string | null;
  approved_by_name?: string | null;
  approved_signature_id?: string | null;
  accepted_at?: string | null;
  estimate_number: string;
  id: string;
  job_id: string;
  sent_at?: string | null;
  status: string;
  title: string;
};

type EstimateReleaseSeedJobRow = JobScheduleRow & {
  company_id: string;
  created_by_user_id: string;
  customer_id: string;
  priority: string;
  service_site_id: string | null;
  source: string;
  vehicle_id: string;
};

type SignatureContextRow = {
  id: string;
};

type ProfileCompanyRow = {
  default_company_id: string | null;
  id: string;
};

function requireUrlParam(url: string, key: string) {
  const value = getUrlSearchParam(url, key);

  expect(value, `Expected ${key} in ${url}`).toBeTruthy();
  return value as string;
}

async function seedAcceptedEstimateReleaseVisit(page: Page) {
  const officeUserId = await getAuthenticatedUserIdFromAuthCookie(page);
  const officeProfile = await getSingleSupabaseRow<ProfileCompanyRow>("profiles", {
    label: `office profile ${officeUserId}`,
    filters: {
      id: `eq.${officeUserId}`
    },
    select: "id,default_company_id"
  });
  const officeCompanyId = officeProfile.default_company_id;

  expect(officeCompanyId, "Expected the signed-in office user to have a default company.").toBeTruthy();

  const releaseJobTemplates = await listSupabaseRows<EstimateReleaseSeedJobRow>("jobs", {
    filters: {
      company_id: `eq.${officeCompanyId}`,
      is_active: "eq.true"
    },
    limit: 12,
    order: "updated_at.desc",
    select:
      "id,title,company_id,created_by_user_id,customer_id,vehicle_id,service_site_id,priority,source,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status,is_active"
  });
  const releaseJobTemplate =
    releaseJobTemplates.find((candidate) => candidate.customer_id && candidate.vehicle_id) ?? null;

  expect(
    releaseJobTemplate,
    "Expected an active visit template with customer and vehicle context for the release flow test."
  ).toBeTruthy();

  const createdJobs = await insertSupabaseRows<EstimateReleaseSeedJobRow>("jobs", {
    arrival_window_end_at: null,
    arrival_window_start_at: null,
    assigned_technician_user_id: null,
    company_id: releaseJobTemplate!.company_id,
    created_by_user_id: releaseJobTemplate!.created_by_user_id,
    customer_id: releaseJobTemplate!.customer_id,
    description: null,
    customer_concern: "E2E estimate release handoff",
    internal_summary: "Created by the estimate desk release regression.",
    is_active: true,
    priority: releaseJobTemplate!.priority || "normal",
    scheduled_end_at: null,
    scheduled_start_at: null,
    service_site_id: releaseJobTemplate!.service_site_id,
    source: releaseJobTemplate!.source || "office",
    status: "new",
    title: `E2E estimate release visit ${Date.now()}`,
    vehicle_id: releaseJobTemplate!.vehicle_id
  });
  const releaseJob = createdJobs[0];

  const estimateNumber = `EST-E2E-${Date.now()}`;
  const approvalStatement =
    "I approve the estimate and authorize the shop to perform the listed work.";
  const approvedByName = "E2E Approval Contact";
  const sentAt = new Date().toISOString();

  const createdEstimates = await insertSupabaseRows<EstimateContextRow>("estimates", {
    company_id: releaseJob.company_id,
    created_by_user_id: releaseJob.created_by_user_id,
    estimate_number: estimateNumber,
    job_id: releaseJob.id,
    sent_at: sentAt,
    status: "sent",
    title: "E2E accepted estimate release flow"
  });
  const acceptedEstimate = createdEstimates[0];
  const createdSignatures = await insertSupabaseRows<SignatureContextRow>("signatures", {
    company_id: releaseJob.company_id,
    estimate_id: acceptedEstimate.id,
    file_size_bytes: 128,
    job_id: releaseJob.id,
    mime_type: "image/png",
    signed_by_name: approvedByName,
    statement: approvalStatement,
    storage_bucket: "customer-assets",
    storage_path: `e2e/signatures/${acceptedEstimate.id}.png`
  });

  await patchSupabaseRows<EstimateContextRow>("estimates", {
    filters: {
      id: `eq.${acceptedEstimate.id}`
    },
    payload: {
      accepted_at: new Date().toISOString(),
      approval_statement: approvalStatement,
      approved_by_name: approvedByName,
      approved_signature_id: createdSignatures[0]?.id ?? null,
      status: "accepted"
    }
  });

  return {
    acceptedEstimate,
    estimateNumber
  };
}

test.describe("office write flows", () => {
  test("queues a payment reminder from the invoice hot thread", async ({ page }) => {
    await loginOffice(page);

    const commandInput = await openCommandPalette(page);
    await commandInput.fill("INV-1006");
    await chooseCommandResult(page, /INV-1006/i);

    await expect(page).toHaveURL(/\/dashboard\/finance\?invoiceId=/);
    await expect(page.getByRole("button", { name: "Send payment reminder" })).toBeVisible();
    const invoiceId = requireUrlParam(page.url(), "invoiceId");
    const invoice = await getSingleSupabaseRow<InvoiceContextRow>("invoices", {
      label: `invoice ${invoiceId}`,
      filters: {
        id: `eq.${invoiceId}`
      },
      select: "id,invoice_number,job_id"
    });
    const initialReminderEvents = await listSupabaseRows<CommunicationEventRow>(
      "communication_events",
      {
        filters: {
          event_type: "eq.payment_reminder_requested",
          invoice_id: `eq.${invoiceId}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );
    const initialReminderCommunications = await listSupabaseRows<CustomerCommunicationRow>(
      "customer_communications",
      {
        filters: {
          communication_type: "eq.payment_reminder",
          invoice_id: `eq.${invoiceId}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );
    const reminderResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/communications") &&
        response.request().postData()?.includes('"action":"payment_reminder"') === true &&
        response.ok()
    );

    await page.getByRole("button", { name: "Send payment reminder" }).click();
    await reminderResponse;

    await expect(page.getByText("Payment reminder queued from the hot thread.")).toBeVisible();
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CommunicationEventRow>("communication_events", {
          filters: {
            event_type: "eq.payment_reminder_requested",
            invoice_id: `eq.${invoiceId}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialReminderEvents.length);
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CustomerCommunicationRow>("customer_communications", {
          filters: {
            communication_type: "eq.payment_reminder",
            invoice_id: `eq.${invoiceId}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialReminderCommunications.length);

    const latestReminderEvent = await getSingleSupabaseRow<CommunicationEventRow>(
      "communication_events",
      {
        label: `latest payment reminder event for ${invoice.invoice_number}`,
        filters: {
          event_type: "eq.payment_reminder_requested",
          invoice_id: `eq.${invoiceId}`
        },
        limit: 1,
        order: "created_at.desc",
        select:
          "id,created_at,invoice_id,job_id,event_type,communication_type,trigger_source,payload"
      }
    );
    const latestReminderCommunication = await getSingleSupabaseRow<CustomerCommunicationRow>(
      "customer_communications",
      {
        label: `latest payment reminder communication for ${invoice.invoice_number}`,
        filters: {
          event_id: `eq.${latestReminderEvent.id}`
        },
        select:
          "id,event_id,invoice_id,job_id,communication_type,channel,status,recipient_email,recipient_phone,created_at"
      }
    );

    expect(Date.parse(latestReminderEvent.created_at)).toBeGreaterThan(
      initialReminderEvents[0]?.created_at ? Date.parse(initialReminderEvents[0].created_at) : 0
    );
    expect(latestReminderEvent.invoice_id).toBe(invoiceId);
    expect(latestReminderEvent.job_id).toBe(invoice.job_id);
    expect(latestReminderEvent.event_type).toBe("payment_reminder_requested");
    expect(latestReminderEvent.communication_type).toBe("payment_reminder");
    expect(latestReminderEvent.trigger_source).toBe("manual");
    expect(latestReminderEvent.payload).toMatchObject({
      invoiceNumber: "INV-1006"
    });

    expect(latestReminderCommunication.event_id).toBe(latestReminderEvent.id);
    expect(latestReminderCommunication.invoice_id).toBe(invoiceId);
    expect(latestReminderCommunication.job_id).toBe(invoice.job_id);
    expect(latestReminderCommunication.communication_type).toBe("payment_reminder");
    expect(["email", "sms"]).toContain(latestReminderCommunication.channel);
    expect(["queued", "processing", "sent", "delivered", "failed"]).toContain(
      latestReminderCommunication.status
    );
    expect(
      latestReminderCommunication.recipient_email || latestReminderCommunication.recipient_phone
    ).toBeTruthy();
  });

  test("creates and edits a service site from the customer sites workspace", async ({ page }) => {
    const siteName = `E2E Service Site ${Date.now()}`;
    const initialAccessNotes = `Ask for dock key ${Date.now()}`;
    const updatedAccessNotes = `${initialAccessNotes} before entering bay 3`;

    await loginOffice(page);

    const commandInput = await openCommandPalette(page);
    await commandInput.fill("123 Service Lane");
    await chooseCommandResult(page, "123 Service Lane");

    await expect(page).toHaveURL(/\/dashboard\/customers\?customerId=.*tab=addresses/);
    await expect(page.getByText("Run recurring sites like operational assets")).toBeVisible();
    const sitesWorkspaceUrl = page.url();
    const customerId = requireUrlParam(sitesWorkspaceUrl, "customerId");

    const newSiteHref = await page.getByRole("link", { name: "Add service site" }).first().getAttribute("href");
    await page.goto(new URL(newSiteHref ?? "", page.url()).toString());
    await expect(page.getByText("Locations and access notes")).toBeVisible();

    await page.getByLabel("Site name").fill(siteName);
    await page.getByLabel("Street address").fill("500 Integration Way");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel("State").fill("TX");
    await page.getByLabel("Postal code").fill("78758");
    await page.getByText("Site contact, access details, and optional fields").click();
    await page.getByLabel("Site contact").fill("Dock supervisor");
    await page.getByLabel("Access window notes").fill("Weekdays after 8 AM");
    await page.getByLabel("Gate code").fill("2468");
    await page.getByLabel("Access notes").fill(initialAccessNotes);
    await page.getByRole("button", { name: "Save service location" }).click();
    await page.waitForLoadState("networkidle");
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CustomerAddressRow>("customer_addresses", {
          filters: {
            customer_id: `eq.${customerId}`,
            site_name: `eq.${siteName}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBe(1);

    const createdSite = await getSingleSupabaseRow<CustomerAddressRow>("customer_addresses", {
      label: `created service site ${siteName}`,
      filters: {
        customer_id: `eq.${customerId}`,
        site_name: `eq.${siteName}`
      },
      select:
        "id,customer_id,site_name,line1,city,state,postal_code,service_contact_name,access_window_notes,gate_code,parking_notes,is_active"
    });

    expect(createdSite.customer_id).toBe(customerId);
    expect(createdSite.site_name).toBe(siteName);
    expect(createdSite.line1).toBe("500 Integration Way");
    expect(createdSite.city).toBe("Austin");
    expect(createdSite.state).toBe("TX");
    expect(createdSite.postal_code).toBe("78758");
    expect(createdSite.service_contact_name).toBe("Dock supervisor");
    expect(createdSite.access_window_notes).toBe("Weekdays after 8 AM");
    expect(createdSite.gate_code).toBe("2468");
    expect(createdSite.parking_notes).toBe(initialAccessNotes);
    expect(createdSite.is_active).toBe(true);

    const editSiteUrl = new URL(sitesWorkspaceUrl);
    editSiteUrl.searchParams.set("editAddressId", createdSite.id);

    await page.goto(editSiteUrl.toString());
    await expect(page.getByText("Edit service location")).toBeVisible();
    await expect(page.getByLabel("Site name")).toHaveValue(siteName);
    await expect(page.getByLabel("Access notes")).toHaveValue(initialAccessNotes);

    const accessNotesInput = page.getByLabel("Access notes");
    await accessNotesInput.fill(updatedAccessNotes);
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForLoadState("networkidle");
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CustomerAddressRow>("customer_addresses", {
          filters: {
            id: `eq.${createdSite.id}`
          },
          select: "parking_notes"
        });

        return rows[0]?.parking_notes ?? null;
      })
      .toBe(updatedAccessNotes);

    const updatedSite = await getSingleSupabaseRow<CustomerAddressRow>("customer_addresses", {
      label: `updated service site ${siteName}`,
      filters: {
        id: `eq.${createdSite.id}`
      },
      select:
        "id,customer_id,site_name,line1,city,state,postal_code,service_contact_name,access_window_notes,gate_code,parking_notes,is_active"
    });

    expect(updatedSite.site_name).toBe(siteName);
    expect(updatedSite.parking_notes).toBe(updatedAccessNotes);
    expect(updatedSite.access_window_notes).toBe("Weekdays after 8 AM");
    expect(updatedSite.gate_code).toBe("2468");

    await page.goto(editSiteUrl.toString());
    await expect(page.getByText("Edit service location")).toBeVisible();
    await expect(page.getByLabel("Access notes")).toHaveValue(updatedAccessNotes);
  });

  test("sends an appointment confirmation from the dispatch drawer", async ({ page }) => {
    await loginOffice(page);
    const dispatchVisit = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
      label: "dispatch appointment visit",
      filters: {
        assigned_technician_user_id: "not.is.null",
        is_active: "eq.true",
        status: "eq.scheduled"
      },
      order: "scheduled_start_at.asc",
      select:
        "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status,is_active"
    });
    const jobId = dispatchVisit.id;
    const promisedAtDate = new Date(Date.now() + 60 * 60 * 1000);
    const promisedEndAtDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const promisedAt = promisedAtDate.toISOString();
    const promisedEndAt = promisedEndAtDate.toISOString();

    await patchSupabaseRows<JobScheduleRow>("jobs", {
      filters: {
        id: `eq.${jobId}`
      },
      payload: {
        arrival_window_end_at: promisedEndAt,
        arrival_window_start_at: promisedAt,
        assigned_technician_user_id: dispatchVisit.assigned_technician_user_id,
        scheduled_end_at: promisedEndAt,
        scheduled_start_at: promisedAt,
        status: "scheduled"
      }
    });

    await page.goto(`${webBaseUrl}/dashboard/dispatch?jobId=${jobId}`);

    await expect(
      page.locator(".dispatch-quick-edit__title").filter({ hasText: dispatchVisit.title })
    ).toBeVisible();
    const recentActivitySection = page.locator(".dispatch-quick-edit__section").filter({
      has: page.getByRole("heading", { name: "Recent activity" })
    });
    await expect(recentActivitySection).toBeVisible();
    const initialAppointmentEvents = await listSupabaseRows<CommunicationEventRow>(
      "communication_events",
      {
        filters: {
          event_type: "eq.appointment_confirmation_requested",
          job_id: `eq.${jobId}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );
    const initialAppointmentCommunications = await listSupabaseRows<CustomerCommunicationRow>(
      "customer_communications",
      {
        filters: {
          communication_type: "eq.appointment_confirmation",
          job_id: `eq.${jobId}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );
    const customerUpdatesSection = page.locator(".dispatch-quick-edit__section").filter({
      has: page.getByRole("heading", { name: "Customer updates" })
    });
    let appointmentButton = customerUpdatesSection.getByRole("button", {
      name: "Send appointment confirmation"
    });
    await expect(appointmentButton).toBeVisible();
    if (await appointmentButton.isDisabled()) {
      await page.reload();
      await expect(
        page.locator(".dispatch-quick-edit__title").filter({ hasText: dispatchVisit.title })
      ).toBeVisible();
      appointmentButton = page
        .locator(".dispatch-quick-edit__section")
        .filter({
          has: page.getByRole("heading", { name: "Customer updates" })
        })
        .getByRole("button", {
          name: "Send appointment confirmation"
        });
      try {
        await expect
          .poll(async () => appointmentButton.isDisabled(), {
            timeout: 10_000
          })
          .toBe(false);
      } catch {
        // Fall through to the promise-window repair path below.
      }
    }
    if (await appointmentButton.isDisabled()) {
      const quickEditPanel = page.locator(".dispatch-quick-edit");
      const scheduledStartInput = quickEditPanel.getByLabel("Scheduled start");
      const scheduledEndInput = quickEditPanel.getByLabel("Scheduled end");
      const arrivalStartInput = quickEditPanel.getByLabel("Arrival window start");
      const arrivalEndInput = quickEditPanel.getByLabel("Arrival window end");
      const formatLocalInputValue = (value: Date) =>
        new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      const shiftLocalInputValue = (value: string, minutes: number) => {
        const localDate = new Date(value);

        return new Date(
          localDate.getTime() + minutes * 60_000 - localDate.getTimezoneOffset() * 60_000
        )
          .toISOString()
          .slice(0, 16);
      };
      const localPromiseStartValue = formatLocalInputValue(promisedAtDate);
      const localPromiseEndValue = formatLocalInputValue(promisedEndAtDate);
      const existingScheduledStartValue = (await scheduledStartInput.inputValue()).trim();
      const existingScheduledEndValue = (await scheduledEndInput.inputValue()).trim();
      const existingArrivalStartValue = (await arrivalStartInput.inputValue()).trim();
      const existingArrivalEndValue = (await arrivalEndInput.inputValue()).trim();
      const nextArrivalStartValue = existingArrivalStartValue || existingScheduledStartValue || localPromiseStartValue;
      const candidateArrivalEndValue = existingArrivalEndValue || existingScheduledEndValue || localPromiseEndValue;
      const nextArrivalEndValue =
        candidateArrivalEndValue > nextArrivalStartValue
          ? candidateArrivalEndValue
          : shiftLocalInputValue(nextArrivalStartValue, 60);

      if (existingArrivalStartValue !== nextArrivalStartValue) {
        await arrivalStartInput.fill(nextArrivalStartValue);
      }
      if (existingArrivalEndValue !== nextArrivalEndValue) {
        await arrivalEndInput.fill(nextArrivalEndValue);
      }
      await quickEditPanel.getByLabel("Arrival window end").press("Tab");
      const saveToBoardButton = quickEditPanel.getByRole("button", { name: "Save to board" });
      await expect(saveToBoardButton).toBeEnabled();
      await saveToBoardButton.click();
      await expect
        .poll(async () => {
          const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
            label: `dispatch drawer promise for ${jobId}`,
            filters: {
              id: `eq.${jobId}`
            },
            select:
              "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
          });

          return {
            arrivalWindowStartAt: job.arrival_window_start_at ?? null,
            scheduledStartAt: job.scheduled_start_at ?? null
          };
        })
        .toMatchObject({
          arrivalWindowStartAt: expect.any(String),
          scheduledStartAt: expect.any(String)
        });
      await page.reload();
      await expect(
        page.locator(".dispatch-quick-edit__title").filter({ hasText: dispatchVisit.title })
      ).toBeVisible();
      appointmentButton = page
        .locator(".dispatch-quick-edit__section")
        .filter({
          has: page.getByRole("heading", { name: "Customer updates" })
        })
        .getByRole("button", {
          name: "Send appointment confirmation"
        });
    }
    const appointmentResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/communications") &&
        response.request().postData()?.includes('"action":"appointment_confirmation"') ===
          true &&
        response.ok()
    );
    await expect(appointmentButton).toBeEnabled();
    await appointmentButton.click({ force: true });
    await appointmentResponse;
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CommunicationEventRow>("communication_events", {
          filters: {
            event_type: "eq.appointment_confirmation_requested",
            job_id: `eq.${jobId}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialAppointmentEvents.length);
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CustomerCommunicationRow>("customer_communications", {
          filters: {
            communication_type: "eq.appointment_confirmation",
            job_id: `eq.${jobId}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialAppointmentCommunications.length);

    const latestAppointmentEvent = await getSingleSupabaseRow<CommunicationEventRow>(
      "communication_events",
      {
        label: `latest appointment confirmation event for ${jobId}`,
        filters: {
          event_type: "eq.appointment_confirmation_requested",
          job_id: `eq.${jobId}`
        },
        limit: 1,
        order: "created_at.desc",
        select: "id,created_at,job_id,event_type,communication_type,trigger_source,payload"
      }
    );
    const latestAppointmentCommunication =
      await getSingleSupabaseRow<CustomerCommunicationRow>("customer_communications", {
        label: `latest appointment confirmation communication for ${jobId}`,
        filters: {
          event_id: `eq.${latestAppointmentEvent.id}`
        },
        select:
          "id,event_id,job_id,communication_type,channel,status,recipient_email,recipient_phone,created_at"
      });

    expect(Date.parse(latestAppointmentEvent.created_at)).toBeGreaterThan(
      initialAppointmentEvents[0]?.created_at
        ? Date.parse(initialAppointmentEvents[0].created_at)
        : 0
    );
    expect(latestAppointmentEvent.job_id).toBe(jobId);
    expect(latestAppointmentEvent.event_type).toBe("appointment_confirmation_requested");
    expect(latestAppointmentEvent.communication_type).toBe("appointment_confirmation");
    expect(latestAppointmentEvent.trigger_source).toBe("manual");
    expect(latestAppointmentEvent.payload).toMatchObject({
      jobTitle: expect.any(String)
    });

    expect(latestAppointmentCommunication.event_id).toBe(latestAppointmentEvent.id);
    expect(latestAppointmentCommunication.job_id).toBe(jobId);
    expect(latestAppointmentCommunication.communication_type).toBe("appointment_confirmation");
    expect(["email", "sms"]).toContain(latestAppointmentCommunication.channel);
    expect(["queued", "processing", "sent", "delivered", "failed"]).toContain(
      latestAppointmentCommunication.status
    );
    expect(
      latestAppointmentCommunication.recipient_email ||
        latestAppointmentCommunication.recipient_phone
    ).toBeTruthy();
  });

  test("runs owner, promise, and release inline from the Dispatch release strip", async ({ page }) => {
    await loginOffice(page);
    const { acceptedEstimate } = await seedAcceptedEstimateReleaseVisit(page);

    const releaseJob = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
      label: `dispatch release strip job ${acceptedEstimate.job_id}`,
      filters: {
        id: `eq.${acceptedEstimate.job_id}`
      },
      select:
        "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
    });

    await page.goto(`${webBaseUrl}/dashboard/dispatch`);

    const approvedReleaseSection = page
      .locator(".dispatch-recovery-band__section")
      .filter({
        has: page.getByRole("heading", {
          name: /Place approved (work|visits) onto (lanes|live lanes)/i
        })
      });
    const collapsedApprovedRelease = page
      .locator(".dispatch-recovery-band__overflow--utility")
      .filter({ has: page.getByText(/Approved release runway|Release runway mode/i) })
      .first();

    const openApprovedReleaseRunway = async () => {
      if (await approvedReleaseSection.isVisible().catch(() => false)) {
        return approvedReleaseSection;
      }

      await expect(collapsedApprovedRelease).toBeVisible();
      if ((await collapsedApprovedRelease.getAttribute("open")) === null) {
        await collapsedApprovedRelease.locator("summary").click();
      }

      return collapsedApprovedRelease;
    };

    const approvedReleaseContainer = await openApprovedReleaseRunway();
    const releaseCard = approvedReleaseContainer.locator(".dispatch-recovery-band__card").filter({
      has: page.locator(".dispatch-recovery-band__card-title").filter({ hasText: releaseJob.title })
    });
    await expect(releaseCard).toBeVisible();
    await expect(releaseCard.getByText("Approved release")).toBeVisible();

    const ownerSelect = releaseCard.getByLabel(`${releaseJob.title} release owner`);
    const assignedTechnicianUserId = await ownerSelect.locator("option").nth(1).getAttribute("value");
    expect(assignedTechnicianUserId).toBeTruthy();
    await ownerSelect.selectOption(assignedTechnicianUserId as string);
    await releaseCard.getByRole("button", { name: "Save owner" }).click();

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `dispatch release strip owner for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.assigned_technician_user_id ?? null;
      })
      .toBe(assignedTechnicianUserId);

    const promisedAt = new Date(Date.now() + 90 * 60 * 1000);
    const localPromiseValue = new Date(
      promisedAt.getTime() - promisedAt.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 16);

    const promiseInput = releaseCard.getByLabel(`${releaseJob.title} release promise`);
    await promiseInput.fill(localPromiseValue);
    await releaseCard.getByRole("button", { name: "Save promise" }).click();

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `dispatch release strip promise for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.arrival_window_start_at ?? null;
      })
      .not.toBeNull();

    await page.reload({ waitUntil: "networkidle" });
    const refreshedApprovedReleaseContainer = await openApprovedReleaseRunway();
    const readyCard = refreshedApprovedReleaseContainer.locator(".dispatch-recovery-band__card").filter({
      has: page.locator(".dispatch-recovery-band__card-title").filter({ hasText: releaseJob.title })
    });
    await expect(readyCard).toBeVisible();
    await readyCard.getByRole("button", { name: "Release to board" }).click();

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `dispatch release strip release state for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.status ?? null;
      })
      .toBe("scheduled");
  });

  test("runs assignment, promise, and dispatch release from the estimate desk", async ({ page }) => {
    await loginOffice(page);
    const { acceptedEstimate, estimateNumber } = await seedAcceptedEstimateReleaseVisit(page);

    await page.goto(`${webBaseUrl}/dashboard/estimates?stage=approved_release`);
    const releaseCard = page.locator(".estimate-production-roster__entry").filter({
      has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
    });
    await expect(releaseCard).toBeVisible();
    const releaseRowHref = await releaseCard.locator(".estimate-production-roster__row").getAttribute("href");
    expect(releaseRowHref).toContain(`estimateId=${acceptedEstimate.id}`);
    await page.goto(new URL(releaseRowHref!, webBaseUrl).toString());
    await page.waitForLoadState("networkidle");

    await expect(
      page
        .locator(".estimate-production-drawer__section-label")
        .filter({ hasText: "Release runway" })
        .first()
    ).toBeVisible();
    const releaseControls = page.locator(".estimate-production-drawer__continuation-list").filter({
      has: page.getByText("Inline release controls")
    });
    await expect(releaseControls).toBeVisible();

    const ownerSelect = releaseControls.locator('select[name="assignedTechnicianUserId"]');
    await expect(ownerSelect).toBeVisible();
    const ownerOption = ownerSelect.locator("option").nth(1);
    const assignedTechnicianUserId = await ownerOption.getAttribute("value");
    expect(assignedTechnicianUserId).toBeTruthy();
    await ownerSelect.selectOption(assignedTechnicianUserId as string);
    await releaseControls.getByRole("button", { name: "Save owner" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `estimate release owner for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.assigned_technician_user_id ?? null;
      })
      .toBe(assignedTechnicianUserId);

    const promisedAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const localPromiseValue = new Date(
      promisedAt.getTime() - promisedAt.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 16);

    await releaseControls.locator('input[name="scheduledStartAt"]').fill(localPromiseValue);
    await releaseControls.getByRole("button", { name: "Save time promise" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `estimate release promise for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.scheduled_start_at ?? job.arrival_window_start_at ?? null;
      }, { timeout: 30_000 })
      .not.toBeNull();

    await expect(releaseControls.getByRole("button", { name: "Release to dispatch" })).toBeVisible();
    await releaseControls.getByRole("button", { name: "Release to dispatch" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `estimate release dispatch status for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.status ?? null;
      })
      .toBe("scheduled");
  });

  test("runs assignment, promise, and dispatch release from the approved-release queue card", async ({ page }) => {
    await loginOffice(page);
    const { acceptedEstimate, estimateNumber } = await seedAcceptedEstimateReleaseVisit(page);

    await page.goto(`${webBaseUrl}/dashboard/estimates?stage=approved_release`);

    const releaseCard = page.locator(".estimate-production-roster__entry").filter({
      has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
    });

    await expect(releaseCard).toBeVisible();

    const ownerSelect = releaseCard.locator('select[name="assignedTechnicianUserId"]');
    const ownerOption = ownerSelect.locator("option").nth(1);
    const assignedTechnicianUserId = await ownerOption.getAttribute("value");
    expect(assignedTechnicianUserId).toBeTruthy();
    await ownerSelect.selectOption(assignedTechnicianUserId as string);
    await releaseCard.getByRole("button", { name: "Save owner" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `queue card owner for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.assigned_technician_user_id ?? null;
      })
      .toBe(assignedTechnicianUserId);

    const promisedAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const localPromiseValue = new Date(
      promisedAt.getTime() - promisedAt.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 16);

    await releaseCard.locator('input[name="scheduledStartAt"]').fill(localPromiseValue);
    await releaseCard.getByRole("button", { name: "Save promise" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `queue card promise for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.scheduled_start_at ?? null;
      })
      .not.toBeNull();

    await page.reload({ waitUntil: "networkidle" });
    const releaseReadyCard = page.locator(".estimate-production-roster__entry").filter({
      has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
    });
    await expect(releaseReadyCard.getByRole("button", { name: "Release" })).toBeVisible();
    await releaseReadyCard.getByRole("button", { name: "Release" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `queue card dispatch status for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.status ?? null;
      })
      .toBe("scheduled");

    await page.reload({ waitUntil: "networkidle" });
    const onBoardGroup = page.locator(".estimate-production-roster__group--on_board");
    await expect(onBoardGroup).toBeVisible();
    const onBoardCard = onBoardGroup.locator(".estimate-production-roster__entry").filter({
      has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
    });
    await expect(onBoardCard).toBeVisible();
    await expect(onBoardGroup.getByRole("link", { name: "Open in Dispatch" })).toHaveAttribute(
      "href",
      /\/dashboard\/dispatch\?[^\s]*jobId=[^&]+/
    );
    await expect(onBoardCard.getByText("Last customer update")).toBeVisible();
    await expect(
      onBoardCard.getByText(/No customer timing update logged|Updated \d+ (min|hr) ago/i)
    ).toBeVisible();
    await expect(onBoardCard.getByRole("button", { name: "Send dispatched update" })).toBeVisible();
    await expect(onBoardCard.getByRole("link", { name: "Open dispatch drawer" })).toHaveAttribute(
      "href",
      new RegExp(`\\/dashboard\\/dispatch\\?[^\\s]*jobId=${acceptedEstimate.job_id}`)
    );

    const initialDispatchEvents = await listSupabaseRows<CommunicationEventRow>(
      "communication_events",
      {
        filters: {
          event_type: "eq.dispatch_update_requested",
          job_id: `eq.${acceptedEstimate.job_id}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );
    const initialDispatchCommunications = await listSupabaseRows<CustomerCommunicationRow>(
      "customer_communications",
      {
        filters: {
          communication_type: "eq.dispatch_update",
          job_id: `eq.${acceptedEstimate.job_id}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );

    await onBoardGroup.getByRole("button", { name: "Send timing updates" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      onBoardGroup.locator(".estimate-production-roster__entry").filter({
        has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
      })
    ).toBeVisible();

    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CommunicationEventRow>("communication_events", {
          filters: {
            event_type: "eq.dispatch_update_requested",
            job_id: `eq.${acceptedEstimate.job_id}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialDispatchEvents.length);
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CustomerCommunicationRow>("customer_communications", {
          filters: {
            communication_type: "eq.dispatch_update",
            job_id: `eq.${acceptedEstimate.job_id}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialDispatchCommunications.length);

    const latestDispatchEvent = await getSingleSupabaseRow<CommunicationEventRow>(
      "communication_events",
      {
        label: `latest approved-release on-board dispatch update for ${acceptedEstimate.job_id}`,
        filters: {
          event_type: "eq.dispatch_update_requested",
          job_id: `eq.${acceptedEstimate.job_id}`
        },
        limit: 1,
        order: "created_at.desc",
        select: "id,created_at,job_id,event_type,communication_type,trigger_source,payload"
      }
    );
    const latestDispatchCommunication = await getSingleSupabaseRow<CustomerCommunicationRow>(
      "customer_communications",
      {
        label: `latest approved-release on-board dispatch communication for ${acceptedEstimate.job_id}`,
        filters: {
          event_id: `eq.${latestDispatchEvent.id}`
        },
        select:
          "id,event_id,job_id,communication_type,channel,status,recipient_email,recipient_phone,created_at"
      }
    );

    expect(latestDispatchEvent.job_id).toBe(acceptedEstimate.job_id);
    expect(latestDispatchEvent.event_type).toBe("dispatch_update_requested");
    expect(latestDispatchEvent.communication_type).toBe("dispatch_update");
    expect(latestDispatchEvent.trigger_source).toBe("manual");
    expect(latestDispatchEvent.payload).toMatchObject({
      updateType: "dispatched"
    });
    expect(latestDispatchCommunication.event_id).toBe(latestDispatchEvent.id);
    expect(latestDispatchCommunication.communication_type).toBe("dispatch_update");
  });

  test("clears blocked approved-release cards from the blocked group shortcuts", async ({ page }) => {
    await loginOffice(page);
    const { acceptedEstimate, estimateNumber } = await seedAcceptedEstimateReleaseVisit(page);

    await page.goto(`${webBaseUrl}/dashboard/estimates?stage=approved_release`);

    const blockedGroup = page.locator(".estimate-production-roster__group--blocked");
    await expect(blockedGroup).toBeVisible();
    await expect(
      blockedGroup.locator(".estimate-production-roster__entry").filter({
        has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
      })
    ).toBeVisible();

    const ownerSelect = blockedGroup.locator('select[name="assignedTechnicianUserId"]').first();
    const assignedTechnicianUserId = await ownerSelect.locator("option").nth(1).getAttribute("value");
    expect(assignedTechnicianUserId).toBeTruthy();
    await ownerSelect.selectOption(assignedTechnicianUserId as string);
    await blockedGroup.getByRole("button", { name: "Apply owner to blocked" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `blocked group owner for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.assigned_technician_user_id ?? null;
      })
      .toBe(assignedTechnicianUserId);

    await page.reload({ waitUntil: "networkidle" });

    const promisedAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const localPromiseValue = new Date(
      promisedAt.getTime() - promisedAt.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 16);

    const refreshedBlockedGroup = page.locator(".estimate-production-roster__group--blocked");
    await refreshedBlockedGroup.locator('input[name="scheduledStartAt"]').first().fill(localPromiseValue);
    await refreshedBlockedGroup.getByRole("button", { name: "Apply promise to blocked" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `blocked group promise for ${acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.scheduled_start_at ?? null;
      })
      .not.toBeNull();

    await page.reload({ waitUntil: "networkidle" });

    const readyGroup = page.locator(".estimate-production-roster__group--ready");
    await expect(readyGroup).toBeVisible();
    await expect(
      readyGroup.locator(".estimate-production-roster__entry").filter({
        has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
      })
    ).toBeVisible();
  });

  test("applies bulk owner, promise, and release actions from the approved-release queue", async ({ page }) => {
    await loginOffice(page);
    const firstSeed = await seedAcceptedEstimateReleaseVisit(page);
    const secondSeed = await seedAcceptedEstimateReleaseVisit(page);

    await page.goto(`${webBaseUrl}/dashboard/estimates?stage=approved_release`);

    const selectedJobIds = [firstSeed.acceptedEstimate.job_id, secondSeed.acceptedEstimate.job_id];
    const selectionUrl = new URL(`${webBaseUrl}/dashboard/estimates`);
    selectionUrl.searchParams.set("stage", "approved_release");
    selectionUrl.searchParams.set("selectedJobIds", selectedJobIds.join(","));
    await page.goto(selectionUrl.toString());

    const getSelectedJobIds = () =>
      new Set(
        (getUrlSearchParam(page.url(), "selectedJobIds") ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      );

    async function ensureBulkSelection(jobId: string, estimateNumber: string) {
      if (getSelectedJobIds().has(jobId)) {
        return;
      }

      const releaseCard = page.locator(".estimate-production-roster__entry").filter({
        has: page.getByRole("link", { name: new RegExp(estimateNumber, "i") })
      });

      await expect(releaseCard).toBeVisible();
      await Promise.all([
        page.waitForURL((url) => {
          const selected = new URL(url.toString()).searchParams.get("selectedJobIds") ?? "";
          return selected.split(",").map((value) => value.trim()).includes(jobId);
        }),
        releaseCard.getByRole("link", { name: "Select for bulk" }).click()
      ]);
    }

    for (const [jobId, estimateNumber] of [
      [firstSeed.acceptedEstimate.job_id, firstSeed.estimateNumber],
      [secondSeed.acceptedEstimate.job_id, secondSeed.estimateNumber]
    ] as const) {
      await ensureBulkSelection(jobId, estimateNumber);
    }

    const bulkBar = page.locator(".estimate-production-bulk-bar");
    await expect(bulkBar).toBeVisible();
    await expect(bulkBar.getByText(/2 approved visits selected/i)).toBeVisible();

    const bulkOwnerSelect = bulkBar.locator('select[name="assignedTechnicianUserId"]');
    const assignedTechnicianUserId = await bulkOwnerSelect.locator("option").nth(1).getAttribute("value");
    expect(assignedTechnicianUserId).toBeTruthy();
    await bulkOwnerSelect.selectOption(assignedTechnicianUserId as string);
    await bulkBar.getByRole("button", { name: "Apply owner to selected" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const firstJob = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk owner first job ${firstSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${firstSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });
        const secondJob = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk owner second job ${secondSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${secondSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return [firstJob.assigned_technician_user_id ?? null, secondJob.assigned_technician_user_id ?? null];
      })
      .toEqual([assignedTechnicianUserId, assignedTechnicianUserId]);

    await page.reload({ waitUntil: "networkidle" });

    const promisedAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const localPromiseValue = new Date(
      promisedAt.getTime() - promisedAt.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 16);

    await bulkBar.locator('input[name="scheduledStartAt"]').fill(localPromiseValue);
    await bulkBar.getByRole("button", { name: "Apply promise to selected" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const firstJob = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk promise first job ${firstSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${firstSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });
        const secondJob = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk promise second job ${secondSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${secondSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return [firstJob.scheduled_start_at ?? null, secondJob.scheduled_start_at ?? null];
      })
      .toEqual([expect.any(String), expect.any(String)]);

    await page.reload({ waitUntil: "networkidle" });
    await expect(bulkBar.getByRole("button", { name: "Release selected to dispatch" })).toBeEnabled();
    await bulkBar.getByRole("button", { name: "Release selected to dispatch" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const firstJob = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk release first job ${firstSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${firstSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });
        const secondJob = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk release second job ${secondSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${secondSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return [firstJob.status ?? null, secondJob.status ?? null];
      })
      .toEqual(["scheduled", "scheduled"]);
  });

  test("surfaces bulk release exceptions and lets the operator drop blocked visits inline", async ({ page }) => {
    await loginOffice(page);
    const firstSeed = await seedAcceptedEstimateReleaseVisit(page);

    await page.goto(`${webBaseUrl}/dashboard/estimates?stage=approved_release`);

    const firstReleaseCard = page.locator(".estimate-production-roster__entry").filter({
      has: page.getByRole("link", { name: new RegExp(firstSeed.estimateNumber, "i") })
    });
    await expect(firstReleaseCard).toBeVisible();

    const ownerSelect = firstReleaseCard.locator('select[name="assignedTechnicianUserId"]');
    const assignedTechnicianUserId = await ownerSelect.locator("option").nth(1).getAttribute("value");
    expect(assignedTechnicianUserId).toBeTruthy();
    await ownerSelect.selectOption(assignedTechnicianUserId as string);
    await firstReleaseCard.getByRole("button", { name: "Save owner" }).click();
    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk exception owner status for ${firstSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${firstSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.assigned_technician_user_id ?? null;
      })
      .toBe(assignedTechnicianUserId);

    const localPromiseValue = new Date(Date.now() + 2 * 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    await firstReleaseCard.locator('input[name="scheduledStartAt"]').fill(localPromiseValue);
    await firstReleaseCard.getByRole("button", { name: "Save promise" }).click();
    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk exception promise status for ${firstSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${firstSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.scheduled_start_at ?? job.arrival_window_start_at ?? null;
      }, { timeout: 30_000 })
      .not.toBeNull();

    await page.reload({ waitUntil: "networkidle" });

    const releaseReadyCard = page.locator(".estimate-production-roster__entry").filter({
      has: page.getByRole("link", { name: new RegExp(firstSeed.estimateNumber, "i") })
    });
    await expect(releaseReadyCard.getByRole("button", { name: "Release" })).toBeVisible();
    await releaseReadyCard.getByRole("button", { name: "Release" }).click();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `bulk exception release status for ${firstSeed.acceptedEstimate.job_id}`,
          filters: {
            id: `eq.${firstSeed.acceptedEstimate.job_id}`
          },
          select:
            "id,title,assigned_technician_user_id,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,status"
        });

        return job.status ?? null;
      })
      .toBe("scheduled");

    const selectionUrl = new URL(`${webBaseUrl}/dashboard/estimates`);
    selectionUrl.searchParams.set("stage", "approved_release");
    selectionUrl.searchParams.set("selectedJobIds", firstSeed.acceptedEstimate.job_id);
    await page.goto(selectionUrl.toString());

    const bulkBar = page.locator(".estimate-production-bulk-bar");
    await expect(bulkBar).toBeVisible();
    await expect(bulkBar.locator(".estimate-production-bulk-bar__title")).toContainText("1 approved visit selected");

    const exceptionRow = bulkBar.locator(".estimate-production-bulk-bar__exception").filter({
      hasText: firstSeed.estimateNumber
    });

    await expect(exceptionRow).toBeVisible();
    await expect(exceptionRow).toContainText(/Release: Visit is already on the dispatch board\./i);
    const dropSelectionHref = await exceptionRow
      .getByRole("link", { name: "Drop from selection" })
      .getAttribute("href");
    expect(dropSelectionHref).toBeTruthy();
    await page.goto(new URL(dropSelectionHref!, webBaseUrl).toString());
    await expect
      .poll(() => getUrlSearchParam(page.url(), "selectedJobIds") ?? "")
      .toBe("");
    await expect(page.locator(".estimate-production-bulk-bar")).toHaveCount(0);
  });

  test("runs a recovery move from the dispatch drawer", async ({ page }) => {
    await loginOffice(page);
    const recoveryVisit = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
      label: "dispatch recovery visit",
      filters: {
        title: "eq.No-start battery and charging diagnosis"
      },
      select:
        "id,title,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,assigned_technician_user_id,status"
    });
    const overdueScheduledStartAt = new Date(Date.now() - 50 * 60_000).toISOString();
    const overdueScheduledEndAt = new Date(Date.now() + 70 * 60_000).toISOString();
    const overdueArrivalWindowStartAt = new Date(Date.now() - 65 * 60_000).toISOString();
    const overdueArrivalWindowEndAt = new Date(Date.now() - 20 * 60_000).toISOString();

    await patchSupabaseRows<JobScheduleRow>("jobs", {
      filters: {
        id: `eq.${recoveryVisit.id}`
      },
      payload: {
        arrival_window_end_at: overdueArrivalWindowEndAt,
        arrival_window_start_at: overdueArrivalWindowStartAt,
        assigned_technician_user_id: recoveryVisit.assigned_technician_user_id,
        scheduled_end_at: overdueScheduledEndAt,
        scheduled_start_at: overdueScheduledStartAt,
        status: "dispatched"
      }
    });

    const jobId = recoveryVisit.id;
    await page.goto(`${webBaseUrl}/dashboard/dispatch?jobId=${jobId}`);

    await expect(page.getByText("Visit intervention")).toBeVisible();
    await expect(
      page.locator(".dispatch-quick-edit__title").filter({ hasText: recoveryVisit.title })
    ).toBeVisible();
    await expect(page.getByText("Promise recovery should happen now")).toBeVisible();
    const initialJobSchedule = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
      label: `dispatch recovery job ${jobId}`,
      filters: {
        id: `eq.${jobId}`
      },
      select:
        "id,title,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
    });

    const scheduledStartField = page.getByLabel("Scheduled start");
    const scheduledEndField = page.getByLabel("Scheduled end");
    const initialScheduledStart = await scheduledStartField.inputValue();
    const initialScheduledEnd = await scheduledEndField.inputValue();
    const recoveryButton = page.getByRole("button", {
      name: /Notify(?:, reset ETA, and reassign| and reset ETA)/i
    });
    await expect(recoveryButton).toBeVisible();
    const recoveryResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/internal/dispatch/calendar/quick-edit") &&
        response.request().method() === "POST" &&
        response.ok()
    );
    await recoveryButton.click();
    await recoveryResponse;

    await expect
      .poll(async () => await scheduledStartField.inputValue())
      .not.toBe(initialScheduledStart);
    await expect
      .poll(async () => await scheduledEndField.inputValue())
      .not.toBe(initialScheduledEnd);
    const initialScheduleSignature = JSON.stringify([
      initialJobSchedule.scheduled_start_at,
      initialJobSchedule.scheduled_end_at,
      initialJobSchedule.arrival_window_start_at,
      initialJobSchedule.arrival_window_end_at
    ]);

    await expect
      .poll(async () => {
        const job = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
          label: `updated dispatch recovery job ${jobId}`,
          filters: {
            id: `eq.${jobId}`
          },
          select:
            "id,title,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
        });

        return JSON.stringify([
          job.scheduled_start_at,
          job.scheduled_end_at,
          job.arrival_window_start_at,
          job.arrival_window_end_at
        ]);
      })
      .not.toBe(initialScheduleSignature);

    const updatedJobSchedule = await getSingleSupabaseRow<JobScheduleRow>("jobs", {
      label: `persisted dispatch recovery job ${jobId}`,
      filters: {
        id: `eq.${jobId}`
      },
      select:
        "id,title,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at"
    });

    expect(updatedJobSchedule.scheduled_start_at).not.toBe(initialJobSchedule.scheduled_start_at);
    expect(updatedJobSchedule.scheduled_end_at).not.toBe(initialJobSchedule.scheduled_end_at);
    expect(updatedJobSchedule.arrival_window_start_at).not.toBe(
      initialJobSchedule.arrival_window_start_at
    );
    expect(updatedJobSchedule.arrival_window_end_at).not.toBe(
      initialJobSchedule.arrival_window_end_at
    );
  });
});
