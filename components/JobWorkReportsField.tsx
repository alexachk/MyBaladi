import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  defaultWorkReportEntry,
  type WorkReportEntry,
} from '../lib/jobWorkReports';

interface JobWorkReportsFieldProps {
  values: WorkReportEntry[];
  onChange: (values: WorkReportEntry[]) => void;
}

export function JobWorkReportsField({ values, onChange }: JobWorkReportsFieldProps) {
  const rows = values.length > 0 ? values : [defaultWorkReportEntry()];

  const updateRow = (index: number, patch: Partial<WorkReportEntry>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultWorkReportEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultWorkReportEntry(`Section ${rows.length + 1}`)]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Work sections</Text>
        <Pressable
          onPress={addRow}
          hitSlop={8}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add section</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Split work by area, system, or visit phase.</Text>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <View key={row.key} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardIndex}>Section {index + 1}</Text>
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

            <Text style={styles.fieldLabel}>Title (optional)</Text>
            <TextInput
              value={row.title}
              onChangeText={(text) => updateRow(index, { title: text })}
              placeholder="e.g. Rooftop unit, Electrical panel"
              placeholderTextColor={colors.grey400}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Work performed</Text>
            <TextInput
              value={row.workPerformed}
              onChangeText={(text) => updateRow(index, { workPerformed: text })}
              placeholder="Diagnostics, repairs, actions taken..."
              placeholderTextColor={colors.grey400}
              style={[styles.input, styles.multiline]}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Parts used</Text>
            <TextInput
              value={row.partsUsed}
              onChangeText={(text) => updateRow(index, { partsUsed: text })}
              placeholder="Parts and quantities for this section"
              placeholderTextColor={colors.grey400}
              style={[styles.input, styles.multiline]}
              multiline
              textAlignVertical="top"
            />
          </View>
        ))}
      </View>
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
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardIndex: { ...typography.caption, color: colors.black, fontWeight: '700' },
  removeBtn: { padding: 2 },
  fieldLabel: { ...typography.caption, color: colors.grey600, marginTop: spacing.xs },
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
  multiline: {
    minHeight: 88,
  },
  pressed: { opacity: 0.85 },
});
