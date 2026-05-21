/** User-facing sync / connection labels (never show vendor names like Appwrite). */

export function homeConnectionLabel(input: {
  syncing: boolean;
  usingCache: boolean;
}): string {
  if (input.syncing) return 'Syncing…';
  if (input.usingCache) return 'Cached · offline';
  return 'Online';
}
