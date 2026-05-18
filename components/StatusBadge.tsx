import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { JobPriority, JobStatus } from '../types/jobCard';

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  draft: { label: 'Draft', bg: colors.grey100, text: colors.grey600, icon: 'document-outline' },
  in_progress: {
    label: 'In Progress',
    bg: colors.infoLight,
    text: colors.info,
    icon: 'construct-outline',
  },
  completed: {
    label: 'Completed',
    bg: colors.successLight,
    text: colors.success,
    icon: 'checkmark-circle-outline',
  },
  pending_review: {
    label: 'Pending Review',
    bg: colors.warningLight,
    text: colors.warning,
    icon: 'time-outline',
  },
};

const PRIORITY_CONFIG: Record<JobPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: colors.grey400 },
  normal: { label: 'Normal', color: colors.info },
  high: { label: 'High', color: colors.warning },
  urgent: { label: 'Urgent', color: colors.error },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon} size={14} color={config.text} />
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

export function PriorityDot({ priority }: { priority: JobPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <View style={styles.priorityRow}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={styles.priorityText}>{config.label}</Text>
    </View>
  );
}

export function StatusPicker({
  value,
  onChange,
}: {
  value: JobStatus;
  onChange: (status: JobStatus) => void;
}) {
  const options = Object.keys(STATUS_CONFIG) as JobStatus[];
  return (
    <View style={styles.pickerRow}>
      {options.map((status) => {
        const config = STATUS_CONFIG[status];
        const selected = value === status;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            style={[
              styles.pickerChip,
              selected && { backgroundColor: config.bg, borderColor: config.text },
            ]}
          >
            <Text style={[styles.pickerText, selected && { color: config.text }]}>
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  priorityText: {
    ...typography.caption,
    color: colors.grey600,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pickerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
  },
  pickerText: {
    ...typography.caption,
    color: colors.grey600,
  },
});
