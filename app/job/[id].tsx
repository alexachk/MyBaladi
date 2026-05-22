import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateTimeField } from '../../components/DateTimeField';
import { JobAttachments } from '../../components/JobAttachments';
import { JobCommentsThread } from '../../components/JobCommentsThread';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PriorityDot, StatusBadge, StatusPicker } from '../../components/StatusBadge';
import { formatAssigneesDisplay } from '../../lib/jobAssignees';
import { formatJobContactsDisplay } from '../../lib/jobContacts';
import { cancelReminder, scheduleJobReminder } from '../../lib/notifications';
import { removeCalendarEvent } from '../../lib/calendar';
import {
  buildRescheduleUpdates,
  formatScheduleWhen,
  jobScheduledAt,
  reminderAtFromSchedule,
  schedulePartsFromDate,
  scheduleWasRescheduled,
} from '../../lib/jobSchedule';
import { syncSingleJobToPhoneCalendar } from '../../lib/phoneCalendarSync';
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
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState<Date | null>(null);
  const [rescheduleNote, setRescheduleNote] = useState('');

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

  const openReschedule = () => {
    setRescheduleAt(jobScheduledAt(job));
    setRescheduleNote('');
    setShowReschedule(true);
  };

  const handleReschedule = async () => {
    if (!canEdit || !user || !rescheduleAt) return;
    setUpdating(true);
    try {
      const { date, time } = schedulePartsFromDate(rescheduleAt);
      const scheduleUpdates = buildRescheduleUpdates(
        job,
        date,
        time,
        { id: user.$id, name: user.name || user.email || 'User' },
        rescheduleNote,
      );

      const previousScheduledAt = jobScheduledAt(job);
      let notificationId = job.notificationId ?? null;
      let nextReminderAt: string | null = job.reminderAt ?? null;
      if (job.notificationId && job.reminderAt && previousScheduledAt) {
        await cancelReminder(job.notificationId);
        nextReminderAt = reminderAtFromSchedule(rescheduleAt, job.reminderAt, previousScheduledAt);
        notificationId = nextReminderAt
          ? await scheduleJobReminder({
              jobReference: job.reference,
              clientName: job.clientName,
              fireAt: new Date(nextReminderAt),
            })
          : null;
      }

      await updateJobCard(job.id, {
        ...scheduleUpdates,
        reminderAt: nextReminderAt,
        notificationId,
        assignees: job.assignees,
        jobContacts: job.jobContacts,
        missionTypes: job.missionTypes,
      });

      const updatedJob = {
        ...job,
        ...scheduleUpdates,
        reminderAt: nextReminderAt,
        notificationId,
      };

      if (updatedJob.calendarEventId || updatedJob.scheduledDate) {
        try {
          await syncSingleJobToPhoneCalendar(updatedJob, user.$id, updateJobCard);
        } catch {
          // optional
        }
      }

      setShowReschedule(false);
      setRescheduleNote('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reschedule.';
      Alert.alert('Reschedule', message);
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
            <View>
              <Text style={styles.metaText}>
                {formatScheduleWhen(job.scheduledDate, job.scheduledTime)}
              </Text>
              {scheduleWasRescheduled(job) ? (
                <Text style={styles.metaSubtext}>
                  Initial · {formatScheduleWhen(
                    job.initialScheduledDate || job.scheduledDate,
                    job.initialScheduledTime ?? job.scheduledTime,
                  )}
                </Text>
              ) : null}
            </View>
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
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, styles.cardHeaderRowTitle]}>Schedule</Text>
          {canEdit ? (
            <Pressable
              onPress={() => (showReschedule ? setShowReschedule(false) : openReschedule())}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={styles.linkBtnText}>{showReschedule ? 'Cancel' : 'Reschedule'}</Text>
            </Pressable>
          ) : null}
        </View>

        <DetailRow
          label="Planned"
          value={formatScheduleWhen(job.scheduledDate, job.scheduledTime)}
        />
        <DetailRow
          label="Initial date"
          value={formatScheduleWhen(
            job.initialScheduledDate || job.scheduledDate,
            job.initialScheduledTime ?? job.scheduledTime,
          )}
        />

        {showReschedule && canEdit ? (
          <View style={styles.rescheduleForm}>
            <DateTimeField
              label="New date & time"
              value={rescheduleAt}
              onChange={setRescheduleAt}
              mode="datetime"
              icon="calendar-outline"
            />
            <View style={styles.noteField}>
              <Text style={styles.detailLabel}>Reason (optional)</Text>
              <TextInput
                value={rescheduleNote}
                onChangeText={setRescheduleNote}
                placeholder="Client request, weather, etc."
                placeholderTextColor={colors.grey400}
                style={styles.noteInput}
                multiline
              />
            </View>
            <PrimaryButton
              label="Save new schedule"
              icon="checkmark-circle-outline"
              onPress={handleReschedule}
              disabled={updating || !rescheduleAt}
            />
          </View>
        ) : null}

        {job.scheduleLog?.length ? (
          <View style={styles.historyBlock}>
            <Text style={styles.historyTitle}>Schedule history</Text>
            {[...(job.scheduleLog ?? [])].reverse().map((entry, index) => (
              <View key={`${entry.at}-${index}`} style={styles.historyRow}>
                <Text style={styles.historyWhen}>
                  {formatScheduleWhen(entry.fromDate, entry.fromTime)}
                  {' → '}
                  {formatScheduleWhen(entry.toDate, entry.toTime)}
                </Text>
                <Text style={styles.historyMeta}>
                  {entry.userName || 'User'} · {formatDate(entry.at)}
                </Text>
                {entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Client & Site</Text>
        <DetailRow label="Address" value={job.siteAddress} />
        <DetailRow
          label="Contacts"
          value={
            job.jobContacts?.length
              ? formatJobContactsDisplay(job.jobContacts)
              : [job.contactName, job.contactPhone].filter(Boolean).join(' · ')
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mission</Text>
        <DetailRow label="Types" value={job.missionType} />
        <DetailRow label="Equipment" value={job.equipment} />
        <DetailRow
          label="Team"
          value={
            job.assignees?.length
              ? formatAssigneesDisplay(job.assignees)
              : job.technicianName
          }
        />
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
        {(job.workReports ?? []).length > 0 ? (
          (job.workReports ?? []).map((entry, index) => (
            <View
              key={`${entry.title}-${index}`}
              style={[styles.reportSection, index > 0 && styles.reportSectionBorder]}
            >
              {(job.workReports?.length ?? 0) > 1 ? (
                <Text style={styles.reportTitle}>{entry.title}</Text>
              ) : null}
              <DetailRow label="Work performed" value={entry.workPerformed} />
              <DetailRow label="Parts used" value={entry.partsUsed} />
            </View>
          ))
        ) : (
          <>
            <DetailRow label="Work performed" value={job.workPerformed} />
            <DetailRow label="Parts used" value={job.partsUsed} />
          </>
        )}
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardHeaderRowTitle: {
    marginBottom: 0,
  },
  linkBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  linkBtnText: {
    ...typography.caption,
    color: colors.info,
    fontWeight: '700',
  },
  rescheduleForm: {
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
  },
  noteField: {
    gap: spacing.xs,
  },
  noteInput: {
    ...typography.body,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  historyBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
    gap: spacing.sm,
  },
  historyTitle: {
    ...typography.label,
    color: colors.grey600,
  },
  historyRow: {
    gap: 2,
    paddingVertical: spacing.xs,
  },
  historyWhen: {
    ...typography.body,
    color: colors.black,
    fontWeight: '600',
  },
  historyMeta: {
    ...typography.caption,
    color: colors.grey600,
  },
  historyNote: {
    ...typography.caption,
    color: colors.grey600,
    fontStyle: 'italic',
  },
  metaSubtext: {
    ...typography.caption,
    color: colors.grey600,
    marginTop: 2,
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
  reportSection: {
    gap: spacing.xs,
  },
  reportSectionBorder: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
  },
  reportTitle: {
    ...typography.subheading,
    color: colors.black,
    marginBottom: spacing.xs,
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
