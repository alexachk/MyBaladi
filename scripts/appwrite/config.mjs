export const APPWRITE = {
  endpoint: process.env.APPWRITE_ENDPOINT ?? 'https://fra.cloud.appwrite.io/v1',
  projectId: process.env.APPWRITE_PROJECT_ID ?? '6a0b77a0003989203e03',
  apiKey: process.env.APPWRITE_API_KEY ?? '',
  databaseId: process.env.APPWRITE_DATABASE_ID ?? '6a0b7bf6002a5babff7c',
  jobCardsCollectionId: process.env.APPWRITE_JOB_CARDS_COLLECTION_ID ?? 'job_cards',
};

export function requireApiKey() {
  if (!APPWRITE.apiKey) {
    throw new Error(
      'Missing APPWRITE_API_KEY in .env — create one in Appwrite Console → Settings → API Keys',
    );
  }
}
