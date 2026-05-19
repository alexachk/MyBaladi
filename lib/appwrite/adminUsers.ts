import { getAppwriteClient } from './client';
import { ADMIN_USERS_FUNCTION_ID, APPWRITE_ENDPOINT } from './config';

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
    throw new Error(execution.errors || 'Function execution failed.');
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
