import type { Models } from 'react-native-appwrite';
import { getRoleLevel } from '../constants/positions';
import { getEffectivePosition, isAdminLabelUser, isAppDevUser } from './appwrite/auth';

/** Level 2+ (Supervisor, Operations Manager), admin label, or App Dev. */
export function canDeleteClient(
  user: Models.User<Models.Preferences> | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppDevUser(user) || isAdminLabelUser(user)) return true;
  const level = getRoleLevel(getEffectivePosition(user));
  return level !== null && level >= 2;
}
