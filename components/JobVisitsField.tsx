import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateTimeField } from './DateTimeField';
import { MapPinPickerModal } from './MapPinPickerModal';
import { OpenInMapsButton } from './OpenInMapsButton';
import { colors, radius, spacing, typography } from '../constants/theme';
import { hasMapPin } from '../lib/clientAddresses';
import { canOpenMapsForAddress, canOpenMapsForAddressEntry, promptMapsForAddress, promptMapsForAddressEntry } from '../lib/maps';
import {
  defaultVisitEntry,
  type JobVisitEntry,
} from '../lib/jobVisits';

interface JobVisitsFieldProps {
  values: JobVisitEntry[];
  onChange: (values: JobVisitEntry[]) => void;
  jobSiteAddress?: string;
}

export function JobVisitsField({ values, onChange, jobSiteAddress = '' }: JobVisitsFieldProps) {
  const rows = values.length > 0 ? values : [defaultVisitEntry()];
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

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Scheduled visits</Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add visit</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Open ticket — program one or more visits. Reschedule or mark done from the job card later.</Text>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <View key={row.key} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardIndex}>Visit {index + 1}</Text>
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
              placeholder="Label (optional) e.g. Phase 1, Follow-up"
              placeholderTextColor={colors.grey400}
              style={styles.input}
            />

            <DateTimeField
              label="Visit date & time"
              value={row.scheduledAt}
              onChange={(scheduledAt) => updateRow(index, { scheduledAt })}
              mode="datetime"
              icon="calendar-outline"
            />

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

            <View style={styles.timeRow}>
              <View style={styles.timeHalf}>
                <DateTimeField
                  label="Arrival"
                  value={row.arrivalAt}
                  onChange={(arrivalAt) => updateRow(index, { arrivalAt })}
                  mode="time"
                  icon="log-in-outline"
                  optional
                  placeholder="On site"
                />
              </View>
              <View style={styles.timeHalf}>
                <DateTimeField
                  label="Departure"
                  value={row.departureAt}
                  onChange={(departureAt) => updateRow(index, { departureAt })}
                  mode="time"
                  icon="log-out-outline"
                  optional
                  placeholder="Left site"
                />
              </View>
            </View>
          </View>
        ))}
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
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIndex: { ...typography.caption, color: colors.black, fontWeight: '700' },
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
  timeHalf: { flex: 1 },
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
