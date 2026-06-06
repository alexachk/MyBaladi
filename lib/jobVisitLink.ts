import { formatVisitOnSiteStamp } from './visitDuration';
import { formatVisitWhen, type StoredJobVisit } from './jobVisits';

export interface VisitLinkOption {
  id: string | null;
  label: string;
}

export function buildVisitLinkOptions(visits: StoredJobVisit[]): VisitLinkOption[] {
  const options: VisitLinkOption[] = [{ id: null, label: 'General (not linked to a visit)' }];
  visits.forEach((visit, index) => {
    const when = formatVisitWhen(visit);
    options.push({
      id: visit.id,
      label: visit.label ? `${visit.label} · ${when}` : `Visit ${index + 1} · ${when}`,
    });
  });
  return options;
}

export function buildVisitLinkOptionsFromFormEntries(
  entries: Array<{ key: string; label?: string; when: string }>,
): VisitLinkOption[] {
  const options: VisitLinkOption[] = [{ id: null, label: 'General (not linked to a visit)' }];
  entries.forEach((entry, index) => {
    options.push({
      id: entry.key,
      label: entry.label ? `${entry.label} · ${entry.when}` : `Visit ${index + 1} · ${entry.when}`,
    });
  });
  return options;
}

export function visitLinkLabel(visits: StoredJobVisit[], visitId: string | null | undefined): string {
  if (!visitId) return 'General';
  const index = visits.findIndex((visit) => visit.id === visitId);
  if (index < 0) return 'Visit';
  const visit = visits[index];
  const when = formatVisitWhen(visit);
  return visit.label ? `${visit.label} · ${when}` : `Visit ${index + 1} · ${when}`;
}

export function formatVisitOnSiteTimes(
  visit: Pick<StoredJobVisit, 'arrivalTime' | 'departureTime' | 'durationMinutes'>,
): string {
  return formatVisitOnSiteStamp(visit.arrivalTime, visit.departureTime, visit.durationMinutes);
}

export function visitIdLocked(
  visitId: string | null | undefined,
  lockedVisitIds: readonly string[],
): boolean {
  return Boolean(visitId && lockedVisitIds.includes(visitId));
}

/** Visit picker options the current user may assign (general always kept). */
export function visitLinkOptionsForEdit(
  options: VisitLinkOption[],
  lockedVisitIds: readonly string[],
  keepVisitId?: string | null,
): VisitLinkOption[] {
  return options.filter((opt) => {
    if (!opt.id) return true;
    if (opt.id === keepVisitId) return true;
    return !visitIdLocked(opt.id, lockedVisitIds);
  });
}

export function canAddVisitLinkedRow(
  options: VisitLinkOption[],
  lockedVisitIds: readonly string[],
): boolean {
  return visitLinkOptionsForEdit(options, lockedVisitIds).length > 0;
}

export function defaultUnlockedVisitId(
  options: VisitLinkOption[],
  lockedVisitIds: readonly string[],
): string | null {
  const match = options.find((opt) => opt.id && !visitIdLocked(opt.id, lockedVisitIds));
  return match?.id ?? null;
}

export function canAddMissionScopeRow(
  rows: Array<{ visitId: string | null }>,
  options: VisitLinkOption[],
  lockedVisitIds: readonly string[],
): boolean {
  if (rows.some((row) => !row.visitId)) return true;
  const used = new Set(rows.map((row) => row.visitId).filter((id): id is string => Boolean(id)));
  return options.some(
    (opt) => opt.id && !used.has(opt.id) && !visitIdLocked(opt.id, lockedVisitIds),
  );
}
