import { expect, test } from "@playwright/test";

import {
  alexTechnicianCredentials,
  getSingleSupabaseRow,
  listSupabaseRows,
  loginTechnician,
  mobileWebBaseUrl,
  technicianCredentials
} from "./helpers";

type InvoiceStateRow = {
  amount_paid_cents: number;
  balance_due_cents: number;
  id: string;
  invoice_number: string;
  job_id: string;
  status: string;
};

type JobNoteRow = {
  author_user_id: string;
  body: string;
  created_at: string;
  id: string;
  is_internal: boolean;
  job_id: string;
};

type PaymentRow = {
  amount_cents: number;
  id: string;
  invoice_id: string;
};

type ProfileRow = {
  email: string;
  id: string;
};

function requireJobIdFromMobileUrl(url: string) {
  const match = url.match(/\/jobs\/([^/?#]+)/u);

  expect(match?.[1], `Expected job id in ${url}`).toBeTruthy();
  return match?.[1] as string;
}

async function openInvoiceWorkspace(page: import("@playwright/test").Page) {
  const candidateLabels = [/^Open invoice$/u, /^Payment$/u, /^Invoice$/u, /^Create invoice$/u];

  for (const label of candidateLabels) {
    const candidate = page.getByText(label).last();

    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }

  throw new Error("Could not find a stop-to-invoice action on the technician workboard.");
}

test.describe("mobile guided stop", () => {
  test("keeps the guided stop sequence intact on mobile web", async ({ page }) => {
    await loginTechnician(page);
    await page.goto(`${mobileWebBaseUrl}/jobs`);
    await page.getByText("Cooling system diagnosis").click();

    await expect(page.getByText("Field workboard")).toBeVisible();
    await expect(page.getByText("Current stage")).toBeVisible();
    await expect(page.getByText(/^Open inspection$/).first()).toBeVisible();
    await expect(page.getByText(/^(Add evidence|Evidence \(\d+\)|Photos \(\d+\))$/u).first()).toBeVisible();
    await expect(page.getByText(/^(Create invoice|Open invoice|Collect payment)$/u).first()).toBeVisible();

    await page.getByText(/^Open inspection$/).first().click();
    await expect(page.getByText("Inspection workflow")).toBeVisible();
    await expect(page.getByText("Inspection status")).toBeVisible();

    await page.goBack();

    await expect(page.getByText("Field workboard")).toBeVisible();
    await expect(page.getByText("Field status")).toBeVisible();
  });

  test("saves a technician note and walks the billing handoff path", async ({ page }) => {
    const noteBody = `E2E technician note ${Date.now()}`;

    await loginTechnician(page);
    await page.goto(`${mobileWebBaseUrl}/jobs`);
    await page.getByText("Cooling system diagnosis").click();
    const jobId = requireJobIdFromMobileUrl(page.url());
    const technicianProfile = await getSingleSupabaseRow<ProfileRow>("profiles", {
      label: `technician profile ${technicianCredentials.email}`,
      filters: {
        email: `eq.${technicianCredentials.email}`
      },
      select: "id,email"
    });
    const initialNotes = await listSupabaseRows<JobNoteRow>("job_notes", {
      filters: {
        job_id: `eq.${jobId}`
      },
      order: "created_at.desc",
      select: "id,created_at"
    });

    await page.getByPlaceholder("Add a technician note for the office team.").fill(noteBody);
    await page.getByText(/^Add note$/).click();

    await expect(page.getByText("Note saved")).toBeVisible();
    await expect(page.getByText(noteBody)).toBeVisible();
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<JobNoteRow>("job_notes", {
          filters: {
            job_id: `eq.${jobId}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialNotes.length);

    const latestNote = await getSingleSupabaseRow<JobNoteRow>("job_notes", {
      label: `latest technician note for ${jobId}`,
      filters: {
        body: `eq.${noteBody}`,
        job_id: `eq.${jobId}`
      },
      order: "created_at.desc",
      select: "id,job_id,body,author_user_id,is_internal,created_at"
    });

    expect(latestNote.job_id).toBe(jobId);
    expect(latestNote.body).toBe(noteBody);
    expect(latestNote.author_user_id).toBe(technicianProfile.id);
    expect(latestNote.is_internal).toBe(true);
    expect(Date.parse(latestNote.created_at)).toBeGreaterThan(
      initialNotes[0]?.created_at ? Date.parse(initialNotes[0].created_at) : 0
    );

    await openInvoiceWorkspace(page);

    await expect(page.getByText("Invoice still needs to be issued")).toBeVisible();
    await expect(page.getByText("Balance due", { exact: true }).last()).toBeVisible();
    const draftInvoice = await getSingleSupabaseRow<InvoiceStateRow>("invoices", {
      label: `draft mobile invoice for ${jobId}`,
      filters: {
        job_id: `eq.${jobId}`
      },
      select: "id,job_id,invoice_number,status,amount_paid_cents,balance_due_cents"
    });
    const draftInvoicePayments = await listSupabaseRows<PaymentRow>("payments", {
      filters: {
        invoice_id: `eq.${draftInvoice.id}`
      },
      select: "id,invoice_id,amount_cents"
    });

    expect(draftInvoice.status).toBe("draft");
    expect(draftInvoice.amount_paid_cents).toBe(0);
    expect(draftInvoice.balance_due_cents).toBeGreaterThan(0);
    expect(draftInvoicePayments).toHaveLength(0);

    await page.getByText(/^Back to stop$/).click();

    await expect(page).toHaveURL(/\/jobs\/[^/]+$/);
    await expect(page.getByText(noteBody).last()).toBeVisible();
  });

  test("shows the live payment handoff on a partially paid completed stop", async ({ page }) => {
    await loginTechnician(page);
    await page.goto(`${mobileWebBaseUrl}/jobs`);
    await page.getByText("Wheel bearing and hub replacement").click();
    const jobId = requireJobIdFromMobileUrl(page.url());

    await expect(page.getByText("Field workboard")).toBeVisible();
    await expect(page.getByText(/^(Open invoice|Collect payment)$/u).first()).toBeVisible();

    await openInvoiceWorkspace(page);

    await expect(page.getByText(/Payment link unavailable|Collect payment from the live page/)).toBeVisible();
    await expect(page.getByText("Balance due", { exact: true }).last()).toBeVisible();
    await expect(page.getByText(/^View receipt$/)).toBeVisible();
    const partialInvoice = await getSingleSupabaseRow<InvoiceStateRow>("invoices", {
      label: `partial mobile invoice for ${jobId}`,
      filters: {
        job_id: `eq.${jobId}`
      },
      select: "id,job_id,invoice_number,status,amount_paid_cents,balance_due_cents"
    });
    const partialInvoicePayments = await listSupabaseRows<PaymentRow>("payments", {
      filters: {
        invoice_id: `eq.${partialInvoice.id}`
      },
      select: "id,invoice_id,amount_cents"
    });

    expect(partialInvoice.status).toBe("partially_paid");
    expect(partialInvoice.amount_paid_cents).toBe(40000);
    expect(partialInvoice.balance_due_cents).toBeGreaterThan(0);
    expect(partialInvoicePayments).toHaveLength(1);
    expect(partialInvoicePayments[0]?.amount_cents).toBe(40000);
  });

  test("shows settled payment history on a fully paid completed stop", async ({ page }) => {
    await loginTechnician(page, alexTechnicianCredentials);
    await page.goto(`${mobileWebBaseUrl}/jobs`);
    await page.getByText("Brake pad and rotor replacement").click();
    const jobId = requireJobIdFromMobileUrl(page.url());

    await expect(page.getByText("Field workboard")).toBeVisible();

    await openInvoiceWorkspace(page);

    await expect(page.getByText("Payment complete")).toBeVisible();
    await expect(page.getByText(/^View receipt$/)).toBeVisible();
    await expect(page.getByText("Balance due", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Open payment page$/)).not.toBeVisible();
    const paidInvoice = await getSingleSupabaseRow<InvoiceStateRow>("invoices", {
      label: `paid mobile invoice for ${jobId}`,
      filters: {
        job_id: `eq.${jobId}`
      },
      select: "id,job_id,invoice_number,status,amount_paid_cents,balance_due_cents"
    });
    const paidInvoicePayments = await listSupabaseRows<PaymentRow>("payments", {
      filters: {
        invoice_id: `eq.${paidInvoice.id}`
      },
      select: "id,invoice_id,amount_cents"
    });

    expect(paidInvoice.status).toBe("paid");
    expect(paidInvoice.amount_paid_cents).toBe(71594);
    expect(paidInvoice.balance_due_cents).toBe(0);
    expect(paidInvoicePayments).toHaveLength(1);
    expect(paidInvoicePayments[0]?.amount_cents).toBe(71594);
  });
});
