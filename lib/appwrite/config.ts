import Constants from 'expo-constants';

const bundleId =
  Constants.expoConfig?.ios?.bundleIdentifier ??
  Constants.expoConfig?.android?.package ??
  'com.baladi.mybaladi';

export const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = '6a0b77a0003989203e03';

export const appwriteConfig = {
  endpoint: APPWRITE_ENDPOINT,
  projectId: APPWRITE_PROJECT_ID,
  platform: process.env.EXPO_PUBLIC_APPWRITE_PLATFORM ?? bundleId,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ?? '6a0b7bf6002a5babff7c',
  jobCardsCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_JOB_CARDS_COLLECTION_ID ?? 'job_cards',
};

export function isAppwriteConfigured(): boolean {
  return Boolean(appwriteConfig.endpoint && appwriteConfig.projectId);
}

export function isAppwriteDatabaseConfigured(): boolean {
  return Boolean(appwriteConfig.databaseId && appwriteConfig.jobCardsCollectionId);
}

export const ADMIN_USERS_FUNCTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_ADMIN_USERS_FUNCTION_ID ?? 'admin_users';

export function appwriteConsoleUsersUrl(): string {
  return `https://cloud.appwrite.io/console/project-${appwriteConfig.projectId}/auth/users`;
}

/** Appwrite collection attributes — create these in the Appwrite Console. */
export const APPWRITE_JOB_CARD_SCHEMA = {
  collectionId: 'job_cards',
  attributes: [
    { key: 'reference', type: 'string', size: 64, required: true },
    { key: 'clientName', type: 'string', size: 256, required: true },
    { key: 'siteAddress', type: 'string', size: 512, required: false },
    { key: 'contactName', type: 'string', size: 128, required: false },
    { key: 'contactPhone', type: 'string', size: 32, required: false },
    { key: 'missionType', type: 'string', size: 64, required: false },
    { key: 'equipment', type: 'string', size: 256, required: false },
    { key: 'technicianName', type: 'string', size: 128, required: true },
    { key: 'technicianId', type: 'string', size: 36, required: true },
    { key: 'scheduledDate', type: 'string', size: 32, required: false },
    { key: 'arrivalTime', type: 'string', size: 16, required: false },
    { key: 'departureTime', type: 'string', size: 16, required: false },
    { key: 'workPerformed', type: 'string', size: 5000, required: false },
    { key: 'partsUsed', type: 'string', size: 2000, required: false },
    { key: 'notes', type: 'string', size: 2000, required: false },
    {
      key: 'status',
      type: 'enum',
      elements: ['draft', 'in_progress', 'completed', 'pending_review'],
      required: true,
    },
    {
      key: 'priority',
      type: 'enum',
      elements: ['low', 'normal', 'high', 'urgent'],
      required: true,
    },
  ],
  indexes: ['technicianId', 'status', 'scheduledDate', 'reference'],
} as const;
