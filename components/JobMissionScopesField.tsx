import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import type { Personnel } from '../lib/appwrite/adminUsers';
import { defaultEquipmentLineEntry } from '../lib/jobEquipment';
import {
  defaultMissionScopeEntry,
  type MissionScopeEntry,
} from '../lib/jobMissionScopes';
import {
  canAddMissionScopeRow,
  visitIdLocked,
  visitLinkOptionsForEdit,
  type VisitLinkOption,
} from '../lib/jobVisitLink';
import { JobAssigneesField } from './JobAssigneesField';
import { MissionTypesField } from './MissionTypesField';
import { PickerSheet } from './PickerSheet';

interface JobMissionScopesFieldProps {
  values: MissionScopeEntry[];
  onChange: (values: MissionScopeEntry[]) => void;
  visitOptions: VisitLinkOption[];
  personnel: Personnel[];
  personnelLoading?: boolean;
  onLoadPersonnel?: () => void;
  missionsError?: string;
  assigneesError?: string;
  anchorRef?: (node: View | null) => void;
  assigneesAnchorRef?: (node: View | null) => void;
  /** Done visits locked during follow-up (Level 1). */
  lockedVisitIds?: string[];
}

export function JobMissionScopesField({
  values,
  onChange,
  visitOptions,
  personnel,
  personnelLoading,
  onLoadPersonnel,
  missionsError,
  assigneesError,
  anchorRef,
  assigneesAnchorRef,
  lockedVisitIds = [],
}: JobMissionScopesFieldProps) {
  const rows = values.length > 0 ? values : [defaultMissionScopeEntry()];
  const [visitPickerIndex, setVisitPickerIndex] = useState<number | null>(null);

  const usedVisitIds = useMemo(
    () => new Set(rows.map((row) => row.visitId).filter((id): id is string => Boolean(id))),
    [rows],
  );

  const canAdd = useMemo(
    () => canAddMissionScopeRow(rows, visitOptions, lockedVisitIds),
    [rows, visitOptions, lockedVisitIds],
  );

  const visitPickerOptions = useMemo(() => {
    if (visitPickerIndex == null) return [];
    const current = rows[visitPickerIndex]?.visitId ?? null;
    return visitLinkOptionsForEdit(visitOptions, lockedVisitIds, current)
      .filter((opt) => {
        if (opt.id === current) return true;
        if (opt.id == null) return !rows.some((row, i) => i !== visitPickerIndex && !row.visitId);
        return !rows.some((row, i) => i !== visitPickerIndex && row.visitId === opt.id);
      })
      .map((opt) => ({ id: opt.id ?? '__general__', label: opt.label }));
  }, [visitOptions, rows, visitPickerIndex, lockedVisitIds]);

  const updateRow = (index: number, patch: Partial<MissionScopeEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const updateEquipment = (
    scopeIndex: number,
    equipment: MissionScopeEntry['equipment'],
  ) => {
    updateRow(scopeIndex, { equipment });
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultMissionScopeEntry()]);
  };

  const addScope = () => {
    const generalTaken = rows.some((row) => !row.visitId);
    const nextVisit = visitOptions.find(
      (opt) => opt.id && !usedVisitIds.has(opt.id) && !visitIdLocked(opt.id, lockedVisitIds),
    );
    onChange([
      ...rows,
      defaultMissionScopeEntry(generalTaken && nextVisit ? nextVisit.id : null),
    ]);
  };

  const visitLabel = (visitId: string | null) =>
    visitOptions.find((opt) => opt.id === visitId)?.label ??
    visitOptions[0]?.label ??
    'General (whole job)';

  return (
    <View ref={anchorRef} collapsable={false} style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Mission scope</Text>
        {canAdd ? (
          <Pressable onPress={addScope} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.addText}>Add scope</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Per visit or general — types, equipment (qty), team.</Text>

      <View style={styles.rows}>
        {rows.map((row, scopeIndex) => {
          const rowLocked = visitIdLocked(row.visitId, lockedVisitIds);
          return (
          <View key={row.key} style={[styles.scopeCard, rowLocked && styles.scopeCardLocked]}>
            {rowLocked ? (
              <Text style={styles.lockedBanner}>Completed visit — Level 2/3 only</Text>
            ) : null}
            <View style={styles.scopeTop}>
              <Pressable
                onPress={() => !rowLocked && setVisitPickerIndex(scopeIndex)}
                disabled={rowLocked}
                style={({ pressed }) => [styles.visitChip, pressed && styles.pressed, rowLocked && styles.disabled]}
              >
                <Ionicons name="calendar-outline" size={14} color={colors.black} />
                <Text style={styles.visitChipText} numberOfLines={2}>
                  {visitLabel(row.visitId)}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.grey600} />
              </Pressable>
              {rows.length > 1 && !rowLocked ? (
                <Pressable
                  onPress={() => removeRow(scopeIndex)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.grey400} />
                </Pressable>
              ) : null}
            </View>

            <View pointerEvents={rowLocked ? 'none' : 'auto'} style={rowLocked ? styles.disabledBlock : undefined}>
            <MissionTypesField
              values={row.missionTypes}
              onChange={(next) => updateRow(scopeIndex, { missionTypes: next })}
              error={scopeIndex === 0 ? missionsError : undefined}
            />

            <Text style={styles.subLabel}>Equipment / systems</Text>
            {row.equipment.map((eq, eqIndex) => (
              <View key={eq.key} style={styles.eqRow}>
                <TextInput
                  value={eq.name}
                  onChangeText={(text) => {
                    const next = row.equipment.map((item, i) =>
                      i === eqIndex ? { ...item, name: text } : item,
                    );
                    updateEquipment(scopeIndex, next);
                  }}
                  placeholder="Item name"
                  placeholderTextColor={colors.grey400}
                  style={styles.eqInput}
                />
                <Pressable
                  onPress={() => {
                    const next = row.equipment.map((item, i) =>
                      i === eqIndex
                        ? {
                            ...item,
                            quantifiable: !item.quantifiable,
                            quantity: !item.quantifiable ? item.quantity ?? 1 : null,
                          }
                        : item,
                    );
                    updateEquipment(scopeIndex, next);
                  }}
                  style={[styles.qtyToggle, eq.quantifiable && styles.qtyToggleOn]}
                >
                  <Text style={[styles.qtyToggleText, eq.quantifiable && styles.qtyToggleTextOn]}>
                    Qty
                  </Text>
                </Pressable>
                {eq.quantifiable ? (
                  <TextInput
                    value={eq.quantity != null ? String(eq.quantity) : ''}
                    onChangeText={(text) => {
                      const qty = text.trim() ? Number(text.replace(',', '.')) : null;
                      const next = row.equipment.map((item, i) =>
                        i === eqIndex
                          ? {
                              ...item,
                              quantity: qty != null && Number.isFinite(qty) ? qty : null,
                            }
                          : item,
                      );
                      updateEquipment(scopeIndex, next);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.grey400}
                    style={styles.qtyInput}
                  />
                ) : null}
                {row.equipment.length > 1 ? (
                  <Pressable
                    onPress={() => {
                      const next = row.equipment.filter((_, i) => i !== eqIndex);
                      updateEquipment(
                        scopeIndex,
                        next.length > 0 ? next : [{ ...eq, name: '', quantity: null, quantifiable: false }],
                      );
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.grey400} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Pressable
              onPress={() =>
                updateEquipment(scopeIndex, [
                  ...row.equipment,
                  defaultEquipmentLineEntry(),
                ])
              }
              style={({ pressed }) => [styles.eqAdd, pressed && styles.pressed]}
            >
              <Text style={styles.eqAddText}>Add equipment</Text>
            </Pressable>

            <JobAssigneesField
              values={row.team}
              onChange={(next) => updateRow(scopeIndex, { team: next })}
              personnel={personnel}
              personnelLoading={personnelLoading}
              onLoadPersonnel={onLoadPersonnel}
              error={scopeIndex === 0 ? assigneesError : undefined}
              anchorRef={scopeIndex === 0 ? assigneesAnchorRef : undefined}
            />
            </View>

          </View>
          );
        })}
      </View>

      <PickerSheet
        visible={visitPickerIndex !== null}
        compact
        title="Link to visit"
        options={visitPickerOptions}
        onClose={() => setVisitPickerIndex(null)}
        onSelect={(opt) => {
          if (visitPickerIndex !== null) {
            const visitId = opt.id === '__general__' ? null : opt.id;
            updateRow(visitPickerIndex, { visitId });
          }
          setVisitPickerIndex(null);
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
  hint: { ...typography.caption, color: colors.grey600, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  rows: { gap: spacing.md },
  scopeCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  scopeCardLocked: { backgroundColor: colors.grey100, opacity: 0.92 },
  lockedBanner: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  disabled: { opacity: 0.55 },
  disabledBlock: { opacity: 0.55 },
  scopeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  visitChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  visitChipText: { ...typography.caption, color: colors.black, flex: 1, fontWeight: '600' },
  removeBtn: { padding: 2 },
  subLabel: { ...typography.label, color: colors.grey600, marginTop: spacing.xs },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  eqInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.black,
    backgroundColor: colors.white,
  },
  qtyToggle: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
  },
  qtyToggleOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  qtyToggleText: { ...typography.caption, color: colors.grey600, fontWeight: '700' },
  qtyToggleTextOn: { color: colors.black },
  qtyInput: {
    width: 52,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.black,
    textAlign: 'center',
    backgroundColor: colors.white,
  },
  eqAdd: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  eqAddText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 72,
    fontSize: 15,
    color: colors.black,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
  },
  pressed: { opacity: 0.85 },
});
