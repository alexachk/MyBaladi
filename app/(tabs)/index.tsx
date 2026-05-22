import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaladiLogo } from '../../components/BaladiLogo';
import { EdgeSwipeOpener } from '../../components/EdgeSwipeOpener';
import { NotificationsPanel } from '../../components/NotificationsPanel';
import { JobCardItem } from '../../components/JobCardItem';
import { MachineryBackground } from '../../components/MachineryBackground';
import { StatCard } from '../../components/PrimaryButton';
import { homeConnectionLabel } from '../../constants/connection';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { todayIsoDate } from '../../utils/formatDate';

export default function HomeScreen() {
  const { user, logout, isConfigured } = useAuth();
  const { jobCards, loading, syncing, isRemote, usingCache, refresh } = useJobCards();
  const { unread, refresh: refreshNotifications } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const today = todayIsoDate();

  const activeCount = jobCards.filter(
    (job) => job.status === 'in_progress' || job.status === 'pending_review',
  ).length;
  const completedToday = jobCards.filter(
    (job) => job.status === 'completed' && job.scheduledDate === today,
  ).length;
  const draftCount = jobCards.filter((job) => job.status === 'draft').length;
  const recentJobs = jobCards.slice(0, 3);

  const greeting = getGreeting();
  const displayName = user?.name?.split(' ')[0] ?? 'there';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), refreshNotifications()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MachineryBackground opacity={0.14} position="bottom" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topBar}>
          <BaladiLogo variant="compact" size={layout.logoCompact} />
          <View style={styles.topBarActions}>
            <Pressable
              onPress={() => setNotificationsOpen(true)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityLabel="Open notifications"
            >
              <Ionicons name="notifications-outline" size={layout.iconSm} color={colors.grey600} />
              {unread > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
                </View>
              ) : null}
            </Pressable>
            {isConfigured && user ? (
              <Pressable
                onPress={() => logout()}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                hitSlop={8}
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={layout.iconSm} color={colors.grey600} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting} numberOfLines={2} allowFontScaling={false}>
            {greeting}, {displayName}
          </Text>
          <Text style={styles.greetingSub}>Here is what is happening today.</Text>
          <View style={styles.statusRow}>
            {isRemote ? (
              <View style={[styles.pill, usingCache ? styles.pillWarn : styles.pillSuccess]}>
                <View
                  style={[
                    styles.pillDot,
                    { backgroundColor: usingCache ? colors.warning : colors.success },
                  ]}
                />
                <Text style={[styles.pillText, { color: usingCache ? colors.warning : colors.success }]}>
                  {homeConnectionLabel({ syncing, usingCache })}
                </Text>
              </View>
            ) : (
              <View style={[styles.pill, styles.pillNeutral]}>
                <Ionicons name="cloud-offline-outline" size={12} color={colors.grey600} />
                <Text style={[styles.pillText, { color: colors.grey600 }]}>Not connected</Text>
              </View>
            )}
            <Text style={styles.todayText}>{formatToday()}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard
                label="Active"
                value={activeCount}
                icon="construct-outline"
                tint={colors.info}
              />
              <StatCard
                label="Done today"
                value={completedToday}
                icon="checkmark-done-outline"
                tint={colors.success}
              />
              <StatCard
                label="Drafts"
                value={draftCount}
                icon="document-text-outline"
                tint={colors.warning}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent missions</Text>
              {jobCards.length > 0 ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/jobs')}
                  hitSlop={8}
                  style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.linkText}>View all</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.black} />
                </Pressable>
              ) : null}
            </View>

            {recentJobs.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="clipboard-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No job cards yet</Text>
                <Text style={styles.emptyText}>
                  Create a new mission from the Job Cards tab.
                </Text>
              </View>
            ) : (
              recentJobs.map((job) => (
                <JobCardItem
                  key={job.id}
                  job={job}
                  onPress={() => router.push(`/job/${job.id}`)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
      <EdgeSwipeOpener edge="right" onOpen={() => setNotificationsOpen(true)} />
      <NotificationsPanel visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: layout.iconButtonSize / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  bellBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  pressed: {
    opacity: 0.7,
  },
  greetingBlock: {
    gap: spacing.xs,
  },
  greeting: {
    ...typography.screenTitle,
    color: colors.black,
  },
  greetingSub: {
    ...typography.body,
    color: colors.grey600,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillSuccess: {
    backgroundColor: colors.successLight,
  },
  pillWarn: {
    backgroundColor: colors.warningLight,
  },
  pillNeutral: {
    backgroundColor: colors.grey100,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '600',
  },
  todayText: {
    ...typography.caption,
    color: colors.grey400,
  },
  loader: {
    marginTop: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.black,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    ...typography.subheading,
    color: colors.black,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.subheading,
    color: colors.black,
  },
  emptyText: {
    ...typography.body,
    color: colors.grey600,
    textAlign: 'center',
  },
});
