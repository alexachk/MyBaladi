import { Alert } from 'react-native';
import type { JobCard } from '../types/jobCard';
import { jobDocumentsForVisit, jobPhotosForVisit } from './jobCardAttachments';
import { formatSignOffVisitLabel } from './jobSignatures';
import {
  groupWorkReportByVisit,
  parseWorkReportsFromStorage,
  type WorkReportGroupItem,
} from './jobWorkReports';
import { normalizeVisitsList } from './jobVisits';

function itemHasContent(item: WorkReportGroupItem): boolean {
  return Boolean(
    item.text?.trim() || item.photoIds.length > 0 || item.documentIds.length > 0,
  );
}

export interface VisitSignOffGap {
  key: 'workReport' | 'photos' | 'documents';
  label: string;
}

export function visitSignOffGaps(
  job: Pick<
    JobCard,
    'workReport' | 'workPerformed' | 'partsUsed' | 'photoIds' | 'documentIds' | 'attachmentVisitLinks' | 'visits'
  >,
  visitId: string,
): VisitSignOffGap[] {
  const gaps: VisitSignOffGap[] = [];
  const visits = normalizeVisitsList(job.visits ?? []);
  const report =
    job.workReport ?? parseWorkReportsFromStorage(job.workPerformed ?? '', job.partsUsed ?? '');
  const group = groupWorkReportByVisit(report, visits).find((row) => row.visitId === visitId);
  const hasWork =
    group &&
    (group.workItems.some(itemHasContent) ||
      group.partItems.some(itemHasContent) ||
      group.noteItems.some(itemHasContent));

  if (!hasWork) gaps.push({ key: 'workReport', label: 'Work report' });
  if (!jobPhotosForVisit(job, visitId).length) gaps.push({ key: 'photos', label: 'Photos' });
  if (!jobDocumentsForVisit(job, visitId).length) gaps.push({ key: 'documents', label: 'Documents' });

  return gaps;
}

export function visitSignOffGapMessage(
  job: Pick<
    JobCard,
    'workReport' | 'workPerformed' | 'partsUsed' | 'photoIds' | 'documentIds' | 'attachmentVisitLinks' | 'visits'
  >,
  visitId: string,
): string {
  const visits = normalizeVisitsList(job.visits ?? []);
  const visit = visits.find((row) => row.id === visitId);
  const label = formatSignOffVisitLabel(visit ?? null, visits);
  const gaps = visitSignOffGaps(job, visitId);
  if (!gaps.length) return '';
  return `For ${label}:\n\n${gaps.map((gap) => `· ${gap.label} not filled in`).join('\n')}\n\nFill them on the job card before signing or locking this visit.`;
}

export function visitSignOffReady(
  job: Parameters<typeof visitSignOffGaps>[0],
  visitId: string,
): boolean {
  return visitSignOffGaps(job, visitId).length === 0;
}

/** Ask whether work report, photos and documents are complete before sign-off / lock. */
export function promptVisitSignOffReadiness(
  job: Parameters<typeof visitSignOffGaps>[0],
  visitId: string,
  onContinue: () => void,
  onGoBack?: () => void,
): void {
  const gaps = visitSignOffGaps(job, visitId);
  if (!gaps.length) {
    onContinue();
    return;
  }
  const detail = visitSignOffGapMessage(job, visitId);
  Alert.alert(
    'Ready to sign off?',
    `Are the work report, photos and documents fully finished for this visit?\n\n${detail}`,
    [
      { text: 'Go back & fill', onPress: onGoBack },
      { text: 'Continue anyway', style: 'destructive', onPress: onContinue },
    ],
  );
}
