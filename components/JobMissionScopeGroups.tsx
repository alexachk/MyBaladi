import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatAssigneesDisplay } from '../lib/jobAssignees';
import { formatEquipmentLine } from '../lib/jobEquipment';
import {
  formatScopeTitle,
  missionScopesFromJob,
  type StoredMissionScope,
} from '../lib/jobMissionScopes';
import { formatMissionTypesDisplay } from '../lib/jobMissions';
import type { JobCard } from '../types/jobCard';

function DetailLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

export function JobMissionScopeGroups({ job }: { job: JobCard }) {
  const scopes = missionScopesFromJob(job);
  if (!scopes.some((s) => s.missionTypes.length || s.equipment.length || s.team.length)) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {scopes.map((scope, index) => (
        <ScopeBlock key={`${scope.visitId ?? 'general'}-${index}`} scope={scope} job={job} />
      ))}
    </View>
  );
}

function ScopeBlock({ scope, job }: { scope: StoredMissionScope; job: JobCard }) {
  const title = formatScopeTitle(job.visits ?? [], scope.visitId);
  const types = formatMissionTypesDisplay(scope.missionTypes);
  const equipment = scope.equipment.map((line) => formatEquipmentLine(line)).filter(Boolean).join('\n');
  const team = formatAssigneesDisplay(scope.team);
  return (
    <View style={styles.card}>
      <Text style={styles.scopeTitle}>{title}</Text>
      <DetailLine label="Types" value={types} />
      <DetailLine label="Equipment" value={equipment} />
      <DetailLine label="Team" value={team} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  scopeTitle: {
    ...typography.caption,
    color: colors.black,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  line: { gap: 2 },
  lineLabel: { ...typography.caption, color: colors.grey600 },
  lineValue: { ...typography.body, color: colors.black, fontSize: 14 },
});
