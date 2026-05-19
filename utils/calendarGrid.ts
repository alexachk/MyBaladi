export function isoDateParts(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

export function toIsoDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addDaysIso(iso: string, delta: number): string {
  const { year, month, day } = isoDateParts(iso);
  const date = new Date(year, month, day + delta);
  return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export type CalendarCell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

/** Monday-first month grid (42 cells). */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return {
      iso: toIsoDate(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}

export function compareJobSchedule(a: { scheduledDate: string; scheduledTime?: string | null }, b: typeof a): number {
  if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate.localeCompare(b.scheduledDate);
  return (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99');
}
