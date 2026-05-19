import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaladiLogo } from '../../components/BaladiLogo';
import { ClientsSidebar } from '../../components/ClientsSidebar';
import { EdgeSwipeOpener } from '../../components/EdgeSwipeOpener';
import { JobCardItem } from '../../components/JobCardItem';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { JobStatus } from '../../types/jobCard';

type FilterKey = 'all' | 'scheduled' | JobStatus;

const FILTERS: Array<{
  key: FilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'scheduled', label: 'Scheduled', icon: 'calendar-outline' },
  { key: 'in_progress', label: 'Active', icon: 'construct-outline' },
  { key: 'draft', label: 'Drafts', icon: 'document-outline' },
  { key: 'pending_review', label: 'Review', icon: 'time-outline' },
  { key: 'completed', label: 'Done', icon: 'checkmark-circle-outline' },
];

export default function JobsScreen() {
  const { jobCards, loading, refresh, syncing } = useJobCards();
  const { isAdmin } = useAuth();
  const { unread } = useNotifications();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      all: jobCards.length,
      scheduled: jobCards.filter((j) => j.scheduledDate && j.scheduledDate >= today && j.status !== 'completed').length,
      in_progress: jobCards.filter((j) => j.status === 'in_progress').length,
      draft: jobCards.filter((j) => j.status === 'draft').length,
      pending_review: jobCards.filter((j) => j.status === 'pending_review').length,
      completed: jobCards.filter((j) => j.status === 'completed').length,
    } as Record<FilterKey, number>;
  }, [jobCards]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return jobCards.filter((job) => {
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'scheduled'
            ? Boolean(job.scheduledDate) && job.scheduledDate >= today && job.status !== 'completed'
            : job.status === filter;

      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        job.reference.toLowerCase().includes(q) ||
        job.clientName.toLowerCase().includes(q) ||
        (job.siteAddress ?? '').toLowerCase().includes(q) ||
        (job.missionType ?? '').toLowerCase().includes(q) ||
        (job.contactName ?? '').toLowerCase().includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [jobCards, filter, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => setSidebarOpen(true)}
          accessibilityLabel="Open clients"
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="menu-outline" size={layout.iconMd} color={colors.black} />
        </Pressable>
        <BaladiLogo variant="compact" size={layout.logoCompact} />
        <View style={styles.topBarRight}>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityLabel="Open notifications"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={layout.iconSm} color={colors.black} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            onPress={() => router.push('/job/new')}
            accessibilityLabel="Create job card"
          >
            <Ionicons name="add" size={layout.iconMd} color={colors.black} />
          </Pressable>
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle} numberOfLines={1} allowFontScaling={false}>
            Job Cards
          </Text>
          <Text style={styles.screenSub}>
            {isAdmin ? 'All technicians · workspace view' : 'Your missions'}
          </Text>
        </View>
        <Pressable
          onPress={() => setSidebarOpen(true)}
          style={({ pressed }) => [styles.clientsBtn, pressed && styles.pressed]}
        >
          <Ionicons name="people-outline" size={16} color={colors.black} />
          <Text style={styles.clientsBtnText}>Clients</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.grey400} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search reference, client, site, contact…"
          placeholderTextColor={colors.grey400}
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={colors.grey400} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((item) => {
          const selected = filter === item.key;
          const count = counts[item.key] ?? 0;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={({ pressed }) => [
                styles.filterChip,
                selected && styles.filterChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={selected ? colors.white : colors.grey600}
              />
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                {item.label}
              </Text>
              <View
                style={[
                  styles.countBubble,
                  selected ? styles.countBubbleActive : styles.countBubbleIdle,
                ]}
              >
                <Text style={[styles.countText, selected && styles.countTextActive]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        style={styles.listScroll}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && styles.listContentEmpty,
        ]}
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || syncing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          loading && jobCards.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : null
        }
        ListEmptyComponent={
          loading && jobCards.length === 0 ? null : (
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={32} color={colors.grey400} />
              <Text style={styles.emptyTitle}>
                {query.trim() || filter !== 'all' ? 'No matching job cards' : 'No job cards yet'}
              </Text>
              <Text style={styles.emptyText}>
                {query.trim() || filter !== 'all'
                  ? 'Try another filter or search term, or pull down to refresh.'
                  : 'Create a new mission for your client. You can pre-fill details now and update them on site.'}
              </Text>
              <PrimaryButton
                label="Create job card"
                icon="add-circle-outline"
                onPress={() => router.push('/job/new')}
              />
            </View>
          )
        }
        renderItem={({ item }) => (
          <JobCardItem job={item} onPress={() => router.push(`/job/${item.id}`)} />
        )}
      />

      <EdgeSwipeOpener edge="left" onOpen={() => setSidebarOpen(true)} />
      <EdgeSwipeOpener edge="right" onOpen={() => router.push('/notifications')} />
      <ClientsSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  iconBtn: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: layout.iconButtonSize / 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
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
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  fab: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: layout.iconButtonSize / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  screenTitle: { ...typography.screenTitle, color: colors.black },
  screenSub: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  clientsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  clientsBtnText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.black,
    paddingVertical: 10,
  },
  filtersScroll: { flexGrow: 0 },
  filters: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  filterChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterText: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '600',
    fontSize: 12,
  },
  filterTextActive: {
    color: colors.white,
  },
  countBubble: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBubbleIdle: { backgroundColor: colors.grey100 },
  countBubbleActive: { backgroundColor: colors.primary },
  countText: { ...typography.caption, color: colors.grey600, fontSize: 10, fontWeight: '700', lineHeight: 12 },
  countTextActive: { color: colors.black },
  loader: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  listScroll: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    gap: spacing.md,
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
  pressed: { opacity: 0.85 },
});
