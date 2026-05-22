import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  DEFAULT_COUNTRY_DIAL,
  countryDialPickerOptions,
  findCountryByDial,
} from '../constants/countryDialCodes';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  PHONE_LABELS,
  defaultPhoneEntry,
  type PhoneEntry,
  type PhoneLabel,
} from '../lib/clientContact';
import { PickerSheet } from './PickerSheet';

interface ContactPhonesFieldProps {
  values: PhoneEntry[];
  onChange: (values: PhoneEntry[]) => void;
}

export function ContactPhonesField({ values, onChange }: ContactPhonesFieldProps) {
  const rows = values.length > 0 ? values : [defaultPhoneEntry()];
  const [countryPickerIndex, setCountryPickerIndex] = useState<number | null>(null);
  const [labelPickerIndex, setLabelPickerIndex] = useState<number | null>(null);
  const countryOptions = useMemo(() => countryDialPickerOptions(), []);

  const updateRow = (index: number, patch: Partial<PhoneEntry>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultPhoneEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultPhoneEntry()]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Phone numbers</Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add phone</Text>
        </Pressable>
      </View>

      <View style={styles.rows}>
        {rows.map((row, index) => {
          const country = findCountryByDial(row.countryDial) ?? findCountryByDial(DEFAULT_COUNTRY_DIAL);
          return (
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

              <View style={styles.phoneRow}>
                <Pressable
                  onPress={() => setCountryPickerIndex(index)}
                  style={({ pressed }) => [styles.countryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.countryFlag}>{country?.flag ?? '🇱🇧'}</Text>
                  <Text style={styles.countryDial}>{row.countryDial || DEFAULT_COUNTRY_DIAL}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.grey600} />
                </Pressable>
                <TextInput
                  value={row.nationalNumber}
                  onChangeText={(text) =>
                    updateRow(index, { nationalNumber: text.replace(/[^\d\s-]/g, '') })
                  }
                  placeholder="Phone number"
                  placeholderTextColor={colors.grey400}
                  keyboardType="phone-pad"
                  style={styles.numberInput}
                />
              </View>
            </View>
          );
        })}
      </View>

      <PickerSheet
        visible={countryPickerIndex !== null}
        title="Country code"
        options={countryOptions}
        searchPlaceholder="Search country or code…"
        emptyLabel="No country found."
        onClose={() => setCountryPickerIndex(null)}
        onSelect={(opt) => {
          if (countryPickerIndex !== null) {
            updateRow(countryPickerIndex, { countryDial: opt.id });
          }
          setCountryPickerIndex(null);
        }}
      />

      <PickerSheet
        visible={labelPickerIndex !== null}
        compact
        title="Phone label"
        options={PHONE_LABELS.map((label) => ({ id: label, label }))}
        onClose={() => setLabelPickerIndex(null)}
        onSelect={(opt) => {
          if (labelPickerIndex !== null) {
            updateRow(labelPickerIndex, { label: opt.id as PhoneLabel });
          }
          setLabelPickerIndex(null);
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
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    minWidth: 108,
  },
  countryFlag: { fontSize: 16 },
  countryDial: { ...typography.caption, color: colors.black, fontWeight: '700' },
  numberInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.black,
    backgroundColor: colors.white,
  },
  pressed: { opacity: 0.85 },
});
