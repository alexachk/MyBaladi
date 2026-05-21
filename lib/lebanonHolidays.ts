/**
 * Lebanese public / government holidays for scheduling.
 *
 * Fixed dates follow Decree 15215. Islamic dates and one-offs are sourced from
 * BDL banking holidays / official gazette and updated per year in YEAR_ENTRIES.
 * Update YEAR_ENTRIES each January from https://bdl.gov.lb/bankingholidays.php
 */

import { toIsoDate } from '../utils/calendarGrid';

export type LebanonHoliday = {
  date: string;
  name: string;
  nameAr: string;
  /** lunar dates may shift when confirmed by the government */
  tentative?: boolean;
};

type HolidayEntry = { month: number; day: number; name: string; nameAr: string };

/** Arabic labels keyed by English name (including computed Easter variants). */
const NAME_AR: Record<string, string> = {
  "New Year's Day": 'رأس السنة الميلادية',
  'Armenian Orthodox Christmas': 'عيد الميلاد المجيد (6 كانون الثاني)',
  "St Maroun's Day": 'عيد مار مارون',
  'Feast of the Annunciation': 'عيد البشارة',
  'Labor Day': 'عيد العمال',
  'Assumption of Mary': 'عيد انتقال العذراء',
  'Independence Day': 'عيد الاستقلال',
  'Christmas Day': 'عيد الميلاد المجيد',
  'Rafic Hariri Memorial Day': 'ذكرى استشهاد الرئيس رفيق الحريري',
  'Eid al-Fitr': 'عيد الفطر',
  'Eid al-Fitr Holiday': 'عطلة عيد الفطر',
  'Good Friday': 'الجمعة العظمى',
  'Good Friday (Western)': 'الجمعة العظمى (الغرب)',
  'Good Friday (Orthodox)': 'الجمعة العظمى (الشرقي)',
  'Easter Sunday': 'عيد القيامة',
  'Easter Sunday (Western)': 'عيد القيامة (الغرب)',
  'Easter Sunday (Orthodox)': 'عيد القيامة (الشرقي)',
  'Easter Monday': 'الاثنين بعد القيامة',
  'Easter Monday (Western)': 'الاثنين بعد القيامة (الغرب)',
  'Easter Monday (Orthodox)': 'الاثنين بعد القيامة (الشرقي)',
  "Martyrs' Day": 'يوم الشهداء',
  'Liberation & Resistance Day': 'يوم التحرير والمقاومة',
  'South Liberation Day': 'يوم تحرير الجنوب',
  'Eid al-Adha': 'عيد الأضحى',
  'Eid al-Adha Holiday': 'عطلة عيد الأضحى',
  'Islamic New Year': 'رأس السنة الهجرية',
  Ashura: 'عاشوراء',
  'Beirut Port Memorial Day': 'ذكرى كارثة مرفأ بيروت',
  "Prophet Muhammad's Birthday": 'المولد النبوي الشريف',
  'Public Holiday': 'عطلة رسمية',
};

/** Gregorian dates that repeat every year (month 1–12). */
const FIXED_ENTRIES: HolidayEntry[] = [
  { month: 1, day: 1, name: "New Year's Day", nameAr: NAME_AR["New Year's Day"] },
  { month: 1, day: 6, name: 'Armenian Orthodox Christmas', nameAr: NAME_AR['Armenian Orthodox Christmas'] },
  { month: 2, day: 9, name: "St Maroun's Day", nameAr: NAME_AR["St Maroun's Day"] },
  { month: 3, day: 25, name: 'Feast of the Annunciation', nameAr: NAME_AR['Feast of the Annunciation'] },
  { month: 5, day: 1, name: 'Labor Day', nameAr: NAME_AR['Labor Day'] },
  { month: 8, day: 15, name: 'Assumption of Mary', nameAr: NAME_AR['Assumption of Mary'] },
  { month: 11, day: 22, name: 'Independence Day', nameAr: NAME_AR['Independence Day'] },
  { month: 12, day: 25, name: 'Christmas Day', nameAr: NAME_AR['Christmas Day'] },
];

/**
 * Year-specific holidays (Islamic, Easter-related when not computed, memorials).
 */
const YEAR_ENTRIES: Record<
  number,
  Array<{ date: string; name: string; tentative?: boolean }>
> = {
  2025: [
    { date: '2025-02-14', name: 'Rafic Hariri Memorial Day' },
    { date: '2025-03-30', name: 'Eid al-Fitr', tentative: true },
    { date: '2025-03-31', name: 'Eid al-Fitr Holiday', tentative: true },
    { date: '2025-04-18', name: 'Good Friday' },
    { date: '2025-04-20', name: 'Easter Sunday' },
    { date: '2025-04-21', name: 'Easter Monday' },
    { date: '2025-05-04', name: "Martyrs' Day" },
    { date: '2025-05-11', name: 'Liberation & Resistance Day' },
    { date: '2025-05-25', name: 'South Liberation Day' },
    { date: '2025-06-06', name: 'Eid al-Adha', tentative: true },
    { date: '2025-06-07', name: 'Eid al-Adha Holiday', tentative: true },
    { date: '2025-06-26', name: 'Islamic New Year', tentative: true },
    { date: '2025-07-05', name: 'Ashura', tentative: true },
    { date: '2025-08-04', name: 'Beirut Port Memorial Day' },
    { date: '2025-09-04', name: "Prophet Muhammad's Birthday", tentative: true },
    { date: '2025-12-01', name: 'Public Holiday' },
    { date: '2025-12-02', name: 'Public Holiday' },
  ],
  2026: [
    { date: '2026-02-14', name: 'Rafic Hariri Memorial Day' },
    { date: '2026-03-20', name: 'Eid al-Fitr', tentative: true },
    { date: '2026-03-21', name: 'Eid al-Fitr Holiday', tentative: true },
    { date: '2026-03-22', name: 'Eid al-Fitr Holiday', tentative: true },
    { date: '2026-03-23', name: 'Eid al-Fitr Holiday', tentative: true },
    { date: '2026-04-03', name: 'Good Friday (Western)' },
    { date: '2026-04-05', name: 'Easter Sunday (Western)' },
    { date: '2026-04-06', name: 'Easter Monday (Western)' },
    { date: '2026-04-10', name: 'Good Friday (Orthodox)' },
    { date: '2026-04-12', name: 'Easter Sunday (Orthodox)' },
    { date: '2026-04-13', name: 'Easter Monday (Orthodox)' },
    { date: '2026-05-03', name: "Martyrs' Day" },
    { date: '2026-05-10', name: 'Liberation & Resistance Day' },
    { date: '2026-05-25', name: 'South Liberation Day' },
    { date: '2026-05-27', name: 'Eid al-Adha', tentative: true },
    { date: '2026-05-28', name: 'Eid al-Adha Holiday', tentative: true },
    { date: '2026-06-17', name: 'Islamic New Year', tentative: true },
    { date: '2026-06-26', name: 'Ashura', tentative: true },
    { date: '2026-08-26', name: "Prophet Muhammad's Birthday", tentative: true },
  ],
  2027: [
    { date: '2027-02-14', name: 'Rafic Hariri Memorial Day' },
    { date: '2027-03-10', name: 'Eid al-Fitr', tentative: true },
    { date: '2027-03-11', name: 'Eid al-Fitr Holiday', tentative: true },
    { date: '2027-03-26', name: 'Good Friday (Western)' },
    { date: '2027-03-28', name: 'Easter Sunday (Western)' },
    { date: '2027-03-29', name: 'Easter Monday (Western)' },
    { date: '2027-04-30', name: 'Good Friday (Orthodox)' },
    { date: '2027-05-02', name: 'Easter Sunday (Orthodox)' },
    { date: '2027-05-03', name: 'Easter Monday (Orthodox)' },
    { date: '2027-05-03', name: "Martyrs' Day" },
    { date: '2027-05-10', name: 'Liberation & Resistance Day' },
    { date: '2027-05-17', name: 'Eid al-Adha', tentative: true },
    { date: '2027-05-18', name: 'Eid al-Adha Holiday', tentative: true },
    { date: '2027-06-07', name: 'Islamic New Year', tentative: true },
    { date: '2027-06-16', name: 'Ashura', tentative: true },
    { date: '2027-08-16', name: "Prophet Muhammad's Birthday", tentative: true },
  ],
};

function nameArFor(name: string): string {
  return NAME_AR[name] ?? name;
}

function makeHoliday(
  date: string,
  name: string,
  tentative?: boolean,
): LebanonHoliday {
  return { date, name, nameAr: nameArFor(name), tentative };
}

function addHoliday(map: Map<string, LebanonHoliday[]>, date: string, holiday: LebanonHoliday) {
  const list = map.get(date) ?? [];
  if (list.some((h) => h.name === holiday.name)) return;
  list.push(holiday);
  map.set(date, list);
}

function fixedForYear(year: number): LebanonHoliday[] {
  return FIXED_ENTRIES.map((entry) =>
    makeHoliday(toIsoDate(year, entry.month - 1, entry.day), entry.name),
  );
}

/** Western Easter Sunday (Gregorian). */
function westernEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Orthodox Easter Sunday (Julian algorithm → Gregorian calendar). */
function orthodoxEasterSunday(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(year, month - 1, day);
  const century = Math.floor(year / 100);
  const offset = century - Math.floor(century / 4) - 2;
  julian.setDate(julian.getDate() + offset);
  return julian;
}

function isoFromDate(date: Date): string {
  return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function easterHolidays(year: number, map: Map<string, LebanonHoliday[]>, yearHasExplicitEaster: boolean) {
  if (yearHasExplicitEaster) return;

  const western = westernEasterSunday(year);
  const orthodox = orthodoxEasterSunday(year);
  const sameEaster =
    western.getFullYear() === orthodox.getFullYear() &&
    western.getMonth() === orthodox.getMonth() &&
    western.getDate() === orthodox.getDate();

  const westernGoodFriday = addDays(western, -2);
  const westernMonday = addDays(western, 1);
  const orthodoxGoodFriday = addDays(orthodox, -2);
  const orthodoxMonday = addDays(orthodox, 1);

  if (sameEaster) {
    addHoliday(map, isoFromDate(westernGoodFriday), makeHoliday(isoFromDate(westernGoodFriday), 'Good Friday'));
    addHoliday(map, isoFromDate(western), makeHoliday(isoFromDate(western), 'Easter Sunday'));
    addHoliday(map, isoFromDate(westernMonday), makeHoliday(isoFromDate(westernMonday), 'Easter Monday'));
    return;
  }

  addHoliday(
    map,
    isoFromDate(westernGoodFriday),
    makeHoliday(isoFromDate(westernGoodFriday), 'Good Friday (Western)'),
  );
  addHoliday(map, isoFromDate(western), makeHoliday(isoFromDate(western), 'Easter Sunday (Western)'));
  addHoliday(
    map,
    isoFromDate(westernMonday),
    makeHoliday(isoFromDate(westernMonday), 'Easter Monday (Western)'),
  );
  addHoliday(
    map,
    isoFromDate(orthodoxGoodFriday),
    makeHoliday(isoFromDate(orthodoxGoodFriday), 'Good Friday (Orthodox)'),
  );
  addHoliday(map, isoFromDate(orthodox), makeHoliday(isoFromDate(orthodox), 'Easter Sunday (Orthodox)'));
  addHoliday(
    map,
    isoFromDate(orthodoxMonday),
    makeHoliday(isoFromDate(orthodoxMonday), 'Easter Monday (Orthodox)'),
  );
}

export function getLebanonHolidays(year: number): LebanonHoliday[] {
  const map = new Map<string, LebanonHoliday[]>();
  const yearEntries = YEAR_ENTRIES[year] ?? [];
  const yearHasExplicitEaster = yearEntries.some((e) => /good friday|easter/i.test(e.name));

  for (const fixed of fixedForYear(year)) {
    addHoliday(map, fixed.date, fixed);
  }

  for (const entry of yearEntries) {
    addHoliday(map, entry.date, makeHoliday(entry.date, entry.name, entry.tentative));
  }

  easterHolidays(year, map, yearHasExplicitEaster);

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, holidays]) => holidays);
}

export function getLebanonHolidaysByDate(year: number): Record<string, LebanonHoliday[]> {
  const byDate: Record<string, LebanonHoliday[]> = {};
  for (const holiday of getLebanonHolidays(year)) {
    if (!byDate[holiday.date]) byDate[holiday.date] = [];
    byDate[holiday.date].push(holiday);
  }
  return byDate;
}

export function formatHolidayLabel(
  holiday: LebanonHoliday,
  mode: 'en' | 'ar' | 'both' = 'both',
): string {
  const star = holiday.tentative ? ' *' : '';
  if (mode === 'en') return `${holiday.name}${star}`;
  if (mode === 'ar') return `${holiday.nameAr}${star}`;
  return `${holiday.nameAr} · ${holiday.name}${star}`;
}

export function formatHolidayList(holidays: LebanonHoliday[], mode: 'en' | 'ar' | 'both' = 'both'): string {
  return holidays.map((h) => formatHolidayLabel(h, mode)).join('\n');
}

export function formatHolidayPhoneTitle(holiday: LebanonHoliday): string {
  const star = holiday.tentative ? ' *' : '';
  return `${holiday.nameAr} · ${holiday.name}${star} (Lebanon)`;
}

export function lebanonHolidayYearsAvailable(): number[] {
  return Object.keys(YEAR_ENTRIES)
    .map(Number)
    .sort((a, b) => a - b);
}
