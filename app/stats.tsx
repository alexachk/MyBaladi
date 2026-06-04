import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackPageHeader } from '../components/StackPageHeader';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth, useJobCards } from '../context/JobCardsContext';
import { getVisibleUserIds } from '../lib/orgHierarchy';
import { listRecapsForStats } from '../lib/appwrite/jobRecaps';
import type { JobRecap } from '../lib/jobRecaps';
import {
  computeStats,
  DATE_RANGE_PRESETS,
  formatStatsRangeSpan,
  type StatsSummary,
} from '../lib/jobStats';

export default function StatsScreen() {
  const { isAdmin, user } = useAuth();
  const { jobCards, teamMembers } = useJobCards();

  const [presetId, setPresetId] = useState('last_30_days');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [recaps, setRecaps] = useState<JobRecap[]>([]);
  const [loading, setLoading] = useState(true);

  const visibleUserIds = useMemo(
    () => (user ? getVisibleUserIds(user.$id, isAdmin, teamMembers) : []),
    [user, isAdmin, teamMembers],
  );

  const staffOptions = useMemo(() => {
    if (isAdmin || visibleUserIds === null) return teamMembers;
    const allow = new Set(visibleUserIds);
    return teamMembers.filter((m) => allow.has(m.id));
  }, [isAdmin, visibleUserIds, teamMembers]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listRecapsForStats({ all: isAdmin, visibleUserIds })
      .then((rows) => {
        if (active) setRecaps(rows);
      })
      .catch(() => {
        if (active) setRecaps([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, visibleUserIds]);

  const activePreset = useMemo(
    () => DATE_RANGE_PRESETS.find((p) => p.id === presetId) ?? DATE_RANGE_PRESETS[0],
    [presetId],
  );

  const range = useMemo(() => activePreset.range(), [activePreset]);

  const rangeSpanLabel = useMemo(
    () => formatStatsRangeSpan(range.from, range.to),
    [range.from, range.to],
  );

  const stats: StatsSummary = useMemo(
    () =>
      computeStats(jobCards, recaps, teamMembers, {
        from: range.from,
        to: range.to,
        userIds: selectedStaff.length ? selectedStaff : null,
      }),
    [jobCards, recaps, teamMembers, range, selectedStaff],
  );

  const toggleStaff = (id: string) => {
    setSelectedStaff((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const maxMonthVisits = Math.max(1, ...stats.byMonth.map((m) => m.visits));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StackPageHeader title="Your activity" />

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.sectionLabel}>Period</Text>
          <Text style={styles.rangeHint}>{rangeSpanLabel}</Text>
          <View style={styles.chipRow}>
            {DATE_RANGE_PRESETS.map((preset) => {
              const active = preset.id === presetId;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => setPresetId(preset.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{preset.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {staffOptions.length > 1 ? (
          <View>
            <Text style={styles.sectionLabel}>Staff{selectedStaff.length ? '' : ' · all'}</Text>
            <View style={styles.chipRow}>
              {staffOptions.map((member) => {
                const active = selectedStaff.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleStaff(member.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {member.id === user?.$id ? 'Me' : member.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        <View style={styles.grid}>
          <StatCard icon="briefcase-outline" label="Jobs" value={stats.totalJobs} />
          <StatCard icon="navigate-outline" label="Visits" value={stats.totalVisits} />
          <StatCard icon="checkmark-done-outline" label="Done" value={stats.doneVisits} tone="success" />
          <StatCard icon="time-outline" label="Upcoming" value={stats.upcomingVisits} tone="warning" />
          <StatCard icon="sync-outline" label="Ongoing" value={stats.ongoingJobs} />
          <StatCard icon="document-text-outline" label="Recaps" value={stats.recaps} />
          <StatCard
            icon="trending-up-outline"
            label="Avg visits / mo"
            value={stats.avgVisitsPerMonth.toFixed(1)}
          />
          <StatCard icon="hourglass-outline" label="To review" value={stats.pendingReviewJobs} tone="warning" />
        </View>

        {stats.byMonth.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Visits by month</Text>
            {stats.byMonth.map((bucket) => (
              <View key={bucket.month} style={styles.monthRow}>
                <Text style={styles.monthLabel}>{bucket.label}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { width: `${(bucket.visits / maxMonthVisits) * 100}%` }]}
                  />
                </View>
                <Text style={styles.monthValue}>{bucket.visits}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>By technician</Text>
          {stats.byTech.length ? (
            <>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.thName]}>Name</Text>
                <Text style={styles.th}>Jobs</Text>
                <Text style={styles.th}>Visits</Text>
                <Text style={styles.th}>Done</Text>
                <Text style={styles.th}>Recaps</Text>
              </View>
              {stats.byTech.map((tech) => (
                <View key={tech.userId} style={styles.tableRow}>
                  <Text style={[styles.td, styles.thName]} numberOfLines={1}>
                    {tech.userId === user?.$id ? `${tech.name} (me)` : tech.name}
                  </Text>
                  <Text style={styles.td}>{tech.jobs}</Text>
                  <Text style={styles.td}>{tech.visits}</Text>
                  <Text style={styles.td}>{tech.doneVisits}</Text>
                  <Text style={styles.td}>{tech.recaps}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.empty}>No data for this selection.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const color =
    tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.primary;
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  rangeHint: { ...typography.caption, color: colors.grey600, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    maxWidth: 160,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  chipTextActive: { color: colors.black },
  sectionLabel: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  loader: { paddingVertical: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    width: '23%',
    minWidth: 80,
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.md,
    gap: 4,
  },
  statValue: { ...typography.heading, color: colors.black, fontSize: 22 },
  statLabel: { ...typography.caption, color: colors.grey600 },
  block: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  blockTitle: { ...typography.subheading, color: colors.black },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthLabel: { ...typography.caption, color: colors.grey600, width: 64 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.grey100, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
  monthValue: { ...typography.caption, color: colors.black, width: 28, textAlign: 'right' },
  tableHead: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey200,
  },
  th: { ...typography.caption, color: colors.grey600, fontWeight: '700', flex: 1, textAlign: 'center' },
  thName: { flex: 2.4, textAlign: 'left' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey100,
  },
  td: { ...typography.body, color: colors.black, flex: 1, textAlign: 'center' },
  empty: { ...typography.caption, color: colors.grey600 },
});
