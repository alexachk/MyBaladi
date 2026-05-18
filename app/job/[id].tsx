import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PriorityDot, StatusBadge, StatusPicker } from '../../components/StatusBadge';
import { colors, radius, shadow, spacing, typography } from '../../constants/theme';
import { useJobCards } from '../../context/JobCardsContext';
import { JOB_PRIORITY_LABELS, type JobPriority, type JobStatus } from '../../types/jobCard';
import { formatDate } from '../../utils/formatDate';

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJobCard, updateJobCard, deleteJobCard } = useJobCards();
  const job = useMemo(() => (id ? getJobCard(id) : undefined), [getJobCard, id]);
  const [updating, setUpdating] = useState(false);

  if (!job) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingTitle}>Job card not found</Text>
        <PrimaryButton label="Back to jobs" onPress={() => router.back()} />
      </View>
    );
  }

  const setStatus = async (status: JobStatus) => {
    setUpdating(true);
    try {
      await updateJobCard(job.id, { status });
    } finally {
      setUpdating(false);
    }
  };

  const setPriority = async (priority: JobPriority) => {
    setUpdating(true);
    try {
      await updateJobCard(job.id, { priority });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete job card', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteJobCard(job.id);
          router.replace('/(tabs)/jobs');
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.reference}>{job.reference}</Text>
            <Text style={styles.client}>{job.clientName}</Text>
          </View>
          <StatusBadge status={job.status} />
        </View>
        <View style={styles.heroMeta}>
          <View style={styles.metaBlock}>
            <Ionicons name="calendar-outline" size={16} color={colors.grey600} />
            <Text style={styles.metaText}>{formatDate(job.scheduledDate)}</Text>
          </View>
          <PriorityDot priority={job.priority} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Client & Site</Text>
        <DetailRow label="Address" value={job.siteAddress} />
        <DetailRow label="Contact" value={job.contactName} />
        <DetailRow label="Phone" value={job.contactPhone} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mission</Text>
        <DetailRow label="Type" value={job.missionType} />
        <DetailRow label="Equipment" value={job.equipment} />
        <DetailRow label="Technician" value={job.technicianName} />
        <DetailRow
          label="On-site times"
          value={
            job.arrivalTime || job.departureTime
              ? `${job.arrivalTime || '—'} → ${job.departureTime || '—'}`
              : ''
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Work report</Text>
        <DetailRow label="Work performed" value={job.workPerformed} />
        <DetailRow label="Parts used" value={job.partsUsed} />
        <DetailRow label="Notes" value={job.notes} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Update status</Text>
        <StatusPicker value={job.status} onChange={setStatus} />
        <Text style={[styles.cardTitle, styles.priorityTitle]}>Update priority</Text>
        <View style={styles.priorityRow}>
          {(Object.keys(JOB_PRIORITY_LABELS) as JobPriority[]).map((level) => {
            const selected = job.priority === level;
            return (
              <Pressable
                key={level}
                disabled={updating}
                onPress={() => setPriority(level)}
                style={[styles.priorityChip, selected && styles.priorityChipActive]}
              >
                <Text
                  style={[styles.priorityChipText, selected && styles.priorityChipTextActive]}
                >
                  {JOB_PRIORITY_LABELS[level]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <PrimaryButton
        label="Delete Job Card"
        variant="secondary"
        icon="trash-outline"
        onPress={handleDelete}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  missingTitle: {
    ...typography.heading,
    color: colors.black,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    ...shadow.card,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  reference: {
    ...typography.caption,
    color: colors.grey600,
    marginBottom: 4,
  },
  client: {
    ...typography.heading,
    color: colors.black,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.grey600,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.black,
    marginBottom: spacing.md,
  },
  priorityTitle: {
    marginTop: spacing.lg,
  },
  detailRow: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    ...typography.label,
    color: colors.grey600,
    marginBottom: spacing.xs,
  },
  detailValue: {
    ...typography.body,
    color: colors.black,
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  priorityChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
  },
  priorityChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  priorityChipText: {
    ...typography.caption,
    color: colors.grey600,
  },
  priorityChipTextActive: {
    color: colors.black,
    fontWeight: '700',
  },
});
