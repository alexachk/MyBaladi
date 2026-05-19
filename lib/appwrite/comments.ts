import { ID, Query } from 'react-native-appwrite';
import { appwriteConfig, isAppwriteDatabaseConfigured } from './config';
import { getDatabases } from './client';

const COLLECTION_ID = 'job_comments';

export interface JobComment {
  id: string;
  jobId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface CommentDoc {
  $id: string;
  $createdAt: string;
  jobId: string;
  authorId: string;
  authorName: string;
  body: string;
}

function toComment(doc: CommentDoc): JobComment {
  return {
    id: doc.$id,
    jobId: doc.jobId,
    authorId: doc.authorId,
    authorName: doc.authorName,
    body: doc.body,
    createdAt: doc.$createdAt,
  };
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
}): Promise<JobComment> {
  const doc = await getDatabases().createDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: {
      jobId: input.jobId,
      authorId: input.authorId,
      authorName: input.authorName,
      body: input.body.trim(),
    },
  });
  return toComment(doc as unknown as CommentDoc);
}
