import { newContactKey } from './clientContact';
import {
  buildVisitLinkOptions,
  buildVisitLinkOptionsFromFormEntries,
  visitLinkLabel,
  type VisitLinkOption,
} from './jobVisitLink';
import { formatVisitWhen, type StoredJobVisit } from './jobVisits';

export interface WorkReportItem {
  text: string;
  visitId?: string | null;
  photoIds?: string[];
  documentIds?: string[];
}

export interface StoredWorkReport {
  workItems: WorkReportItem[];
  partItems: WorkReportItem[];
}

export interface WorkReportTextEntry {
  key: string;
  text: string;
  visitId: string | null;
  photoIds: string[];
  documentIds: string[];
}

export interface WorkReportFormState {
  workItems: WorkReportTextEntry[];
  partItems: WorkReportTextEntry[];
}

export interface WorkReportGroupItem {
  text: string;
  photoIds: string[];
  documentIds: string[];
}

export interface WorkReportVisitGroup {
  visitId: string | null;
  visitLabel: string;
  workItems: WorkReportGroupItem[];
  partItems: WorkReportGroupItem[];
}

interface WorkReportBlobV3 {
  v: 3;
  work: WorkReportItem[];
  parts: WorkReportItem[];
}

interface WorkReportBlobV2 {
  v: 2;
  work: string[];
  parts: string[];
}

interface WorkReportBlobV1 {
  entries: Array<{
    title?: string;
    workPerformed?: string;
    partsUsed?: string;
  }>;
}

function defaultTextEntry(prefix: string, visitId: string | null = null): WorkReportTextEntry {
  return { key: newContactKey(prefix), text: '', visitId, photoIds: [], documentIds: [] };
}

function normalizeAttachmentIds(ids?: string[]): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}

function workReportItemHasContent(item: Pick<WorkReportItem, 'text' | 'photoIds' | 'documentIds'>): boolean {
  return Boolean(
    item.text?.trim() ||
      normalizeAttachmentIds(item.photoIds).length ||
      normalizeAttachmentIds(item.documentIds).length,
  );
}

function normalizeItem(item: WorkReportItem | string): WorkReportItem | null {
  if (typeof item === 'string') {
    const text = item.trim();
    return text ? { text, photoIds: [], documentIds: [] } : null;
  }
  const text = item.text?.trim() ?? '';
  const photoIds = normalizeAttachmentIds(item.photoIds);
  const documentIds = normalizeAttachmentIds(item.documentIds);
  if (!workReportItemHasContent({ text, photoIds, documentIds })) return null;
  return {
    text,
    visitId: item.visitId?.trim() || null,
    photoIds,
    documentIds,
  };
}

function normalizeItems(items: WorkReportItem[]): WorkReportItem[] {
  return items.map((item) => normalizeItem(item)).filter(Boolean) as WorkReportItem[];
}

export function defaultWorkReportFormState(defaultVisitId: string | null = null): WorkReportFormState {
  return {
    workItems: [defaultTextEntry('work', defaultVisitId)],
    partItems: [defaultTextEntry('part', defaultVisitId)],
  };
}

export function normalizeWorkReportForm(state: WorkReportFormState): StoredWorkReport {
  return {
    workItems: normalizeItems(
      state.workItems.map((entry) => ({
        text: entry.text,
        visitId: entry.visitId,
        photoIds: entry.photoIds,
        documentIds: entry.documentIds,
      })),
    ),
    partItems: normalizeItems(
      state.partItems.map((entry) => ({
        text: entry.text,
        visitId: entry.visitId,
        photoIds: entry.photoIds,
        documentIds: entry.documentIds,
      })),
    ),
  };
}

function parseLegacySectionBlob(parsed: WorkReportBlobV1): StoredWorkReport {
  const workItems: WorkReportItem[] = [];
  const partItems: WorkReportItem[] = [];
  for (const entry of parsed.entries ?? []) {
    const work = typeof entry.workPerformed === 'string' ? entry.workPerformed.trim() : '';
    const parts = typeof entry.partsUsed === 'string' ? entry.partsUsed.trim() : '';
    if (work) workItems.push({ text: work });
    if (parts) partItems.push({ text: parts });
  }
  return { workItems, partItems };
}

function parseBlobItems(raw: unknown): WorkReportItem[] {
  if (!Array.isArray(raw)) return [];
  return normalizeItems(
    raw
      .map((item) => {
        if (typeof item === 'string') return { text: item };
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          return {
            text: typeof row.text === 'string' ? row.text : '',
            visitId:
              typeof row.visitId === 'string' && row.visitId.trim() ? row.visitId.trim() : null,
            photoIds: normalizeAttachmentIds(
              Array.isArray(row.photoIds)
                ? row.photoIds.filter((id): id is string => typeof id === 'string')
                : undefined,
            ),
            documentIds: normalizeAttachmentIds(
              Array.isArray(row.documentIds)
                ? row.documentIds.filter((id): id is string => typeof id === 'string')
                : undefined,
            ),
          };
        }
        return null;
      })
      .filter(Boolean) as WorkReportItem[],
  );
}

export function parseWorkReportsFromStorage(
  rawWork: string,
  rawParts: string,
): StoredWorkReport {
  const trimmedWork = rawWork.trim();
  const trimmedParts = rawParts.trim();

  if (trimmedWork.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmedWork) as WorkReportBlobV3 | WorkReportBlobV2 | WorkReportBlobV1;
      if (parsed && typeof parsed === 'object' && 'v' in parsed && parsed.v === 3) {
        return {
          workItems: parseBlobItems(parsed.work),
          partItems: parseBlobItems(parsed.parts),
        };
      }
      if (parsed && typeof parsed === 'object' && 'v' in parsed && parsed.v === 2) {
        return {
          workItems: parseBlobItems(parsed.work),
          partItems: parseBlobItems(parsed.parts),
        };
      }
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as WorkReportBlobV1).entries)) {
        return parseLegacySectionBlob(parsed as WorkReportBlobV1);
      }
    } catch {
      // fall through
    }
  }

  return {
    workItems: trimmedWork ? [{ text: trimmedWork }] : [],
    partItems: trimmedParts ? [{ text: trimmedParts }] : [],
  };
}

export type WorkReportVisitOption = VisitLinkOption;

export const workReportVisitOptions = buildVisitLinkOptions;
export const workReportVisitOptionsFromKeys = buildVisitLinkOptionsFromFormEntries;
export const visitLabelById = visitLinkLabel;

export function workReportFormState(
  stored?: StoredWorkReport | null,
  legacyWork?: string,
  legacyParts?: string,
  defaultVisitId: string | null = null,
): WorkReportFormState {
  const report = stored ?? parseWorkReportsFromStorage(legacyWork ?? '', legacyParts ?? '');
  return {
    workItems: report.workItems.length
      ? report.workItems.map((item) => ({
          key: newContactKey('work'),
          text: item.text,
          visitId: item.visitId ?? null,
          photoIds: normalizeAttachmentIds(item.photoIds),
          documentIds: normalizeAttachmentIds(item.documentIds),
        }))
      : [defaultTextEntry('work', defaultVisitId)],
    partItems: report.partItems.length
      ? report.partItems.map((item) => ({
          key: newContactKey('part'),
          text: item.text,
          visitId: item.visitId ?? null,
          photoIds: normalizeAttachmentIds(item.photoIds),
          documentIds: normalizeAttachmentIds(item.documentIds),
        }))
      : [defaultTextEntry('part', defaultVisitId)],
  };
}

function hasVisitLinks(report: StoredWorkReport): boolean {
  return [...report.workItems, ...report.partItems].some((item) => item.visitId);
}

function hasAttachments(report: StoredWorkReport): boolean {
  return [...report.workItems, ...report.partItems].some(
    (item) => normalizeAttachmentIds(item.photoIds).length || normalizeAttachmentIds(item.documentIds).length,
  );
}

function isSimpleLegacyReport(report: StoredWorkReport): boolean {
  return (
    report.workItems.length <= 1 &&
    report.partItems.length <= 1 &&
    !hasVisitLinks(report) &&
    !hasAttachments(report)
  );
}

export function serializeWorkReportsToStorage(
  report: StoredWorkReport,
): { workPerformed: string; partsUsed: string } {
  const workItems = normalizeItems(report.workItems);
  const partItems = normalizeItems(report.partItems);
  if (workItems.length === 0 && partItems.length === 0) {
    return { workPerformed: '', partsUsed: '' };
  }

  if (isSimpleLegacyReport({ workItems, partItems })) {
    return {
      workPerformed: workItems[0]?.text ?? '',
      partsUsed: partItems[0]?.text ?? '',
    };
  }

  return {
    workPerformed: JSON.stringify({ v: 3, work: workItems, parts: partItems }),
    partsUsed: formatWorkReportItemsList(partItems),
  };
}

export function formatWorkReportItemsList(
  items: WorkReportItem[],
  visits: StoredJobVisit[] = [],
): string {
  const normalized = normalizeItems(items);
  if (!normalized.length) return '';
  if (normalized.length === 1 && !normalized[0].visitId) return normalized[0].text;
  return normalized
    .map((item, index) => {
      const visit = item.visitId ? ` [${visitLabelById(visits, item.visitId)}]` : '';
      return `${index + 1}. ${item.text}${visit}`;
    })
    .join('\n');
}

export function formatWorkItemsList(items: string[] | WorkReportItem[], visits: StoredJobVisit[] = []): string {
  const normalized =
    typeof items[0] === 'string'
      ? (items as string[]).map((text) => ({ text }))
      : normalizeItems(items as WorkReportItem[]);
  return formatWorkReportItemsList(normalized, visits);
}

export function formatPartItemsList(items: string[] | WorkReportItem[], visits: StoredJobVisit[] = []): string {
  return formatWorkItemsList(items, visits);
}

export function formatWorkSummary(report: StoredWorkReport, visits: StoredJobVisit[] = []): string {
  return formatWorkReportItemsList(report.workItems, visits);
}

export function formatPartsSummary(report: StoredWorkReport, visits: StoredJobVisit[] = []): string {
  return formatWorkReportItemsList(report.partItems, visits);
}

export function groupWorkReportByVisit(
  report: StoredWorkReport,
  visits: StoredJobVisit[],
): WorkReportVisitGroup[] {
  const groups = new Map<string | null, WorkReportVisitGroup>();

  const ensureGroup = (visitId: string | null) => {
    if (!groups.has(visitId)) {
      groups.set(visitId, {
        visitId,
        visitLabel: visitLinkLabel(visits, visitId),
        workItems: [],
        partItems: [],
      });
    }
    return groups.get(visitId)!;
  };

  for (const item of normalizeItems(report.workItems)) {
    ensureGroup(item.visitId ?? null).workItems.push({
      text: item.text,
      photoIds: normalizeAttachmentIds(item.photoIds),
      documentIds: normalizeAttachmentIds(item.documentIds),
    });
  }
  for (const item of normalizeItems(report.partItems)) {
    ensureGroup(item.visitId ?? null).partItems.push({
      text: item.text,
      photoIds: normalizeAttachmentIds(item.photoIds),
      documentIds: normalizeAttachmentIds(item.documentIds),
    });
  }

  const orderedIds = [
    ...visits.map((visit) => visit.id),
    null,
  ].filter((id, index, arr) => groups.has(id) && arr.indexOf(id) === index);

  return orderedIds
    .map((id) => groups.get(id)!)
    .filter(
      (group) =>
        group.workItems.some((item) => workReportItemHasContent(item)) ||
        group.partItems.some((item) => workReportItemHasContent(item)),
    );
}

export function collectWorkReportAttachmentIds(report: StoredWorkReport): {
  photoIds: string[];
  documentIds: string[];
} {
  const photoIds = new Set<string>();
  const documentIds = new Set<string>();
  for (const item of [...normalizeItems(report.workItems), ...normalizeItems(report.partItems)]) {
    for (const id of normalizeAttachmentIds(item.photoIds)) photoIds.add(id);
    for (const id of normalizeAttachmentIds(item.documentIds)) documentIds.add(id);
  }
  return { photoIds: [...photoIds], documentIds: [...documentIds] };
}
