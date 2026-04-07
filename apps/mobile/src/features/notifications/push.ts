import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Platform } from "react-native";

import type { TechnicianJobSeed } from "@mobile-mechanic/types";

import { mobileEnv } from "../../env";
import { clientStorage } from "../../lib/client-storage";
import { supabase } from "../../lib/supabase";
import { saveTechnicianJobSeedToCache } from "../jobs/seed-cache";
import {
  markTechnicianNotificationInboxEntryRead,
  saveTechnicianNotificationInboxEntry
} from "./inbox-store";

const pushInstallationIdStorageKey = "mobile-push-installation-id";
const pushNotificationChannelId = "dispatch-updates";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

function getMobileWebAppUrl() {
  const baseUrl = mobileEnv.EXPO_PUBLIC_WEB_APP_URL?.trim() ?? "";

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/g, "");
}

async function getPushInstallationId() {
  const existingId = await clientStorage.getItem(pushInstallationIdStorageKey);

  if (existingId) {
    return existingId;
  }

  const nextId = Crypto.randomUUID();
  await clientStorage.setItem(pushInstallationIdStorageKey, nextId);
  return nextId;
}

function getExpoProjectId() {
  const expoConfigProjectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ?? null;

  return Constants.easConfig?.projectId ?? expoConfigProjectId ?? null;
}

export async function ensureTechnicianPushNotificationsRegistered() {
  if (Platform.OS === "web") {
    return { status: "skipped" as const };
  }

  const baseUrl = getMobileWebAppUrl();

  if (!baseUrl) {
    return { status: "skipped" as const };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(pushNotificationChannelId, {
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#8b5e34",
      name: "Dispatch updates",
      vibrationPattern: [0, 250, 250, 250]
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  const finalPermission =
    permission.status === "granted"
      ? permission
      : await Notifications.requestPermissionsAsync();

  if (finalPermission.status !== "granted") {
    return { status: "denied" as const };
  }

  const projectId = getExpoProjectId();

  if (!projectId) {
    return { status: "missing_project_id" as const };
  }

  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token ?? null;

  if (!accessToken) {
    return { status: "unauthenticated" as const };
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const installationId = await getPushInstallationId();
  const response = await fetch(`${baseUrl}/api/mobile/push/subscriptions`, {
    body: JSON.stringify({
      expoPushToken: tokenResult.data,
      installationId,
      platform: Platform.OS
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Push subscription could not be registered.");
  }

  return { status: "ok" as const };
}

export function getPushNotificationPath(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const path = "path" in data ? data.path : null;
  return typeof path === "string" && path.startsWith("/") ? path : null;
}

function parsePushJobSeed(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const seed = "jobSeed" in data ? data.jobSeed : null;

  if (!seed || typeof seed !== "object") {
    return null;
  }

  const record = seed as Record<string, unknown>;
  const job = record.job;
  const customer = record.customer;
  const vehicle = record.vehicle;
  const serviceSite = "serviceSite" in record ? record.serviceSite : null;
  const primaryAddress = "primaryAddress" in record ? record.primaryAddress : null;

  if (
    !job ||
    typeof job !== "object" ||
    !("id" in job) ||
    typeof job.id !== "string" ||
    !customer ||
    typeof customer !== "object" ||
    !vehicle ||
    typeof vehicle !== "object"
  ) {
    return null;
  }

  return {
    customer: customer as TechnicianJobSeed["customer"],
    job: job as TechnicianJobSeed["job"],
    primaryAddress: (primaryAddress ?? null) as TechnicianJobSeed["primaryAddress"],
    serviceSite: (serviceSite ?? null) as TechnicianJobSeed["serviceSite"],
    vehicle: vehicle as TechnicianJobSeed["vehicle"]
  } satisfies TechnicianJobSeed;
}

async function cachePushJobSeed(data: unknown) {
  const seed = parsePushJobSeed(data);

  if (!seed) {
    return;
  }

  await saveTechnicianJobSeedToCache(seed);
}

async function savePushNotificationInboxEntry(args: {
  body: string | null | undefined;
  createdAt?: string | null | undefined;
  data: unknown;
  id: string;
  markRead?: boolean | undefined;
  title: string | null | undefined;
}) {
  const path = getPushNotificationPath(args.data);
  const record = args.data && typeof args.data === "object" ? (args.data as Record<string, unknown>) : null;
  const jobId = record && typeof record.jobId === "string" ? record.jobId : null;
  const type =
    record?.type === "job_assigned" || record?.type === "job_rescheduled"
      ? record.type
      : "unknown";

  await saveTechnicianNotificationInboxEntry({
    body: args.body?.trim() || "Open the stop board for the latest dispatch detail.",
    createdAt: args.createdAt?.trim() || new Date().toISOString(),
    id: args.id,
    jobId,
    path,
    readAt: args.markRead ? new Date().toISOString() : null,
    title: args.title?.trim() || "Dispatch update",
    type
  });

  if (args.markRead) {
    await markTechnicianNotificationInboxEntryRead(args.id);
  }
}

export async function routePendingPushNotification() {
  const response = await Notifications.getLastNotificationResponseAsync();
  const data = response?.notification.request.content.data;
  const path = getPushNotificationPath(data);

  await cachePushJobSeed(data);
  if (response) {
    await savePushNotificationInboxEntry({
      body: response.notification.request.content.body,
      createdAt: response.notification.date ? new Date(response.notification.date).toISOString() : null,
      data,
      id: response.notification.request.identifier,
      markRead: true,
      title: response.notification.request.content.title
    });
  }

  if (path) {
    router.push(path as never);
  }
}

export function attachPushNotificationReceivedListener() {
  return Notifications.addNotificationReceivedListener((notification) => {
    void cachePushJobSeed(notification.request.content.data).catch(() => undefined);
    void savePushNotificationInboxEntry({
      body: notification.request.content.body,
      createdAt: notification.date ? new Date(notification.date).toISOString() : null,
      data: notification.request.content.data,
      id: notification.request.identifier,
      title: notification.request.content.title
    }).catch(() => undefined);
  });
}

export function attachPushNotificationResponseListener() {
  return Notifications.addNotificationResponseReceivedListener(
    (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    const path = getPushNotificationPath(data);

      void cachePushJobSeed(data)
        .catch(() => undefined)
        .finally(() => {
          void savePushNotificationInboxEntry({
            body: response.notification.request.content.body,
            createdAt: response.notification.date ? new Date(response.notification.date).toISOString() : null,
            data,
            id: response.notification.request.identifier,
            markRead: true,
            title: response.notification.request.content.title
          }).catch(() => undefined);

          if (path) {
            router.push(path as never);
          }
        });
    }
  );
}
