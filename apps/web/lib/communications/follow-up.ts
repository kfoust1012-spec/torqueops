import {
  createCommunicationEvent,
  createQueuedCustomerCommunication,
  getCustomerById,
  getCustomerCommunicationPreferences,
  getJobById,
  getVehicleById,
  listAddressesByCustomer,
  resolveDefaultCommunicationProvider,
  type AppSupabaseClient
} from "@mobile-mechanic/api-client";
import {
  buildCommunicationIdempotencyKey,
  canSendCommunicationType,
  formatDateTime,
  formatServiceAddressSummary,
  getCustomerDisplayName,
  getVehicleDisplayName,
  resolveCommunicationChannel
} from "@mobile-mechanic/core";

import { ensureJobVisitAccessLink, markJobVisitAccessLinkSent } from "../customer-documents/service";
import { getTechnicianProfilePreview } from "../technician-profiles/service";
import type { FollowUpCommunicationAction } from "../jobs/follow-up";

function getPrimaryAddress(
  addresses: Array<{
    city: string;
    isPrimary: boolean;
    line1: string;
    line2: string | null;
    postalCode: string;
    state: string;
  }>
) {
  return addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null;
}

function getScheduleLabel(args: {
  arrivalWindowEndAt: string | null;
  arrivalWindowStartAt: string | null;
  scheduledStartAt: string | null;
  timeZone: string;
}) {
  if (args.scheduledStartAt) {
    return formatDateTime(args.scheduledStartAt, {
      fallback: "the scheduled time",
      timeZone: args.timeZone
    });
  }

  if (args.arrivalWindowStartAt || args.arrivalWindowEndAt) {
    const startLabel = formatDateTime(args.arrivalWindowStartAt, {
      fallback: "the start of the arrival window",
      timeZone: args.timeZone
    });
    const endLabel = formatDateTime(args.arrivalWindowEndAt, {
      fallback: "the end of the arrival window",
      timeZone: args.timeZone
    });

    return `${startLabel} to ${endLabel}`;
  }

  return "the updated service window";
}

function buildFollowUpMessage(args: {
  action: FollowUpCommunicationAction;
  customerName: string;
  jobTitle: string;
  serviceAddress: string | null;
  technicianName: string | null;
  timeZone: string;
  vehicleLabel: string;
  visitUrl: string | null;
  job: {
    arrivalWindowEndAt: string | null;
    arrivalWindowStartAt: string | null;
    scheduledStartAt: string | null;
  };
}) {
  const scheduleLabel = getScheduleLabel({
    arrivalWindowEndAt: args.job.arrivalWindowEndAt,
    arrivalWindowStartAt: args.job.arrivalWindowStartAt,
    scheduledStartAt: args.job.scheduledStartAt,
    timeZone: args.timeZone
  });
  const technicianLine = args.technicianName ? ` Technician: ${args.technicianName}.` : "";
  const addressLine = args.serviceAddress ? ` Service location: ${args.serviceAddress}.` : "";
  const visitLine = args.visitUrl ? ` Review the visit here: ${args.visitUrl}` : "";

  switch (args.action) {
    case "follow_up_awaiting_parts":
      return {
        communicationType: "dispatch_update" as const,
        eventType: "dispatch_update_requested" as const,
        subject: "Update on your return visit",
        bodyText:
          `Hi ${args.customerName}, we still need parts before we can complete the follow-up work for ${args.jobTitle} on your ${args.vehicleLabel}. ` +
          `We will reach back out as soon as the parts are ready and lock in the return visit.${addressLine}${visitLine}`
      };
    case "follow_up_booked":
      return {
        communicationType: "appointment_confirmation" as const,
        eventType: "appointment_confirmation_requested" as const,
        subject: "Your return visit is booked",
        bodyText:
          `Hi ${args.customerName}, your return visit for ${args.jobTitle} on your ${args.vehicleLabel} is booked for ${scheduleLabel}.` +
          `${technicianLine}${addressLine}${visitLine}`
      };
    case "follow_up_rescheduled":
      return {
        communicationType: "appointment_confirmation" as const,
        eventType: "appointment_confirmation_requested" as const,
        subject: "Your return visit has been rescheduled",
        bodyText:
          `Hi ${args.customerName}, the return visit for ${args.jobTitle} on your ${args.vehicleLabel} has been moved to ${scheduleLabel}.` +
          `${technicianLine}${addressLine}${visitLine}`
      };
    case "follow_up_status_update":
      return {
        communicationType: "dispatch_update" as const,
        eventType: "dispatch_update_requested" as const,
        subject: "Update on your return visit",
        bodyText:
          `Hi ${args.customerName}, your return visit for ${args.jobTitle} on your ${args.vehicleLabel} is moving now.` +
          `${technicianLine}${addressLine}${visitLine}`
      };
    default:
      throw new Error("Unsupported follow-up communication action.");
  }
}

export async function enqueueFollowUpCustomerCommunication(input: {
  action: FollowUpCommunicationAction;
  actorUserId: string;
  companyId: string;
  jobId: string;
  resend?: boolean;
  supabase: AppSupabaseClient;
  timeZone: string;
}) {
  const jobResult = await getJobById(input.supabase, input.jobId);

  if (jobResult.error || !jobResult.data || jobResult.data.companyId !== input.companyId) {
    throw jobResult.error ?? new Error("Visit not found.");
  }

  const job = jobResult.data;
  const [customerResult, vehicleResult, addressesResult, preferenceResult, technicianPreview] =
    await Promise.all([
      getCustomerById(input.supabase, job.customerId),
      getVehicleById(input.supabase, job.vehicleId),
      listAddressesByCustomer(input.supabase, job.customerId),
      getCustomerCommunicationPreferences(input.supabase, input.companyId, job.customerId),
      getTechnicianProfilePreview(input.supabase, job.assignedTechnicianUserId).catch(() => ({
        isReady: false,
        missingFields: [],
        profile: null,
        technicianName: null
      }))
    ]);

  if (customerResult.error || !customerResult.data) {
    throw customerResult.error ?? new Error("Customer not found.");
  }

  if (vehicleResult.error || !vehicleResult.data) {
    throw vehicleResult.error ?? new Error("Vehicle not found.");
  }

  if (addressesResult.error) {
    throw addressesResult.error;
  }

  if (preferenceResult.error) {
    throw preferenceResult.error;
  }

  const message = buildFollowUpMessage({
    action: input.action,
    customerName: getCustomerDisplayName(customerResult.data),
    job: {
      arrivalWindowEndAt: job.arrivalWindowEndAt,
      arrivalWindowStartAt: job.arrivalWindowStartAt,
      scheduledStartAt: job.scheduledStartAt
    },
    jobTitle: job.title,
    serviceAddress: formatServiceAddressSummary(
      getPrimaryAddress(addressesResult.data ?? [])
        ? {
            line1: getPrimaryAddress(addressesResult.data ?? [])!.line1,
            line2: getPrimaryAddress(addressesResult.data ?? [])!.line2,
            city: getPrimaryAddress(addressesResult.data ?? [])!.city,
            state: getPrimaryAddress(addressesResult.data ?? [])!.state,
            postalCode: getPrimaryAddress(addressesResult.data ?? [])!.postalCode
          }
        : null
    ),
    technicianName: technicianPreview.technicianName,
    timeZone: input.timeZone,
    vehicleLabel: getVehicleDisplayName(vehicleResult.data),
    visitUrl: technicianPreview.isReady
      ? (
          await ensureJobVisitAccessLink({
            actorUserId: input.actorUserId,
            jobId: input.jobId
          }).catch(() => null)
        )?.publicUrl ?? null
      : null
  });

  if (!canSendCommunicationType(message.communicationType, preferenceResult.data)) {
    throw new Error("Customer preferences do not allow this communication type.");
  }

  const channel = resolveCommunicationChannel({
    preference: preferenceResult.data,
    recipientEmail: customerResult.data.email,
    recipientPhone: customerResult.data.phone
  });

  const eventResult = await createCommunicationEvent(input.supabase, {
    actorUserId: input.actorUserId,
    communicationType: message.communicationType,
    companyId: input.companyId,
    customerId: customerResult.data.id,
    eventType: message.eventType,
    idempotencyKey: buildCommunicationIdempotencyKey(
      "job",
      job.id,
      "follow_up",
      input.action,
      input.resend ? new Date().toISOString() : `${job.updatedAt}:${job.scheduledStartAt ?? ""}:${job.arrivalWindowStartAt ?? ""}`
    ),
    jobId: job.id,
    occurredAt: new Date().toISOString(),
    payload: {
      action: input.action,
      jobTitle: job.title,
      serviceAddress:
        message.bodyText.includes("Service location:") || message.bodyText.includes("Service address:")
          ? true
          : false,
      subject: message.subject,
      vehicleLabel: getVehicleDisplayName(vehicleResult.data)
    },
    triggerSource: "manual"
  });

  if (eventResult.error || !eventResult.data) {
    throw eventResult.error ?? new Error("Communication event could not be created.");
  }

  const provider = await resolveDefaultCommunicationProvider(
    input.supabase,
    input.companyId,
    channel
  );

  const communicationResult = await createQueuedCustomerCommunication(input.supabase, {
    channel,
    communicationType: message.communicationType,
    companyId: input.companyId,
    createdByUserId: input.actorUserId,
    customerId: customerResult.data.id,
    eventId: eventResult.data.id,
    jobId: job.id,
    provider,
    recipientEmail: customerResult.data.email,
    recipientName: getCustomerDisplayName(customerResult.data),
    recipientPhone: customerResult.data.phone,
    subject: message.subject,
    bodyText: message.bodyText
  });

  if (communicationResult.error || !communicationResult.data) {
    throw communicationResult.error ?? new Error("Follow-up communication could not be queued.");
  }

  const visitLink = technicianPreview.isReady
    ? await ensureJobVisitAccessLink({
        actorUserId: input.actorUserId,
        jobId: input.jobId
      }).catch(() => null)
    : null;

  if (visitLink) {
    await markJobVisitAccessLinkSent(
      visitLink.linkId,
      communicationResult.data.id,
      input.actorUserId
    );
  }

  return communicationResult;
}
