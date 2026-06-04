import { appwriteConfig } from './config';
import { getDatabases } from './client';
import { deleteClientViaAdmin } from './adminUsers';

export async function deleteClientDocument(collectionId: string, documentId: string): Promise<void> {
  try {
    await getDatabases().deleteDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId,
      documentId,
    });
    return;
  } catch {
    await deleteClientViaAdmin({ documentId, collectionId });
  }
}
