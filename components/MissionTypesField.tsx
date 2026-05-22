import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { MISSION_TYPES } from '../types/jobCard';

interface MissionTypesFieldProps {
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
  anchorRef?: (node: View | null) => void;
}

export function MissionTypesField({ values, onChange, error, anchorRef }: MissionTypesFieldProps) {
  const toggle = (type: (typeof MISSION_TYPES)[number]) => {
    if (values.includes(type)) {
      onChange(values.filter((value) => value !== type));
      return;
    }
    onChange([...values, type]);
  };

  return (
    <View ref={anchorRef} collapsable={false} style={styles.wrap}>
      <Text style={styles.label}>
        Mission types <Text style={styles.required}>*</Text>
      </Text>
      <View style={[styles.chipRow, error ? styles.chipRowError : null]}>
        {MISSION_TYPES.map((type) => {
          const selected = values.includes(type);
          return (
            <Pressable
              key={type}
              onPress={() => toggle(type)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type}</Text>
            </Pressable>
          );
        })}
      </View>
      {values.length > 0 ? (
        <Text style={styles.summary}>{values.join(' · ')}</Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.grey600, marginBottom: spacing.sm },
  required: { color: colors.error },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipRowError: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.xs,
    backgroundColor: colors.errorLight,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: { ...typography.caption, color: colors.grey600 },
  chipTextSelected: { color: colors.black, fontWeight: '700' },
  summary: {
    ...typography.caption,
    color: colors.grey600,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
