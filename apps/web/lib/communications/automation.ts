import {
  enqueueDispatchUpdate,
  enqueuePaymentReminder,
  getDefaultSmsProviderAccountByCompany
} from "@mobile-mechanic/api-client";
import { isTechnicianTravelJobStatus } from "@mobile-mechanic/core";
import type { Database, PaymentReminderStage } from "@mobile-mechanic/types";

import { createServiceRoleSupabaseClient } from "../supabase/service-role";

const DEFAULT_AUTOMATION_LIMIT = 10;
const MAX_AUTOMATION_LIMIT = 25;
const EN_ROUTE_LEAD_MINUTES = 20;
const RUNNING_LATE_GRACE_MINUTES = 5;
const RUNNING_LATE_LOOKBACK_MINUTES = 90;
const PAYMENT_REMINDER_UPCOMING_WINDOW_HOURS = 24;
const PAYMENT_REMINDER_DUE_WINDOW_MINUTES = 60;
const PAYMENT_REMINDER_OVERDUE_WINDOW_DAYS = 7;
const COMPANY_QUERY_MULTIPLIER = 8;
const MIN_COMPANY_QUERY_LIMIT = 25;

type CommunicationAutomationSettingsRow =
  Database["public"]["Tables"]["communication_automation_settings"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

type CompanyOwnerRow = Pick<CompanyRow, "id" | "owner_user_id">;
type AutomationJobRow = Pick<
  JobRow,
  | "id"
  | "arrival_window_start_at"
  | "assigned_technician_user_id"
  | "company_id"
  | "scheduled_start_at"
  | "status"
>;
type AutomationInvoiceRow = Pick<
  InvoiceRow,
  "balance_due_cents" | "company_id" | "due_at" | "id" | "status"
>;

export type CommunicationAutomationWorkflowSummary = {
  attempted: number;
  errorCount: number;
  evaluated: number;
  processedIds: string[];
};

export type CommunicationAutomationProcessSummary = {
  companyCount: number;
  enRoute: CommunicationAutomationWorkflowSummary;
  errors: string[];
  paymentReminders: CommunicationAutomationWorkflowSummary;
  processedAt: string;
  runningLate: CommunicationAutomationWorkflowSummary;
  skippedCompanies: number;
};

function createWorkflowSummary(): CommunicationAutomationWorkflowSummary {
  return {
    attempted: 0,
    errorCount: 0,
    evaluated: 0,
    processedIds: []
  };
}

function getAutomationQueryLimit(limitPerWorkflow: number) {
  return Math.max(limitPerWorkflow * COMPANY_QUERY_MULTIPLIER, MIN_COMPANY_QUERY_LIMIT);
}

function getJobPromiseAt(
  job: Pick<AutomationJobRow, "arrival_window_start_at" | "scheduled_start_at">
) {
  return job.arrival_window_start_at ?? job.scheduled_start_at ?? null;
}

function isInvoiceEligibleForAutomationReminder(
  invoice: Pick<AutomationInvoiceRow, "balance_due_cents" | "due_at" | "status">
) {
  return (
    ["issued", "partially_paid"].includes(invoice.status) &&
    invoice.balance_due_cents > 0 &&
    Boolean(invoice.due_at)
  );
}

function getMinutesUntil(timestamp: string, now: Date) {
  const time = Date.parse(timestamp);

  if (Number.isNaN(time)) {
    return null;
  }

  return (time - now.getTime()) / 60_000;
}

export function shouldQueueEnRouteAutomation(job: AutomationJobRow, now: Date = new Date()) {
  if (!isTechnicianTravelJobStatus(job.status) || !job.assigned_technician_user_id) {
    return false;
  }

  const promiseAt = getJobPromiseAt(job);

  if (!promiseAt) {
    return false;
  }

  const minutesUntilPromise = getMinutesUntil(promiseAt, now);

  if (minutesUntilPromise === null) {
    return false;
  }

  return minutesUntilPromise >= 0 && minutesUntilPromise <= EN_ROUTE_LEAD_MINUTES;
}

export function shouldQueueRunningLateAutomation(job: AutomationJobRow, now: Date = new Date()) {
  if (!isTechnicianTravelJobStatus(job.status) || !job.assigned_technician_user_id) {
    return false;
  }

  const promiseAt = getJobPromiseAt(job);

  if (!promiseAt) {
    return false;
  }

  const minutesUntilPromise = getMinutesUntil(promiseAt, now);

  if (minutesUntilPromise === null) {
    return false;
  }

  const minutesPastPromise = minutesUntilPromise * -1;
  return (
    minutesPastPromise >= RUNNING_LATE_GRACE_MINUTES &&
    minutesPastPromise <= RUNNING_LATE_LOOKBACK_MINUTES
  );
}

export function resolveAutomatedPaymentReminderStage(
  invoice: AutomationInvoiceRow,
  now: Date = new Date()
): PaymentReminderStage | null {
  if (!isInvoiceEligibleForAutomationReminder(invoice)) {
    return null;
  }

  const dueTime = Date.parse(invoice.due_at ?? "");

  if (Number.isNaN(dueTime)) {
    return null;
  }

  const differenceMinutes = (dueTime - now.getTime()) / 60_000;

  if (differenceMinutes >= 60 && differenceMinutes <= PAYMENT_REMINDER_UPCOMING_WINDOW_HOURS * 60) {
    return "upcoming";
  }

  if (Math.abs(differenceMinutes) < PAYMENT_REMINDER_DUE_WINDOW_MINUTES) {
    return "due";
  }

  if (
    differenceMinutes <= -PAYMENT_REMINDER_DUE_WINDOW_MINUTES &&
    differenceMinutes >= -(PAYMENT_REMINDER_OVERDUE_WINDOW_DAYS * 24 * 60)
  ) {
    return "overdue";
  }

  return null;
}

async function listEnabledAutomationSettings() {
  const client = createServiceRoleSupabaseClient();
  const result = await client
    .from("communication_automation_settings")
    .select("*")
    .or(
      "dispatch_en_route_sms_enabled.eq.true,dispatch_running_late_sms_enabled.eq.true,invoice_payment_reminder_sms_enabled.eq.true"
    )
    .returns<CommunicationAutomationSettingsRow[]>();

  if (result.error) {
    throw result.error;
  }

  return {
    client,
    settingsRows: result.data ?? []
  };
}

async function listCompanyOwnersByIds(client: ReturnType<typeof createServiceRoleSupabaseClient>, companyIds: string[]) {
  if (!companyIds.length) {
    return new Map<string, CompanyOwnerRow>();
  }

  const result = await client
    .from("companies")
    .select("id, owner_user_id")
    .in("id", companyIds)
    .returns<CompanyOwnerRow[]>();

  if (result.error) {
    throw result.error;
  }

  return new Map((result.data ?? []).map((row) => [row.id, row]));
}

async function listTravelJobsForCompany(
  client: ReturnType<typeof createServiceRoleSupabaseClient>,
  companyId: string,
  limitPerWorkflow: number
) {
  const result = await client
    .from("jobs")
    .select(
      "id, company_id, status, scheduled_start_at, arrival_window_start_at, assigned_technician_user_id"
    )
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("status", ["dispatched", "en_route"])
    .order("arrival_window_start_at", { ascending: true, nullsFirst: false })
    .order("scheduled_start_at", { ascending: true, nullsFirst: false })
    .limit(getAutomationQueryLimit(limitPerWorkflow))
    .returns<AutomationJobRow[]>();

  if (result.error) {
    throw result.error;
  }

  return result.data ?? [];
}

async function listInvoicesForPaymentReminderAutomation(
  client: ReturnType<typeof createServiceRoleSupabaseClient>,
  companyId: string,
  limitPerWorkflow: number
) {
  const result = await client
    .from("invoices")
    .select("id, company_id, status, balance_due_cents, due_at")
    .eq("company_id", companyId)
    .in("status", ["issued", "partially_paid"])
    .gt("balance_due_cents", 0)
    .not("due_at", "is", null)
    .order("due_at", { ascending: true })
    .limit(getAutomationQueryLimit(limitPerWorkflow))
    .returns<AutomationInvoiceRow[]>();

  if (result.error) {
    throw result.error;
  }

  return result.data ?? [];
}

function isReadyDefaultProvider(account: Awaited<ReturnType<typeof getDefaultSmsProviderAccountByCompany>>["data"]) {
  return Boolean(
    account &&
      account.status === "connected" &&
      account.lastVerifiedAt &&
      account.fromNumber?.trim()
  );
}

export async function processCommunicationAutomations(options?: {
  limitPerWorkflow?: number;
  now?: Date;
}) {
  const { client, settingsRows } = await listEnabledAutomationSettings();
  const now = options?.now ?? new Date();
  const limitPerWorkflow = Math.min(
    Math.max(options?.limitPerWorkflow ?? DEFAULT_AUTOMATION_LIMIT, 1),
    MAX_AUTOMATION_LIMIT
  );
  const companyOwnersById = await listCompanyOwnersByIds(
    client,
    settingsRows.map((row) => row.company_id)
  );
  const summary: CommunicationAutomationProcessSummary = {
    companyCount: settingsRows.length,
    enRoute: createWorkflowSummary(),
    errors: [],
    paymentReminders: createWorkflowSummary(),
    processedAt: now.toISOString(),
    runningLate: createWorkflowSummary(),
    skippedCompanies: 0
  };

  for (const settings of settingsRows) {
    const owner = companyOwnersById.get(settings.company_id);

    if (!owner?.owner_user_id) {
      summary.skippedCompanies += 1;
      summary.errors.push(`Company ${settings.company_id} has no owner user for automation attribution.`);
      continue;
    }

    try {
      const defaultProviderResult = await getDefaultSmsProviderAccountByCompany(
        client,
        settings.company_id
      );

      if (defaultProviderResult.error) {
        throw defaultProviderResult.error;
      }

      if (!isReadyDefaultProvider(defaultProviderResult.data)) {
        summary.skippedCompanies += 1;
        continue;
      }

      if (
        (settings.dispatch_en_route_sms_enabled &&
          summary.enRoute.attempted < limitPerWorkflow) ||
        (settings.dispatch_running_late_sms_enabled &&
          summary.runningLate.attempted < limitPerWorkflow)
      ) {
        const jobs = await listTravelJobsForCompany(client, settings.company_id, limitPerWorkflow);

        for (const job of jobs) {
          if (
            settings.dispatch_en_route_sms_enabled &&
            summary.enRoute.attempted < limitPerWorkflow
          ) {
            summary.enRoute.evaluated += 1;

            if (shouldQueueEnRouteAutomation(job, now)) {
              summary.enRoute.attempted += 1;

              try {
                const result = await enqueueDispatchUpdate(client, {
                  actorUserId: owner.owner_user_id,
                  channel: "sms",
                  jobId: job.id,
                  updateType: "en_route"
                });

                if (result.error) {
                  throw result.error;
                }

                if (result.data) {
                  summary.enRoute.processedIds.push(result.data.id);
                }
              } catch {
                summary.enRoute.errorCount += 1;
              }
            }
          }

          if (
            settings.dispatch_running_late_sms_enabled &&
            summary.runningLate.attempted < limitPerWorkflow
          ) {
            summary.runningLate.evaluated += 1;

            if (shouldQueueRunningLateAutomation(job, now)) {
              summary.runningLate.attempted += 1;

              try {
                const result = await enqueueDispatchUpdate(client, {
                  actorUserId: owner.owner_user_id,
                  channel: "sms",
                  jobId: job.id,
                  updateType: "running_late"
                });

                if (result.error) {
                  throw result.error;
                }

                if (result.data) {
                  summary.runningLate.processedIds.push(result.data.id);
                }
              } catch {
                summary.runningLate.errorCount += 1;
              }
            }
          }

          if (
            summary.enRoute.attempted >= limitPerWorkflow &&
            summary.runningLate.attempted >= limitPerWorkflow
          ) {
            break;
          }
        }
      }

      if (
        settings.invoice_payment_reminder_sms_enabled &&
        summary.paymentReminders.attempted < limitPerWorkflow
      ) {
        const invoices = await listInvoicesForPaymentReminderAutomation(
          client,
          settings.company_id,
          limitPerWorkflow
        );

        for (const invoice of invoices) {
          summary.paymentReminders.evaluated += 1;

          if (summary.paymentReminders.attempted >= limitPerWorkflow) {
            break;
          }

          const reminderStage = resolveAutomatedPaymentReminderStage(invoice, now);

          if (!reminderStage) {
            continue;
          }

          summary.paymentReminders.attempted += 1;

          try {
            const result = await enqueuePaymentReminder(client, {
              actorUserId: owner.owner_user_id,
              channel: "sms",
              invoiceId: invoice.id,
              reminderStage
            });

            if (result.error) {
              throw result.error;
            }

            if (result.data) {
              summary.paymentReminders.processedIds.push(result.data.id);
            }
          } catch {
            summary.paymentReminders.errorCount += 1;
          }
        }
      }
    } catch (error) {
      summary.skippedCompanies += 1;
      summary.errors.push(
        error instanceof Error
          ? `Company ${settings.company_id}: ${error.message}`
          : `Company ${settings.company_id}: automation failed.`
      );
    }

    if (
      summary.enRoute.attempted >= limitPerWorkflow &&
      summary.runningLate.attempted >= limitPerWorkflow &&
      summary.paymentReminders.attempted >= limitPerWorkflow
    ) {
      break;
    }
  }

  return summary;
}
