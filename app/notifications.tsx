import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function NotificationsScreen() {
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerBackTitle: 'Back',
          headerRight: () =>
            unread > 0 ? (
              <Pressable onPress={markAllRead} hitSlop={10} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Mark all read</Text>
              </Pressable>
            ) : null,
        }}
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
                  style={({ pressed }) => [
                    styles.row,
                    !n.read && styles.rowUnread,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: `${meta.color}22` }]}>
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
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
                  {n.jobId ? (
                    <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyTitle: { ...typography.subheading, color: colors.black },
  emptyText: { ...typography.body, color: colors.grey600 },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.subheading, color: colors.black, fontSize: 14, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  body: { ...typography.body, color: colors.grey600, fontSize: 13 },
  time: { ...typography.caption, color: colors.grey400, fontSize: 11, marginTop: 2 },
  headerBtn: { paddingHorizontal: spacing.md },
  headerBtnText: { ...typography.caption, color: colors.info, fontWeight: '700' },
  pressed: { opacity: 0.9 },
});
