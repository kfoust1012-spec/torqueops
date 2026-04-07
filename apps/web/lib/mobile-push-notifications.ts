import { getAssignedJobDetailForTechnician } from "@mobile-mechanic/api-client";
import type { Customer, CustomerAddress, Job, Vehicle } from "@mobile-mechanic/types";

import { getServiceRoleSupabaseClient } from "./supabase/service-role";

type TechnicianPushSubscriptionRow = {
  company_id: string;
  expo_push_token: string;
  id: string;
  installation_id: string;
  is_active: boolean;
  last_seen_at: string;
  platform: "android" | "ios";
  technician_user_id: string;
};

type PushNotificationEnvelope = {
  body: string;
  data: {
    jobId: string;
    jobSeed?: TechnicianPushJobSeed;
    path: string;
    type: "job_assigned" | "job_rescheduled";
  };
  technicianUserId: string;
  title: string;
};

type TechnicianPushJobSeed = {
  customer: Customer;
  job: Job;
  primaryAddress: CustomerAddress | null;
  serviceSite: CustomerAddress | null;
  vehicle: Vehicle;
};

type TechnicianPushJobSnapshot = {
  arrivalWindowEndAt: string | null;
  arrivalWindowStartAt: string | null;
  assignedTechnicianUserId: string | null;
  id: string;
  isActive: boolean;
  scheduledStartAt: string | null;
  status: string;
  title: string;
};

type PushNotificationReceipt = {
  details?: {
    error?: string;
  };
  status: "error" | "ok";
};

type ExpoPushResponse = {
  data?: PushNotificationReceipt[];
};

function normalizeTimestamp(value: string | null | undefined) {
  return value?.trim() || null;
}

function toTechnicianPushJobSnapshot(input: unknown): TechnicianPushJobSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;
  const title = typeof record.title === "string" ? record.title : null;

  if (!id || !title) {
    return null;
  }

  return {
    arrivalWindowEndAt:
      normalizeTimestamp(
        typeof record.arrivalWindowEndAt === "string"
          ? record.arrivalWindowEndAt
          : typeof record.arrival_window_end_at === "string"
            ? record.arrival_window_end_at
            : null
      ),
    arrivalWindowStartAt:
      normalizeTimestamp(
        typeof record.arrivalWindowStartAt === "string"
          ? record.arrivalWindowStartAt
          : typeof record.arrival_window_start_at === "string"
            ? record.arrival_window_start_at
            : null
      ),
    assignedTechnicianUserId:
      typeof record.assignedTechnicianUserId === "string"
        ? record.assignedTechnicianUserId
        : typeof record.assigned_technician_user_id === "string"
          ? record.assigned_technician_user_id
          : null,
    id,
    isActive:
      typeof record.isActive === "boolean"
        ? record.isActive
        : record.is_active === true,
    scheduledStartAt:
      normalizeTimestamp(
        typeof record.scheduledStartAt === "string"
          ? record.scheduledStartAt
          : typeof record.scheduled_start_at === "string"
            ? record.scheduled_start_at
            : null
      ),
    status:
      typeof record.status === "string" ? record.status : "new",
    title
  };
}

function formatTechnicianPromiseLabel(job: TechnicianPushJobSnapshot, timeZone: string) {
  if (job.scheduledStartAt) {
    return `Scheduled for ${new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone
    }).format(new Date(job.scheduledStartAt))}`;
  }

  if (job.arrivalWindowStartAt) {
    const startLabel = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone
    }).format(new Date(job.arrivalWindowStartAt));
    const endLabel = job.arrivalWindowEndAt
      ? new Intl.DateTimeFormat("en-US", {
          timeStyle: "short",
          timeZone
        }).format(new Date(job.arrivalWindowEndAt))
      : null;

    return endLabel ? `Arrival window ${startLabel} to ${endLabel}` : `Arrival window starts ${startLabel}`;
  }

  return "Open the stop board for the latest timing.";
}

function hasTechnicianPromiseChanged(
  previousJob: TechnicianPushJobSnapshot,
  nextJob: TechnicianPushJobSnapshot
) {
  return (
    normalizeTimestamp(previousJob.scheduledStartAt) !== normalizeTimestamp(nextJob.scheduledStartAt) ||
    normalizeTimestamp(previousJob.arrivalWindowStartAt) !== normalizeTimestamp(nextJob.arrivalWindowStartAt) ||
    normalizeTimestamp(previousJob.arrivalWindowEndAt) !== normalizeTimestamp(nextJob.arrivalWindowEndAt)
  );
}

export function buildTechnicianJobPushNotification(input: {
  companyTimeZone: string;
  jobSeed?: TechnicianPushJobSeed | null;
  nextJob: TechnicianPushJobSnapshot;
  previousJob: TechnicianPushJobSnapshot | null;
}): PushNotificationEnvelope | null {
  const { companyTimeZone, jobSeed, nextJob, previousJob } = input;

  if (
    !nextJob.assignedTechnicianUserId ||
    !nextJob.isActive ||
    nextJob.status === "canceled" ||
    nextJob.status === "completed"
  ) {
    return null;
  }

  const assignmentChanged =
    !previousJob || previousJob.assignedTechnicianUserId !== nextJob.assignedTechnicianUserId;
  const scheduleChanged =
    previousJob !== null &&
    previousJob.assignedTechnicianUserId === nextJob.assignedTechnicianUserId &&
    hasTechnicianPromiseChanged(previousJob, nextJob);

  if (!assignmentChanged && !scheduleChanged) {
    return null;
  }

  const title = assignmentChanged ? "New job assigned" : "Job timing updated";
  const timingLabel = formatTechnicianPromiseLabel(nextJob, companyTimeZone);

  return {
    body: assignmentChanged
      ? `${nextJob.title}. ${timingLabel}`
      : `${nextJob.title}. ${timingLabel}`,
    data: {
      jobId: nextJob.id,
      ...(jobSeed ? { jobSeed } : {}),
      path: `/jobs/${nextJob.id}`,
      type: assignmentChanged ? "job_assigned" : "job_rescheduled"
    },
    technicianUserId: nextJob.assignedTechnicianUserId,
    title
  };
}

async function loadTechnicianPushJobSeed(input: {
  companyId: string;
  jobId: string;
  technicianUserId: string;
}): Promise<TechnicianPushJobSeed | null> {
  const serviceRoleSupabase = getServiceRoleSupabaseClient() as any;
  const detailResult = await getAssignedJobDetailForTechnician(
    serviceRoleSupabase,
    input.companyId,
    input.technicianUserId,
    input.jobId
  );

  if (detailResult.error || !detailResult.data) {
    return null;
  }

  return {
    customer: detailResult.data.customer,
    job: detailResult.data.job,
    primaryAddress: detailResult.data.primaryAddress,
    serviceSite: detailResult.data.serviceSite,
    vehicle: detailResult.data.vehicle
  };
}

function chunkPushMessages<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function deactivateInvalidPushTokens(subscriptionIds: string[]) {
  if (!subscriptionIds.length) {
    return;
  }

  const serviceRoleSupabase = getServiceRoleSupabaseClient() as any;
  await serviceRoleSupabase
    .from("technician_push_subscriptions")
    .update({ is_active: false })
    .in("id", subscriptionIds);
}

export async function registerTechnicianPushSubscription(input: {
  companyId: string;
  expoPushToken: string;
  installationId: string;
  platform: "android" | "ios";
  technicianUserId: string;
}) {
  const serviceRoleSupabase = getServiceRoleSupabaseClient() as any;
  const timestamp = new Date().toISOString();

  await serviceRoleSupabase
    .from("technician_push_subscriptions")
    .delete()
    .eq("expo_push_token", input.expoPushToken)
    .neq("technician_user_id", input.technicianUserId);

  const result = await serviceRoleSupabase
    .from("technician_push_subscriptions")
    .upsert(
      {
        company_id: input.companyId,
        expo_push_token: input.expoPushToken,
        installation_id: input.installationId,
        is_active: true,
        last_seen_at: timestamp,
        platform: input.platform,
        technician_user_id: input.technicianUserId
      },
      {
        onConflict: "company_id,technician_user_id,installation_id"
      }
    )
    .select("*")
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Push subscription could not be stored.");
  }

  return result.data as TechnicianPushSubscriptionRow;
}

export async function sendTechnicianJobPushNotification(input: {
  companyId: string;
  companyTimeZone: string;
  nextJob: unknown;
  previousJob: unknown;
}) {
  const nextJob = toTechnicianPushJobSnapshot(input.nextJob);
  const previousJob = toTechnicianPushJobSnapshot(input.previousJob);

  if (!nextJob) {
    return { attemptedCount: 0, sentCount: 0 };
  }

  const jobSeed = nextJob.assignedTechnicianUserId
    ? await loadTechnicianPushJobSeed({
        companyId: input.companyId,
        jobId: nextJob.id,
        technicianUserId: nextJob.assignedTechnicianUserId
      })
    : null;
  const notification = buildTechnicianJobPushNotification({
    companyTimeZone: input.companyTimeZone,
    jobSeed,
    nextJob,
    previousJob
  });

  if (!notification) {
    return { attemptedCount: 0, sentCount: 0 };
  }

  const serviceRoleSupabase = getServiceRoleSupabaseClient() as any;
  const subscriptionsResult = await serviceRoleSupabase
    .from("technician_push_subscriptions")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("technician_user_id", notification.technicianUserId)
    .eq("is_active", true);

  if (subscriptionsResult.error) {
    throw subscriptionsResult.error;
  }

  const subscriptions = (subscriptionsResult.data ?? []) as TechnicianPushSubscriptionRow[];

  if (!subscriptions.length) {
    return { attemptedCount: 0, sentCount: 0 };
  }

  const messages = subscriptions.map((subscription) => ({
    body: notification.body,
    data: notification.data,
    sound: "default",
    title: notification.title,
    to: subscription.expo_push_token
  }));

  let sentCount = 0;
  const invalidSubscriptionIds: string[] = [];

  for (const chunk of chunkPushMessages(messages, 100)) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      body: JSON.stringify(chunk),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json().catch(() => null)) as ExpoPushResponse | null;
    const receipts = payload?.data ?? [];

    receipts.forEach((receipt, index) => {
      if (receipt.status === "ok") {
        sentCount += 1;
        return;
      }

      if (receipt.details?.error === "DeviceNotRegistered") {
        const subscription = subscriptions.find(
          (candidate) => candidate.expo_push_token === chunk[index]?.to
        );

        if (subscription) {
          invalidSubscriptionIds.push(subscription.id);
        }
      }
    });
  }

  await deactivateInvalidPushTokens(invalidSubscriptionIds);

  return {
    attemptedCount: messages.length,
    sentCount
  };
}
