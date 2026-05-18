import { getAppwriteClient } from './client';

/** Verifies Appwrite endpoint + project connectivity on app launch. */
export function verifyAppwriteSetup(): void {
  void getAppwriteClient()
    .ping()
    .then((response: unknown) => {
      console.log('[Appwrite] Ping successful:', response);
    })
    .catch((error: unknown) => {
      console.warn('[Appwrite] Ping failed:', error);
    });
}
