import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { visitOnDate } from '../lib/jobVisits';
import { memberAccentBg } from '../utils/teamColors';
import { JobCard } from '../types/jobCard';
import { StatusBadge } from './StatusBadge';

interface CalendarJobRowProps {
  job: JobCard;
  visitDate?: string;
  ownerLabel?: string;
  isOwn: boolean;
  accentColor?: string;
  onPress: () => void;
}

export function CalendarJobRow({
  job,
  visitDate,
  ownerLabel,
  isOwn,
  accentColor,
  onPress,
}: CalendarJobRowProps) {
  const visit = visitDate ? visitOnDate(job, visitDate) : null;
  const time = visit?.time ?? job.scheduledTime ?? '—';
  const past = (visitDate ?? job.scheduledDate) < new Date().toISOString().slice(0, 10);
  const accent = accentColor ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderLeftColor: accent },
        past && styles.rowPast,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: accent }]}>{time}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.ref} numberOfLines={1}>
            {job.reference}
          </Text>
          {!isOwn && ownerLabel ? (
            <View style={[styles.teamBadge, { backgroundColor: memberAccentBg(accent) }]}>
              <View style={[styles.teamDot, { backgroundColor: accent }]} />
              <Text style={[styles.teamBadgeText, { color: accent }]} numberOfLines={1}>
                {ownerLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.client} numberOfLines={1}>
          {job.clientName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {visit?.label ? `${visit.label} · ` : ''}
          {job.missionType || 'Mission'} · {job.siteAddress || 'No address'}
        </Text>
        <StatusBadge status={job.status} />
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderLeftWidth: 4,
    padding: spacing.md,
  },
  rowPast: { opacity: 0.72 },
  timeCol: { width: 44, alignItems: 'center' },
  time: { ...typography.caption, fontWeight: '700' },
  body: { flex: 1, gap: 4, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ref: { ...typography.subheading, color: colors.black, flexShrink: 1 },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 130,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  teamDot: { width: 6, height: 6, borderRadius: 3 },
  teamBadgeText: { fontSize: 10, fontWeight: '700' },
  client: { ...typography.body, color: colors.black },
  meta: { ...typography.caption, color: colors.grey600 },
  pressed: { opacity: 0.85 },
});
