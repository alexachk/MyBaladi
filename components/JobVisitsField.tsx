import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateTimeField } from './DateTimeField';
import { MapPinPickerModal } from './MapPinPickerModal';
import { OpenInMapsButton } from './OpenInMapsButton';
import { colors, radius, spacing, typography } from '../constants/theme';
import { hasMapPin } from '../lib/clientAddresses';
import { canOpenMapsForAddress, canOpenMapsForAddressEntry, promptMapsForAddress, promptMapsForAddressEntry } from '../lib/maps';
import {
  defaultVisitEntry,
  mergeVisitSchedule,
  type JobVisitEntry,
} from '../lib/jobVisits';
import {
  formatVisitDurationShort,
  VISIT_DURATION_OPTIONS,
} from '../lib/visitDuration';
import { getVisitScheduleWarnings } from '../lib/visitScheduleWarnings';
import type { JobCard } from '../types/jobCard';
import { VisitScheduleWarnings } from './VisitScheduleWarnings';

interface JobVisitsFieldProps {
  values: JobVisitEntry[];
  onChange: (values: JobVisitEntry[]) => void;
  jobSiteAddress?: string;
  assigneeUserIds?: string[];
  allJobs?: Array<
    Pick<
      JobCard,
      | 'id'
      | 'reference'
      | 'clientName'
      | 'status'
      | 'technicianId'
      | 'assigneeId'
      | 'assignees'
      | 'visits'
      | 'scheduledDate'
      | 'scheduledTime'
    >
  >;
  excludeVisitId?: string;
  /** Single new-visit form (hide multi-add). */
  allowMultiple?: boolean;
  /** Card title when allowMultiple is false (default: "New visit"). */
  singleVisitTitle?: string;
}

export function JobVisitsField({
  values,
  onChange,
  jobSiteAddress = '',
  assigneeUserIds = [],
  allJobs = [],
  excludeVisitId,
  allowMultiple = true,
  singleVisitTitle = 'Visit',
}: JobVisitsFieldProps) {
  const rows = values.length > 0 ? values : [defaultVisitEntry()];
  const [activePickerKey, setActivePickerKey] = useState<string | null>(null);
  const [mapPickerIndex, setMapPickerIndex] = useState<number | null>(null);
  const mapRow = mapPickerIndex != null ? rows[mapPickerIndex] : undefined;

  const updateRow = (index: number, patch: Partial<JobVisitEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultVisitEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultVisitEntry(new Date())]);
  };

  const setLocationMode = (index: number, useJobLocation: boolean) => {
    if (useJobLocation) {
      updateRow(index, {
        useJobLocation: true,
        location: '',
        latitude: undefined,
        longitude: undefined,
      });
      return;
    }
    updateRow(index, { useJobLocation: false });
  };

  const syncEstimatedArrivalWithDate = (index: number, visitDate: Date | null) => {
    const row = rows[index];
    const merged = mergeVisitSchedule(visitDate, row.estimatedArrivalAt);
    updateRow(index, {
      visitDate,
      estimatedArrivalAt: merged,
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{allowMultiple ? 'Scheduled visits' : 'Add visit'}</Text>
        {allowMultiple ? (
          <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.addText}>Add visit</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>
        {allowMultiple
          ? 'Planned date, estimated arrival, and duration. Record actual on-site times when you know them.'
          : 'Planned date, arrival, duration, and location — same options as when creating a job card.'}
      </Text>

      <View style={styles.rows}>
        {rows.map((row, index) => {
          const scheduleWarnings = getVisitScheduleWarnings({
            visitDate: row.visitDate,
            estimatedArrivalAt: row.estimatedArrivalAt,
            estimatedDurationMinutes: row.estimatedDurationMinutes,
            visitKey: row.key,
            assigneeUserIds,
            jobs: allJobs,
            siblingEntries: rows,
            excludeVisitId,
          });
          return (
          <View key={row.key} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardIndex}>
                {allowMultiple ? `Visit ${index + 1}` : singleVisitTitle}
              </Text>
              {rows.length > 1 ? (
                <Pressable
                  onPress={() => removeRow(index)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.grey400} />
                </Pressable>
              ) : null}
            </View>

            <TextInput
              value={row.label}
              onChangeText={(text) => updateRow(index, { label: text })}
              placeholder="Label (optional) e.g. Phase 1, Warranty"
              placeholderTextColor={colors.grey400}
              style={styles.input}
            />

            <Text style={styles.sectionTitle}>Planned</Text>
            <DateTimeField
              label="Visit date"
              value={row.visitDate}
              onChange={(visitDate) => syncEstimatedArrivalWithDate(index, visitDate)}
              mode="date"
              icon="calendar-outline"
              pickerKey={`${row.key}-visit-date`}
              activePickerKey={activePickerKey}
              onActivePickerChange={setActivePickerKey}
            />
            <DateTimeField
              label="Estimated arrival"
              value={row.estimatedArrivalAt}
              onChange={(estimatedArrivalAt) => {
                const visitDate = row.visitDate ?? estimatedArrivalAt;
                updateRow(index, {
                  visitDate,
                  estimatedArrivalAt: estimatedArrivalAt ?? null,
                });
              }}
              mode="time"
              icon="time-outline"
              pickerKey={`${row.key}-arrival`}
              activePickerKey={activePickerKey}
              onActivePickerChange={setActivePickerKey}
            />

            <Text style={styles.fieldLabel}>Estimated duration</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.durationRow}
            >
              {VISIT_DURATION_OPTIONS.map((minutes) => {
                const selected = row.estimatedDurationMinutes === minutes;
                return (
                  <Pressable
                    key={minutes}
                    onPress={() => updateRow(index, { estimatedDurationMinutes: minutes })}
                    style={({ pressed }) => [
                      styles.durationChip,
                      selected && styles.durationChipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        selected && styles.durationChipTextSelected,
                      ]}
                    >
                      {formatVisitDurationShort(minutes)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <VisitScheduleWarnings warnings={scheduleWarnings} />

            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.locModeRow}>
              <Pressable
                onPress={() => setLocationMode(index, true)}
                style={({ pressed }) => [
                  styles.locChip,
                  row.useJobLocation && styles.locChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={14}
                  color={row.useJobLocation ? colors.black : colors.grey600}
                />
                <Text style={[styles.locChipText, row.useJobLocation && styles.locChipTextSelected]}>
                  Job site
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setLocationMode(index, false)}
                style={({ pressed }) => [
                  styles.locChip,
                  !row.useJobLocation && styles.locChipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={!row.useJobLocation ? colors.black : colors.grey600}
                />
                <Text style={[styles.locChipText, !row.useJobLocation && styles.locChipTextSelected]}>
                  Other address
                </Text>
              </Pressable>
            </View>

            {row.useJobLocation ? (
              <>
                <Text style={styles.locHint} numberOfLines={3}>
                  {jobSiteAddress.trim() || 'Same address as the job card above.'}
                </Text>
                {canOpenMapsForAddress(jobSiteAddress) ? (
                  <OpenInMapsButton
                    compact
                    label="Open job site in maps"
                    onPress={() => promptMapsForAddress(jobSiteAddress)}
                  />
                ) : null}
              </>
            ) : (
              <>
                <TextInput
                  value={row.location}
                  onChangeText={(text) =>
                    updateRow(index, { location: text, latitude: undefined, longitude: undefined })
                  }
                  placeholder="Street, city, country…"
                  placeholderTextColor={colors.grey400}
                  multiline
                  style={[styles.input, styles.multiline]}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={() => setMapPickerIndex(index)}
                  style={({ pressed }) => [styles.pickMapBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="map-outline" size={18} color={colors.black} />
                  <View style={styles.pickMapBody}>
                    <Text style={styles.pickMapTitle}>
                      {hasMapPin(row) ? 'Edit map location' : 'Pick on map'}
                    </Text>
                    <Text style={styles.pickMapHint} numberOfLines={2}>
                      {hasMapPin(row)
                        ? row.location || 'Location pinned — tap to adjust'
                        : 'Search, drop pin, confirm'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
                </Pressable>
                {hasMapPin(row) ? (
                  <View style={styles.pinBadge}>
                    <Ionicons name="pin" size={12} color={colors.info} />
                    <Text style={styles.pinText}>Map pin saved</Text>
                  </View>
                ) : null}
                {canOpenMapsForAddressEntry({
                  text: row.location,
                  latitude: row.latitude,
                  longitude: row.longitude,
                }) ? (
                  <OpenInMapsButton
                    compact
                    onPress={() =>
                      promptMapsForAddressEntry({
                        text: row.location,
                        latitude: row.latitude,
                        longitude: row.longitude,
                      })
                    }
                  />
                ) : null}
              </>
            )}

            <Text style={styles.sectionTitle}>Actual on site</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeHalf}>
                <DateTimeField
                  label="Arrival"
                  value={row.actualArrivalAt}
                  onChange={(actualArrivalAt) => updateRow(index, { actualArrivalAt })}
                  mode="time"
                  icon="log-in-outline"
                  optional
                  placeholder="Actual"
                  pickerKey={`${row.key}-actual-arrival`}
                  activePickerKey={activePickerKey}
                  onActivePickerChange={setActivePickerKey}
                />
              </View>
              <View style={styles.timeHalf}>
                <DateTimeField
                  label="Departure"
                  value={row.actualDepartureAt}
                  onChange={(actualDepartureAt) => updateRow(index, { actualDepartureAt })}
                  mode="time"
                  icon="log-out-outline"
                  optional
                  placeholder="Actual"
                  pickerKey={`${row.key}-actual-departure`}
                  activePickerKey={activePickerKey}
                  onActivePickerChange={setActivePickerKey}
                />
              </View>
            </View>
          </View>
          );
        })}
      </View>

      <MapPinPickerModal
        visible={mapPickerIndex !== null}
        initial={
          mapRow
            ? { text: mapRow.location, latitude: mapRow.latitude, longitude: mapRow.longitude }
            : undefined
        }
        onClose={() => setMapPickerIndex(null)}
        onConfirm={(result) => {
          if (mapPickerIndex !== null) {
            updateRow(mapPickerIndex, {
              useJobLocation: false,
              location: result.text,
              latitude: result.latitude,
              longitude: result.longitude,
            });
          }
          setMapPickerIndex(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: { ...typography.label, color: colors.grey600 },
  sectionTitle: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.xs,
  },
  fieldLabel: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.grey600, marginBottom: spacing.sm },
  rows: { gap: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    overflow: 'visible',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIndex: { ...typography.caption, color: colors.black, fontWeight: '700' },
  durationRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  durationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.grey100,
  },
  durationChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  durationChipText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  durationChipTextSelected: { color: colors.black },
  locModeRow: { flexDirection: 'row', gap: spacing.sm },
  locChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.grey100,
  },
  locChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  locChipText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  locChipTextSelected: { color: colors.black },
  locHint: { ...typography.caption, color: colors.grey600, fontStyle: 'italic' },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeHalf: { flex: 1, minWidth: 0 },
  removeBtn: { padding: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.black,
    backgroundColor: colors.white,
  },
  multiline: { minHeight: 72 },
  pickMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.grey100,
  },
  pickMapBody: { flex: 1 },
  pickMapTitle: { ...typography.caption, color: colors.black, fontWeight: '700' },
  pickMapHint: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
  },
  pinText: { ...typography.caption, color: colors.info, fontWeight: '600', fontSize: 11 },
  pressed: { opacity: 0.85 },
});
