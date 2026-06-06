import type { JobCard } from '../types/jobCard';

function touchesJobPeopleBlob(updates: Partial<JobCard>): boolean {
  return (
    updates.assignees !== undefined ||
    updates.jobContacts !== undefined ||
    updates.missionTypes !== undefined ||
    updates.missionScopes !== undefined ||
    updates.missionNotes !== undefined ||
    updates.equipmentItems !== undefined ||
    updates.scheduleLog !== undefined ||
    updates.initialScheduledDate !== undefined ||
    updates.initialScheduledTime !== undefined ||
    updates.visits !== undefined ||
    updates.photoIds !== undefined ||
    updates.documentIds !== undefined ||
    updates.attachmentVisitLinks !== undefined
  );
}

/** Keep schedule / mission / attachment-link blob fields when a partial update touches any of them. */
export function mergeJobCardBlobFields(
  before: JobCard | undefined,
  updates: Partial<JobCard>,
): Partial<JobCard> {
  if (!before || !touchesJobPeopleBlob(updates)) return updates;
  return {
    assignees: before.assignees,
    jobContacts: before.jobContacts,
    missionTypes: before.missionTypes,
    missionScopes: before.missionScopes,
    missionNotes: before.missionNotes,
    equipmentItems: before.equipmentItems,
    initialScheduledDate: before.initialScheduledDate,
    initialScheduledTime: before.initialScheduledTime,
    scheduleLog: before.scheduleLog,
    visits: before.visits,
    attachmentVisitLinks: before.attachmentVisitLinks,
    ...updates,
  };
}
