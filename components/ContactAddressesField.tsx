import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  ADDRESS_LABELS,
  defaultAddressEntry,
  hasMapPin,
  type AddressEntry,
  type AddressLabel,
} from '../lib/clientAddresses';
import { MapPinPickerModal } from './MapPinPickerModal';
import { PickerSheet } from './PickerSheet';

interface ContactAddressesFieldProps {
  values: AddressEntry[];
  onChange: (values: AddressEntry[]) => void;
}

export function ContactAddressesField({ values, onChange }: ContactAddressesFieldProps) {
  const rows = values.length > 0 ? values : [defaultAddressEntry()];
  const [labelPickerIndex, setLabelPickerIndex] = useState<number | null>(null);
  const [mapPickerIndex, setMapPickerIndex] = useState<number | null>(null);

  const updateRow = (index: number, patch: Partial<AddressEntry>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultAddressEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultAddressEntry()]);
  };

  const activeRow = mapPickerIndex != null ? rows[mapPickerIndex] : undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Addresses</Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add address</Text>
        </Pressable>
      </View>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <View key={row.key} style={styles.card}>
            <View style={styles.cardTop}>
              <Pressable
                onPress={() => setLabelPickerIndex(index)}
                style={({ pressed }) => [styles.labelChip, pressed && styles.pressed]}
              >
                <Text style={styles.labelChipText}>{row.label}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.grey600} />
              </Pressable>
              <Pressable
                onPress={() => removeRow(index)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.grey400} />
              </Pressable>
            </View>

            <TextInput
              value={row.reference ?? ''}
              onChangeText={(text) => updateRow(index, { reference: text })}
              placeholder="Reference tag (optional)"
              placeholderTextColor={colors.grey400}
              style={styles.referenceInput}
            />

            <TextInput
              value={row.text}
              onChangeText={(text) =>
                updateRow(index, { text, latitude: undefined, longitude: undefined })
              }
              placeholder="Street, city, country…"
              placeholderTextColor={colors.grey400}
              multiline
              style={styles.addressInput}
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
                    ? row.text || 'Location pinned — tap to adjust'
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
          </View>
        ))}
      </View>

      <PickerSheet
        visible={labelPickerIndex !== null}
        compact
        title="Address label"
        options={ADDRESS_LABELS.map((label) => ({ id: label, label }))}
        onClose={() => setLabelPickerIndex(null)}
        onSelect={(opt) => {
          if (labelPickerIndex !== null) {
            updateRow(labelPickerIndex, { label: opt.id as AddressLabel });
          }
          setLabelPickerIndex(null);
        }}
      />

      <MapPinPickerModal
        visible={mapPickerIndex !== null}
        initial={
          activeRow
            ? {
                latitude: activeRow.latitude,
                longitude: activeRow.longitude,
                text: activeRow.text,
              }
            : undefined
        }
        onClose={() => setMapPickerIndex(null)}
        onConfirm={(result) => {
          if (mapPickerIndex !== null) {
            updateRow(mapPickerIndex, {
              text: result.text,
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
    marginBottom: spacing.sm,
  },
  label: { ...typography.label, color: colors.grey600 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
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
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.grey100,
  },
  labelChipText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  removeBtn: { padding: 2 },
  referenceInput: {
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.black,
    backgroundColor: colors.white,
  },
  addressInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.black,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
  pickMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.grey100,
  },
  pickMapBody: { flex: 1, gap: 2 },
  pickMapTitle: { ...typography.caption, color: colors.black, fontWeight: '700' },
  pickMapHint: { ...typography.caption, color: colors.grey600, fontSize: 11 },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
  },
  pinText: { ...typography.caption, color: colors.info, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
