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
import { JobAttachments } from '../../components/JobAttachments';
import { JobCommentsThread } from '../../components/JobCommentsThread';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PriorityDot, StatusBadge, StatusPicker } from '../../components/StatusBadge';
import { cancelReminder } from '../../lib/notifications';
import { removeCalendarEvent } from '../../lib/calendar';
import { colors, radius, shadow, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import {
  JOB_PRIORITY_LABELS,
  isJobLocked,
  type JobPriority,
  type JobStatus,
} from '../../types/jobCard';
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
  const { getJobCard, updateJobCard, deleteJobCard, jobCards } = useJobCards();
  const { isAdmin, user } = useAuth();
  const { findPerson, findCompany } = useClients();

  const job = useMemo(() => (id ? getJobCard(id) : undefined), [getJobCard, id]);
  const [updating, setUpdating] = useState(false);

  const parent = job?.parentJobId ? jobCards.find((j) => j.id === job.parentJobId) : undefined;
  const followUps = useMemo(
    () => (job ? jobCards.filter((j) => j.parentJobId === job.id) : []),
    [job, jobCards],
  );
  const person = findPerson(job?.personId);
  const company = findCompany(job?.companyId);

  if (!job) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingTitle}>Job card not found</Text>
        <PrimaryButton label="Back to jobs" onPress={() => router.back()} />
      </View>
    );
  }

  const locked = isJobLocked(job);
  const canEdit = isAdmin || !locked;

  const setStatus = async (status: JobStatus) => {
    if (!canEdit) {
      Alert.alert('Locked', 'Only admins can edit a signed job card.');
      return;
    }
    setUpdating(true);
    try {
      await updateJobCard(job.id, { status });
    } finally {
      setUpdating(false);
    }
  };

  const setPriority = async (priority: JobPriority) => {
    if (!canEdit) {
      Alert.alert('Locked', 'Only admins can edit a signed job card.');
      return;
    }
    setUpdating(true);
    try {
      await updateJobCard(job.id, { priority });
    } finally {
      setUpdating(false);
    }
  };

  const handleStart = async () => {
    if (!canEdit) return;
    setUpdating(true);
    try {
      await updateJobCard(job.id, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        arrivalTime: job.arrivalTime || new Date().toTimeString().slice(0, 5),
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleFinish = async () => {
    if (!canEdit) return;
    setUpdating(true);
    try {
      await updateJobCard(job.id, {
        status: 'pending_review',
        finishedAt: new Date().toISOString(),
        departureTime: job.departureTime || new Date().toTimeString().slice(0, 5),
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSignOff = () => {
    router.push(`/job/sign/${job.id}`);
  };

  const handleUnlock = () => {
    Alert.alert('Unlock', 'Remove the lock so the technician can edit again?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlock',
        onPress: async () => {
          await updateJobCard(job.id, { lockedAt: null, lockedBy: null });
        },
      },
    ]);
  };

  const handleFollowUp = () => {
    router.push({ pathname: '/job/new', params: { parentJobId: job.id } });
  };

  const handleDelete = () => {
    Alert.alert('Delete job card', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelReminder(job.notificationId);
          await removeCalendarEvent(job.calendarEventId);
          await deleteJobCard(job.id);
          router.replace('/(tabs)/jobs');
        },
      },
    ]);
  };

  const handleAttachmentsChange = async ({
    photoIds,
    documentIds,
  }: {
    photoIds: string[];
    documentIds: string[];
  }) => {
    if (!canEdit) {
      Alert.alert('Locked', 'Only admins can change attachments on a signed job card.');
      return;
    }
    await updateJobCard(job.id, { photoIds, documentIds });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reference}>{job.reference}</Text>
            <Text style={styles.client}>{job.clientName}</Text>
            {(person || company) ? (
              <Pressable
                onPress={() =>
                  router.push(
                    person
                      ? `/clients/${person.id}?type=person`
                      : `/clients/${company!.id}?type=company`,
                  )
                }
                style={({ pressed }) => [styles.clientChip, pressed && styles.pressed]}
              >
                <Ionicons
                  name={person ? 'person-outline' : 'business-outline'}
                  size={12}
                  color={colors.black}
                />
                <Text style={styles.clientChipText}>
                  {person ? person.fullName : company?.name}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <StatusBadge status={job.status} />
        </View>

        <View style={styles.heroMeta}>
          <View style={styles.metaBlock}>
            <Ionicons name="calendar-outline" size={16} color={colors.grey600} />
            <Text style={styles.metaText}>
              {formatDate(job.scheduledDate)}
              {job.scheduledTime ? ` · ${job.scheduledTime}` : ''}
            </Text>
          </View>
          <PriorityDot priority={job.priority} />
        </View>

        {parent ? (
          <Pressable
            onPress={() => router.push(`/job/${parent.id}`)}
            style={({ pressed }) => [styles.relRow, pressed && styles.pressed]}
          >
            <Ionicons name="return-up-back-outline" size={14} color={colors.info} />
            <Text style={styles.relText}>Follow-up of {parent.reference}</Text>
          </Pressable>
        ) : null}
        {followUps.length ? (
          <View style={styles.relRow}>
            <Ionicons name="git-branch-outline" size={14} color={colors.info} />
            <Text style={styles.relText}>{followUps.length} follow-up{followUps.length === 1 ? '' : 's'}</Text>
          </View>
        ) : null}

        {locked ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={14} color={colors.warning} />
            <Text style={styles.lockText}>
              Locked {job.lockedAt ? `· ${formatDate(job.lockedAt)}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* On-site action toolbar */}
      {!locked ? (
        <View style={styles.actionToolbar}>
          {job.status === 'draft' || !job.startedAt ? (
            <PrimaryButton label="Start mission" icon="play-circle-outline" onPress={handleStart} />
          ) : null}
          {job.status === 'in_progress' || (job.startedAt && !job.finishedAt) ? (
            <PrimaryButton label="Finish on site" icon="stop-circle-outline" variant="secondary" onPress={handleFinish} />
          ) : null}
          {job.status === 'pending_review' || job.finishedAt ? (
            <PrimaryButton label="Sign-off & lock" icon="create-outline" onPress={handleSignOff} />
          ) : null}
        </View>
      ) : null}

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
        <DetailRow
          label="Timestamps"
          value={
            job.startedAt || job.finishedAt
              ? `${job.startedAt ? formatDate(job.startedAt) : '—'} → ${job.finishedAt ? formatDate(job.finishedAt) : '—'}`
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

      {canEdit ? (
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
      ) : null}

      <JobAttachments
        photoIds={job.photoIds ?? []}
        documentIds={job.documentIds ?? []}
        disabled={!canEdit}
        onChange={handleAttachmentsChange}
      />

      <JobCommentsThread jobId={job.id} />

      <View style={styles.bottomActions}>
        <PrimaryButton
          label="Open follow-up"
          icon="git-branch-outline"
          variant="secondary"
          onPress={handleFollowUp}
        />
        {locked && isAdmin ? (
          <PrimaryButton
            label="Unlock"
            icon="lock-open-outline"
            variant="secondary"
            onPress={handleUnlock}
          />
        ) : null}
        {isAdmin || !locked ? (
          <PrimaryButton
            label="Delete"
            icon="trash-outline"
            variant="ghost"
            onPress={handleDelete}
          />
        ) : null}
      </View>
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
    gap: spacing.sm,
    ...shadow.card,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
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
  clientChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  clientChipText: { ...typography.caption, color: colors.black, fontSize: 11, fontWeight: '600' },
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
  relRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  relText: { ...typography.caption, color: colors.info, fontWeight: '600' },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningLight,
  },
  lockText: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  actionToolbar: {
    gap: spacing.sm,
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
  bottomActions: {
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
});
