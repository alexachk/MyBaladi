import type { JobCard } from '../types/jobCard';
import { normalizeVisitsList } from './jobVisits';

/** draft = information / non-binding · final = official signed-off version */
export type RecapDocumentType = 'draft' | 'final';

export interface JobRecapExportOptions {
  /** Information / draft vs. final official document */
  documentType: RecapDocumentType;
  includeClient: boolean;
  includeContacts: boolean;
  includeMission: boolean;
  includeVisits: boolean;
  includeWorkReport: boolean;
  includeScheduleHistory: boolean;
  includeComments: boolean;
  includePhotos: boolean;
  includeDocuments: boolean;
  /** Work report + contacts not linked to a visit */
  includeGeneral: boolean;
  /** Empty = all visits */
  visitIds: string[];
  /** Empty = all photos (when includePhotos) */
  photoIds: string[];
  /** Empty = all documents (when includeDocuments) */
  documentIds: string[];
}

export function defaultJobRecapExportOptions(job: JobCard): JobRecapExportOptions {
  const visits = normalizeVisitsList(job.visits ?? []);
  return {
    documentType: 'draft',
    includeClient: true,
    includeContacts: true,
    includeMission: true,
    includeVisits: true,
    includeWorkReport: true,
    includeScheduleHistory: true,
    includeComments: true,
    includePhotos: true,
    includeDocuments: true,
    includeGeneral: true,
    visitIds: visits.map((visit) => visit.id),
    photoIds: [...(job.photoIds ?? [])],
    documentIds: [...(job.documentIds ?? [])],
  };
}

export const RECAP_DOCUMENT_TYPE_META: Record<
  RecapDocumentType,
  { label: string; tag: string; description: string }
> = {
  draft: {
    label: 'Information / Draft',
    tag: 'For information only',
    description: 'Non-binding working copy — not an official record.',
  },
  final: {
    label: 'Final official version',
    tag: 'Official document',
    description: 'Final intervention report issued by Baladi Frères.',
  },
};

export function visitMatchesExport(
  visitId: string | null | undefined,
  options: JobRecapExportOptions,
): boolean {
  if (visitId === null || visitId === undefined || visitId === '') {
    return options.includeGeneral;
  }
  if (!options.includeVisits) return false;
  if (options.visitIds.length === 0) return true;
  return options.visitIds.includes(visitId);
}

export function visitRowIncluded(visitId: string, options: JobRecapExportOptions): boolean {
  if (!options.includeVisits) return false;
  if (options.visitIds.length === 0) return true;
  return options.visitIds.includes(visitId);
}

export function photoIncluded(photoId: string, options: JobRecapExportOptions): boolean {
  if (!options.includePhotos) return false;
  if (options.photoIds.length === 0) return true;
  return options.photoIds.includes(photoId);
}

export function documentIncluded(documentId: string, options: JobRecapExportOptions): boolean {
  if (!options.includeDocuments) return false;
  if (options.documentIds.length === 0) return true;
  return options.documentIds.includes(documentId);
}
