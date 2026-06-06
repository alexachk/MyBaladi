import type { JobComment } from './appwrite/comments';

export interface CommentThreadNode {
  comment: JobComment;
  replies: CommentThreadNode[];
}

function parentKey(comment: JobComment): string {
  return comment.parentId?.trim() || '';
}

export function buildCommentThreads(comments: JobComment[]): CommentThreadNode[] {
  const byParent = new Map<string, JobComment[]>();
  for (const comment of comments) {
    const key = parentKey(comment);
    const bucket = byParent.get(key);
    if (bucket) bucket.push(comment);
    else byParent.set(key, [comment]);
  }

  const sortAsc = (list: JobComment[]) =>
    [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const build = (parentId: string): CommentThreadNode[] =>
    sortAsc(byParent.get(parentId) ?? []).map((comment) => ({
      comment,
      replies: build(comment.id),
    }));

  return build('');
}

export function collectCommentSubtreeIds(rootId: string, comments: JobComment[]): string[] {
  const ids: string[] = [];
  const walk = (id: string) => {
    ids.push(id);
    for (const child of comments.filter((c) => c.parentId === id)) {
      walk(child.id);
    }
  };
  walk(rootId);
  return ids;
}

export interface FlatReplyRow {
  comment: JobComment;
  /** Set when replying to someone other than the thread root. */
  replyToName?: string;
}

/** All replies under a root, single visual level (nested replies stay chronological + @context). */
export function flattenThreadRepliesWithNames(
  root: CommentThreadNode,
  commentsById: Map<string, JobComment>,
): FlatReplyRow[] {
  const rows: FlatReplyRow[] = [];
  const walk = (nodes: CommentThreadNode[]) => {
    for (const node of nodes) {
      const parent = commentsById.get(node.comment.parentId);
      const replyToName =
        parent && parent.id !== root.comment.id ? parent.authorName : undefined;
      rows.push({ comment: node.comment, replyToName });
      walk(node.replies);
    }
  };
  walk(root.replies);
  return rows;
}

export function commentBelongsToThread(
  commentId: string,
  rootId: string,
  commentsById: Map<string, JobComment>,
): boolean {
  let id: string | undefined = commentId;
  while (id) {
    if (id === rootId) return true;
    const comment = commentsById.get(id);
    id = comment?.parentId || undefined;
    if (!id) return false;
  }
  return false;
}

export function flattenCommentThreads(nodes: CommentThreadNode[]): JobComment[] {
  const out: JobComment[] = [];
  const walk = (list: CommentThreadNode[]) => {
    for (const node of list) {
      out.push(node.comment);
      walk(node.replies);
    }
  };
  walk(nodes);
  return out;
}
