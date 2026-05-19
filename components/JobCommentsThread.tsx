import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth, useJobCards } from '../context/JobCardsContext';
import { addComment, listComments, type JobComment } from '../lib/appwrite/comments';
import { notifyComment } from '../lib/notifyEvents';

interface Props {
  jobId: string;
}

export function JobCommentsThread({ jobId }: Props) {
  const { user, isAdmin } = useAuth();
  const { getJobCard } = useJobCards();
  const [items, setItems] = useState<JobComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

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
        notifyComment(job, { id: user.$id, name: user.name || user.email, isAdmin }, created.body).catch(() => undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to post comment.';
      Alert.alert('Comment', message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Comments</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : items.length === 0 ? (
        <Text style={styles.dim}>No comments yet.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((c) => (
            <View key={c.id} style={styles.bubble}>
              <View style={styles.bubbleHeader}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={12} color={colors.black} />
                </View>
                <Text style={styles.author}>{c.authorName}</Text>
                <Text style={styles.time}>{new Date(c.createdAt).toLocaleString()}</Text>
              </View>
              <Text style={styles.body}>{c.body}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Add a comment, observation, or follow-up note…"
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
  list: { gap: spacing.sm },
  bubble: {
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
  },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  author: { ...typography.caption, color: colors.black, fontWeight: '700' },
  time: { ...typography.caption, color: colors.grey400, fontSize: 11, marginLeft: 'auto' },
  body: { ...typography.body, color: colors.black, fontSize: 14 },
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
