import { getAccount } from './client';

function readTokens(prefs: Record<string, unknown> | undefined): string[] {
  if (!prefs) return [];
  if (Array.isArray(prefs.expoPushTokens)) {
    return prefs.expoPushTokens.map(String).filter(Boolean);
  }
  if (typeof prefs.expoPushToken === 'string' && prefs.expoPushToken) {
    return [prefs.expoPushToken];
  }
  return [];
}

export async function syncExpoPushToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;

  const account = getAccount();
  const user = await account.get();
  const prefs = { ...(user.prefs ?? {}) } as Record<string, unknown>;
  const tokens = readTokens(prefs);
  if (tokens.includes(trimmed)) return;

  await account.updatePrefs({
    ...prefs,
    expoPushTokens: [...tokens, trimmed],
  });
}
