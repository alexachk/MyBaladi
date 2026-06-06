import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth, useJobCards } from '../context/JobCardsContext';
import {
  addComment,
  canManageComment,
  deleteComment,
  isCommentEdited,
  listComments,
  updateComment,
  type JobComment,
} from '../lib/appwrite/comments';
import {
  buildCommentThreads,
  collectCommentSubtreeIds,
  commentBelongsToThread,
  flattenThreadRepliesWithNames,
  type CommentThreadNode,
} from '../lib/jobCommentThreads';
import { notifyComment } from '../lib/notifyEvents';

interface Props {
  jobId: string;
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function JobCommentsThread({ jobId }: Props) {
  const { user, isAdmin } = useAuth();
  const { getJobCard } = useJobCards();
  const [items, setItems] = useState<JobComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<JobComment | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);

  const threads = useMemo(() => buildCommentThreads(items), [items]);
  const commentsById = useMemo(() => new Map(items.map((c) => [c.id, c])), [items]);

  const load = useCallback(async () => {
    try {
      setItems(await listComments(jobId));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePost = async () => {
    if (!body.trim() || !user) return;
    setPosting(true);
    try {
      const created = await addComment({
        jobId,
        authorId: user.$id,
        authorName: user.name || user.email,
        body,
      });
      setItems((prev) => [...prev, created]);
      setBody('');

      const job = getJobCard(jobId);
      if (job) {
        notifyComment(job, { id: user.$id, name: user.name || user.email, isAdmin }, created.body).catch(
          () => undefined,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to post comment.';
      Alert.alert('Comment', message);
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !user || !replyTarget) return;
    setReplyPosting(true);
    try {
      const created = await addComment({
        jobId,
        authorId: user.$id,
        authorName: user.name || user.email,
        body: replyBody,
        parentId: replyTarget.id,
      });
      setItems((prev) => [...prev, created]);
      setReplyBody('');
      setReplyTarget(null);

      const job = getJobCard(jobId);
      if (job) {
        notifyComment(
          job,
          { id: user.$id, name: user.name || user.email, isAdmin },
          created.body,
          { authorName: replyTarget.authorName },
        ).catch(() => undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to post reply.';
      Alert.alert('Comment', message);
    } finally {
      setReplyPosting(false);
    }
  };

  const startEdit = (comment: JobComment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
    setReplyTarget(null);
    setReplyBody('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editBody.trim()) return;
    setSavingId(commentId);
    try {
      const updated = await updateComment(commentId, editBody);
      setItems((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      cancelEdit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update comment.';
      Alert.alert('Comment', message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = (comment: JobComment) => {
    const hasReplies = items.some((c) => c.parentId === comment.id);
    Alert.alert(
      'Delete comment',
      hasReplies ? 'Remove this comment and all replies?' : 'Remove this comment permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const removeIds = new Set(collectCommentSubtreeIds(comment.id, items));
                await deleteComment(comment.id, items);
                setItems((prev) => prev.filter((c) => !removeIds.has(c.id)));
                if (editingId && removeIds.has(editingId)) cancelEdit();
                if (replyTarget && removeIds.has(replyTarget.id)) {
                  setReplyTarget(null);
                  setReplyBody('');
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Unable to delete comment.';
                Alert.alert('Comment', message);
              }
            })();
          },
        },
      ],
    );
  };

  const startReply = (comment: JobComment) => {
    setReplyTarget(comment);
    setReplyBody('');
    cancelEdit();
  };

  const formatMeta = (comment: JobComment) => {
    const time = shortTime(comment.createdAt);
    return isCommentEdited(comment) ? `${time} · edited` : time;
  };

  const renderActions = (comment: JobComment) => {
    if (!canManageComment(comment, user?.$id, isAdmin) || editingId === comment.id) return null;
    return (
      <View style={styles.actions}>
        <Pressable onPress={() => startEdit(comment)} hitSlop={8} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <Ionicons name="pencil-outline" size={13} color={colors.grey600} />
        </Pressable>
        <Pressable onPress={() => handleDelete(comment)} hitSlop={8} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <Ionicons name="trash-outline" size={13} color={colors.grey600} />
        </Pressable>
      </View>
    );
  };

  const renderEditBlock = (commentId: string) => (
    <View style={styles.editBlock}>
      <TextInput value={editBody} onChangeText={setEditBody} multiline autoFocus style={styles.editInput} />
      <View style={styles.editActions}>
        <Pressable onPress={cancelEdit} disabled={savingId === commentId} style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
          <Text style={styles.editBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleSaveEdit(commentId)}
          disabled={!editBody.trim() || savingId === commentId}
          style={({ pressed }) => [
            styles.editBtn,
            styles.editBtnPrimary,
            (!editBody.trim() || savingId === commentId) && styles.editBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          {savingId === commentId ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Text style={styles.editBtnTextPrimary}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  const renderReplyComposer = () => (
    <View style={styles.replyComposer}>
      <Text style={styles.replyingTo} numberOfLines={1}>
        Reply to {replyTarget?.authorName}
      </Text>
      <View style={styles.replyRow}>
        <TextInput
          value={replyBody}
          onChangeText={setReplyBody}
          placeholder="Write a reply…"
          placeholderTextColor={colors.grey400}
          multiline
          autoFocus
          style={styles.replyInput}
        />
        <Pressable
          onPress={() => void handleReply()}
          disabled={!replyBody.trim() || replyPosting}
          style={({ pressed }) => [
            styles.sendBtn,
            styles.replySendBtn,
            (!replyBody.trim() || replyPosting) && styles.sendBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="send" size={14} color={colors.black} />
        </Pressable>
      </View>
      <Pressable onPress={() => { setReplyTarget(null); setReplyBody(''); }} style={styles.cancelReply}>
        <Text style={styles.cancelReplyText}>Cancel</Text>
      </Pressable>
    </View>
  );

  const renderRoot = (comment: JobComment) => {
    const editing = editingId === comment.id;
    return (
      <View style={styles.rootBubble}>
        <View style={styles.metaRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={11} color={colors.black} />
          </View>
          <Text style={styles.author} numberOfLines={1}>
            {comment.authorName}
          </Text>
          <Text style={styles.metaTime}>{formatMeta(comment)}</Text>
          {renderActions(comment)}
        </View>
        {editing ? renderEditBlock(comment.id) : <Text style={styles.rootBody}>{comment.body}</Text>}
        {!editing && user ? (
          <Pressable onPress={() => startReply(comment)} style={({ pressed }) => [styles.replyLink, pressed && styles.pressed]}>
            <Text style={styles.replyLinkText}>Reply</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderReply = (comment: JobComment, replyToName?: string) => {
    const editing = editingId === comment.id;
    return (
      <View key={comment.id} style={styles.replyRowWrap}>
        <View style={styles.metaRow}>
          {replyToName ? (
            <Text style={styles.replyTo} numberOfLines={1}>
              @{replyToName}
            </Text>
          ) : null}
          <Text style={styles.replyAuthor} numberOfLines={1}>
            {comment.authorName}
          </Text>
          <Text style={styles.metaTime}>{formatMeta(comment)}</Text>
          {renderActions(comment)}
        </View>
        {editing ? renderEditBlock(comment.id) : <Text style={styles.replyBody}>{comment.body}</Text>}
        {!editing && user ? (
          <Pressable onPress={() => startReply(comment)} style={({ pressed }) => [styles.replyLink, pressed && styles.pressed]}>
            <Text style={styles.replyLinkText}>Reply</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderThread = (thread: CommentThreadNode) => {
    const replies = flattenThreadRepliesWithNames(thread, commentsById);
    const showComposer =
      replyTarget !== null && commentBelongsToThread(replyTarget.id, thread.comment.id, commentsById);

    return (
      <View key={thread.comment.id} style={styles.thread}>
        {renderRoot(thread.comment)}
        {replies.length > 0 ? (
          <View style={styles.repliesBlock}>
            {replies.map((row) => renderReply(row.comment, row.replyToName))}
          </View>
        ) : null}
        {showComposer ? renderReplyComposer() : null}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Discussion</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : items.length === 0 ? (
        <Text style={styles.dim}>No comments yet.</Text>
      ) : (
        <View style={styles.list}>{threads.map((thread) => renderThread(thread))}</View>
      )}

      <View style={styles.composer}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Start the discussion…"
          placeholderTextColor={colors.grey400}
          multiline
          style={styles.input}
        />
        <Pressable
          onPress={handlePost}
          disabled={!body.trim() || posting}
          style={({ pressed }) => [
            styles.sendBtn,
            (!body.trim() || posting) && styles.sendBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="send" size={16} color={colors.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.subheading, color: colors.black },
  dim: { ...typography.caption, color: colors.grey400 },
  list: { gap: spacing.md },
  thread: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    overflow: 'hidden',
  },
  rootBubble: {
    backgroundColor: colors.grey100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  author: { ...typography.caption, color: colors.black, fontWeight: '700', flexShrink: 1 },
  replyAuthor: { ...typography.caption, color: colors.black, fontWeight: '600', flexShrink: 1, fontSize: 12 },
  replyTo: { ...typography.caption, color: colors.info, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  metaTime: { ...typography.caption, color: colors.grey400, fontSize: 10, marginLeft: 'auto' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 },
  actionBtn: { padding: 2 },
  rootBody: { ...typography.body, color: colors.black, fontSize: 14, lineHeight: 20 },
  repliesBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
    backgroundColor: colors.white,
  },
  replyRowWrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
  },
  replyBody: { ...typography.body, color: colors.black, fontSize: 13, lineHeight: 18 },
  replyLink: { alignSelf: 'flex-start', paddingTop: 2 },
  replyLinkText: { ...typography.caption, color: colors.grey600, fontSize: 11, fontWeight: '600' },
  replyComposer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
    backgroundColor: colors.grey100,
  },
  replyingTo: { ...typography.caption, color: colors.grey600, fontSize: 11 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  replyInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 88,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.black,
  },
  replySendBtn: { width: 34, height: 34, borderRadius: 17 },
  cancelReply: { alignSelf: 'flex-start' },
  cancelReplyText: { ...typography.caption, color: colors.grey600, fontSize: 11 },
  editBlock: { gap: spacing.xs },
  editInput: {
    minHeight: 56,
    maxHeight: 120,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.black,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  editBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
    minWidth: 64,
    alignItems: 'center',
  },
  editBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  editBtnDisabled: { opacity: 0.45 },
  editBtnText: { ...typography.caption, color: colors.black, fontWeight: '600', fontSize: 11 },
  editBtnTextPrimary: { ...typography.caption, color: colors.black, fontWeight: '700', fontSize: 11 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.grey100,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.black,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
