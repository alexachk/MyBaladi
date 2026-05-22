/** Single source of truth for Appwrite schema — synced via `npm run appwrite:sync`. */

/** Grant the same DB/storage rights as label:admin to label:appdev. */
function withAppDev(permissions) {
  const out = [...permissions];
  for (const rule of permissions) {
    if (rule.includes('label:admin')) {
      out.push(rule.replace('label:admin', 'label:appdev'));
    }
  }
  return out;
}

/**
 * Platforms registered with the Appwrite project (controls the allowed Origin
 * for SDK requests). Without these, the React Native SDK calls fail with
 * "Invalid Origin".
 *
 * Types accepted by the Appwrite API: 'web' | 'flutter-android' |
 * 'flutter-ios' | 'flutter-linux' | 'flutter-macos' | 'flutter-windows' |
 * 'apple-ios' | 'apple-macos' | 'apple-watchos' | 'apple-tvos' | 'android' |
 * 'unity' | 'react-native-android' | 'react-native-ios'
 */
export const PLATFORMS = [
  {
    type: 'react-native-android',
    name: 'MyBaladi Android',
    key: 'com.baladi.mybaladi',
  },
  {
    type: 'react-native-ios',
    name: 'MyBaladi iOS',
    key: 'com.baladi.mybaladi',
  },
];

export const ADMIN_USERS_FUNCTION = {
  id: 'admin_users',
  name: 'Admin Users',
  runtime: 'node-22',
  entrypoint: 'src/main.js',
  execute: ['users'],
  scopes: ['users.read', 'users.write'],
  timeout: 30,
};

export const PUSH_NOTIFICATIONS_FUNCTION = {
  id: 'push_notifications',
  name: 'Push Notifications',
  runtime: 'node-22',
  entrypoint: 'src/main.js',
  execute: [],
  scopes: ['users.read'],
  timeout: 15,
  events(databaseId) {
    return [`databases.${databaseId}.collections.notifications.documents.*.create`];
  },
};

export const APPWRITE_FUNCTIONS = [ADMIN_USERS_FUNCTION, PUSH_NOTIFICATIONS_FUNCTION];

/**
 * Attribute kinds:
 *   { type: 'string', key, size, required?, array?, default? }
 *   { type: 'enum', key, elements, required?, default? }
 *   { type: 'datetime', key, required?, default? }
 *   { type: 'boolean', key, required?, default? }
 *   { type: 'integer', key, required?, min?, max?, default? }
 *
 * Index kinds:
 *   { key, type: 'key' | 'fulltext', attributes: [string] }
 */
export const COLLECTIONS = [
  {
    id: 'job_cards',
    name: 'Job Cards',
    documentSecurity: true,
    collectionPermissions: withAppDev(['create("users")', 'read("label:admin")', 'update("label:admin")', 'delete("label:admin")']),
    attributes: [
      { type: 'string', key: 'reference', size: 64, required: true },
      { type: 'string', key: 'clientName', size: 256, required: true },
      { type: 'string', key: 'siteAddress', size: 512 },
      { type: 'string', key: 'contactName', size: 128 },
      { type: 'string', key: 'contactPhone', size: 32 },
      { type: 'string', key: 'missionType', size: 64 },
      { type: 'string', key: 'equipment', size: 256 },
      { type: 'string', key: 'technicianName', size: 128, required: true },
      { type: 'string', key: 'technicianId', size: 36, required: true },
      { type: 'string', key: 'assigneeId', size: 36 },
      { type: 'string', key: 'assigneeName', size: 128 },
      { type: 'string', key: 'assignees', size: 2000 },
      { type: 'string', key: 'scheduledDate', size: 32 },
      { type: 'string', key: 'arrivalTime', size: 16 },
      { type: 'string', key: 'departureTime', size: 16 },
      { type: 'string', key: 'workPerformed', size: 5000 },
      { type: 'string', key: 'partsUsed', size: 2000 },
      { type: 'string', key: 'notes', size: 2000 },
      { type: 'enum', key: 'status', elements: ['draft', 'in_progress', 'completed', 'pending_review'], required: true },
      { type: 'enum', key: 'priority', elements: ['low', 'normal', 'high', 'urgent'], required: true },
      { type: 'enum', key: 'clientType', elements: ['person', 'company'] },
      { type: 'string', key: 'personId', size: 36 },
      { type: 'string', key: 'companyId', size: 36 },
      { type: 'string', key: 'parentJobId', size: 36 },
      { type: 'string', key: 'scheduledTime', size: 16 },
      { type: 'datetime', key: 'reminderAt' },
      { type: 'datetime', key: 'startedAt' },
      { type: 'datetime', key: 'finishedAt' },
      { type: 'string', key: 'technicianSignatureId', size: 64 },
      { type: 'string', key: 'clientSignatureId', size: 64 },
      { type: 'string', key: 'clientSignatureName', size: 128 },
      { type: 'datetime', key: 'lockedAt' },
      { type: 'string', key: 'lockedBy', size: 36 },
      { type: 'string', key: 'notificationId', size: 128 },
      { type: 'string', key: 'calendarEventId', size: 128 },
      { type: 'string', key: 'photoIds', size: 64, array: true },
      { type: 'string', key: 'documentIds', size: 64, array: true },
    ],
    indexes: [
      { key: 'technicianId_idx', type: 'key', attributes: ['technicianId'] },
      { key: 'status_idx', type: 'key', attributes: ['status'] },
      { key: 'assigneeId_idx', type: 'key', attributes: ['assigneeId'] },
      { key: 'scheduledDate_idx', type: 'key', attributes: ['scheduledDate'] },
      { key: 'reference_idx', type: 'key', attributes: ['reference'] },
      { key: 'personId_idx', type: 'key', attributes: ['personId'] },
      { key: 'companyId_idx', type: 'key', attributes: ['companyId'] },
      { key: 'parentJobId_idx', type: 'key', attributes: ['parentJobId'] },
    ],
  },
  {
    id: 'persons',
    name: 'Persons',
    documentSecurity: false,
    collectionPermissions: withAppDev(['read("users")', 'create("users")', 'update("users")', 'delete("label:admin")']),
    attributes: [
      { type: 'string', key: 'firstName', size: 128, required: true },
      { type: 'string', key: 'lastName', size: 128 },
      { type: 'string', key: 'fullName', size: 256, required: true },
      { type: 'string', key: 'email', size: 256 },
      { type: 'string', key: 'phone', size: 64 },
      { type: 'string', key: 'contactPhones', size: 4000 },
      { type: 'string', key: 'contactEmails', size: 8000 },
      { type: 'string', key: 'address', size: 512 },
      { type: 'string', key: 'notes', size: 2000 },
      { type: 'string', key: 'companyId', size: 36 },
      { type: 'string', key: 'createdBy', size: 36 },
    ],
    indexes: [
      { key: 'fullName_idx', type: 'key', attributes: ['fullName'] },
      { key: 'phone_idx', type: 'key', attributes: ['phone'] },
      { key: 'email_idx', type: 'key', attributes: ['email'] },
      { key: 'companyId_idx', type: 'key', attributes: ['companyId'] },
    ],
  },
  {
    id: 'companies',
    name: 'Companies',
    documentSecurity: false,
    collectionPermissions: withAppDev(['read("users")', 'create("users")', 'update("users")', 'delete("label:admin")']),
    attributes: [
      { type: 'string', key: 'name', size: 256, required: true },
      { type: 'string', key: 'legalName', size: 256 },
      { type: 'string', key: 'email', size: 256 },
      { type: 'string', key: 'phone', size: 64 },
      { type: 'string', key: 'contactPhones', size: 4000 },
      { type: 'string', key: 'contactEmails', size: 8000 },
      { type: 'string', key: 'address', size: 512 },
      { type: 'string', key: 'industry', size: 128 },
      { type: 'string', key: 'website', size: 256 },
      { type: 'string', key: 'contactWebsites', size: 4000 },
      { type: 'string', key: 'notes', size: 2000 },
      { type: 'string', key: 'primaryContactId', size: 36 },
      { type: 'string', key: 'createdBy', size: 36 },
    ],
    indexes: [
      { key: 'name_idx', type: 'key', attributes: ['name'] },
      { key: 'phone_idx', type: 'key', attributes: ['phone'] },
      { key: 'email_idx', type: 'key', attributes: ['email'] },
    ],
  },
  {
    id: 'job_comments',
    name: 'Job Comments',
    documentSecurity: false,
    collectionPermissions: withAppDev(['read("users")', 'create("users")', 'update("label:admin")', 'delete("label:admin")']),
    attributes: [
      { type: 'string', key: 'jobId', size: 36, required: true },
      { type: 'string', key: 'authorId', size: 36, required: true },
      { type: 'string', key: 'authorName', size: 128, required: true },
      { type: 'string', key: 'body', size: 5000, required: true },
    ],
    indexes: [
      { key: 'jobId_idx', type: 'key', attributes: ['jobId'] },
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    documentSecurity: true,
    collectionPermissions: withAppDev(['create("users")', 'read("label:admin")', 'update("label:admin")', 'delete("label:admin")']),
    attributes: [
      {
        type: 'enum',
        key: 'recipientScope',
        elements: ['user', 'admin'],
        required: true,
      },
      { type: 'string', key: 'recipientUserId', size: 36 },
      {
        type: 'enum',
        key: 'type',
        elements: [
          'job_created',
          'job_assigned',
          'job_updated',
          'job_started',
          'job_finished',
          'job_signed',
          'job_completed',
          'job_reopened',
          'job_commented',
          'visit_rescheduled',
          'visit_done',
          'visit_added',
        ],
        required: true,
      },
      { type: 'string', key: 'title', size: 256, required: true },
      { type: 'string', key: 'body', size: 1000 },
      { type: 'string', key: 'jobId', size: 36 },
      { type: 'string', key: 'jobReference', size: 64 },
      { type: 'string', key: 'actorId', size: 36 },
      { type: 'string', key: 'actorName', size: 128 },
      { type: 'boolean', key: 'read', default: false },
    ],
    indexes: [
      { key: 'recipientUserId_idx', type: 'key', attributes: ['recipientUserId'] },
      { key: 'recipientScope_idx', type: 'key', attributes: ['recipientScope'] },
      { key: 'jobId_idx', type: 'key', attributes: ['jobId'] },
    ],
  },
];

export const STORAGE_BUCKETS = [
  {
    id: 'job_attachments',
    name: 'Job Attachments',
    permissions: withAppDev(['read("users")', 'create("users")', 'update("users")', 'delete("label:admin")']),
    fileSecurity: false,
    maximumFileSize: 20 * 1024 * 1024,
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'heic', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
    compression: 'gzip',
    encryption: true,
    antivirus: true,
  },
];

export const ATTACHMENT_BUCKET_ID = STORAGE_BUCKETS[0].id;

// Legacy export for back-compat references
export const JOB_CARDS_COLLECTION = COLLECTIONS[0];
