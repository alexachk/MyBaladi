import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import type { VisitScheduleWarning } from '../lib/visitScheduleWarnings';

interface VisitScheduleWarningsProps {
  warnings: VisitScheduleWarning[];
}

export function VisitScheduleWarnings({ warnings }: VisitScheduleWarningsProps) {
  if (!warnings.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="warning-outline" size={16} color={colors.warning} />
        <Text style={styles.headerText}>Schedule notice</Text>
      </View>
      {warnings.map((warning, index) => (
        <Text key={`${warning.code}-${index}`} style={styles.line}>
          {warning.message}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerText: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  line: { ...typography.caption, color: colors.black, lineHeight: 18 },
});
