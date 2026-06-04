import { getAppwriteClient } from './client';
import { ADMIN_USERS_FUNCTION_ID, APPWRITE_ENDPOINT, appwriteConfig } from './config';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  managerId: string;
  contactPhones: string[];
  contactEmails: string[];
  labels: string[];
  status: boolean | string;
};

type AdminResponse<T> = { ok: true } & T;
type AdminError = { ok: false; error: string };

type Execution = {
  status: string;
  responseStatusCode: number;
  responseBody: string;
  errors?: string;
};

async function executeAdmin<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const client = getAppwriteClient();
  const execution = (await client.call(
    'POST',
    new URL(`${APPWRITE_ENDPOINT}/functions/${ADMIN_USERS_FUNCTION_ID}/executions`),
    { 'content-type': 'application/json' },
    { body: JSON.stringify(body), async: false },
  )) as Execution;

  if (execution.status === 'failed') {
    let detail = execution.errors?.trim() || '';
    if (!detail && execution.responseBody) {
      try {
        const parsed = JSON.parse(execution.responseBody) as { error?: string };
        detail = parsed.error?.trim() || execution.responseBody;
      } catch {
        detail = execution.responseBody;
      }
    }
    throw new Error(detail || 'Function execution failed.');
  }

  let payload: (AdminResponse<Record<string, unknown>> & T) | AdminError;
  try {
    payload = JSON.parse(execution.responseBody || '{}');
  } catch {
    throw new Error('Invalid response from admin service.');
  }

  if (!payload.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  const { ok: _ok, ...data } = payload;
  return data as T;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const result = await executeAdmin<{ users: AdminUser[] }>({ action: 'list' });
  return result.users;
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  managerId?: string;
  contactPhones?: string[];
  contactEmails?: string[];
  grantAdmin?: boolean;
}): Promise<AdminUser> {
  const result = await executeAdmin<{ user: AdminUser }>({
    action: 'create',
    email: input.email.trim().toLowerCase(),
    password: input.password,
    firstName: input.firstName?.trim() ?? '',
    lastName: input.lastName?.trim() ?? '',
    position: input.position?.trim() ?? '',
    managerId: input.managerId?.trim() ?? '',
    contactPhones: input.contactPhones ?? [],
    contactEmails: input.contactEmails ?? [],
    grantAdmin: Boolean(input.grantAdmin),
  });
  return result.user;
}

export async function updateAdminUserProfile(input: {
  userId: string;
  firstName: string;
  lastName: string;
  position: string;
  managerId?: string;
  email?: string;
  password?: string;
  contactPhones?: string[];
  contactEmails?: string[];
}): Promise<AdminUser> {
  const result = await executeAdmin<{ user: AdminUser }>({
    action: 'update-profile',
    userId: input.userId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    position: input.position.trim(),
    managerId: input.managerId?.trim() ?? '',
    email: input.email?.trim().toLowerCase() ?? '',
    password: input.password ?? '',
    contactPhones: input.contactPhones ?? [],
    contactEmails: input.contactEmails ?? [],
  });
  return result.user;
}

export async function setAdminUserRole(userId: string, enabled: boolean): Promise<AdminUser> {
  const result = await executeAdmin<{ user: AdminUser }>({
    action: 'set-admin',
    userId,
    enabled,
  });
  return result.user;
}

export async function setAppDevUserRole(userId: string, enabled: boolean): Promise<AdminUser> {
  const result = await executeAdmin<{ user: AdminUser }>({
    action: 'set-app-dev',
    userId,
    enabled,
  });
  return result.user;
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await executeAdmin<Record<string, never>>({ action: 'delete', userId });
}

export type Personnel = {
  id: string;
  name: string;
  email: string;
  labels: string[];
  position: string;
  managerId: string;
  contactPhones: string[];
  contactEmails: string[];
};

export async function listPersonnel(): Promise<Personnel[]> {
  const result = await executeAdmin<{ personnel: Personnel[] }>({ action: 'list-personnel' });
  return result.personnel;
}

/** Server-side ACL — client SDK cannot grant other users read/update on documents. */
export async function syncJobCardPermissions(input: {
  documentId: string;
  ownerId: string;
  assigneeIds: string[];
}): Promise<void> {
  await executeAdmin<Record<string, never>>({
    action: 'sync-job-permissions',
    documentId: input.documentId,
    ownerId: input.ownerId,
    assigneeIds: input.assigneeIds,
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
  });
}

/** Server-side ACL for recap log — client cannot set label:admin or other users on create. */
export async function syncJobRecapPermissions(input: {
  documentId: string;
  ownerId: string;
  readerIds: string[];
}): Promise<void> {
  await executeAdmin<Record<string, never>>({
    action: 'sync-recap-permissions',
    documentId: input.documentId,
    ownerId: input.ownerId,
    readerIds: input.readerIds,
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobRecapsCollectionId,
  });
}

/** Server-side delete when client ACL lacks delete permission. */
export async function deleteClientViaAdmin(input: {
  documentId: string;
  collectionId: string;
}): Promise<void> {
  await executeAdmin<Record<string, never>>({
    action: 'delete-client',
    documentId: input.documentId,
    databaseId: appwriteConfig.databaseId,
    collectionId: input.collectionId,
  });
}

export async function deleteJobCardViaAdmin(input: {
  documentId: string;
  ownerId: string;
  assigneeIds: string[];
  reviewStatus?: string;
  status?: string;
  lockedAt?: string | null;
}): Promise<void> {
  await executeAdmin<Record<string, never>>({
    action: 'delete-job-card',
    documentId: input.documentId,
    ownerId: input.ownerId,
    assigneeIds: input.assigneeIds,
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.jobCardsCollectionId,
    reviewStatus: input.reviewStatus ?? 'none',
    status: input.status ?? '',
    lockedAt: input.lockedAt ?? '',
  });
}
