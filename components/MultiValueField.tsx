import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

interface MultiValueFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  addLabel?: string;
}

export function MultiValueField({
  label,
  values,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  addLabel = 'Add',
}: MultiValueFieldProps) {
  const rows = values.length > 0 ? values : [''];

  const updateRow = (index: number, text: string) => {
    const next = [...rows];
    next[index] = text;
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : ['']);
  };

  const addRow = () => {
    onChange([...rows, '']);
  };

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
        {rows.map((value, index) => (
          <View key={`${label}-${index}`} style={styles.row}>
            <TextInput
              value={value}
              onChangeText={(text) => updateRow(index, text)}
              placeholder={placeholder}
              placeholderTextColor={colors.grey400}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              style={styles.input}
            />
            <Pressable
              onPress={() => removeRow(index)}
              hitSlop={8}
              style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
            >
              <Ionicons name="close-circle-outline" size={22} color={colors.grey400} />
            </Pressable>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.black,
  },
  removeBtn: { padding: 2 },
  pressed: { opacity: 0.85 },
});
