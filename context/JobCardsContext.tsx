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
import { listPersonnel } from '../lib/appwrite/adminUsers';
import { isAppwriteConfigured, isAppwriteDatabaseConfigured } from '../lib/appwrite/config';
import { getCurrentSessionUser, isAdminUser, loginWithEmail, logout as logoutSession } from '../lib/appwrite/auth';
import {
  getDescendantIds,
  getDirectReports,
  getVisibleUserIds,
} from '../lib/orgHierarchy';
import { notifyJobCreated, notifyJobLifecycle, notifyJobUpdated, notifyVisitScheduleEvents } from '../lib/notifyEvents';
import { clearCredentials } from '../lib/biometric';
import { JobCard } from '../types/jobCard';
import type { OrgMember } from '../types/org';

/** Read-only snapshot after a successful Appwrite fetch (offline fallback only). */
const CACHE_KEY = '@mybaladi/job-cards-cache';
const LEGACY_LOCAL_KEY = '@mybaladi/job-cards';

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
  usingCache: boolean;
  refresh: () => Promise<void>;
  refreshTeam: () => Promise<void>;
  addJobCard: (job: Omit<JobCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<JobCard>;
  updateJobCard: (id: string, updates: Partial<JobCard>) => Promise<void>;
  deleteJobCard: (id: string) => Promise<void>;
  getJobCard: (id: string) => JobCard | undefined;
  /** Org chart for calendar team view */
  teamMembers: OrgMember[];
  directReports: OrgMember[];
  canViewTeam: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const JobCardsContext = createContext<JobCardsContextValue | null>(null);

async function writeCache(cards: JobCard[]) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cards)).catch(() => undefined);
}

async function readCache(): Promise<JobCard[] | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobCard[];
  } catch {
    return null;
  }
}

async function clearCache() {
  await AsyncStorage.multiRemove([CACHE_KEY, LEGACY_LOCAL_KEY]).catch(() => undefined);
}

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
    await clearCache();
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
  const [teamMembers, setTeamMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [usingCache, setUsingCache] = useState(false);

  const directReports = useMemo(
    () => (user ? getDirectReports(user.$id, teamMembers) : []),
    [user, teamMembers],
  );

  const visibleUserIds = useMemo(
    () => (user ? getVisibleUserIds(user.$id, isAdmin, teamMembers) : []),
    [user, isAdmin, teamMembers],
  );

  const canViewTeam =
    isAdmin || (user ? getDescendantIds(user.$id, teamMembers).length > 0 : false);

  const loadTeam = useCallback(async () => {
    if (!isConfigured || !user) {
      setTeamMembers([]);
      return;
    }
    try {
      const personnel = await listPersonnel();
      setTeamMembers(
        personnel.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          labels: p.labels,
          position: p.position,
          managerId: p.managerId ?? '',
          contactPhones: p.contactPhones ?? [],
          contactEmails: p.contactEmails ?? [],
        })),
      );
    } catch {
      setTeamMembers([]);
    }
  }, [isConfigured, user]);

  const isRemote = isConfigured && isAppwriteDatabaseConfigured() && Boolean(user);

  const requireSession = useCallback(() => {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured. Add your project keys to .env.');
    }
    if (!isAppwriteDatabaseConfigured()) {
      throw new Error('Appwrite database is not configured.');
    }
    if (!user) {
      throw new Error('Sign in to manage job cards.');
    }
    return user;
  }, [user]);

  const loadFromAppwrite = useCallback(async () => {
    const sessionUser = requireSession();
    setSyncing(true);
    try {
      const cards = await fetchJobCardsFromAppwrite(sessionUser.$id, {
        all: isAdmin,
        visibleUserIds,
      });
      setJobCards(cards);
      setUsingCache(false);
      await writeCache(cards);
    } catch {
      const cached = await readCache();
      if (cached?.length) {
        setJobCards(cached);
        setUsingCache(true);
      } else {
        setJobCards([]);
        setUsingCache(false);
      }
      throw new Error('Unable to sync job cards from Appwrite.');
    } finally {
      setSyncing(false);
    }
  }, [requireSession, isAdmin, visibleUserIds]);

  const refresh = useCallback(async () => {
    if (!isRemote) {
      setJobCards([]);
      setUsingCache(false);
      return;
    }
    await loadFromAppwrite();
  }, [isRemote, loadFromAppwrite]);

  useEffect(() => {
    AsyncStorage.removeItem(LEGACY_LOCAL_KEY).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadTeam().catch(() => undefined);
  }, [loadTeam]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [refresh]);

  const addJobCard = useCallback(
    async (job: Omit<JobCard, 'id' | 'createdAt' | 'updatedAt'>) => {
      const sessionUser = requireSession();
      const created = await createJobCardInAppwrite(job, sessionUser.$id);
      setJobCards((prev) => {
        const next = [created, ...prev];
        writeCache(next);
        return next;
      });
      setUsingCache(false);

      notifyJobCreated(created, {
        id: sessionUser.$id,
        name: sessionUser.name || sessionUser.email,
        isAdmin,
      }).catch(() => undefined);

      return created;
    },
    [requireSession, isAdmin],
  );

  const updateJobCard = useCallback(
    async (id: string, updates: Partial<JobCard>) => {
      const sessionUser = requireSession();
      const before = jobCards.find((j) => j.id === id);
      const touchesPeopleBlob =
        updates.assignees !== undefined ||
        updates.jobContacts !== undefined ||
        updates.missionTypes !== undefined ||
        updates.equipmentItems !== undefined;
      const touchesScheduleBlob =
        updates.scheduleLog !== undefined ||
        updates.initialScheduledDate !== undefined ||
        updates.initialScheduledTime !== undefined ||
        updates.visits !== undefined;
      const payload =
        before && touchesScheduleBlob && !touchesPeopleBlob
          ? {
              ...updates,
              assignees: before.assignees,
              jobContacts: before.jobContacts,
              missionTypes: before.missionTypes,
              equipmentItems: before.equipmentItems,
            }
          : before && touchesPeopleBlob && !touchesScheduleBlob
            ? {
                ...updates,
                initialScheduledDate: before.initialScheduledDate,
                initialScheduledTime: before.initialScheduledTime,
                scheduleLog: before.scheduleLog,
                visits: before.visits,
              }
            : updates;
      await updateJobCardInAppwrite(id, payload);
      let after: JobCard | undefined;
      setJobCards((prev) => {
        const next = prev.map((job) =>
          job.id === id ? { ...job, ...payload, updatedAt: new Date().toISOString() } : job,
        );
        after = next.find((j) => j.id === id);
        writeCache(next);
        return next;
      });
      setUsingCache(false);

      if (before && after) {
        const actor = { id: sessionUser.$id, name: sessionUser.name || sessionUser.email, isAdmin };

        const startedNow = !before.startedAt && after.startedAt;
        const finishedNow = !before.finishedAt && after.finishedAt;
        const lockedNow = !before.lockedAt && after.lockedAt;
        const unlockedNow = before.lockedAt && !after.lockedAt;
        const completedNow = before.status !== 'completed' && after.status === 'completed';

        if (lockedNow) {
          notifyJobLifecycle(after, 'signed', actor).catch(() => undefined);
        } else if (completedNow) {
          notifyJobLifecycle(after, 'completed', actor).catch(() => undefined);
        } else if (unlockedNow) {
          notifyJobLifecycle(after, 'reopened', actor).catch(() => undefined);
        } else if (finishedNow) {
          notifyJobLifecycle(after, 'finished', actor).catch(() => undefined);
        } else if (startedNow) {
          notifyJobLifecycle(after, 'started', actor).catch(() => undefined);
        } else {
          const newScheduleEntries = (after.scheduleLog ?? []).slice((before.scheduleLog ?? []).length);
          if (newScheduleEntries.length) {
            notifyVisitScheduleEvents(after, actor, newScheduleEntries).catch(() => undefined);
          }

          const scheduleOnlyFields = new Set([
            'visits',
            'scheduleLog',
            'scheduledDate',
            'scheduledTime',
            'initialScheduledDate',
            'initialScheduledTime',
            'reminderAt',
            'notificationId',
            'calendarEventId',
          ]);

          const watchFields: Array<keyof JobCard> = [
            'reference',
            'clientName',
            'siteAddress',
            'contactName',
            'contactPhone',
            'missionType',
            'equipment',
            'equipmentItems',
            'scheduledDate',
            'scheduledTime',
            'visits',
            'reminderAt',
            'arrivalTime',
            'departureTime',
            'workPerformed',
            'partsUsed',
            'workReport',
            'notes',
            'status',
            'priority',
            'personId',
            'companyId',
            'photoIds',
            'documentIds',
            'assignees',
            'jobContacts',
            'missionTypes',
          ];
          const changed = watchFields.filter(
            (k) => JSON.stringify((before as any)[k]) !== JSON.stringify((after as any)[k]),
          );
          const meaningfulChanges =
            newScheduleEntries.length > 0
              ? changed.filter((field) => !scheduleOnlyFields.has(field))
              : changed;
          if (meaningfulChanges.length) {
            notifyJobUpdated(after, actor, meaningfulChanges).catch(() => undefined);
          }
        }
      }
    },
    [requireSession, jobCards, isAdmin],
  );

  const deleteJobCard = useCallback(
    async (id: string) => {
      requireSession();
      await deleteJobCardFromAppwrite(id);
      setJobCards((prev) => {
        const next = prev.filter((job) => job.id !== id);
        writeCache(next);
        return next;
      });
      setUsingCache(false);
    },
    [requireSession],
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
      usingCache,
      refresh,
      refreshTeam: loadTeam,
      addJobCard,
      updateJobCard,
      deleteJobCard,
      getJobCard,
      teamMembers,
      directReports,
      canViewTeam,
    }),
    [
      jobCards,
      loading,
      syncing,
      isRemote,
      usingCache,
      refresh,
      loadTeam,
      addJobCard,
      updateJobCard,
      deleteJobCard,
      getJobCard,
      teamMembers,
      directReports,
      canViewTeam,
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
