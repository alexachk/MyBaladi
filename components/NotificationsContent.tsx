import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useNotifications } from '../context/NotificationsContext';
import type { AppNotification, NotificationType } from '../lib/appwrite/notifications';

const TYPE_META: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  job_created: { icon: 'add-circle-outline', color: colors.info },
  job_assigned: { icon: 'person-add-outline', color: colors.info },
  job_updated: { icon: 'pencil-outline', color: colors.warning },
  job_started: { icon: 'play-circle-outline', color: colors.info },
  job_finished: { icon: 'stop-circle-outline', color: colors.warning },
  job_signed: { icon: 'lock-closed-outline', color: colors.success },
  job_reopened: { icon: 'lock-open-outline', color: colors.warning },
  job_commented: { icon: 'chatbubble-outline', color: colors.info },
};

interface NotificationsContentProps {
  onClose?: () => void;
}

export function NotificationsContent({ onClose }: NotificationsContentProps) {
  const { items, loading, refresh, markRead, markAllRead, remove, unread } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpen = async (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    onClose?.();
    if (n.jobId) router.push(`/job/${n.jobId}`);
  };

  const handleLongPress = (n: AppNotification) => {
    Alert.alert('Notification', undefined, [
      n.read
        ? { text: 'Mark unread', onPress: () => undefined }
        : { text: 'Mark read', onPress: () => markRead(n.id) },
      { text: 'Delete', style: 'destructive', onPress: () => remove(n.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={36} color={colors.grey400} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            You'll see updates here when new jobs are assigned, started, finished, or commented on.
          </Text>
        </View>
      ) : (
        items.map((n) => {
          const meta = TYPE_META[n.type];
          return (
            <Pressable
              key={n.id}
              onPress={() => handleOpen(n)}
              onLongPress={() => handleLongPress(n)}
              style={({ pressed }) => [styles.row, !n.read && styles.rowUnread, pressed && styles.pressed]}
            >
              <View style={[styles.icon, { backgroundColor: `${meta.color}22` }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={styles.bodyWrap}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {n.title}
                  </Text>
                  {!n.read ? <View style={styles.dot} /> : null}
                </View>
                {n.body ? (
                  <Text style={styles.body} numberOfLines={2}>
                    {n.body}
                  </Text>
                ) : null}
                <Text style={styles.time}>
                  {new Date(n.createdAt).toLocaleString()}
                  {n.jobReference ? ` · ${n.jobReference}` : ''}
                </Text>
              </View>
              {n.jobId ? <Ionicons name="chevron-forward" size={16} color={colors.grey400} /> : null}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

export function NotificationsHeader({
  onClose,
  unread,
  onMarkAllRead,
}: {
  onClose: () => void;
  unread: number;
  onMarkAllRead: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={22} color={colors.black} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        Notifications
      </Text>
      {unread > 0 ? (
        <Pressable onPress={onMarkAllRead} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.markAll}>Mark all read</Text>
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyTitle: { ...typography.subheading, color: colors.black },
  emptyText: { ...typography.body, color: colors.grey600, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  rowUnread: { borderColor: colors.primary, backgroundColor: '#FFFDF5' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyWrap: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.subheading, color: colors.black, fontSize: 14, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  body: { ...typography.body, color: colors.grey600, fontSize: 13 },
  time: { ...typography.caption, color: colors.grey400, fontSize: 11, marginTop: 2 },
  pressed: { opacity: 0.7 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
    backgroundColor: colors.white,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.navTitle, color: colors.black, flex: 1 },
  headerSpacer: { width: 88 },
  markAll: { ...typography.caption, color: colors.info, fontWeight: '700' },
});
