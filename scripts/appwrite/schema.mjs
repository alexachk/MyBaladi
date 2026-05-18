/** Single source of truth for Appwrite schema — synced via `npm run appwrite:sync`. */

export const JOB_CARDS_COLLECTION = {
  id: 'job_cards',
  name: 'Job Cards',
  documentSecurity: true,
  permissions: ['create("users")'],
  stringAttributes: [
    { key: 'reference', size: 64, required: true },
    { key: 'clientName', size: 256, required: true },
    { key: 'siteAddress', size: 512, required: false },
    { key: 'contactName', size: 128, required: false },
    { key: 'contactPhone', size: 32, required: false },
    { key: 'missionType', size: 64, required: false },
    { key: 'equipment', size: 256, required: false },
    { key: 'technicianName', size: 128, required: true },
    { key: 'technicianId', size: 36, required: true },
    { key: 'scheduledDate', size: 32, required: false },
    { key: 'arrivalTime', size: 16, required: false },
    { key: 'departureTime', size: 16, required: false },
    { key: 'workPerformed', size: 5000, required: false },
    { key: 'partsUsed', size: 2000, required: false },
    { key: 'notes', size: 2000, required: false },
  ],
  enumAttributes: [
    {
      key: 'status',
      elements: ['draft', 'in_progress', 'completed', 'pending_review'],
      required: true,
      default: 'draft',
    },
    {
      key: 'priority',
      elements: ['low', 'normal', 'high', 'urgent'],
      required: true,
      default: 'normal',
    },
  ],
  indexes: ['technicianId', 'status', 'scheduledDate', 'reference'],
};
