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
