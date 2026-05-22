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
  EMAIL_LABELS,
  defaultEmailEntry,
  type EmailEntry,
  type EmailLabel,
} from '../lib/clientContact';
import { emailFieldScrollKey } from '../lib/formScroll';
import { PickerSheet } from './PickerSheet';

interface ContactEmailsFieldProps {
  values: EmailEntry[];
  onChange: (values: EmailEntry[]) => void;
  errors?: Record<string, string>;
  registerField?: (key: string) => (node: View | null) => void;
}

export function ContactEmailsField({ values, onChange, errors, registerField }: ContactEmailsFieldProps) {
  const rows = values.length > 0 ? values : [defaultEmailEntry()];
  const [labelPickerIndex, setLabelPickerIndex] = useState<number | null>(null);

  const updateRow = (index: number, patch: Partial<EmailEntry>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultEmailEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultEmailEntry()]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Email addresses</Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add email</Text>
        </Pressable>
      </View>

      <View style={styles.rows}>
        {rows.map((row, index) => {
          const rowError = errors?.[row.key];
          return (
          <View
            key={row.key}
            ref={registerField?.(emailFieldScrollKey(row.key))}
            collapsable={false}
            style={[styles.card, rowError ? styles.cardError : null]}
          >
            <Pressable
              onPress={() => setLabelPickerIndex(index)}
              style={({ pressed }) => [styles.labelChip, pressed && styles.pressed]}
            >
              <Text style={styles.labelChipText}>{row.label}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.grey600} />
            </Pressable>
            <View style={styles.emailRow}>
              <TextInput
                value={row.address}
                onChangeText={(text) => updateRow(index, { address: text })}
                placeholder="Email address"
                placeholderTextColor={colors.grey400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.emailInput, rowError ? styles.inputError : null]}
              />
              <Pressable
                onPress={() => removeRow(index)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.grey400} />
              </Pressable>
            </View>
            {rowError ? <Text style={styles.errorText}>{rowError}</Text> : null}
          </View>
          );
        })}
      </View>

      <PickerSheet
        visible={labelPickerIndex !== null}
        compact
        title="Email label"
        options={EMAIL_LABELS.map((label) => ({ id: label, label }))}
        onClose={() => setLabelPickerIndex(null)}
        onSelect={(opt) => {
          if (labelPickerIndex !== null) {
            updateRow(labelPickerIndex, { label: opt.id as EmailLabel });
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
  cardError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  labelChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.grey100,
  },
  labelChipText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emailInput: {
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
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.white,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },
  removeBtn: { padding: 2 },
  pressed: { opacity: 0.85 },
});
