import { getLebanonHolidaysByDate } from '../lib/lebanonHolidays.ts';

const checks = {
  2025: { '2025-04-20': ['Easter Sunday'], '2025-05-04': ["Martyrs' Day"] },
  2026: { '2026-04-05': ['Easter Sunday (Western)'], '2026-05-03': ["Martyrs' Day"] },
  2027: {
    '2027-05-02': ["Martyrs' Day", 'Easter Sunday (Orthodox)'],
    '2027-05-09': ['Liberation & Resistance Day'],
    '2027-06-15': ['Ashura'],
  },
  2028: {
    '2028-04-16': ['Easter Sunday'],
    '2028-05-07': ["Martyrs' Day", 'Liberation & Resistance Day'],
  },
};

let failed = 0;
for (const [year, dates] of Object.entries(checks)) {
  const by = getLebanonHolidaysByDate(Number(year));
  for (const [date, names] of Object.entries(dates)) {
    const got = (by[date] ?? []).map((h) => h.name).sort();
    const exp = [...names].sort();
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      failed += 1;
      console.error('FAIL', date, 'expected', exp, 'got', got);
    }
  }
}

if (failed) process.exit(1);
console.log('Lebanon holiday checks passed.');
