import { ID, Permission, Query, Role } from 'react-native-appwrite';
import { appwriteConfig, isAppwriteDatabaseConfigured } from './config';
import { getDatabases } from './client';

const COLLECTION_ID = 'notifications';

export type NotificationType =
  | 'job_created'
  | 'job_assigned'
  | 'job_updated'
  | 'job_started'
  | 'job_finished'
  | 'job_signed'
  | 'job_reopened'
  | 'job_commented';

export type RecipientScope = 'user' | 'admin';

export interface AppNotification {
  id: string;
  recipientScope: RecipientScope;
  recipientUserId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  jobId: string | null;
  jobReference: string | null;
  actorId: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationDoc {
  $id: string;
  $createdAt: string;
  recipientScope: RecipientScope;
  recipientUserId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  jobId?: string;
  jobReference?: string;
  actorId?: string;
  actorName?: string;
  read?: boolean;
}

function toNotification(doc: NotificationDoc): AppNotification {
  return {
    id: doc.$id,
    recipientScope: doc.recipientScope,
    recipientUserId: doc.recipientUserId || null,
    type: doc.type,
    title: doc.title,
    body: doc.body ?? '',
    jobId: doc.jobId || null,
    jobReference: doc.jobReference || null,
    actorId: doc.actorId || null,
    actorName: doc.actorName || null,
    read: Boolean(doc.read),
    createdAt: doc.$createdAt,
  };
}

export interface CreateNotificationInput {
  recipientScope: RecipientScope;
  recipientUserId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  jobId?: string;
  jobReference?: string;
  actorId?: string;
  actorName?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<AppNotification | null> {
  if (!isAppwriteDatabaseConfigured()) return null;

  const permissions: string[] = [
    Permission.read(Role.label('admin')),
    Permission.update(Role.label('admin')),
    Permission.delete(Role.label('admin')),
  ];

  if (input.recipientScope === 'user' && input.recipientUserId) {
    permissions.push(Permission.read(Role.user(input.recipientUserId)));
    permissions.push(Permission.update(Role.user(input.recipientUserId)));
    permissions.push(Permission.delete(Role.user(input.recipientUserId)));
  }
  // admin scope is already readable by label:admin

  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: {
      recipientScope: input.recipientScope,
      recipientUserId: input.recipientUserId ?? '',
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      jobId: input.jobId ?? '',
      jobReference: input.jobReference ?? '',
      actorId: input.actorId ?? '',
      actorName: input.actorName ?? '',
      read: false,
    },
    permissions,
  });

  return toNotification(doc as unknown as NotificationDoc);
}

export async function listNotificationsFor(opts: {
  userId: string;
  isAdmin: boolean;
}): Promise<AppNotification[]> {
  if (!isAppwriteDatabaseConfigured()) return [];

  const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
  if (opts.isAdmin) {
    queries.unshift(
      Query.or([
        Query.equal('recipientUserId', opts.userId),
        Query.equal('recipientScope', 'admin'),
      ]),
    );
  } else {
    queries.unshift(Query.equal('recipientUserId', opts.userId));
  }

  const response = await getDatabases().listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    queries,
  });

  return response.documents.map((d) => toNotification(d as unknown as NotificationDoc));
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
    data: { read },
  });
}

export async function deleteNotification(id: string): Promise<void> {
  await getDatabases().deleteDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: id,
  });
}

export function notificationsChannel(): string {
  return `databases.${appwriteConfig.databaseId}.collections.${COLLECTION_ID}.documents`;
}
