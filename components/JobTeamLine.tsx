import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';
import {
  formatAssigneesCompact,
  formatAssigneesDisplay,
  type StoredJobAssignee,
} from '../lib/jobAssignees';
import { jobLevelTeam, storedAssigneesForVisit } from '../lib/jobMissionScopes';
import type { JobCard } from '../types/jobCard';

type JobTeamSource = Pick<
  JobCard,
  | 'missionScopes'
  | 'missionTypes'
  | 'missionType'
  | 'equipmentItems'
  | 'equipment'
  | 'assignees'
  | 'assigneeId'
  | 'assigneeName'
  | 'technicianName'
>;

interface JobTeamLineProps {
  job: JobTeamSource;
  /** When set, shows team for that visit's mission scope (fallback: general / merged). */
  visitId?: string;
  compact?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  emptyLabel?: string;
}

function resolveTeam(job: JobTeamSource, visitId?: string): StoredJobAssignee[] {
  if (visitId) return storedAssigneesForVisit(job, visitId);
  return jobLevelTeam(job);
}

export function formatJobTeamText(
  job: JobTeamSource,
  opts?: { visitId?: string; compact?: boolean },
): string {
  const team = resolveTeam(job, opts?.visitId);
  if (team.length) {
    return opts?.compact ? formatAssigneesCompact(team) : formatAssigneesDisplay(team);
  }
  return job.technicianName?.trim() || job.assigneeName?.trim() || '';
}

export function JobTeamLine({
  job,
  visitId,
  compact = false,
  numberOfLines = 2,
  style,
  emptyLabel = 'No team assigned',
}: JobTeamLineProps) {
  const text = formatJobTeamText(job, { visitId, compact });
  const label = text || emptyLabel;
  const muted = !text;

  return (
    <View style={[styles.row, style]}>
      <Ionicons name="people-outline" size={14} color={colors.grey600} />
      <Text
        style={[styles.text, muted && styles.muted]}
        numberOfLines={numberOfLines}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  text: {
    ...typography.caption,
    color: colors.grey600,
    flex: 1,
  },
  muted: {
    color: colors.grey400,
    fontStyle: 'italic',
  },
});
