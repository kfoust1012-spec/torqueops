import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import {
  loadTechnicianNotificationInbox,
  markAllTechnicianNotificationInboxEntriesRead,
  markTechnicianNotificationInboxEntryRead,
  subscribeToTechnicianNotificationInbox,
  type TechnicianNotificationInboxEntry
} from "./inbox-store";

type NotificationInboxContextValue = {
  entries: TechnicianNotificationInboxEntry[];
  isLoading: boolean;
  markAllRead: () => Promise<void>;
  markRead: (entryId: string) => Promise<void>;
  refreshInbox: () => Promise<void>;
  unreadCount: number;
};

const NotificationInboxContext = createContext<NotificationInboxContextValue | null>(null);

export function NotificationInboxProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TechnicianNotificationInboxEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshInbox() {
    const nextEntries = await loadTechnicianNotificationInbox();
    setEntries(nextEntries);
  }

  async function markRead(entryId: string) {
    await markTechnicianNotificationInboxEntryRead(entryId);
  }

  async function markAllRead() {
    await markAllTechnicianNotificationInboxEntriesRead();
  }

  useEffect(() => {
    let isMounted = true;

    void loadTechnicianNotificationInbox()
      .then((nextEntries) => {
        if (isMounted) {
          setEntries(nextEntries);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToTechnicianNotificationInbox((nextEntries) => {
      if (isMounted) {
        setEntries(nextEntries);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      entries,
      isLoading,
      markAllRead,
      markRead,
      refreshInbox,
      unreadCount: entries.filter((entry) => !entry.readAt).length
    }),
    [entries, isLoading]
  );

  return (
    <NotificationInboxContext.Provider value={value}>
      {children}
    </NotificationInboxContext.Provider>
  );
}

export function useNotificationInbox() {
  const context = useContext(NotificationInboxContext);

  if (!context) {
    throw new Error("useNotificationInbox must be used within NotificationInboxProvider.");
  }

  return context;
}
