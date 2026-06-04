import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PickerSheet } from './PickerSheet';
import { WorkReportEntryAttachments } from './WorkReportEntryAttachments';
import { colors, radius, spacing, typography } from '../constants/theme';
import { newContactKey } from '../lib/clientContact';
import {
  defaultWorkReportFormState,
  type WorkReportFormState,
  type WorkReportTextEntry,
  type WorkReportVisitOption,
} from '../lib/jobWorkReports';

interface JobWorkReportsFieldProps {
  value: WorkReportFormState;
  onChange: (value: WorkReportFormState) => void;
  visitOptions?: WorkReportVisitOption[];
  lockedVisitIds?: string[];
}

function isVisitRowLocked(visitId: string | null, lockedVisitIds: string[]): boolean {
  return Boolean(visitId && lockedVisitIds.includes(visitId));
}

function TextEntryList({
  label,
  addLabel,
  placeholder,
  rows,
  visitOptions,
  onChange,
  showAttachments = true,
  lockedVisitIds = [],
}: {
  label: string;
  addLabel: string;
  placeholder: string;
  rows: WorkReportTextEntry[];
  visitOptions: WorkReportVisitOption[];
  onChange: (rows: WorkReportTextEntry[]) => void;
  showAttachments?: boolean;
  lockedVisitIds?: string[];
}) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const defaultVisitId = visitOptions.find((option) => option.id)?.id ?? null;

  const updateRow = (index: number, patch: Partial<WorkReportTextEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(
      next.length > 0
        ? next
        : [
            {
              key: newContactKey('entry'),
              text: '',
              visitId: defaultVisitId,
              photoIds: [],
              documentIds: [],
            },
          ],
    );
  };

  const addRow = () => {
    onChange([
      ...rows,
      {
        key: newContactKey('entry'),
        text: '',
        visitId: defaultVisitId,
        photoIds: [],
        documentIds: [],
      },
    ]);
  };

  const selectedVisitLabel = (visitId: string | null) =>
    visitOptions.find((option) => option.id === visitId)?.label ?? visitOptions[0]?.label ?? 'General';

  return (
    <View style={styles.block}>
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
            {visitOptions.length > 1 ? (
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

            {showAttachments ? (
              <WorkReportEntryAttachments
                photoIds={row.photoIds}
                documentIds={row.documentIds}
                onChange={(attachments) => updateRow(index, attachments)}
              />
            ) : null}
            </View>
          </View>
          );
        })}
      </View>

      <PickerSheet
        visible={pickerIndex !== null}
        title="Link to visit"
        compact
        options={visitOptions.map((option) => ({
          id: option.id ?? '__general__',
          label: option.label,
        }))}
        onSelect={(option) => {
          if (pickerIndex === null) return;
          updateRow(pickerIndex, { visitId: option.id === '__general__' ? null : option.id });
          setPickerIndex(null);
        }}
        onClose={() => setPickerIndex(null)}
      />
    </View>
  );
}

export function JobWorkReportsField({
  value,
  onChange,
  visitOptions = [],
  lockedVisitIds = [],
}: JobWorkReportsFieldProps) {
  const state =
    value.workItems.length || value.partItems.length || value.noteItems?.length
      ? { ...defaultWorkReportFormState(), ...value, noteItems: value.noteItems ?? [] }
      : defaultWorkReportFormState();
  const options = useMemo(
    () =>
      visitOptions.length
        ? visitOptions
        : [{ id: null, label: 'General (not linked to a visit)' }],
    [visitOptions],
  );

  return (
    <View style={styles.wrap}>
      <TextEntryList
        label="Work performed"
        addLabel="Add entry"
        placeholder="Diagnostics, repairs, actions taken..."
        rows={state.workItems}
        visitOptions={options}
        onChange={(workItems) => onChange({ ...state, workItems })}
        lockedVisitIds={lockedVisitIds}
      />
      <TextEntryList
        label="Parts used"
        addLabel="Add part"
        placeholder="Part name and quantity"
        rows={state.partItems}
        visitOptions={options}
        onChange={(partItems) => onChange({ ...state, partItems })}
        lockedVisitIds={lockedVisitIds}
      />
      <TextEntryList
        label="Work notes"
        addLabel="Add note"
        placeholder="Observations, follow-ups, site context…"
        rows={state.noteItems}
        visitOptions={options}
        onChange={(noteItems) => onChange({ ...state, noteItems })}
        showAttachments={false}
        lockedVisitIds={lockedVisitIds}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  block: { gap: spacing.sm },
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
  multiline: { minHeight: 88 },
  pressed: { opacity: 0.85 },
});
