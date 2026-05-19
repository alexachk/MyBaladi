import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Models } from 'react-native-appwrite';
import {
  createJobCardInAppwrite,
  deleteJobCardFromAppwrite,
  fetchJobCardsFromAppwrite,
  updateJobCardInAppwrite,
} from '../lib/appwrite/jobCards';
import { isAppwriteConfigured, isAppwriteDatabaseConfigured } from '../lib/appwrite/config';
import { getCurrentSessionUser, isAdminUser, loginWithEmail, logout as logoutSession } from '../lib/appwrite/auth';
import { notifyJobCreated, notifyJobLifecycle, notifyJobUpdated } from '../lib/notifyEvents';
import { clearCredentials } from '../lib/biometric';
import { JobCard } from '../types/jobCard';

const STORAGE_KEY = '@mybaladi/job-cards';
const CACHE_KEY = '@mybaladi/job-cards-cache';

interface AuthContextValue {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  isConfigured: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

interface JobCardsContextValue {
  jobCards: JobCard[];
  loading: boolean;
  syncing: boolean;
  isRemote: boolean;
  refresh: () => Promise<void>;
  addJobCard: (job: Omit<JobCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<JobCard>;
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>;
  deleteJobCard: (id: string) => Promise<void>;
  getJobCard: (id: string) => JobCard | undefined;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const JobCardsContext = createContext<JobCardsContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isAppwriteConfigured();

  const refreshSession = useCallback(async () => {
    if (!isConfigured) {
      setUser(null);
      return;
    }
    const sessionUser = await getCurrentSessionUser();
    setUser(sessionUser);
  }, [isConfigured]);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const sessionUser = await loginWithEmail(email, password);
    setUser(sessionUser);
  }, []);

  const handleLogout = useCallback(async () => {
    if (isConfigured) {
      await logoutSession();
    }
    await clearCredentials().catch(() => undefined);
    setUser(null);
  }, [isConfigured]);

  const isAdmin = isAdminUser(user);

  const value = useMemo(
    () => ({
      user,
      loading,
      isConfigured,
      isAdmin,
      login,
      logout: handleLogout,
      refreshSession,
    }),
    [user, loading, isConfigured, isAdmin, login, handleLogout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function JobCardsProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured, isAdmin } = useAuth();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const isRemote = isConfigured && isAppwriteDatabaseConfigured() && Boolean(user);

  const persistLocal = useCallback(async (cards: JobCard[]) => {
    setJobCards(cards);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, []);

  const loadLocal = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      setJobCards(JSON.parse(raw) as JobCard[]);
    } else {
      setJobCards([]);
    }
  }, []);

  const loadRemote = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const cards = await fetchJobCardsFromAppwrite(user.$id, { all: isAdmin });
      setJobCards(cards);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cards));
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setJobCards(JSON.parse(cached) as JobCard[]);
      }
      throw new Error('Unable to sync job cards from Appwrite.');
    } finally {
      setSyncing(false);
    }
  }, [user, isAdmin]);

  const refresh = useCallback(async () => {
    if (isRemote && user) {
      await loadRemote();
      return;
    }
    await loadLocal();
  }, [isRemote, user, loadRemote, loadLocal]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [refresh]);

  const addJobCard = useCallback(
    async (job: Omit<JobCard, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (isRemote && user) {
        const created = await createJobCardInAppwrite(job, user.$id);
        setJobCards((prev) => {
          const next = [created, ...prev];
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
          return next;
        });

        notifyJobCreated(created, {
          id: user.$id,
          name: user.name || user.email,
          isAdmin,
        }).catch(() => undefined);

        return created;
      }

      const now = new Date().toISOString();
      const newJob: JobCard = {
        ...job,
        id: `job_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      await persistLocal([newJob, ...jobCards]);
      return newJob;
    },
    [isRemote, user, jobCards, persistLocal, isAdmin],
  );

  const updateJobCard = useCallback(
    async (id: string, updates: Partial<JobCard>) => {
      if (isRemote) {
        const before = jobCards.find((j) => j.id === id);
        await updateJobCardInAppwrite(id, updates);
        let after: JobCard | undefined;
        setJobCards((prev) => {
          const next = prev.map((job) =>
            job.id === id ? { ...job, ...updates, updatedAt: new Date().toISOString() } : job,
          );
          after = next.find((j) => j.id === id);
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
          return next;
        });

        if (user && before && after) {
          const actor = { id: user.$id, name: user.name || user.email, isAdmin };

          // Detect lifecycle transitions
          const startedNow = !before.startedAt && after.startedAt;
          const finishedNow = !before.finishedAt && after.finishedAt;
          const lockedNow = !before.lockedAt && after.lockedAt;
          const unlockedNow = before.lockedAt && !after.lockedAt;

          if (lockedNow) {
            notifyJobLifecycle(after, 'signed', actor).catch(() => undefined);
          } else if (unlockedNow) {
            notifyJobLifecycle(after, 'reopened', actor).catch(() => undefined);
          } else if (finishedNow) {
            notifyJobLifecycle(after, 'finished', actor).catch(() => undefined);
          } else if (startedNow) {
            notifyJobLifecycle(after, 'started', actor).catch(() => undefined);
          } else {
            // Generic update — only flag meaningful business fields
            const watchFields: Array<keyof JobCard> = [
              'reference', 'clientName', 'siteAddress', 'contactName', 'contactPhone',
              'missionType', 'equipment', 'scheduledDate', 'scheduledTime', 'reminderAt',
              'arrivalTime', 'departureTime', 'workPerformed', 'partsUsed', 'notes',
              'status', 'priority', 'personId', 'companyId', 'photoIds', 'documentIds',
            ];
            const changed = watchFields.filter((k) => JSON.stringify((before as any)[k]) !== JSON.stringify((after as any)[k]));
            if (changed.length) {
              notifyJobUpdated(after, actor, changed).catch(() => undefined);
            }
          }
        }
        return;
      }

      const next = jobCards.map((job) =>
        job.id === id ? { ...job, ...updates, updatedAt: new Date().toISOString() } : job,
      );
      await persistLocal(next);
    },
    [isRemote, jobCards, persistLocal, user, isAdmin],
  );

  const deleteJobCard = useCallback(
    async (id: string) => {
      if (isRemote) {
        await deleteJobCardFromAppwrite(id);
        setJobCards((prev) => {
          const next = prev.filter((job) => job.id !== id);
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
          return next;
        });
        return;
      }

      await persistLocal(jobCards.filter((job) => job.id !== id));
    },
    [isRemote, jobCards, persistLocal],
  );

  const getJobCard = useCallback(
    (id: string) => jobCards.find((job) => job.id === id),
    [jobCards],
  );

  const value = useMemo(
    () => ({
      jobCards,
      loading,
      syncing,
      isRemote,
      refresh,
      addJobCard,
      updateJobCard,
      deleteJobCard,
      getJobCard,
    }),
    [
      jobCards,
      loading,
      syncing,
      isRemote,
      refresh,
      addJobCard,
      updateJobCard,
      deleteJobCard,
      getJobCard,
    ],
  );

  return <JobCardsContext.Provider value={value}>{children}</JobCardsContext.Provider>;
}

export function useJobCards() {
  const context = useContext(JobCardsContext);
  if (!context) {
    throw new Error('useJobCards must be used within JobCardsProvider');
  }
  return context;
}
