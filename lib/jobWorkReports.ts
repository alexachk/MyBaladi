import { newContactKey } from './clientContact';

export interface StoredWorkReport {
  title: string;
  workPerformed: string;
  partsUsed: string;
}

export interface WorkReportEntry extends StoredWorkReport {
  key: string;
}

interface WorkReportBlob {
  entries: StoredWorkReport[];
}

export function defaultWorkReportEntry(title = ''): WorkReportEntry {
  return {
    key: newContactKey('workreport'),
    title,
    workPerformed: '',
    partsUsed: '',
  };
}

export function normalizeWorkReportEntries(entries: WorkReportEntry[]): StoredWorkReport[] {
  const out: StoredWorkReport[] = [];
  for (const entry of entries) {
    const workPerformed = entry.workPerformed.trim();
    const partsUsed = entry.partsUsed.trim();
    const title = entry.title.trim();
    if (!workPerformed && !partsUsed && !title) continue;
    out.push({
      title: title || `Section ${out.length + 1}`,
      workPerformed,
      partsUsed,
    });
  }
  return out;
}

export function workReportsForForm(
  stored?: StoredWorkReport[] | null,
  legacyWork?: string,
  legacyParts?: string,
): WorkReportEntry[] {
  const reports =
    stored && stored.length > 0
      ? stored
      : parseWorkReportsFromStorage(legacyWork ?? '', legacyParts ?? '');
  if (reports.length === 0) return [defaultWorkReportEntry()];
  return reports.map((entry, index) => ({
    key: newContactKey('workreport'),
    title: entry.title || `Section ${index + 1}`,
    workPerformed: entry.workPerformed,
    partsUsed: entry.partsUsed,
  }));
}

export function parseWorkReportsFromStorage(
  rawWork: string,
  rawParts: string,
): StoredWorkReport[] {
  const trimmed = rawWork.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as WorkReportBlob;
      if (Array.isArray(parsed?.entries)) {
        return parsed.entries
          .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
          .map((entry, index) => ({
            title:
              typeof entry.title === 'string' && entry.title.trim()
                ? entry.title.trim()
                : `Section ${index + 1}`,
            workPerformed:
              typeof entry.workPerformed === 'string' ? entry.workPerformed.trim() : '',
            partsUsed: typeof entry.partsUsed === 'string' ? entry.partsUsed.trim() : '',
          }))
          .filter((entry) => entry.workPerformed || entry.partsUsed || entry.title);
      }
    } catch {
      // fall through to legacy plain text
    }
  }

  const work = trimmed;
  const parts = rawParts.trim();
  if (!work && !parts) return [];
  return [{ title: 'Section 1', workPerformed: work, partsUsed: parts }];
}

export function serializeWorkReportsToStorage(
  entries: StoredWorkReport[],
): { workPerformed: string; partsUsed: string } {
  if (entries.length === 0) {
    return { workPerformed: '', partsUsed: '' };
  }

  if (entries.length === 1) {
    const entry = entries[0];
    const isDefaultTitle = !entry.title || /^Section \d+$/.test(entry.title);
    if (isDefaultTitle) {
      return {
        workPerformed: entries[0].workPerformed,
        partsUsed: entries[0].partsUsed,
      };
    }
  }

  return {
    workPerformed: JSON.stringify({ entries }),
    partsUsed: formatPartsSummary(entries),
  };
}

export function formatWorkSummary(entries: StoredWorkReport[]): string {
  if (entries.length === 0) return '';
  if (entries.length === 1) return entries[0].workPerformed;
  return entries
    .map((entry) => {
      const header = entry.title ? `${entry.title}\n` : '';
      return `${header}${entry.workPerformed}`.trim();
    })
    .filter(Boolean)
    .join('\n\n—\n\n');
}

export function formatPartsSummary(entries: StoredWorkReport[]): string {
  const lines = entries
    .map((entry) => {
      if (!entry.partsUsed) return '';
      return entry.title ? `${entry.title}: ${entry.partsUsed}` : entry.partsUsed;
    })
    .filter(Boolean);
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];
  return lines.join('\n');
}

export function formatWorkReportsDisplay(entries: StoredWorkReport[]): string {
  if (entries.length === 0) return '';
  return entries
    .map((entry) => {
      const blocks = [
        entry.title ? `[${entry.title}]` : '',
        entry.workPerformed ? `Work: ${entry.workPerformed}` : '',
        entry.partsUsed ? `Parts: ${entry.partsUsed}` : '',
      ].filter(Boolean);
      return blocks.join('\n');
    })
    .join('\n\n');
}
