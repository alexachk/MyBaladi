import { Client } from 'node-appwrite';
import { APPWRITE, requireApiKey } from './config.mjs';

export function createAdminClient() {
  requireApiKey();
  return new Client()
    .setEndpoint(APPWRITE.endpoint)
    .setProject(APPWRITE.projectId)
    .setKey(APPWRITE.apiKey);
}
