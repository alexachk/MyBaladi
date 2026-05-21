import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarJobRow } from '../../components/CalendarJobRow';
import { MonthCalendar, type DayMarker } from '../../components/MonthCalendar';
import { getRoleLabel } from '../../constants/positions';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { getDescendantIds, memberName } from '../../lib/orgHierarchy';
import {
  formatHolidayList,
  getLebanonHolidaysByDate,
  lebanonHolidayYearsAvailable,
} from '../../lib/lebanonHolidays';
import { syncPhoneCalendar } from '../../lib/phoneCalendarSync';
import { compareJobSchedule, addDaysIso, isoDateParts } from '../../utils/calendarGrid';
import { formatDate, todayIsoDate } from '../../utils/formatDate';
import { memberAccentColor } from '../../utils/teamColors';
import type { OrgMember } from '../../types/org';
import type { JobCard } from '../../types/jobCard';

type ViewScope = 'mine' | 'team';

function jobOwnerId(job: JobCard): string {
  return job.assigneeId ?? job.technicianId ?? '';
}

function buildMarkersByDate(
  jobs: JobCard[],
  memberIds: string[],
  colorFor: (id: string) => string,
): Record<string, DayMarker[]> {
  const byDateOwner: Record<string, Record<string, number>> = {};

  for (const job of jobs) {
    const owner = jobOwnerId(job) || job.technicianId;
    if (!owner || !job.scheduledDate) continue;
    if (!byDateOwner[job.scheduledDate]) byDateOwner[job.scheduledDate] = {};
    byDateOwner[job.scheduledDate][owner] = (byDateOwner[job.scheduledDate][owner] ?? 0) + 1;
  }

  const markers: Record<string, DayMarker[]> = {};
  for (const [date, owners] of Object.entries(byDateOwner)) {
    markers[date] = Object.entries(owners)
      .map(([memberId, count]) => ({
        memberId,
        color: colorFor(memberId),
        count,
      }))
      .sort((a, b) => {
        const ai = memberIds.indexOf(a.memberId);
        const bi = memberIds.indexOf(b.memberId);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
  }
  return markers;
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const { jobCards, loading, syncing, refresh, canViewTeam, teamMembers, directReports, updateJobCard } =
    useJobCards();
  const today = todayIsoDate();
  const todayParts = isoDateParts(today);

  const [year, setYear] = useState(todayParts.year);
  const [month, setMonth] = useState(todayParts.month);
  const [selectedDate, setSelectedDate] = useState(today);
  const [scope, setScope] = useState<ViewScope>('mine');
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [phoneSyncing, setPhoneSyncing] = useState(false);

  const scheduledJobs = useMemo(
    () => jobCards.filter((j) => Boolean(j.scheduledDate)),
    [jobCards],
  );

  const teamPeople = useMemo((): OrgMember[] => {
    if (!user) return [];
    const descendantIds = getDescendantIds(user.$id, teamMembers);
    const fromDescendants = descendantIds
      .map((id) => teamMembers.find((m) => m.id === id))
      .filter((m): m is OrgMember => Boolean(m));
    if (fromDescendants.length) return fromDescendants;
    if (directReports.length) return directReports;
    return teamMembers.filter((m) => m.id !== user.$id);
  }, [user, teamMembers, directReports]);

  const teamMemberIds = useMemo(() => teamPeople.map((m) => m.id), [teamPeople]);

  const colorForMember = useMemo(
    () => (memberId: string) => memberAccentColor(memberId, teamMemberIds),
    [teamMemberIds],
  );

  const scopedJobs = useMemo(() => {
    if (!user) return [];
    if (scope === 'mine') {
      return scheduledJobs.filter(
        (j) => jobOwnerId(j) === user.$id || j.technicianId === user.$id,
      );
    }
    if (personFilter) {
      return scheduledJobs.filter(
        (j) => jobOwnerId(j) === personFilter || j.technicianId === personFilter,
      );
    }
    return scheduledJobs.filter((j) => {
      const owner = jobOwnerId(j) || j.technicianId;
      return owner && teamMemberIds.includes(owner);
    });
  }, [scheduledJobs, scope, user, personFilter, teamMemberIds]);

  const markersByDate = useMemo(() => {
    if (scope === 'mine' && user) {
      return buildMarkersByDate(scopedJobs, [user.$id], () => colors.primary);
    }
    if (scope === 'team') {
      return buildMarkersByDate(scopedJobs, teamMemberIds, colorForMember);
    }
    return {};
  }, [scopedJobs, scope, user, teamMemberIds, colorForMember]);

  const holidaysByDate = useMemo(() => {
    const years = new Set([year, month === 0 ? year - 1 : year, month === 11 ? year + 1 : year]);
    const merged: Record<string, string[]> = {};
    for (const y of years) {
      const yearMap = getLebanonHolidaysByDate(y);
      for (const [date, holidays] of Object.entries(yearMap)) {
        merged[date] = holidays.map((h) => h.name);
      }
    }
    return merged;
  }, [year, month]);

  const selectedHolidays = useMemo(
    () => getLebanonHolidaysByDate(isoDateParts(selectedDate).year)[selectedDate] ?? [],
    [selectedDate],
  );

  const dayJobs = useMemo(
    () =>
      scopedJobs
        .filter((j) => j.scheduledDate === selectedDate)
        .sort(compareJobSchedule),
    [scopedJobs, selectedDate],
  );

  const selectedDayCountsByPerson = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of dayJobs) {
      const owner = jobOwnerId(job) || job.technicianId;
      if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
    }
    return counts;
  }, [dayJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const selectDate = (iso: string) => {
    setSelectedDate(iso);
    const parts = isoDateParts(iso);
    setYear(parts.year);
    setMonth(parts.month);
  };

  const shiftDay = (delta: number) => {
    selectDate(addDaysIso(selectedDate, delta));
  };

  const runPhoneSync = async (includeJobs: boolean, includeHolidays: boolean) => {
    if (!user) return;
    setPhoneSyncing(true);
    try {
      const result = await syncPhoneCalendar({
        jobs: scopedJobs,
        userId: user.$id,
        years: [year, year - 1, year + 1],
        includeJobs,
        includeHolidays,
        updateJobCard,
      });

      if (result.permissionDenied) {
        Alert.alert(
          'Calendar access',
          'Allow calendar access to sync missions and holidays to your phone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const parts: string[] = [];
      if (includeJobs) {
        parts.push(`${result.jobsSynced} mission${result.jobsSynced === 1 ? '' : 's'}`);
      }
      if (includeHolidays) {
        parts.push(`${result.holidaysSynced} holiday${result.holidaysSynced === 1 ? '' : 's'}`);
      }

      Alert.alert(
        'Phone calendar',
        parts.length ? `Synced ${parts.join(' and ')}.` : 'Nothing to sync.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync calendar.';
      Alert.alert('Phone calendar', message);
    } finally {
      setPhoneSyncing(false);
    }
  };

  const handlePhoneSync = () => {
    Alert.alert('Sync to phone calendar', 'Choose what to add or update on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Missions only',
        onPress: () => {
          void runPhoneSync(true, false);
        },
      },
      {
        text: 'Holidays only',
        onPress: () => {
          void runPhoneSync(false, true);
        },
      },
      {
        text: 'Both',
        onPress: () => {
          void runPhoneSync(true, true);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing || syncing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleBody}>
            <Text style={styles.screenTitle} numberOfLines={1} allowFontScaling={false}>
              Schedule
            </Text>
            <Text style={styles.screenSub}>Past and upcoming missions on the timeline.</Text>
          </View>
          <Pressable
            onPress={handlePhoneSync}
            disabled={phoneSyncing}
            style={({ pressed }) => [styles.syncBtn, pressed && styles.pressed]}
            accessibilityLabel="Sync to phone calendar"
          >
            {phoneSyncing ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <Ionicons name={Platform.OS === 'ios' ? 'calendar' : 'sync-outline'} size={18} color={colors.black} />
            )}
          </Pressable>
        </View>

        {canViewTeam ? (
          <View style={styles.scopeRow}>
            <ScopeChip
              label="My calendar"
              active={scope === 'mine'}
              onPress={() => {
                setScope('mine');
                setPersonFilter(null);
              }}
            />
            <ScopeChip
              label="My team"
              active={scope === 'team'}
              onPress={() => {
                setScope('team');
                setPersonFilter(null);
              }}
            />
          </View>
        ) : null}

        {scope === 'team' && teamPeople.length > 0 ? (
          <View style={styles.teamPanel}>
            <Text style={styles.teamPanelLabel}>People under you</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.teamRow}
            >
              <TeamPersonChip
                label="All team"
                sublabel={`${teamPeople.length} people`}
                active={!personFilter}
                swatchColors={teamPeople.map((m) => colorForMember(m.id))}
                onPress={() => setPersonFilter(null)}
              />
              {teamPeople.map((m) => (
                <TeamPersonChip
                  key={m.id}
                  label={m.name.split(' ')[0] || m.email}
                  sublabel={getRoleLabel(m.position) || m.position || 'Team member'}
                  active={personFilter === m.id}
                  color={colorForMember(m.id)}
                  count={selectedDayCountsByPerson[m.id]}
                  onPress={() => setPersonFilter(m.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.calendarSection}>
          <View style={styles.calendarToolbar}>
            {!showCalendar ? (
              <Pressable
                onPress={() => shiftDay(-1)}
                hitSlop={8}
                style={({ pressed }) => [styles.dayNavBtn, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.black} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setShowCalendar((v) => !v)}
              style={({ pressed }) => [styles.calendarToggle, pressed && styles.pressed]}
            >
              <Ionicons
                name={showCalendar ? 'calendar' : 'calendar-outline'}
                size={16}
                color={colors.black}
              />
              <View style={styles.calendarToggleBody}>
                <Text style={styles.calendarToggleTitle} numberOfLines={1}>
                  {formatDate(selectedDate)}
                </Text>
                <Text style={styles.calendarToggleSub}>
                  {dayJobs.length} mission{dayJobs.length === 1 ? '' : 's'}
                  {showCalendar ? ' · tap to hide' : ' · tap to show calendar'}
                </Text>
              </View>
              <Ionicons
                name={showCalendar ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.grey400}
              />
            </Pressable>

            {!showCalendar ? (
              <View style={styles.dayNavGroup}>
                {selectedDate !== today ? (
                  <Pressable
                    onPress={() => selectDate(today)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.todayBtnText}>Today</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => shiftDay(1)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.dayNavBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.black} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {showCalendar ? (
            <MonthCalendar
              embedded
              year={year}
              month={month}
              selectedDate={selectedDate}
              markersByDate={markersByDate}
              holidaysByDate={holidaysByDate}
              onSelectDate={selectDate}
              onMonthChange={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
            />
          ) : null}
        </View>

        {selectedHolidays.length > 0 ? (
          <View style={styles.holidayBanner}>
            <Ionicons name="flag-outline" size={16} color={colors.error} />
            <View style={styles.holidayBannerBody}>
              <Text style={styles.holidayBannerTitle}>عطلة رسمية · Public holiday</Text>
              <Text style={styles.holidayBannerText}>{formatHolidayList(selectedHolidays)}</Text>
              {selectedHolidays.some((h) => h.tentative) ? (
                <Text style={styles.holidayBannerNote}>
                  * التواريخ الإسلامية قد تتغيّر بعد تأكيد الحكومة · Islamic dates may shift when confirmed
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {!lebanonHolidayYearsAvailable().includes(year) ? (
          <Text style={styles.holidayNote}>
            Fixed holidays shown · العطل الثابتة معروضة. Update app for {year} lunar dates.
          </Text>
        ) : null}

        {scope === 'team' && !personFilter && dayJobs.length > 1 ? (
          <View style={styles.legend}>
            {Object.entries(selectedDayCountsByPerson).map(([id, count]) => (
              <View key={id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colorForMember(id) }]} />
                <Text style={styles.legendText} numberOfLines={1}>
                  {memberName(teamMembers, id)} · {count}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : dayJobs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={layout.iconLg} color={colors.grey400} />
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyText}>
              {scope === 'team'
                ? personFilter
                  ? `No missions for ${memberName(teamMembers, personFilter)} on this day.`
                  : 'No team missions on this day.'
                : 'Create a job card with a schedule to see it here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {dayJobs.map((job) => {
              const owner = jobOwnerId(job) || job.technicianId;
              const isOwn = owner === user?.$id;
              const accent =
                scope === 'team' && owner
                  ? colorForMember(owner)
                  : colors.primary;
              return (
                <CalendarJobRow
                  key={job.id}
                  job={job}
                  isOwn={isOwn}
                  accentColor={accent}
                  ownerLabel={memberName(teamMembers, owner)}
                  onPress={() => router.push(`/job/${job.id}`)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScopeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.scopeChip, active && styles.scopeChipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TeamPersonChip({
  label,
  sublabel,
  active,
  color,
  swatchColors,
  count,
  onPress,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  color?: string;
  swatchColors?: string[];
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.personChip,
        active && styles.personChipActive,
        active && color ? { borderColor: color } : null,
        pressed && styles.pressed,
      ]}
    >
      {swatchColors ? (
        <View style={styles.multiSwatch}>
          {swatchColors.slice(0, 4).map((c, i) => (
            <View key={`${c}-${i}`} style={[styles.swatchSlice, { backgroundColor: c }]} />
          ))}
        </View>
      ) : (
        <View style={[styles.swatch, { backgroundColor: color ?? colors.grey400 }]} />
      )}
      <View style={styles.personChipBody}>
        <Text style={[styles.personChipLabel, active && styles.personChipLabelActive]} numberOfLines={1}>
          {label}
          {count ? ` (${count})` : ''}
        </Text>
        {sublabel ? (
          <Text style={styles.personChipSub} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleBody: { flex: 1, gap: 2 },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    marginTop: 2,
  },
  screenTitle: { ...typography.screenTitle, color: colors.black },
  screenSub: { ...typography.caption, color: colors.grey600 },
  scopeRow: { flexDirection: 'row', gap: spacing.sm },
  scopeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  scopeChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  scopeChipText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  scopeChipTextActive: { color: colors.white },
  teamPanel: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.md,
    gap: spacing.sm,
  },
  teamPanelLabel: { ...typography.label, color: colors.grey600 },
  teamRow: { gap: spacing.sm },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.grey200,
    backgroundColor: colors.grey100,
    maxWidth: 160,
  },
  personChipActive: {
    backgroundColor: colors.white,
    borderColor: colors.black,
  },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  multiSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  swatchSlice: { width: '50%', height: '50%' },
  personChipBody: { flex: 1, minWidth: 0, gap: 1 },
  personChipLabel: { ...typography.caption, color: colors.black, fontWeight: '700' },
  personChipLabelActive: { color: colors.black },
  personChipSub: { ...typography.caption, color: colors.grey600, fontSize: 10 },
  calendarSection: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    overflow: 'hidden',
  },
  calendarToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  calendarToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  calendarToggleBody: { flex: 1, minWidth: 0, gap: 2 },
  calendarToggleTitle: { ...typography.subheading, color: colors.black },
  calendarToggleSub: { ...typography.caption, color: colors.grey600 },
  holidayBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  holidayBannerBody: { flex: 1, gap: 2 },
  holidayBannerTitle: { ...typography.caption, color: colors.error, fontWeight: '700' },
  holidayBannerText: { ...typography.body, color: colors.black, fontSize: 14 },
  holidayBannerNote: { ...typography.caption, color: colors.grey600, fontSize: 11 },
  holidayNote: { ...typography.caption, color: colors.grey600, textAlign: 'center' },
  dayNavGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dayNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey100,
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  todayBtnText: { ...typography.caption, color: colors.black, fontWeight: '700', fontSize: 11 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.caption, color: colors.grey600, maxWidth: 140 },
  list: { gap: spacing.sm },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  emptyTitle: { ...typography.subheading, color: colors.black },
  emptyText: { ...typography.body, color: colors.grey600, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
