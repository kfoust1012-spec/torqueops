import {
  claimCustomerCommunicationForProcessing,
  createCommunicationDeliveryAttempt,
  getCommunicationEventById,
  getCustomerCommunicationById,
  getNextCommunicationAttemptNumber,
  listCommunicationEventsByIds,
  listQueuedCustomerCommunications,
  markCommunicationEventFailed,
  markCommunicationEventProcessed,
  updateCustomerCommunicationStatus
} from "@mobile-mechanic/api-client";
import type { CustomerCommunicationLogEntry, Json } from "@mobile-mechanic/types";

import { sendCommunication } from "./providers";
import { createServiceRoleSupabaseClient } from "../supabase/service-role";

const MAX_COMMUNICATION_ATTEMPTS = 5;
const RETRY_BACKOFF_MINUTES = [0, 5, 15, 60, 240] as const;
const MAX_COMMUNICATION_PROCESS_BATCH = 20;
const MAX_COMMUNICATION_PROCESS_CONCURRENCY = 4;

function asJson(value: unknown): Json {
  return (value ?? null) as Json;
}

function getRetryDelayMinutes(attemptNumber: number) {
  return RETRY_BACKOFF_MINUTES[Math.min(Math.max(attemptNumber - 1, 0), RETRY_BACKOFF_MINUTES.length - 1)] ?? 0;
}

function canRetryCommunication(failedAt: string | null, attemptNumber: number) {
  if (!failedAt) {
    return true;
  }

  const failedTime = new Date(failedAt).getTime();

  if (Number.isNaN(failedTime)) {
    return true;
  }

  return failedTime + getRetryDelayMinutes(attemptNumber) * 60_000 <= Date.now();
}

export async function processQueuedCommunicationById(communicationId: string) {
  const client = createServiceRoleSupabaseClient();
  const communicationResult = await getCustomerCommunicationById(client, communicationId);

  if (communicationResult.error || !communicationResult.data) {
    throw communicationResult.error ?? new Error("Queued communication not found.");
  }

  const communication = communicationResult.data;

  if (!["queued", "failed"].includes(communication.status)) {
    return communication;
  }

  const eventResult = communication.eventId
    ? await getCommunicationEventById(client, communication.eventId)
    : { data: null, error: null };

  if (eventResult.error) {
    throw eventResult.error;
  }

  if (eventResult.data && new Date(eventResult.data.scheduledFor).getTime() > Date.now()) {
    return communication;
  }

  const attemptNumber = await getNextCommunicationAttemptNumber(client, communication.id);

  if (communication.status === "failed") {
    if (attemptNumber > MAX_COMMUNICATION_ATTEMPTS) {
      const exhausted = await updateCustomerCommunicationStatus(client, communication.id, {
        status: "canceled",
        errorCode: "retry_exhausted",
        errorMessage: `Delivery failed after ${MAX_COMMUNICATION_ATTEMPTS} attempts.`,
        failedAt: communication.failedAt ?? new Date().toISOString()
      });

      if (exhausted.error || !exhausted.data) {
        throw exhausted.error ?? new Error("Failed communication could not be finalized.");
      }

      if (eventResult.data) {
        await markCommunicationEventFailed(client, eventResult.data.id, exhausted.data.errorMessage ?? "Delivery failed.");
      }

      return exhausted.data;
    }

    if (!canRetryCommunication(communication.failedAt, attemptNumber)) {
      return communication;
    }
  }

  const claimResult = await claimCustomerCommunicationForProcessing(client, communication.id);

  if (claimResult.error || !claimResult.data) {
    throw claimResult.error ?? new Error("Queued communication could not be claimed for processing.");
  }

  if (claimResult.data.status !== "processing") {
    return claimResult.data;
  }

  const claimedCommunication = claimResult.data;

  try {
    const delivery = await sendCommunication(client, claimedCommunication);

    await createCommunicationDeliveryAttempt(client, {
      communicationId: claimedCommunication.id,
      attemptNumber,
      provider: claimedCommunication.provider,
      requestPayload: asJson({
        channel: claimedCommunication.channel,
        recipientEmail: claimedCommunication.recipientEmail,
        recipientPhone: claimedCommunication.recipientPhone,
        subject: claimedCommunication.subject
      }),
      responsePayload: asJson(delivery.providerMetadata),
      succeeded: true
    });

    const updated = await updateCustomerCommunicationStatus(client, claimedCommunication.id, {
      status: "sent",
      providerMessageId: delivery.providerMessageId,
      providerMetadata: asJson(delivery.providerMetadata),
      sentAt: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
      failedAt: null
    });

    if (eventResult.data) {
      await markCommunicationEventProcessed(client, eventResult.data.id);
    }

    if (updated.error || !updated.data) {
      throw updated.error ?? new Error("Failed to persist sent communication status.");
    }

    return updated.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process queued communication.";
    const isFinalAttempt = attemptNumber >= MAX_COMMUNICATION_ATTEMPTS;

    await createCommunicationDeliveryAttempt(client, {
      communicationId: claimedCommunication.id,
      attemptNumber,
      provider: claimedCommunication.provider,
      requestPayload: asJson({
        channel: claimedCommunication.channel,
        recipientEmail: claimedCommunication.recipientEmail,
        recipientPhone: claimedCommunication.recipientPhone,
        subject: claimedCommunication.subject
      }),
      responsePayload: asJson({}),
      succeeded: false,
      errorMessage: message
    });

    await updateCustomerCommunicationStatus(client, claimedCommunication.id, {
      status: isFinalAttempt ? "canceled" : "failed",
      errorCode: isFinalAttempt ? "retry_exhausted" : "delivery_failed",
      errorMessage: isFinalAttempt
        ? `Delivery failed after ${MAX_COMMUNICATION_ATTEMPTS} attempts. Last error: ${message}`
        : message,
      failedAt: new Date().toISOString()
    });

    if (eventResult.data) {
      await markCommunicationEventFailed(client, eventResult.data.id, message);
    }

    throw error;
  }
}

export async function processQueuedCommunications(limit = 10) {
  const cappedLimit = Math.min(Math.max(limit, 1), MAX_COMMUNICATION_PROCESS_BATCH);
  const client = createServiceRoleSupabaseClient();
  const pageSize = Math.max(cappedLimit, 20);
  const readyCommunications: CustomerCommunicationLogEntry[] = [];
  let offset = 0;

  while (readyCommunications.length < cappedLimit) {
    const result = await listQueuedCustomerCommunications(client, pageSize, offset);

    if (result.error) {
      throw result.error;
    }

    const communications = result.data ?? [];

    if (!communications.length) {
      break;
    }

    const eventIds = communications
      .map((communication) => communication.eventId)
      .filter((eventId): eventId is string => Boolean(eventId));
    const eventsResult = await listCommunicationEventsByIds(client, eventIds);

    if (eventsResult.error) {
      throw eventsResult.error;
    }

    const nowTime = Date.now();
    const scheduledForByEventId = new Map(
      (eventsResult.data ?? []).map((event) => [event.id, new Date(event.scheduledFor).getTime()])
    );

    for (const communication of communications) {
      if (!communication.eventId) {
        readyCommunications.push(communication);
      } else {
        const scheduledForTime = scheduledForByEventId.get(communication.eventId);

        if (scheduledForTime === undefined || scheduledForTime <= nowTime) {
          readyCommunications.push(communication);
        }
      }

      if (readyCommunications.length >= cappedLimit) {
        break;
      }
    }

    offset += communications.length;

    if (communications.length < pageSize) {
      break;
    }
  }

  const processedIds = new Array<string>(readyCommunications.length);
  const workerCount = Math.min(MAX_COMMUNICATION_PROCESS_CONCURRENCY, readyCommunications.length);
  let nextIndex = 0;

  // Keep deliveries bounded so one slow provider does not stall the whole batch.
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= readyCommunications.length) {
          return;
        }

        const communication = readyCommunications[currentIndex];

        if (!communication) {
          return;
        }

        try {
          await processQueuedCommunicationById(communication.id);
        } catch {
          // Individual delivery failures are already recorded inside processQueuedCommunicationById.
        } finally {
          processedIds[currentIndex] = communication.id;
        }
      }
    })
  );

  return {
    attempted: readyCommunications.length,
    processedIds: processedIds.filter(Boolean)
  };
}
