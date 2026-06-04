export const DEFAULT_VISIT_DURATION_MINUTES = 60;
export const VISIT_DURATION_STEP_MINUTES = 15;
export const VISIT_DURATION_MIN_MINUTES = 30;
export const VISIT_DURATION_MAX_MINUTES = 8 * 60;

export const VISIT_DURATION_OPTIONS: number[] = (() => {
  const out: number[] = [];
  for (
    let m = VISIT_DURATION_MIN_MINUTES;
    m <= VISIT_DURATION_MAX_MINUTES;
    m += VISIT_DURATION_STEP_MINUTES
  ) {
    out.push(m);
  }
  return out;
})();

export function normalizeVisitDurationMinutes(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_VISIT_DURATION_MINUTES;
  const stepped = Math.round(n / VISIT_DURATION_STEP_MINUTES) * VISIT_DURATION_STEP_MINUTES;
  return Math.min(
    VISIT_DURATION_MAX_MINUTES,
    Math.max(VISIT_DURATION_MIN_MINUTES, stepped),
  );
}

/** Minutes between HH:mm on the same calendar day (handles past midnight). */
export function minutesBetweenHHmm(start: string, end: string): number | null {
  const parse = (value: string) => {
    const [h, m] = value.trim().split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const a = parse(start);
  const b = parse(end);
  if (a == null || b == null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function computeActualVisitDurationMinutes(
  arrival: string | undefined,
  departure: string | undefined,
): number | null {
  if (!arrival?.trim() || !departure?.trim()) return null;
  return minutesBetweenHHmm(arrival.trim(), departure.trim());
}

/** On-site stamp: times plus actual (and optional planned) duration. */
export function formatVisitOnSiteStamp(
  arrival?: string,
  departure?: string,
  plannedMinutes?: number,
): string {
  const a = arrival?.trim();
  const d = departure?.trim();
  if (!a && !d) return '';
  const times = `${a || '—'} → ${d || '—'}`;
  if (!a || !d) return times;
  const mins = computeActualVisitDurationMinutes(a, d);
  if (mins == null) return times;
  const actualLabel = formatVisitDurationShort(mins);
  if (plannedMinutes != null) {
    return `${times} · ${actualLabel} actual (planned ${formatVisitDurationShort(plannedMinutes)})`;
  }
  return `${times} · ${actualLabel} actual`;
}

/** Chip label: 30m, 1h, 1h30 */
export function formatVisitDurationShort(minutes: number): string {
  const m = normalizeVisitDurationMinutes(minutes);
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return hours === 1 ? '1h' : `${hours}h`;
  return `${hours}h${String(mins).padStart(2, '0')}`;
}
