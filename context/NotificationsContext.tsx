import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Notifications from 'expo-notifications';
import { client } from '../lib/appwrite/client';
import { hydrateLocalStoragePolyfill } from '../lib/localStoragePolyfill';
import {
  createNotification,
  deleteNotification,
  listNotificationsFor,
  markNotificationRead,
  notificationsChannel,
  type AppNotification,
  type CreateNotificationInput,
} from '../lib/appwrite/notifications';
import { useAuth } from './JobCardsContext';

interface NotificationsContextValue {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  push: (input: CreateNotificationInput) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, isConfigured } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured || !user) {
      setItems([]);
      return;
    }
    try {
      setItems(await listNotificationsFor({ userId: user.$id, isAdmin }));
    } catch {
      // ignore
    }
  }, [isConfigured, user, isAdmin]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Realtime updates (needs localStorage polyfill for Appwrite session cookies)
  useEffect(() => {
    if (!isConfigured || !user) return;

    let cancelled = false;
    const channel = notificationsChannel();

    void (async () => {
      await hydrateLocalStoragePolyfill();
      if (cancelled) return;

      try {
        const unsubscribe = client.subscribe(channel, (event) => {
        const events = event.events ?? [];
        const payload = event.payload as AppNotification | undefined;
        if (!payload) return;

        // Only update if this notification is for us
        const isMine =
          payload.recipientUserId === user.$id ||
          (isAdmin && payload.recipientScope === 'admin');
        if (!isMine) return;

        if (events.some((e) => e.endsWith('.create'))) {
          setItems((prev) => [payload, ...prev.filter((n) => n.id !== payload.id)]);
          // Local push banner
          Notifications.scheduleNotificationAsync({
            content: {
              title: payload.title,
              body: payload.body || undefined,
              data: { jobId: payload.jobId, notificationId: payload.id },
            },
            trigger: null,
          }).catch(() => undefined);
        } else if (events.some((e) => e.endsWith('.update'))) {
          setItems((prev) => prev.map((n) => (n.id === payload.id ? payload : n)));
        } else if (events.some((e) => e.endsWith('.delete'))) {
          setItems((prev) => prev.filter((n) => n.id !== payload.id));
        }
        });

        unsubscribeRef.current = unsubscribe;
      } catch {
        // realtime unavailable — list still works via refresh()
      }
    })();

    return () => {
      cancelled = true;
      try {
        unsubscribeRef.current?.();
      } catch {
        // ignore
      }
      unsubscribeRef.current = null;
    };
  }, [isConfigured, user, isAdmin]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(id, true);
    } catch {
      // ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = items.filter((n) => !n.read);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await Promise.all(unread.map((n) => markNotificationRead(n.id, true).catch(() => undefined)));
  }, [items]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      // ignore
    }
  }, []);

  const push = useCallback(async (input: CreateNotificationInput) => {
    try {
      await createNotification(input);
    } catch {
      // best-effort
    }
  }, []);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const value = useMemo(
    () => ({ items, unread, loading, refresh, markRead, markAllRead, remove, push }),
    [items, unread, loading, refresh, markRead, markAllRead, remove, push],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
