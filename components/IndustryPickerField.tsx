import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { industryPickerOptions } from '../constants/industries';
import { colors, radius, spacing, typography } from '../constants/theme';
import { PickerSheet } from './PickerSheet';

interface IndustryPickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function IndustryPickerField({
  value,
  onChange,
  label = 'Industry',
}: IndustryPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => industryPickerOptions(value), [value]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <Ionicons name="briefcase-outline" size={18} color={colors.black} />
        <Text style={[styles.selectorText, !value && styles.placeholder]}>
          {value || 'Choose industry'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.grey400} />
      </Pressable>

      <PickerSheet
        visible={open}
        title="Industry"
        options={options}
        searchPlaceholder="Search industry…"
        emptyLabel="No industry found."
        onClose={() => setOpen(false)}
        onSelect={(opt) => {
          onChange(opt.id);
          setOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.grey600, marginBottom: spacing.sm },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
  },
  selectorText: { ...typography.body, color: colors.black, fontSize: 15, flex: 1, textAlign: 'left' },
  placeholder: { color: colors.grey400 },
  pressed: { opacity: 0.85 },
});
