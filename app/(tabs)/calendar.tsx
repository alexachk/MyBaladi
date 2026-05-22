import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarJobRow } from '../../components/CalendarJobRow';
import { MonthCalendar, type DayMarker } from '../../components/MonthCalendar';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { getDescendantIds, memberName } from '../../lib/orgHierarchy';
import {
  formatHolidayList,
  getLebanonHolidaysByDate,
  hasFullLebanonHolidayYear,
  HOLIDAY_DATE_DISCLAIMER,
  HOLIDAY_TENTATIVE_NOTE,
} from '../../lib/lebanonHolidays';
import { syncPhoneCalendar, unsyncPhoneCalendar } from '../../lib/phoneCalendarSync';
import {
  jobHasVisitOnDate,
  jobIsScheduled,
  jobVisitDates,
  visitOnDate,
} from '../../lib/jobVisits';
import { addDaysIso, isoDateParts } from '../../utils/calendarGrid';
import { formatDate, todayIsoDate } from '../../utils/formatDate';
import { memberAccentColor, memberAccentBg } from '../../utils/teamColors';
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
    if (!owner) continue;
    for (const date of jobVisitDates(job)) {
      if (!byDateOwner[date]) byDateOwner[date] = {};
      byDateOwner[date][owner] = (byDateOwner[date][owner] ?? 0) + 1;
    }
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

function scopeScheduledJobs(
  scheduledJobs: JobCard[],
  pageScope: ViewScope,
  userId: string,
  selectedPersonIds: string[],
): JobCard[] {
  if (pageScope === 'mine') {
    return scheduledJobs.filter(
      (j) => jobOwnerId(j) === userId || j.technicianId === userId,
    );
  }
  if (!selectedPersonIds.length) return [];
  const allowed = new Set(selectedPersonIds);
  return scheduledJobs.filter((j) => {
    const owner = jobOwnerId(j) || j.technicianId;
    return owner && allowed.has(owner);
  });
}

function dayJobsForDate(jobs: JobCard[], date: string): JobCard[] {
  return jobs
    .filter((job) => jobHasVisitOnDate(job, date))
    .sort((a, b) => {
      const av = visitOnDate(a, date);
      const bv = visitOnDate(b, date);
      if (av?.date !== bv?.date) return (av?.date ?? '').localeCompare(bv?.date ?? '');
      return (av?.time ?? '99:99').localeCompare(bv?.time ?? '99:99');
    });
}

export default function CalendarScreen() {
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const { jobCards, loading, refresh, canViewTeam, teamMembers, directReports, updateJobCard } =
    useJobCards();
  const today = todayIsoDate();
  const todayParts = isoDateParts(today);

  const [year, setYear] = useState(todayParts.year);
  const [month, setMonth] = useState(todayParts.month);
  const [selectedDate, setSelectedDate] = useState(today);
  const [scope, setScope] = useState<ViewScope>('mine');
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [phoneSyncing, setPhoneSyncing] = useState(false);

  const scheduledJobs = useMemo(
    () => jobCards.filter((j) => jobIsScheduled(j)),
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
    const ids = scope === 'team' ? selectedPersonIds : [];
    return scopeScheduledJobs(scheduledJobs, scope, user.$id, ids);
  }, [scheduledJobs, scope, user, selectedPersonIds, teamMemberIds]);

  const allTeamSelected =
    teamMemberIds.length > 0 && selectedPersonIds.length === teamMemberIds.length;

  const togglePerson = (id: string) => {
    setSelectedPersonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const goToScope = (next: ViewScope) => {
    setScope(next);
    if (next === 'team') setSelectedPersonIds(teamMemberIds);
    else setSelectedPersonIds([]);
    if (canViewTeam) {
      pagerRef.current?.scrollTo({ x: next === 'mine' ? 0 : pageWidth, animated: true });
    }
  };

  const onPagerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const next: ViewScope = index === 0 ? 'mine' : 'team';
    if (next !== scope) {
      if (next === 'team') setSelectedPersonIds(teamMemberIds);
      else setSelectedPersonIds([]);
    }
    setScope(next);
  };

  const dayJobs = useMemo(
    () => dayJobsForDate(scopedJobs, selectedDate),
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

  const runPhoneUnsync = async (includeJobs: boolean, includeHolidays: boolean) => {
    if (!user) return;
    setPhoneSyncing(true);
    try {
      const result = await unsyncPhoneCalendar({
        jobs: scopedJobs,
        userId: user.$id,
        years: [year, year - 1, year + 1],
        includeJobs,
        includeHolidays,
        updateJobCard,
      });

      const parts: string[] = [];
      if (includeJobs) {
        parts.push(`${result.jobsRemoved} mission${result.jobsRemoved === 1 ? '' : 's'}`);
      }
      if (includeHolidays) {
        parts.push(`${result.holidaysRemoved} holiday${result.holidaysRemoved === 1 ? '' : 's'}`);
      }

      Alert.alert(
        'Phone calendar',
        parts.length ? `Removed ${parts.join(' and ')} from this device.` : 'Nothing to remove.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove calendar events.';
      Alert.alert('Phone calendar', message);
    } finally {
      setPhoneSyncing(false);
    }
  };

  const showSyncOptions = () => {
    Alert.alert('Sync to phone', 'Add or update events on this device’s calendar.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Missions only', onPress: () => void runPhoneSync(true, false) },
      { text: 'Holidays only', onPress: () => void runPhoneSync(false, true) },
      { text: 'Both', onPress: () => void runPhoneSync(true, true) },
    ]);
  };

  const showUnsyncOptions = () => {
    Alert.alert(
      'Remove from phone',
      'Delete MyBaladi events from this device’s calendar. Missions created with “Add to calendar” on a job are included.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Missions only',
          style: 'destructive',
          onPress: () => void runPhoneUnsync(true, false),
        },
        {
          text: 'Holidays only',
          style: 'destructive',
          onPress: () => void runPhoneUnsync(false, true),
        },
        {
          text: 'Both',
          style: 'destructive',
          onPress: () => void runPhoneUnsync(true, true),
        },
      ],
    );
  };

  const handlePhoneSync = () => {
    Alert.alert(
      'Phone calendar',
      'Pull down refreshes missions from the server. Sync pushes them to your phone calendar (one-way).',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sync…', onPress: showSyncOptions },
        { text: 'Remove…', style: 'destructive', onPress: showUnsyncOptions },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
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
              <Ionicons name="phone-portrait-outline" size={18} color={colors.black} />
            )}
          </Pressable>
        </View>

        {canViewTeam ? (
          <View style={styles.scopeRow}>
            <ScopeChip
              label="My calendar"
              active={scope === 'mine'}
              onPress={() => goToScope('mine')}
            />
            <ScopeChip
              label="My team"
              active={scope === 'team'}
              onPress={() => goToScope('team')}
            />
          </View>
        ) : null}

        {scope === 'team' && teamPeople.length > 0 ? (
          <View style={styles.teamPanel}>
            <View style={styles.teamPanelHead}>
              <Text style={styles.teamPanelLabel}>People under you</Text>
              <View style={styles.teamPanelActions}>
                <Pressable
                  onPress={() => setSelectedPersonIds(teamMemberIds)}
                  disabled={allTeamSelected}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.teamPanelAction,
                      allTeamSelected && styles.teamPanelActionMuted,
                    ]}
                  >
                    Select all
                  </Text>
                </Pressable>
                <Text style={styles.teamPanelActionSep}>·</Text>
                <Pressable
                  onPress={() => setSelectedPersonIds([])}
                  disabled={selectedPersonIds.length === 0}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.teamPanelAction,
                      selectedPersonIds.length === 0 && styles.teamPanelActionMuted,
                    ]}
                  >
                    Deselect all
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.nameTagWrap}>
              {teamPeople.map((m) => {
                const color = colorForMember(m.id);
                const selected = selectedPersonIds.includes(m.id);
                const label = m.name.trim() || m.email;
                return (
                  <TeamNameTag
                    key={m.id}
                    label={label}
                    color={color}
                    selected={selected}
                    count={selectedDayCountsByPerson[m.id]}
                    onPress={() => togglePerson(m.id)}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      {canViewTeam ? (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerScrollEnd}
          scrollEventThrottle={16}
          style={styles.pager}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {(['mine', 'team'] as ViewScope[]).map((pageScope) => (
            <ScheduleScopePage
              key={pageScope}
              pageWidth={pageWidth}
              pageScope={pageScope}
              activeScope={scope}
              user={user}
              scheduledJobs={scheduledJobs}
              teamMembers={teamMembers}
              teamMemberIds={teamMemberIds}
              selectedPersonIds={selectedPersonIds}
              selectedDate={selectedDate}
              year={year}
              month={month}
              today={today}
              showCalendar={showCalendar}
              holidaysByDate={holidaysByDate}
              loading={loading}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onSelectDate={selectDate}
              onShiftDay={shiftDay}
              onToggleCalendar={() => setShowCalendar((v) => !v)}
              onMonthChange={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
              colorForMember={colorForMember}
            />
          ))}
        </ScrollView>
      ) : (
        <ScheduleScopePage
          pageWidth={pageWidth}
          pageScope="mine"
          activeScope="mine"
          user={user}
          scheduledJobs={scheduledJobs}
          teamMembers={teamMembers}
          teamMemberIds={teamMemberIds}
          selectedPersonIds={[]}
          selectedDate={selectedDate}
          year={year}
          month={month}
          today={today}
          showCalendar={showCalendar}
          holidaysByDate={holidaysByDate}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onSelectDate={selectDate}
          onShiftDay={shiftDay}
          onToggleCalendar={() => setShowCalendar((v) => !v)}
          onMonthChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
          colorForMember={colorForMember}
        />
      )}
    </SafeAreaView>
  );
}

interface ScheduleScopePageProps {
  pageWidth: number;
  pageScope: ViewScope;
  activeScope: ViewScope;
  user: { $id: string } | null;
  scheduledJobs: JobCard[];
  teamMembers: OrgMember[];
  teamMemberIds: string[];
  selectedPersonIds: string[];
  selectedDate: string;
  year: number;
  month: number;
  today: string;
  showCalendar: boolean;
  holidaysByDate: Record<string, string[]>;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectDate: (iso: string) => void;
  onShiftDay: (delta: number) => void;
  onToggleCalendar: () => void;
  onMonthChange: (year: number, month: number) => void;
  colorForMember: (memberId: string) => string;
}

function ScheduleScopePage({
  pageWidth,
  pageScope,
  activeScope,
  user,
  scheduledJobs,
  teamMembers,
  teamMemberIds,
  selectedPersonIds,
  selectedDate,
  year,
  month,
  today,
  showCalendar,
  holidaysByDate,
  loading,
  refreshing,
  onRefresh,
  onSelectDate,
  onShiftDay,
  onToggleCalendar,
  onMonthChange,
  colorForMember,
}: ScheduleScopePageProps) {
  const scopedJobs = useMemo(() => {
    if (!user) return [];
    const ids = pageScope === 'team' ? selectedPersonIds : [];
    return scopeScheduledJobs(scheduledJobs, pageScope, user.$id, ids);
  }, [scheduledJobs, pageScope, user, selectedPersonIds, teamMemberIds]);

  const activeMemberIds = pageScope === 'team' ? selectedPersonIds : teamMemberIds;

  const markersByDate = useMemo(() => {
    if (pageScope === 'mine' && user) {
      return buildMarkersByDate(scopedJobs, [user.$id], () => colors.primary);
    }
    if (pageScope === 'team') {
      return buildMarkersByDate(scopedJobs, activeMemberIds, colorForMember);
    }
    return {};
  }, [scopedJobs, pageScope, user, activeMemberIds, colorForMember]);

  const selectedHolidays = useMemo(
    () => getLebanonHolidaysByDate(isoDateParts(selectedDate).year)[selectedDate] ?? [],
    [selectedDate],
  );

  const dayJobs = useMemo(
    () => dayJobsForDate(scopedJobs, selectedDate),
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

  return (
    <ScrollView
      style={{ width: pageWidth }}
      contentContainerStyle={styles.pageContent}
      refreshControl={
        pageScope === activeScope ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.calendarSection}>
        <View style={styles.calendarToolbar}>
          {!showCalendar ? (
            <Pressable
              onPress={() => onShiftDay(-1)}
              hitSlop={8}
              style={({ pressed }) => [styles.dayNavBtn, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.black} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={onToggleCalendar}
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
                  onPress={() => onSelectDate(today)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.todayBtnText}>Today</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => onShiftDay(1)}
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
            onSelectDate={onSelectDate}
            onMonthChange={onMonthChange}
            footer={
              <Text style={styles.holidayDisclaimer}>{HOLIDAY_DATE_DISCLAIMER}</Text>
            }
          />
        ) : null}
      </View>

      {selectedHolidays.length > 0 ? (
        <View style={styles.holidayBanner}>
          <Ionicons name="flag-outline" size={16} color={colors.error} />
          <View style={styles.holidayBannerBody}>
            <Text style={styles.holidayBannerTitle}>Public holiday</Text>
            <Text style={styles.holidayBannerText}>{formatHolidayList(selectedHolidays)}</Text>
            {!showCalendar ? (
              <Text style={styles.holidayBannerNote}>{HOLIDAY_DATE_DISCLAIMER}</Text>
            ) : null}
            {selectedHolidays.some((h) => h.tentative) ? (
              <Text style={styles.holidayBannerNote}>{HOLIDAY_TENTATIVE_NOTE}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {!hasFullLebanonHolidayYear(year) ? (
        <Text style={styles.holidayNote}>
          Partial holiday list for {year}. An app update will add the rest.
        </Text>
      ) : null}

      {pageScope === 'team' && selectedPersonIds.length > 1 && dayJobs.length > 1 ? (
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
            {pageScope === 'team'
              ? selectedPersonIds.length === 0
                ? 'Select at least one team member above.'
                : selectedPersonIds.length === 1
                  ? `No missions for ${memberName(teamMembers, selectedPersonIds[0])} on this day.`
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
              pageScope === 'team' && owner ? colorForMember(owner) : colors.primary;
            return (
              <CalendarJobRow
                key={job.id}
                job={job}
                visitDate={selectedDate}
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

function TeamNameTag({
  label,
  color,
  selected,
  count,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.nameTag,
        selected
          ? { backgroundColor: memberAccentBg(color), borderColor: color }
          : styles.nameTagOff,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.nameTagDot, { backgroundColor: selected ? color : colors.grey400 }]} />
      <Text
        style={[styles.nameTagText, selected && styles.nameTagTextOn]}
        numberOfLines={1}
      >
        {label}
        {count ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  pager: { flex: 1 },
  pageContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
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
  teamPanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  teamPanelActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamPanelAction: { ...typography.caption, color: colors.black, fontWeight: '700', fontSize: 11 },
  teamPanelActionMuted: { color: colors.grey400 },
  teamPanelActionSep: { ...typography.caption, color: colors.grey400, fontSize: 11 },
  nameTagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    maxWidth: '100%',
  },
  nameTagOff: {
    backgroundColor: colors.grey100,
    borderColor: colors.grey200,
  },
  nameTagDot: { width: 8, height: 8, borderRadius: 4 },
  nameTagText: { ...typography.caption, color: colors.grey600, fontWeight: '600', flexShrink: 1 },
  nameTagTextOn: { color: colors.black, fontWeight: '700' },
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
  holidayDisclaimer: {
    ...typography.caption,
    color: colors.grey600,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
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
