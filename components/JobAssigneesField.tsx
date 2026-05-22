import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import type { Personnel } from '../lib/appwrite/adminUsers';
import {
  ASSIGNEE_ROLES,
  assigneeRolePickHint,
  assigneeRolePickerEmptyLabel,
  assigneeRolePickerTitle,
  defaultAssigneeEntry,
  filterPersonnelForAssigneeRole,
  personnelMatchesAssigneeRole,
  type AssigneeEntry,
  type AssigneeRole,
} from '../lib/jobAssignees';
import { PickerSheet, type PickerOption } from './PickerSheet';

interface JobAssigneesFieldProps {
  values: AssigneeEntry[];
  onChange: (values: AssigneeEntry[]) => void;
  personnel: Personnel[];
  personnelLoading?: boolean;
  onLoadPersonnel?: () => void;
  error?: string;
  anchorRef?: (node: View | null) => void;
}

function personnelToOption(person: Personnel): PickerOption {
  const hintParts = [person.position, person.labels.includes('admin') ? 'Admin' : null].filter(Boolean);
  return {
    id: person.id,
    label: person.name || person.email,
    hint: hintParts.length ? hintParts.join(' · ') : person.email,
    icon: 'person-circle-outline',
  };
}

export function JobAssigneesField({
  values,
  onChange,
  personnel,
  personnelLoading,
  onLoadPersonnel,
  error,
  anchorRef,
}: JobAssigneesFieldProps) {
  const rows = values.length > 0 ? values : [defaultAssigneeEntry()];
  const [rolePickerIndex, setRolePickerIndex] = useState<number | null>(null);
  const [personPickerIndex, setPersonPickerIndex] = useState<number | null>(null);

  const activeRow = personPickerIndex != null ? rows[personPickerIndex] : undefined;
  const activeRole = activeRow?.role ?? 'Lead';

  const usedUserIds = useMemo(
    () => new Set(rows.map((row) => row.userId).filter(Boolean)),
    [rows],
  );

  const filteredPersonnel = useMemo(() => {
    if (!activeRow) return personnel;
    const pool = filterPersonnelForAssigneeRole(personnel, activeRole);
    return pool.filter(
      (person) => !usedUserIds.has(person.id) || activeRow.userId === person.id,
    );
  }, [activeRow, activeRole, personnel, usedUserIds]);

  const personnelOptions = useMemo(
    () => filteredPersonnel.map(personnelToOption),
    [filteredPersonnel],
  );

  const updateRow = (index: number, patch: Partial<AssigneeEntry>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultAssigneeEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultAssigneeEntry('', '', rows.length === 0 ? 'Lead' : 'Support')]);
  };

  const openPersonPicker = (index: number) => {
    onLoadPersonnel?.();
    setPersonPickerIndex(index);
  };

  return (
    <View ref={anchorRef} collapsable={false} style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          Team <Text style={styles.required}>*</Text>
        </Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add member</Text>
        </Pressable>
      </View>

      <View style={[styles.rows, error ? styles.rowsError : null]}>
        {rows.map((row, index) => (
          <View key={row.key} style={styles.card}>
            <View style={styles.cardTop}>
              <Pressable
                onPress={() => setRolePickerIndex(index)}
                style={({ pressed }) => [styles.labelChip, pressed && styles.pressed]}
              >
                <Text style={styles.labelChipText}>{row.role}</Text>
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

            <Pressable
              onPress={() => openPersonPicker(index)}
              style={({ pressed }) => [styles.personPicker, pressed && styles.pressed]}
            >
              <Ionicons name="construct-outline" size={18} color={colors.black} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.personName, !row.name && styles.placeholder]}>
                  {row.name || assigneeRolePickHint(row.role)}
                </Text>
                {row.userId ? (
                  <Text style={styles.personHint}>
                    {personnel.find((person) => person.id === row.userId)?.position || 'Assigned'}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.grey400} />
            </Pressable>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <PickerSheet
        visible={rolePickerIndex !== null}
        compact
        title="Role"
        options={ASSIGNEE_ROLES.map((role) => ({ id: role, label: role }))}
        onClose={() => setRolePickerIndex(null)}
        onSelect={(opt) => {
          if (rolePickerIndex !== null) {
            const nextRole = opt.id as AssigneeRole;
            const current = rows[rolePickerIndex];
            const patch: Partial<AssigneeEntry> = { role: nextRole };
            if (
              current.userId &&
              !personnelMatchesAssigneeRole(
                personnel.find((person) => person.id === current.userId)?.position ?? '',
                personnel.find((person) => person.id === current.userId)?.labels ?? [],
                nextRole,
              )
            ) {
              patch.userId = '';
              patch.name = '';
            }
            updateRow(rolePickerIndex, patch);
          }
          setRolePickerIndex(null);
        }}
      />

      <PickerSheet
        visible={personPickerIndex !== null}
        title={assigneeRolePickerTitle(activeRole)}
        loading={personnelLoading}
        options={personnelOptions}
        emptyLabel={assigneeRolePickerEmptyLabel(activeRole)}
        searchPlaceholder="Search by name, email, or role"
        onClose={() => setPersonPickerIndex(null)}
        onSelect={(opt) => {
          if (personPickerIndex !== null) {
            updateRow(personPickerIndex, { userId: opt.id, name: opt.label });
          }
          setPersonPickerIndex(null);
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
  required: { color: colors.error },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  rows: { gap: spacing.sm },
  rowsError: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.xs,
    backgroundColor: colors.errorLight,
  },
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
  personPicker: {
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
  personName: { ...typography.body, color: colors.black, fontSize: 15 },
  personHint: { ...typography.caption, color: colors.grey600, fontSize: 11, marginTop: 2 },
  placeholder: { color: colors.grey400 },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  pressed: { opacity: 0.85 },
});
