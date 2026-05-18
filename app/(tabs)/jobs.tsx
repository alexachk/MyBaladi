import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { JobCardItem } from '../../components/JobCardItem';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing, typography } from '../../constants/theme';
import { useJobCards } from '../../context/JobCardsContext';
import { JobStatus } from '../../types/jobCard';

const FILTERS: Array<{ key: 'all' | JobStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'Active' },
  { key: 'draft', label: 'Drafts' },
  { key: 'completed', label: 'Done' },
];

export default function JobsScreen() {
  const { jobCards, loading, refresh, syncing } = useJobCards();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | JobStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    return jobCards.filter((job) => {
      const matchesFilter = filter === 'all' || job.status === filter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        job.reference.toLowerCase().includes(q) ||
        job.clientName.toLowerCase().includes(q) ||
        job.siteAddress.toLowerCase().includes(q) ||
        job.missionType.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [jobCards, filter, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <BaladiLogo variant="compact" size={36} />
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/job/new')}
          accessibilityLabel="Create job card"
        >
          <Ionicons name="add" size={24} color={colors.black} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.grey400} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search client, reference, site..."
          placeholderTextColor={colors.grey400}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, selected && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || syncing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={styles.count}>
            {filtered.length} job card{filtered.length === 1 ? '' : 's'}
          </Text>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No matching job cards</Text>
              <Text style={styles.emptyText}>
                Create a new job card for your current client mission.
              </Text>
              <PrimaryButton
                label="Create Job Card"
                icon="add-circle-outline"
                onPress={() => router.push('/job/new')}
              />
            </View>
          ) : (
            filtered.map((job) => (
              <JobCardItem
                key={job.id}
                job={job}
                onPress={() => router.push(`/job/${job.id}`)}
              />
            ))
          )}
        </ScrollView>
      )}
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
    paddingBottom: spacing.md,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.black,
    paddingVertical: spacing.sm,
  },
  filters: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    color: colors.grey600,
  },
  filterTextActive: {
    color: colors.black,
    fontWeight: '700',
  },
  loader: {
    marginTop: spacing.xl,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  count: {
    ...typography.caption,
    color: colors.grey600,
    marginBottom: spacing.md,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: 16,
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
});
