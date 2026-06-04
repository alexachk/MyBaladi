import type { JobCard } from '../types/jobCard';
import type { OrgMember } from '../types/org';
import type { JobRecap } from './jobRecaps';
import { normalizeVisitsList, visitStatus } from './jobVisits';

export interface StatsFilter {
  from: Date | null;
  to: Date | null;
  /** Staff selection — null/empty = everyone visible. */
  userIds: string[] | null;
}

export interface TechStats {
  userId: string;
  name: string;
  jobs: number;
  visits: number;
  doneVisits: number;
  upcomingVisits: number;
  recaps: number;
}

export interface MonthBucket {
  month: string; // YYYY-MM
  label: string; // e.g. "Mar 2026"
  visits: number;
  doneVisits: number;
  recaps: number;
}

export interface StatsSummary {
  totalJobs: number;
  totalVisits: number;
  doneVisits: number;
  upcomingVisits: number;
  ongoingJobs: number;
  completedJobs: number;
  pendingReviewJobs: number;
  recaps: number;
  avgVisitsPerMonth: number;
  rangeMonths: number;
  byTech: TechStats[];
  byMonth: MonthBucket[];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey(): string {
  return dateKey(new Date());
}

function inRange(dayKey: string, from: Date | null, to: Date | null): boolean {
  if (!dayKey) return false;
  const key = dayKey.slice(0, 10);
  if (from && key < dateKey(from)) return false;
  if (to && key > dateKey(to)) return false;
  return true;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function jobParticipants(
  job: Pick<JobCard, 'technicianId' | 'assigneeId' | 'assignees'>,
): string[] {
  const ids = new Set<string>();
  if (job.technicianId) ids.add(job.technicianId);
  if (job.assigneeId) ids.add(job.assigneeId);
  for (const assignee of job.assignees ?? []) {
    if (assignee.userId) ids.add(assignee.userId);
  }
  return [...ids];
}

function memberName(members: OrgMember[], id: string, fallback = ''): string {
  return members.find((m) => m.id === id)?.name || fallback || id;
}

function monthsBetween(from: Date | null, to: Date | null, fallback: number): number {
  if (!from || !to) return Math.max(1, fallback);
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  return Math.max(1, months);
}

/** Aggregate KPIs across the visible jobs + recaps for the given filter. */
export function computeStats(
  jobs: JobCard[],
  recaps: JobRecap[],
  members: OrgMember[],
  filter: StatsFilter,
): StatsSummary {
  const selection = filter.userIds && filter.userIds.length ? new Set(filter.userIds) : null;
  const today = todayKey();

  const techMap = new Map<string, TechStats>();
  const monthMap = new Map<string, MonthBucket>();
  const monthKeys = new Set<string>();

  const ensureTech = (userId: string): TechStats => {
    let entry = techMap.get(userId);
    if (!entry) {
      entry = {
        userId,
        name: memberName(members, userId),
        jobs: 0,
        visits: 0,
        doneVisits: 0,
        upcomingVisits: 0,
        recaps: 0,
      };
      techMap.set(userId, entry);
    }
    return entry;
  };

  const ensureMonth = (monthKey: string): MonthBucket => {
    let entry = monthMap.get(monthKey);
    if (!entry) {
      entry = { month: monthKey, label: monthLabel(monthKey), visits: 0, doneVisits: 0, recaps: 0 };
      monthMap.set(monthKey, entry);
    }
    return entry;
  };

  let totalJobs = 0;
  let totalVisits = 0;
  let doneVisits = 0;
  let upcomingVisits = 0;
  let ongoingJobs = 0;
  let completedJobs = 0;
  let pendingReviewJobs = 0;

  for (const job of jobs) {
    const participants = jobParticipants(job);
    const relevant = participants.filter((id) => !selection || selection.has(id));
    if (selection && relevant.length === 0) continue;

    const visits = normalizeVisitsList(job.visits ?? []);
    const visitsInRange = visits.filter((visit) => inRange(visit.date, filter.from, filter.to));

    if (!visitsInRange.length && (filter.from || filter.to)) {
      // Still count ongoing/status if job itself overlaps via visits — otherwise skip.
    }

    let jobCounted = false;
    for (const visit of visitsInRange) {
      const status = visitStatus(visit);
      if (status === 'cancelled' || status === 'rescheduled') continue;
      jobCounted = true;
      totalVisits += 1;
      const isDone = status === 'done';
      const isUpcoming = status === 'scheduled' && visit.date.slice(0, 10) >= today;
      if (isDone) doneVisits += 1;
      if (isUpcoming) upcomingVisits += 1;

      const monthKey = visit.date.slice(0, 7);
      monthKeys.add(monthKey);
      const bucket = ensureMonth(monthKey);
      bucket.visits += 1;
      if (isDone) bucket.doneVisits += 1;

      for (const id of relevant) {
        const tech = ensureTech(id);
        tech.visits += 1;
        if (isDone) tech.doneVisits += 1;
        if (isUpcoming) tech.upcomingVisits += 1;
      }
    }

    if (jobCounted || !(filter.from || filter.to)) {
      totalJobs += 1;
      for (const id of relevant) ensureTech(id).jobs += 1;
      if (job.status === 'in_progress') ongoingJobs += 1;
      if (job.status === 'pending_review') pendingReviewJobs += 1;
      if (job.status === 'completed') completedJobs += 1;
    }
  }

  let recapsTotal = 0;
  for (const recap of recaps) {
    if (!inRange(recap.createdAt, filter.from, filter.to)) continue;
    const attribId = recap.technicianId || recap.generatedById;
    if (selection && attribId && !selection.has(attribId)) continue;
    recapsTotal += 1;
    const monthKey = recap.createdAt.slice(0, 7);
    monthKeys.add(monthKey);
    ensureMonth(monthKey).recaps += 1;
    if (attribId) ensureTech(attribId).recaps += 1;
  }

  const byTech = [...techMap.values()].sort((a, b) => b.visits - a.visits || b.jobs - a.jobs);
  const byMonth = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const rangeMonths = monthsBetween(filter.from, filter.to, monthKeys.size);
  const avgVisitsPerMonth = rangeMonths ? totalVisits / rangeMonths : totalVisits;

  return {
    totalJobs,
    totalVisits,
    doneVisits,
    upcomingVisits,
    ongoingJobs,
    completedJobs,
    pendingReviewJobs,
    recaps: recapsTotal,
    avgVisitsPerMonth,
    rangeMonths,
    byTech,
    byMonth,
  };
}

export interface DateRangePreset {
  id: string;
  label: string;
  range: () => { from: Date | null; to: Date | null };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatStatsRangeSpan(from: Date | null, to: Date | null): string {
  if (!from && !to) return 'All dates';
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  return `Until ${fmt(to!)}`;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    id: 'last_30_days',
    label: 'Last 30 days',
    range: () => {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: startOfDay(now) };
    },
  },
  {
    id: 'this_month',
    label: 'This month',
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    },
  },
  {
    id: 'last_3_months',
    label: 'Last 3 months',
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: startOfDay(now) };
    },
  },
  {
    id: 'this_year',
    label: 'This year',
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
    },
  },
  {
    id: 'all_time',
    label: 'All time',
    range: () => ({ from: null, to: null }),
  },
];
