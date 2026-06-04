import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../constants/theme';
import { JobCard } from '../types/jobCard';
import { formatDateShort } from '../utils/formatDate';
import { JobTeamLine } from './JobTeamLine';
import { PriorityDot, StatusBadge } from './StatusBadge';

interface JobCardItemProps {
  job: JobCard;
  onPress: () => void;
}

export function JobCardItem({ job, onPress }: JobCardItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reference}>{job.reference}</Text>
            <Text style={styles.client} numberOfLines={1}>
              {job.clientName}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.grey400} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={colors.grey600} />
            <Text style={styles.metaText} numberOfLines={1}>
              {job.siteAddress || 'No address'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.grey600} />
            <Text style={styles.metaText}>{formatDateShort(job.scheduledDate)}</Text>
          </View>
          <JobTeamLine job={job} compact numberOfLines={1} />
        </View>

        <View style={styles.footer}>
          <StatusBadge status={job.status} />
          <PriorityDot priority={job.priority} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.92,
  },
  accent: {
    width: 4,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  reference: {
    ...typography.caption,
    color: colors.grey600,
    marginBottom: 2,
  },
  client: {
    ...typography.subheading,
    color: colors.black,
  },
  metaRow: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.grey600,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
