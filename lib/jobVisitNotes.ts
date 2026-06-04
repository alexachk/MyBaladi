import { newContactKey } from './clientContact';
import { visitLinkLabel } from './jobVisitLink';
import type { StoredJobVisit } from './jobVisits';

export interface StoredVisitNote {
  visitId: string | null;
  text: string;
}

export interface VisitNoteEntry {
  key: string;
  visitId: string | null;
  text: string;
}

const NOTE_MAX = 500;

export function defaultVisitNoteEntry(visitId: string | null = null): VisitNoteEntry {
  return { key: newContactKey('note'), visitId, text: '' };
}

export function parseStoredVisitNotes(raw: unknown): StoredVisitNote[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredVisitNote[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = item.trim().slice(0, NOTE_MAX);
      if (text) out.push({ visitId: null, text });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === 'string' ? row.text.trim().slice(0, NOTE_MAX) : '';
    if (!text) continue;
    const visitId =
      typeof row.visitId === 'string' && row.visitId.trim() ? row.visitId.trim() : null;
    out.push({ visitId, text });
  }
  return out;
}

export function normalizeVisitNoteEntries(entries: VisitNoteEntry[]): StoredVisitNote[] {
  const out: StoredVisitNote[] = [];
  for (const entry of entries) {
    const text = entry.text.trim().slice(0, NOTE_MAX);
    if (!text) continue;
    out.push({ visitId: entry.visitId, text });
  }
  return out;
}

export function visitNotesForForm(
  stored?: StoredVisitNote[] | null,
  legacyText?: string | null,
): VisitNoteEntry[] {
  const notes = stored?.length
    ? stored
    : legacyText?.trim()
      ? [{ visitId: null, text: legacyText.trim() }]
      : [];
  return notes.length
    ? notes.map((note) => ({
        key: newContactKey('note'),
        visitId: note.visitId,
        text: note.text,
      }))
    : [defaultVisitNoteEntry()];
}

export function formatVisitNotesList(notes: StoredVisitNote[], visits: StoredJobVisit[] = []): string {
  const normalized = parseStoredVisitNotes(notes);
  if (!normalized.length) return '';
  if (normalized.length === 1 && !normalized[0].visitId) return normalized[0].text;
  return normalized
    .map((note, index) => {
      const visit = note.visitId ? ` [${visitLinkLabel(visits, note.visitId)}]` : '';
      return `${index + 1}. ${note.text}${visit}`;
    })
    .join('\n');
}

/** Legacy single `note` on mission scopes → visit-linked notes. */
export function legacyMissionNotesFromScopes(
  scopes: Array<{ visitId: string | null; note?: string; notes?: unknown }>,
): StoredVisitNote[] {
  const out: StoredVisitNote[] = [];
  for (const scope of scopes) {
    if (Array.isArray(scope.notes)) {
      for (const item of scope.notes) {
        if (typeof item === 'string') {
          const text = item.trim().slice(0, NOTE_MAX);
          if (text) out.push({ visitId: scope.visitId, text });
          continue;
        }
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          const text = typeof row.text === 'string' ? row.text.trim().slice(0, NOTE_MAX) : '';
          if (!text) continue;
          const visitId =
            typeof row.visitId === 'string' && row.visitId.trim()
              ? row.visitId.trim()
              : scope.visitId;
          out.push({ visitId, text });
        }
      }
    }
    if (typeof scope.note === 'string' && scope.note.trim()) {
      out.push({ visitId: scope.visitId, text: scope.note.trim().slice(0, NOTE_MAX) });
    }
  }
  return out;
}

export function missionNotesFromJob(
  job: {
    missionNotes?: StoredVisitNote[];
    missionScopes?: Array<{ visitId: string | null; note?: string; notes?: unknown }>;
  },
): StoredVisitNote[] {
  if (job.missionNotes?.length) return job.missionNotes;
  return legacyMissionNotesFromScopes(job.missionScopes ?? []);
}
