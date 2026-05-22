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
  WEBSITE_LABELS,
  defaultWebsiteEntry,
  type WebsiteEntry,
  type WebsiteLabel,
} from '../lib/clientWebsites';
import { PickerSheet } from './PickerSheet';

interface ContactWebsitesFieldProps {
  values: WebsiteEntry[];
  onChange: (values: WebsiteEntry[]) => void;
  errors?: Record<string, string>;
  registerField?: (key: string) => (node: View | null) => void;
}

export function ContactWebsitesField({
  values,
  onChange,
  errors,
  registerField,
}: ContactWebsitesFieldProps) {
  const rows = values.length > 0 ? values : [defaultWebsiteEntry()];
  const [labelPickerIndex, setLabelPickerIndex] = useState<number | null>(null);

  const updateRow = (index: number, patch: Partial<WebsiteEntry>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultWebsiteEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultWebsiteEntry()]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Websites</Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add website</Text>
        </Pressable>
      </View>

      <View style={styles.rows}>
        {rows.map((row, index) => {
          const rowError = errors?.[row.key];
          return (
            <View
              key={row.key}
              ref={registerField?.(`website:${row.key}`)}
              collapsable={false}
              style={[styles.card, rowError ? styles.cardError : null]}
            >
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
                value={row.url}
                onChangeText={(text) => updateRow(index, { url: text })}
                placeholder="https://example.com"
                placeholderTextColor={colors.grey400}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.urlInput, rowError ? styles.inputError : null]}
              />
              {rowError ? <Text style={styles.errorText}>{rowError}</Text> : null}
            </View>
          );
        })}
      </View>

      <PickerSheet
        visible={labelPickerIndex !== null}
        compact
        title="Website label"
        options={WEBSITE_LABELS.map((label) => ({ id: label, label }))}
        onClose={() => setLabelPickerIndex(null)}
        onSelect={(opt) => {
          if (labelPickerIndex !== null) {
            updateRow(labelPickerIndex, { label: opt.id as WebsiteLabel });
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
  urlInput: {
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
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },
  pressed: { opacity: 0.85 },
});
