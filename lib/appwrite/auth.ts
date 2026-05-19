import { Models } from 'react-native-appwrite';
import { getAccount, isAppwriteConfigured } from './client';

export const ADMIN_LABEL = 'admin';

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

export function isAdminUser(user: Models.User<Models.Preferences> | null | undefined): boolean {
  if (!user) return false;
  return Array.isArray(user.labels) && user.labels.includes(ADMIN_LABEL);
}
