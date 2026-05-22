import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  defaultEquipmentEntry,
  type EquipmentEntry,
} from '../lib/jobEquipment';

interface JobEquipmentFieldProps {
  values: EquipmentEntry[];
  onChange: (values: EquipmentEntry[]) => void;
}

export function JobEquipmentField({ values, onChange }: JobEquipmentFieldProps) {
  const rows = values.length > 0 ? values : [defaultEquipmentEntry()];

  const updateRow = (index: number, name: string) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, name } : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [defaultEquipmentEntry()]);
  };

  const addRow = () => {
    onChange([...rows, defaultEquipmentEntry()]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Equipment / systems</Text>
        <Pressable onPress={addRow} hitSlop={8} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add item</Text>
        </Pressable>
      </View>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <View key={row.key} style={styles.card}>
            <View style={styles.cardTop}>
              {rows.length > 1 ? <Text style={styles.rowIndex}>#{index + 1}</Text> : <View />}
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
            <TextInput
              value={row.name}
              onChangeText={(text) => updateRow(index, text)}
              placeholder="e.g. Compressor unit #4, Chiller line B"
              placeholderTextColor={colors.grey400}
              style={styles.input}
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
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowIndex: { ...typography.caption, color: colors.grey600, fontWeight: '700' },
  removeBtn: { padding: 2 },
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
