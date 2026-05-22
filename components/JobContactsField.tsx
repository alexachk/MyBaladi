import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { clientPrimaryPhone } from '../lib/clientContact';
import {
  JOB_CONTACT_ROLES,
  defaultJobContactEntry,
  jobContactFromPerson,
  type JobContactEntry,
  type JobContactRole,
} from '../lib/jobContacts';
import type { Person } from '../types/client';
import { PickerSheet, type PickerOption } from './PickerSheet';

interface JobContactsFieldProps {
  values: JobContactEntry[];
  onChange: (values: JobContactEntry[]) => void;
  linkedPersons: Person[];
  allPersons: Person[];
  companyId?: string;
}

export function JobContactsField({
  values,
  onChange,
  linkedPersons,
  allPersons,
  companyId,
}: JobContactsFieldProps) {
  const rows = values.length > 0 ? values : [defaultJobContactEntry()];
  const [rolePickerIndex, setRolePickerIndex] = useState<number | null>(null);
  const [personPickerIndex, setPersonPickerIndex] = useState<number | null>(null);

  const pickerPool = companyId && linkedPersons.length > 0 ? linkedPersons : allPersons;
  const usedPersonIds = useMemo(
    () => new Set(rows.map((row) => row.personId).filter(Boolean)),
    [rows],
  );

  const personOptions: PickerOption[] = useMemo(
    () =>
      pickerPool
        .filter((p) => !usedPersonIds.has(p.id) || rows[personPickerIndex ?? -1]?.personId === p.id)
        .map((p) => ({
          id: p.id,
          label: p.fullName,
          hint: p.phone || p.email || undefined,
          icon: 'person-outline' as const,
        })),
    [pickerPool, usedPersonIds, rows, personPickerIndex],
  );

  const updateRow = (index: number, patch: Partial<JobContactEntry>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultJobContactEntry()]);
  };

  const addManualRow = () => {
    onChange([...rows, defaultJobContactEntry()]);
  };

  const addFromPerson = (person: Person) => {
    if (usedPersonIds.has(person.id)) return;
    const filled = rows.filter((row) => row.name.trim() || row.phone.trim() || row.personId);
    onChange([...filled, jobContactFromPerson(person)]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Site contacts</Text>
        <Pressable
          onPress={addManualRow}
          hitSlop={8}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add contact</Text>
        </Pressable>
      </View>

      {companyId && linkedPersons.length > 0 ? (
        <>
          <Text style={styles.hint}>Pick from company list</Text>
          <View style={styles.quickRow}>
            {linkedPersons.map((person) => {
              const added = usedPersonIds.has(person.id);
              return (
                <Pressable
                  key={person.id}
                  onPress={() => !added && addFromPerson(person)}
                  disabled={added}
                  style={({ pressed }) => [
                    styles.quickChip,
                    added && styles.quickChipAdded,
                    pressed && !added && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={added ? 'checkmark-circle' : 'person-add-outline'}
                    size={14}
                    color={added ? colors.grey400 : colors.black}
                  />
                  <Text style={[styles.quickChipText, added && styles.quickChipTextAdded]}>
                    {person.fullName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/clients/new-person', params: { companyId } })}
            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
          >
            <Ionicons name="person-add-outline" size={14} color={colors.primary} />
            <Text style={styles.linkText}>Create new company contact</Text>
          </Pressable>
        </>
      ) : null}

      <View style={styles.rows}>
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
              <View style={styles.cardTopActions}>
                <Pressable
                  onPress={() => setPersonPickerIndex(index)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.pickBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="list-outline" size={16} color={colors.black} />
                </Pressable>
                <Pressable
                  onPress={() => removeRow(index)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.grey400} />
                </Pressable>
              </View>
            </View>

            {row.personId ? (
              <View style={styles.linkedBadge}>
                <Ionicons name="link-outline" size={12} color={colors.info} />
                <Text style={styles.linkedText}>Linked contact</Text>
              </View>
            ) : null}

            <TextInput
              value={row.name}
              onChangeText={(text) => updateRow(index, { name: text, personId: undefined })}
              placeholder="Contact name"
              placeholderTextColor={colors.grey400}
              style={styles.input}
              autoCapitalize="words"
            />
            <TextInput
              value={row.phone}
              onChangeText={(text) => updateRow(index, { phone: text, personId: undefined })}
              placeholder="Phone number"
              placeholderTextColor={colors.grey400}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>
        ))}
      </View>

      <PickerSheet
        visible={rolePickerIndex !== null}
        compact
        title="Contact role"
        options={JOB_CONTACT_ROLES.map((role) => ({ id: role, label: role }))}
        onClose={() => setRolePickerIndex(null)}
        onSelect={(opt) => {
          if (rolePickerIndex !== null) {
            updateRow(rolePickerIndex, { role: opt.id as JobContactRole });
          }
          setRolePickerIndex(null);
        }}
      />

      <PickerSheet
        visible={personPickerIndex !== null}
        title={companyId ? 'Pick company contact' : 'Pick contact'}
        options={personOptions}
        emptyLabel={
          companyId
            ? 'No more linked contacts. Add manually or create one.'
            : 'No contacts yet. Add manually or create in Clients.'
        }
        searchPlaceholder="Search contacts"
        onClose={() => setPersonPickerIndex(null)}
        onSelect={(opt) => {
          if (personPickerIndex === null) return;
          const person = pickerPool.find((p) => p.id === opt.id);
          if (person) {
            updateRow(personPickerIndex, {
              personId: person.id,
              name: person.fullName,
              phone: clientPrimaryPhone(person),
              role: rows[personPickerIndex]?.role ?? 'Site',
            });
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.grey600, marginBottom: spacing.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  quickChipAdded: {
    backgroundColor: colors.grey100,
    borderColor: colors.grey200,
  },
  quickChipText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  quickChipTextAdded: { color: colors.grey400 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  linkText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
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
  cardTopActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  pickBtn: { padding: 4 },
  removeBtn: { padding: 2 },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
  },
  linkedText: { ...typography.caption, color: colors.info, fontWeight: '600', fontSize: 11 },
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
  pressed: { opacity: 0.85 },
});
