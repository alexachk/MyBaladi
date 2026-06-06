import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField } from './DateTimeField';
import { MapPinPickerModal } from './MapPinPickerModal';
import { JobAssigneesField } from './JobAssigneesField';
import { PrimaryButton } from './PrimaryButton';
import { colors, radius, spacing, typography } from '../constants/theme';
import type { Personnel } from '../lib/appwrite/adminUsers';
import {
  normalizeAssigneeEntries,
  type AssigneeEntry,
  type StoredJobAssignee,
} from '../lib/jobAssignees';
import type { LaunchVisitLocationChoice } from '../lib/jobOnSite';
import { assigneesForVisitLaunch } from '../lib/jobMissionScopes';
import type { JobCard } from '../types/jobCard';
import { resolveLocationPin } from '../lib/locationPin';
import {
  dateFromHhmm,
  hhmmFromDate,
  validateOnSiteTimeRange,
} from '../lib/visitDuration';
import {
  formatVisitLocationLabel,
  formatVisitWhen,
  resolveVisitLocation,
  visitStatus,
  visitUsesJobLocation,
  type StoredJobVisit,
} from '../lib/jobVisits';

type LocationMode = 'keep' | 'job_site' | 'actual';
export type VisitOnSiteSheetMode = 'launch' | 'complete';

type Props = {
  visible: boolean;
  mode?: VisitOnSiteSheetMode;
  job: Pick<
    JobCard,
    | 'missionScopes'
    | 'missionTypes'
    | 'missionType'
    | 'equipmentItems'
    | 'equipment'
    | 'assignees'
    | 'assigneeId'
    | 'assigneeName'
  >;
  visits: StoredJobVisit[];
  jobSiteAddress: string;
  initialVisitId?: string | null;
  personnel: Personnel[];
  personnelLoading?: boolean;
  onLoadPersonnel?: () => void;
  busy?: boolean;
  onClose: () => void;
  onLaunch: (
    visitId: string,
    location: LaunchVisitLocationChoice,
    team: StoredJobAssignee[],
    arrivalTime: string,
  ) => void;
  onComplete?: (visitId: string, arrivalTime: string, departureTime: string) => void;
};

export function LaunchVisitSheet({
  visible,
  mode = 'launch',
  job,
  visits,
  jobSiteAddress,
  initialVisitId,
  personnel,
  personnelLoading,
  onLoadPersonnel,
  busy = false,
  onClose,
  onLaunch,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const isLaunch = mode === 'launch';
  const [visitId, setVisitId] = useState('');
  const [teamDraft, setTeamDraft] = useState<AssigneeEntry[]>([]);
  const [locationMode, setLocationMode] = useState<LocationMode>('keep');
  const [actualText, setActualText] = useState('');
  const [actualLat, setActualLat] = useState<number | undefined>();
  const [actualLng, setActualLng] = useState<number | undefined>();
  const [mapOpen, setMapOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [arrivalAt, setArrivalAt] = useState<Date | null>(new Date());
  const [departureAt, setDepartureAt] = useState<Date | null>(new Date());
  const [activePickerKey, setActivePickerKey] = useState<string | null>(null);

  const selected = useMemo(
    () => visits.find((visit) => visit.id === visitId),
    [visits, visitId],
  );

  const plannedLabel = selected
    ? formatVisitLocationLabel(selected, jobSiteAddress)
    : '';

  useEffect(() => {
    if (!visible) return;
    const pick =
      (initialVisitId && visits.some((v) => v.id === initialVisitId) ? initialVisitId : null) ??
      visits[0]?.id ??
      '';
    setVisitId(pick);
    setTeamDraft(assigneesForVisitLaunch(job, pick));
    setLocationMode('keep');
    setActualText('');
    setActualLat(undefined);
    setActualLng(undefined);
    const now = new Date();
    setArrivalAt(now);
    setDepartureAt(now);
    setActivePickerKey(null);
    onLoadPersonnel?.();
  }, [visible, initialVisitId, visits, job, onLoadPersonnel]);

  useEffect(() => {
    if (!visible || !selected) return;
    const now = new Date();
    const arrival =
      selected.arrivalTime && visitStatus(selected) === 'in_progress'
        ? dateFromHhmm(now, selected.arrivalTime) ?? now
        : now;
    setArrivalAt(arrival);
    setDepartureAt(now);
  }, [visible, selected?.id, selected?.arrivalTime, selected?.status]);

  useEffect(() => {
    if (!visible || !visitId) return;
    setTeamDraft(assigneesForVisitLaunch(job, visitId));
  }, [visible, visitId, job]);

  const useGps = async () => {
    setGpsLoading(true);
    try {
      const pin = await resolveLocationPin();
      if (!pin) return;
      setLocationMode('actual');
      setActualText(pin.text);
      setActualLat(pin.latitude);
      setActualLng(pin.longitude);
    } finally {
      setGpsLoading(false);
    }
  };

  const buildLocationChoice = (): LaunchVisitLocationChoice => {
    if (locationMode === 'keep') return { mode: 'keep' };
    if (locationMode === 'job_site') return { mode: 'job_site' };
    const text = actualText.trim();
    if (!text) throw new Error('Enter the actual on-site location or pick on map.');
    return {
      mode: 'actual',
      location: text,
      latitude: actualLat,
      longitude: actualLng,
    };
  };

  const handleLaunch = () => {
    if (!visitId) return;
    try {
      const team = normalizeAssigneeEntries(teamDraft);
      if (!team.length) {
        Alert.alert('Launch', 'Confirm at least one person on site for this visit.');
        return;
      }
      if (!arrivalAt) {
        Alert.alert('Launch', 'Enter the on-site arrival time.');
        return;
      }
      onLaunch(visitId, buildLocationChoice(), team, hhmmFromDate(arrivalAt));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check on-site location.';
      Alert.alert('Launch', message);
    }
  };

  const handleComplete = () => {
    if (!visitId || !onComplete) return;
    if (!arrivalAt || !departureAt) {
      Alert.alert('Complete visit', 'Enter arrival and departure times.');
      return;
    }
    const arrivalTime = hhmmFromDate(arrivalAt);
    const departureTime = hhmmFromDate(departureAt);
    const rangeError = validateOnSiteTimeRange(arrivalTime, departureTime);
    if (rangeError) {
      Alert.alert('Complete visit', rangeError);
      return;
    }
    onComplete(visitId, arrivalTime, departureTime);
  };

  return (
    <>
      <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
        <View style={styles.container}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {isLaunch ? 'Mark visit launched' : 'Complete visit'}
          </Text>
          <Text style={styles.subtitle}>
            {isLaunch
              ? 'Pick the visit, enter on-site times, team, and location.'
              : 'Enter actual on-site times for this visit, then sign or lock.'}
          </Text>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Visit</Text>
            {visits.map((visit) => {
              const picked = visit.id === visitId;
              return (
                <Pressable
                  key={visit.id}
                  onPress={() => setVisitId(visit.id)}
                  style={({ pressed }) => [
                    styles.visitOption,
                    picked && styles.visitOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={picked ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={picked ? colors.primary : colors.grey400}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visitOptionTitle}>
                      {visit.label?.trim() || 'Visit'} · {formatVisitWhen(visit)}
                    </Text>
                    <Text style={styles.visitOptionHint}>
                      {formatVisitLocationLabel(visit, jobSiteAddress)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {selected ? (
              <>
                <Text style={[styles.sectionLabel, styles.sectionGap]}>On-site times</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeHalf}>
                    <DateTimeField
                      label="Arrival"
                      value={arrivalAt}
                      onChange={setArrivalAt}
                      mode="time"
                      icon="log-in-outline"
                      pickerKey={`${visitId}-arrival`}
                      activePickerKey={activePickerKey}
                      onActivePickerChange={setActivePickerKey}
                    />
                  </View>
                  {!isLaunch ? (
                    <View style={styles.timeHalf}>
                      <DateTimeField
                        label="Departure"
                        value={departureAt}
                        onChange={setDepartureAt}
                        mode="time"
                        icon="log-out-outline"
                        pickerKey={`${visitId}-departure`}
                        activePickerKey={activePickerKey}
                        onActivePickerChange={setActivePickerKey}
                      />
                    </View>
                  ) : null}
                </View>

                {isLaunch ? (
                  <>
                <Text style={[styles.sectionLabel, styles.sectionGap]}>On-site team</Text>
                <Text style={styles.teamHint}>
                  Confirm who is on this visit. Adjust roles or add someone if needed.
                </Text>
                <JobAssigneesField
                  values={teamDraft}
                  onChange={setTeamDraft}
                  personnel={personnel}
                  personnelLoading={personnelLoading}
                  onLoadPersonnel={onLoadPersonnel}
                />
                <Text style={[styles.sectionLabel, styles.sectionGap]}>On-site location</Text>
                <LocationModeChip
                  label="Planned for this visit"
                  hint={plannedLabel}
                  selected={locationMode === 'keep'}
                  onPress={() => setLocationMode('keep')}
                />
                <LocationModeChip
                  label="Job site address"
                  hint={jobSiteAddress.trim() || 'Same as job card site'}
                  selected={locationMode === 'job_site'}
                  onPress={() => setLocationMode('job_site')}
                  disabled={visitUsesJobLocation(selected) && !jobSiteAddress.trim()}
                />
                <LocationModeChip
                  label="Actual on-site (different)"
                  hint="Save where you really are — GPS or map"
                  selected={locationMode === 'actual'}
                  onPress={() => setLocationMode('actual')}
                />

                {locationMode === 'actual' ? (
                  <View style={styles.actualBlock}>
                    <TextInput
                      value={actualText}
                      onChangeText={(text) => {
                        setActualText(text);
                        setActualLat(undefined);
                        setActualLng(undefined);
                      }}
                      placeholder="Street, city…"
                      placeholderTextColor={colors.grey400}
                      style={styles.actualInput}
                      multiline
                    />
                    <View style={styles.actualActions}>
                      <Pressable
                        onPress={() => void useGps()}
                        disabled={gpsLoading || busy}
                        style={({ pressed }) => [styles.miniBtn, pressed && styles.pressed]}
                      >
                        {gpsLoading ? (
                          <ActivityIndicator size="small" color={colors.black} />
                        ) : (
                          <Ionicons name="navigate-outline" size={16} color={colors.black} />
                        )}
                        <Text style={styles.miniBtnText}>My location</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setMapOpen(true)}
                        disabled={busy}
                        style={({ pressed }) => [styles.miniBtn, pressed && styles.pressed]}
                      >
                        <Ionicons name="map-outline" size={16} color={colors.black} />
                        <Text style={styles.miniBtnText}>Pick on map</Text>
                      </Pressable>
                    </View>
                    {locationMode === 'actual' &&
                    selected &&
                    actualText.trim() &&
                    resolveVisitLocation(selected, jobSiteAddress).trim() !== actualText.trim() ? (
                      <Text style={styles.actualNote}>
                        This updates the visit&apos;s actual location on the job card.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={
                  busy
                    ? isLaunch
                      ? 'Saving…'
                      : 'Completing…'
                    : isLaunch
                      ? 'Mark launched'
                      : 'Complete visit'
                }
                icon={isLaunch ? 'play-circle-outline' : 'checkmark-circle-outline'}
                onPress={isLaunch ? handleLaunch : handleComplete}
                disabled={busy || !visitId || (!isLaunch && !onComplete)}
              />
            </View>
          </View>
        </View>
        </View>
      </Modal>

      <MapPinPickerModal
        visible={mapOpen}
        initial={{
          text: actualText,
          latitude: actualLat,
          longitude: actualLng,
        }}
        onClose={() => setMapOpen(false)}
        onConfirm={(result) => {
          setLocationMode('actual');
          setActualText(result.text);
          setActualLat(result.latitude);
          setActualLng(result.longitude);
          setMapOpen(false);
        }}
      />
    </>
  );
}

function LocationModeChip({
  label,
  hint,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.locChip,
        selected && styles.locChipSelected,
        disabled && styles.locChipDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.locChipLabel, selected && styles.locChipLabelSelected]}>{label}</Text>
      <Text style={styles.locChipHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey200,
    marginBottom: spacing.md,
  },
  title: { ...typography.subheading, color: colors.black, fontSize: 18 },
  subtitle: { ...typography.caption, color: colors.grey600, marginTop: 4, marginBottom: spacing.md },
  scroll: { maxHeight: 520 },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeHalf: { flex: 1, minWidth: 0 },
  teamHint: {
    ...typography.caption,
    color: colors.grey600,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  sectionGap: { marginTop: spacing.md },
  visitOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    marginBottom: spacing.sm,
  },
  visitOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.grey100,
  },
  visitOptionTitle: { ...typography.body, color: colors.black, fontWeight: '600' },
  visitOptionHint: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  locChip: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    marginBottom: spacing.sm,
  },
  locChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.grey100,
  },
  locChipDisabled: { opacity: 0.45 },
  locChipLabel: { ...typography.body, color: colors.black, fontWeight: '600' },
  locChipLabelSelected: { color: colors.primaryDark },
  locChipHint: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  actualBlock: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  actualInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 72,
    textAlignVertical: 'top',
    color: colors.black,
  },
  actualActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  miniBtnText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  actualNote: { ...typography.caption, color: colors.info, fontStyle: 'italic' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
  },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  cancelText: { ...typography.body, color: colors.grey600, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
