import { signOut, type AppSession } from "@mobile-mechanic/api-client";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";

import { syncAllQueuedAttachmentUploads } from "../features/attachments/api";
import { syncAllQueuedAssignedEstimateMutations } from "../features/estimates/api";
import { syncAllQueuedInspectionMutations } from "../features/inspections/api";
import {
  syncAllQueuedAssignedInvoiceMutations,
  syncAllQueuedAssignedPaymentHandoffs
} from "../features/invoices/api";
import { syncTrackedCloseoutSyncStates } from "../features/jobs/closeout-sync";
import { syncAllQueuedJobMutations } from "../features/jobs/api";
import {
  stopWorkdayLocationTracking,
  syncWorkdayLocationTrackingWithSchedule
} from "../features/location/workday-location-service";
import {
  attachPushNotificationReceivedListener,
  attachPushNotificationResponseListener,
  ensureTechnicianPushNotificationsRegistered,
  routePendingPushNotification
} from "../features/notifications/push";
import { loadMobileAppContext, type MobileAppContext } from "../lib/app-context";
import { supabase } from "../lib/supabase";

type SessionContextValue = {
  appContext: MobileAppContext | null;
  appError: string | null;
  isLoading: boolean;
  isRefreshingContext: boolean;
  refreshAppContext: () => Promise<MobileAppContext | null>;
  session: AppSession | null;
  signOutUser: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [appContext, setAppContext] = useState<MobileAppContext | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);

  async function syncAppContext(
    nextSession: AppSession | null,
    options?: { initial?: boolean }
  ): Promise<MobileAppContext | null> {
    const isInitial = options?.initial ?? false;

    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshingContext(true);
    }

    setSession(nextSession);

    if (!nextSession) {
      await stopWorkdayLocationTracking({ clearPendingPings: true });
      setAppContext(null);
      setAppError(null);
      setIsLoading(false);
      setIsRefreshingContext(false);
      return null;
    }

    const result = await loadMobileAppContext(supabase, nextSession.user.id);

    if (result.error) {
      setAppContext(null);
      setAppError(result.error.message);
    } else {
      setAppContext(result.data);
      setAppError(null);
    }

    setIsLoading(false);
    setIsRefreshingContext(false);
    return result.data;
  }

  useEffect(() => {
    void routePendingPushNotification().catch(() => undefined);
    const receivedSubscription = attachPushNotificationReceivedListener();
    const responseSubscription = attachPushNotificationResponseListener();

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function handleSession(nextSession: AppSession | null, options?: { initial?: boolean }) {
      if (!isMounted) {
        return;
      }

      await syncAppContext(nextSession, options);
    }

    supabase.auth.getSession().then(({ data }) => {
      void handleSession(data.session, { initial: true });
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void handleSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!appContext) {
      return;
    }

    const activeAppContext = appContext;
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function syncTracking() {
      if (!isMounted) {
        return;
      }

      try {
        await syncTrackedCloseoutSyncStates().catch(() => undefined);
        await Promise.all([
          syncWorkdayLocationTrackingWithSchedule(activeAppContext),
          syncAllQueuedJobMutations(activeAppContext.companyId, activeAppContext.userId).catch(
            () => undefined
          ),
          syncAllQueuedInspectionMutations(activeAppContext.companyId, activeAppContext.userId).catch(
            () => undefined
          ),
          syncAllQueuedAttachmentUploads(activeAppContext.companyId, activeAppContext.userId).catch(
            () => undefined
          ),
          syncAllQueuedAssignedEstimateMutations({
            companyId: activeAppContext.companyId,
            technicianUserId: activeAppContext.userId
          }).catch(() => undefined)
        ]);
        await syncTrackedCloseoutSyncStates().catch(() => undefined);
        await Promise.all([
          syncAllQueuedAssignedInvoiceMutations().catch(() => undefined),
          syncAllQueuedAssignedPaymentHandoffs().catch(() => undefined),
          ensureTechnicianPushNotificationsRegistered().catch(() => undefined)
        ]);
      } catch {
        return;
      }
    }

    void syncTracking();
    intervalId = setInterval(() => {
      void syncTracking();
    }, 60_000);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncTracking();
      }
    });

    return () => {
      isMounted = false;
      appStateSubscription.remove();

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [appContext]);

  async function refreshAppContext() {
    return syncAppContext(session);
  }

  async function signOutUser() {
    await stopWorkdayLocationTracking({ clearPendingPings: true });
    await signOut(supabase);
  }

  return (
    <SessionContext.Provider
      value={{
        appContext,
        appError,
        isLoading,
        isRefreshingContext,
        refreshAppContext,
        session,
        signOutUser
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSessionContext must be used within SessionProvider.");
  }

  return context;
}
