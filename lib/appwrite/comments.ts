import { ID, Query } from 'react-native-appwrite';
import { collectCommentSubtreeIds } from '../jobCommentThreads';
import { appwriteConfig, isAppwriteDatabaseConfigured } from './config';
import { getDatabases } from './client';

const COLLECTION_ID = 'job_comments';

export interface JobComment {
  id: string;
  jobId: string;
  authorId: string;
  authorName: string;
  body: string;
  parentId: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentDoc {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  jobId: string;
  authorId: string;
  authorName: string;
  body: string;
  parentId?: string;
}

function toComment(doc: CommentDoc): JobComment {
  return {
    id: doc.$id,
    jobId: doc.jobId,
    authorId: doc.authorId,
    authorName: doc.authorName,
    body: doc.body,
    parentId: doc.parentId?.trim() || '',
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export function isCommentEdited(comment: JobComment): boolean {
  return new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000;
}

export function canManageComment(comment: JobComment, userId: string | undefined, isAdmin: boolean): boolean {
  if (!userId) return false;
  return comment.authorId === userId || isAdmin;
}

export async function listComments(jobId: string): Promise<JobComment[]> {
  if (!isAppwriteDatabaseConfigured()) return [];
  const response = await getDatabases().listDocuments({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    queries: [Query.equal('jobId', jobId), Query.orderAsc('$createdAt'), Query.limit(200)],
  });
  return response.documents.map((d) => toComment(d as unknown as CommentDoc));
}

export async function addComment(input: {
  jobId: string;
  authorId: string;
  authorName: string;
  body: string;
  parentId?: string;
}): Promise<JobComment> {
  const parentId = input.parentId?.trim() || '';
  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: {
      jobId: input.jobId,
      authorId: input.authorId,
      authorName: input.authorName,
      body: input.body.trim(),
      parentId,
    },
  });
  return toComment(doc as unknown as CommentDoc);
}

export async function updateComment(commentId: string, body: string): Promise<JobComment> {
  const doc = await getDatabases().updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: commentId,
    data: { body: body.trim() },
  });
  return toComment(doc as unknown as CommentDoc);
}

export async function deleteComment(commentId: string, comments?: JobComment[]): Promise<void> {
  const ids = comments?.length ? collectCommentSubtreeIds(commentId, comments) : [commentId];
  for (const id of ids) {
    await getDatabases().deleteDocument({
      databaseId: appwriteConfig.databaseId,
      collectionId: COLLECTION_ID,
      documentId: id,
    });
  }
}
