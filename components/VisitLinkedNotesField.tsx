import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { defaultVisitNoteEntry, type VisitNoteEntry } from '../lib/jobVisitNotes';
import type { VisitLinkOption } from '../lib/jobVisitLink';
import { PickerSheet } from './PickerSheet';

interface VisitLinkedNotesFieldProps {
  label?: string;
  addLabel?: string;
  placeholder?: string;
  values: VisitNoteEntry[];
  onChange: (values: VisitNoteEntry[]) => void;
  visitOptions: VisitLinkOption[];
  lockedVisitIds?: string[];
}

function isVisitRowLocked(visitId: string | null, lockedVisitIds: string[]): boolean {
  return Boolean(visitId && lockedVisitIds.includes(visitId));
}

export function VisitLinkedNotesField({
  label = 'Notes',
  addLabel = 'Add note',
  placeholder = 'Instructions, reminders, context…',
  values,
  onChange,
  visitOptions,
  lockedVisitIds = [],
}: VisitLinkedNotesFieldProps) {
  const rows = values.length > 0 ? values : [defaultVisitNoteEntry()];
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const options = useMemo(
    () =>
      visitOptions.length
        ? visitOptions
        : [{ id: null, label: 'General (whole job)' }],
    [visitOptions],
  );

  const updateRow = (index: number, patch: Partial<VisitNoteEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultVisitNoteEntry()]);
  };

  const addRow = () => {
    const defaultVisitId = options.find((opt) => opt.id)?.id ?? null;
    onChange([...rows, defaultVisitNoteEntry(defaultVisitId)]);
  };

  const selectedVisitLabel = (visitId: string | null) =>
    options.find((option) => option.id === visitId)?.label ?? options[0]?.label ?? 'General';

  const pickerOptions = useMemo(
    () => options.map((opt) => ({ id: opt.id ?? '__general__', label: opt.label })),
    [options],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>{addLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.rows}>
        {rows.map((row, index) => {
          const rowLocked = isVisitRowLocked(row.visitId, lockedVisitIds);
          return (
          <View key={row.key} style={[styles.card, rowLocked && styles.cardLocked]}>
            {rowLocked ? (
              <Text style={styles.lockedBanner}>Completed visit — Level 2/3 only</Text>
            ) : null}
            <View style={styles.cardTop}>
              {rows.length > 1 ? (
                <Text style={styles.rowIndex}>#{index + 1}</Text>
              ) : (
                <View />
              )}
              {rows.length > 1 && !rowLocked ? (
                <Pressable
                  onPress={() => removeRow(index)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.grey400} />
                </Pressable>
              ) : null}
            </View>

            <View pointerEvents={rowLocked ? 'none' : 'auto'} style={rowLocked ? styles.disabledBlock : undefined}>
            {options.length > 0 ? (
              <Pressable
                onPress={() => setPickerIndex(index)}
                style={({ pressed }) => [styles.visitPicker, pressed && styles.pressed]}
              >
                <Ionicons name="calendar-outline" size={14} color={colors.info} />
                <Text style={styles.visitPickerText} numberOfLines={2}>
                  {selectedVisitLabel(row.visitId)}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.grey400} />
              </Pressable>
            ) : null}

            <TextInput
              value={row.text}
              onChangeText={(text) => updateRow(index, { text })}
              placeholder={placeholder}
              placeholderTextColor={colors.grey400}
              style={[styles.input, styles.multiline]}
              multiline
              textAlignVertical="top"
              editable={!rowLocked}
            />
            </View>
          </View>
          );
        })}
      </View>

      <PickerSheet
        visible={pickerIndex !== null}
        title="Link to visit"
        compact
        options={pickerOptions}
        onSelect={(opt) => {
          if (pickerIndex === null) return;
          updateRow(pickerIndex, { visitId: opt.id === '__general__' ? null : opt.id });
          setPickerIndex(null);
        }}
        onClose={() => setPickerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { ...typography.label, color: colors.grey600 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  rows: { gap: spacing.sm },
  cardLocked: { backgroundColor: colors.grey100, opacity: 0.92 },
  lockedBanner: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  disabledBlock: { opacity: 0.55 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowIndex: { ...typography.caption, color: colors.grey600, fontWeight: '700' },
  removeBtn: { padding: 2 },
  visitPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  visitPickerText: {
    flex: 1,
    ...typography.caption,
    color: colors.black,
    fontWeight: '600',
  },
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
  pressed: { opacity: 0.85 },
});
