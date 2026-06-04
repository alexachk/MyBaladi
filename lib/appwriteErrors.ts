/** Pull a readable message from Appwrite SDK errors (RN + node). */
export function formatAppwriteError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? error : 'Request failed.';
  }
  const row = error as Record<string, unknown>;
  const message = typeof row.message === 'string' ? row.message : '';
  const response =
    row.response && typeof row.response === 'object'
      ? (row.response as Record<string, unknown>)
      : null;
  const responseMessage =
    typeof response?.message === 'string'
      ? response.message
      : typeof row.response === 'string'
        ? row.response
        : '';

  const combined = [message, responseMessage].filter(Boolean).join(' · ');
  if (!combined) return 'Request failed.';

  if (/valid enum|enum value/i.test(combined)) {
    return 'Invalid field value. If you used a manual client name only, save again after this update.';
  }
  if (/maximum size|longer than|exceed|too long|length/i.test(combined)) {
    return 'Job data is too large for storage (contacts, visits, or work report). Try fewer site contacts or shorter notes.';
  }
  if (/permissions must be one of/i.test(combined)) {
    return 'Job save blocked by Appwrite permissions. Reload the app (Expo: shake → Reload), then try again. If it persists, run npm run appwrite:sync-functions.';
  }
  return combined;
}
