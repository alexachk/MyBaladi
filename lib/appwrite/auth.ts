import { Models } from 'react-native-appwrite';
import { getAccount, isAppwriteConfigured } from './client';

export const ADMIN_LABEL = 'admin';
export const APP_DEV_LABEL = 'appdev';

export const MANAGEMENT_LABELS = [ADMIN_LABEL, APP_DEV_LABEL] as const;

export async function getCurrentSessionUser(): Promise<Models.User<Models.Preferences> | null> {
  if (!isAppwriteConfigured()) return null;
  try {
    return await getAccount().get();
  } catch {
    return null;
  }
}

export async function loginWithEmail(email: string, password: string) {
  await getAccount().createEmailPasswordSession({ email, password });
  return getAccount().get();
}

export async function logout() {
  await getAccount().deleteSession({ sessionId: 'current' });
}

export function userHasLabel(
  user: Models.User<Models.Preferences> | null | undefined,
  label: string,
): boolean {
  if (!user) return false;
  return Array.isArray(user.labels) && user.labels.includes(label);
}

export function isAdminLabelUser(user: Models.User<Models.Preferences> | null | undefined): boolean {
  return userHasLabel(user, ADMIN_LABEL);
}

export function isAppDevUser(user: Models.User<Models.Preferences> | null | undefined): boolean {
  return userHasLabel(user, APP_DEV_LABEL);
}

/** Admin tab, account console, and all-job visibility — App Dev only. */
export function hasManagementAccess(
  user: Models.User<Models.Preferences> | null | undefined,
): boolean {
  return isAppDevUser(user);
}

/** Role shown in UI — App Dev label wins over prefs.position. */
export function getEffectivePosition(
  user: Models.User<Models.Preferences> | null | undefined,
): string {
  if (isAppDevUser(user)) return 'App Dev';
  const prefs = user?.prefs as { position?: string } | undefined;
  return prefs?.position ?? '';
}

/** @deprecated use hasManagementAccess — kept for existing call sites */
export function isAdminUser(user: Models.User<Models.Preferences> | null | undefined): boolean {
  return hasManagementAccess(user);
}

export function accountHasLabel(labels: string[] | undefined, label: string): boolean {
  return Array.isArray(labels) && labels.includes(label);
}
