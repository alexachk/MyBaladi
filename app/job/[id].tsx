import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { JobWorkReportsField } from '../../components/JobWorkReportsField';
import { WorkReportEntryAttachments } from '../../components/WorkReportEntryAttachments';
import { JobRecapExportSheet } from '../../components/JobRecapExportSheet';
import { JobCommentsThread } from '../../components/JobCommentsThread';
import { PrimaryButton } from '../../components/PrimaryButton';
import { PriorityDot, StatusBadge, StatusPicker } from '../../components/StatusBadge';
import { formatAssigneesDisplay } from '../../lib/jobAssignees';
import { formatEquipmentList } from '../../lib/jobEquipment';
import {
  formatJobContactDisplay,
  groupJobContactsByVisit,
} from '../../lib/jobContacts';
import {
  groupWorkReportByVisit,
  normalizeWorkReportForm,
  parseWorkReportsFromStorage,
  serializeWorkReportsToStorage,
  workReportFormState,
  workReportVisitOptions as buildWorkReportVisitOptions,
  type WorkReportFormState,
  type WorkReportGroupItem,
} from '../../lib/jobWorkReports';
import { shareJobRecapPdf } from '../../lib/jobRecapPdf';
import type { JobRecapExportOptions } from '../../lib/jobRecapExport';
import { cancelReminder, scheduleJobReminder } from '../../lib/notifications';
import { removeCalendarEvent } from '../../lib/calendar';
import {
  buildAddFollowUpVisitUpdates,
  buildMarkVisitDoneUpdates,
  buildRescheduleVisitUpdates,
  formatScheduleLogEntry,
  formatScheduleWhen,
  jobScheduledAt,
  reminderAtFromSchedule,
  schedulePartsFromDate,
  scheduleWasRescheduled,
} from '../../lib/jobSchedule';
import { collectJobCalendarEventIds, syncSingleJobToPhoneCalendar } from '../../lib/phoneCalendarSync';
import { canOpenMapsForAddress, promptMapsForAddress, promptMapsForVisit } from '../../lib/maps';
import { colors, radius, shadow, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import {
  JOB_PRIORITY_LABELS,
  isJobLocked,
  type JobPriority,
  type JobStatus,
  type JobCard,
} from '../../types/jobCard';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { formatVisitOnSiteTimes } from '../../lib/jobVisitLink';
import {
  activeOnSiteVisit,
  doneVisitCount,
  formatVisitLocationLabel,
  formatVisitWhen,
  JOB_VISIT_STATUS_LABELS,
  nextScheduledVisit,
  normalizeVisitsList,
  patchVisitInList,
  scheduledVisitCount,
  sortVisitsTimeline,
  syncJobOnSiteFields,
  visitStatus,
  visitToDate,
} from '../../lib/jobVisits';

function visitStatusColor(status: ReturnType<typeof visitStatus>): string {
  if (status === 'done') return colors.success;
  if (status === 'rescheduled') return colors.grey600;
  if (status === 'cancelled') return colors.warning;
  return colors.info;
}

function visitStatusBg(status: ReturnType<typeof visitStatus>): string {
  if (status === 'done') return colors.successLight;
  if (status === 'rescheduled') return colors.grey100;
  if (status === 'cancelled') return colors.warningLight;
  return colors.infoLight;
}

function JobContactVisitGroups({ job }: { job: JobCard }) {
  const visits = normalizeVisitsList(job.visits ?? []);
  const groups = groupJobContactsByVisit(job.jobContacts ?? [], visits);
  if (!groups.length) {
    const legacy = [job.contactName, job.contactPhone].filter(Boolean).join(' · ');
    return legacy ? <Text style={styles.detailValue}>{legacy}</Text> : null;
  }

  return (
    <View style={styles.workGroups}>
      {groups.map((group) => (
        <View key={group.visitId ?? 'general'} style={styles.workGroup}>
          <View style={styles.workGroupHead}>
            <Ionicons name="person-outline" size={14} color={colors.info} />
            <Text style={styles.workGroupTitle}>{group.visitLabel}</Text>
          </View>
          {group.contacts.map((contact, index) => (
            <Text key={`${group.visitId ?? 'general'}-${index}`} style={styles.workGroupItem}>
              {formatJobContactDisplay(contact, [])}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function WorkReportEntryBlock({
  item,
  index,
  total,
}: {
  item: WorkReportGroupItem;
  index: number;
  total: number;
}) {
  const hasText = Boolean(item.text.trim());
  const hasMedia = item.photoIds.length > 0 || item.documentIds.length > 0;
  if (!hasText && !hasMedia) return null;

  return (
    <View style={styles.workEntry}>
      {hasText ? (
        <Text style={styles.workGroupItem}>
          {total > 1 ? `${index + 1}. ` : ''}
          {item.text}
        </Text>
      ) : total > 1 ? (
        <Text style={styles.workGroupItem}>{index + 1}.</Text>
      ) : null}
      <WorkReportEntryAttachments
        photoIds={item.photoIds}
        documentIds={item.documentIds}
        disabled
      />
    </View>
  );
}

function WorkReportVisitGroups({ job }: { job: JobCard }) {
  const visits = normalizeVisitsList(job.visits ?? []);
  const report =
    job.workReport ?? parseWorkReportsFromStorage(job.workPerformed, job.partsUsed);
  const groups = groupWorkReportByVisit(report, visits);
  if (!groups.length) return <Text style={styles.workEmpty}>No work recorded yet.</Text>;

  return (
    <View style={styles.workGroups}>
      {groups.map((group) => (
        <View key={group.visitId ?? 'general'} style={styles.workGroup}>
          <View style={styles.workGroupHead}>
            <Ionicons name="calendar-outline" size={14} color={colors.info} />
            <Text style={styles.workGroupTitle}>{group.visitLabel}</Text>
          </View>
          {group.workItems.length ? (
            <View style={styles.workGroupBlock}>
              <Text style={styles.workGroupLabel}>Work performed</Text>
              {group.workItems.map((item, index) => (
                <WorkReportEntryBlock
                  key={`w-${index}`}
                  item={item}
                  index={index}
                  total={group.workItems.length}
                />
              ))}
            </View>
          ) : null}
          {group.partItems.length ? (
            <View style={styles.workGroupBlock}>
              <Text style={styles.workGroupLabel}>Parts used</Text>
              {group.partItems.map((item, index) => (
                <WorkReportEntryBlock
                  key={`p-${index}`}
                  item={item}
                  index={index}
                  total={group.partItems.length}
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function MapsDetailRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  if (!value) return null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.detailRow, styles.mapsDetailRow, pressed && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, styles.mapsDetailValue]}>{value}</Text>
      </View>
      <Ionicons name="navigate-outline" size={18} color={colors.info} />
    </Pressable>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJobCard, updateJobCard, deleteJobCard, jobCards } = useJobCards();
  const { isAdmin, user } = useAuth();
  const { findPerson, findCompany } = useClients();

  const job = useMemo(() => (id ? getJobCard(id) : undefined), [getJobCard, id]);
  const [updating, setUpdating] = useState(false);
  const [rescheduleVisitId, setRescheduleVisitId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState<Date | null>(null);
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [addVisitAt, setAddVisitAt] = useState<Date | null>(null);
  const [addVisitLabel, setAddVisitLabel] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [workDraft, setWorkDraft] = useState<WorkReportFormState>(() =>
    workReportFormState(undefined, '', ''),
  );
  const [workDraftDirty, setWorkDraftDirty] = useState(false);

  useEffect(() => {
    if (!job) return;
    setWorkDraft(
      workReportFormState(job.workReport, job.workPerformed, job.partsUsed),
    );
    setWorkDraftDirty(false);
  }, [job?.id, job?.workReport, job?.workPerformed, job?.partsUsed]);

  const parent = job?.parentJobId ? jobCards.find((j) => j.id === job.parentJobId) : undefined;
  const followUps = useMemo(
    () => (job ? jobCards.filter((j) => j.parentJobId === job.id) : []),
    [job, jobCards],
  );
  const person = findPerson(job?.personId);
  const company = findCompany(job?.companyId);

  const workReportVisitOptionsList = useMemo(
    () => buildWorkReportVisitOptions(normalizeVisitsList(job?.visits ?? [])),
    [job?.visits],
  );

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
  const timelineVisits = sortVisitsTimeline(job.visits ?? []);
  const nextVisit = nextScheduledVisit(normalizeVisitsList(job.visits ?? []));

  const persistScheduleUpdates = async (
    scheduleUpdates: Pick<
      typeof job,
      | 'scheduledDate'
      | 'scheduledTime'
      | 'initialScheduledDate'
      | 'initialScheduledTime'
      | 'scheduleLog'
      | 'visits'
    >,
    nextScheduledAt?: Date | null,
  ) => {
    const previousScheduledAt = jobScheduledAt(job);
    let notificationId = job.notificationId ?? null;
    let nextReminderAt: string | null = job.reminderAt ?? null;
    const targetAt = nextScheduledAt ?? jobScheduledAt({ ...job, ...scheduleUpdates });

    if (job.notificationId && job.reminderAt && previousScheduledAt && targetAt) {
      await cancelReminder(job.notificationId);
      nextReminderAt = reminderAtFromSchedule(targetAt, job.reminderAt, previousScheduledAt);
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
      equipmentItems: job.equipmentItems,
    });

    const updatedJob = {
      ...job,
      ...scheduleUpdates,
      reminderAt: nextReminderAt,
      notificationId,
    };

    if (updatedJob.calendarEventId || updatedJob.scheduledDate) {
      try {
        await syncSingleJobToPhoneCalendar(updatedJob, user!.$id, updateJobCard);
      } catch {
        // optional
      }
    }
  };

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
      const visits = normalizeVisitsList(job.visits ?? []);
      const target = activeOnSiteVisit(visits);
      const arrivalTime = new Date().toTimeString().slice(0, 5);
      const updatedVisits = target ? patchVisitInList(visits, target.id, { arrivalTime }) : visits;
      const onSite = syncJobOnSiteFields(updatedVisits);
      await updateJobCard(job.id, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        visits: updatedVisits,
        arrivalTime: onSite.arrivalTime,
        departureTime: onSite.departureTime,
        assignees: job.assignees,
        jobContacts: job.jobContacts,
        missionTypes: job.missionTypes,
        equipmentItems: job.equipmentItems,
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleFinish = async () => {
    if (!canEdit) return;
    setUpdating(true);
    try {
      const visits = normalizeVisitsList(job.visits ?? []);
      const target =
        visits.find((visit) => visit.arrivalTime && !visit.departureTime) ?? activeOnSiteVisit(visits);
      const departureTime = new Date().toTimeString().slice(0, 5);
      const updatedVisits = target
        ? patchVisitInList(visits, target.id, { departureTime })
        : visits;
      const onSite = syncJobOnSiteFields(updatedVisits);
      await updateJobCard(job.id, {
        status: 'pending_review',
        finishedAt: new Date().toISOString(),
        visits: updatedVisits,
        arrivalTime: onSite.arrivalTime,
        departureTime: onSite.departureTime,
        assignees: job.assignees,
        jobContacts: job.jobContacts,
        missionTypes: job.missionTypes,
        equipmentItems: job.equipmentItems,
      });
    } finally {
      setUpdating(false);
    }
  };

  const openReschedule = (visitId: string) => {
    const visit = timelineVisits.find((row) => row.id === visitId);
    setRescheduleVisitId(visitId);
    setRescheduleAt(visit ? visitToDate(visit) : jobScheduledAt(job));
    setRescheduleNote('');
    setShowAddVisit(false);
  };

  const handleReschedule = async () => {
    if (!canEdit || !user || !rescheduleAt || !rescheduleVisitId) return;
    setUpdating(true);
    try {
      const { date, time } = schedulePartsFromDate(rescheduleAt);
      const scheduleUpdates = buildRescheduleVisitUpdates(
        job,
        rescheduleVisitId,
        date,
        time,
        { id: user.$id, name: user.name || user.email || 'User' },
        rescheduleNote,
      );
      await persistScheduleUpdates(scheduleUpdates, rescheduleAt);
      setRescheduleVisitId(null);
      setRescheduleAt(null);
      setRescheduleNote('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reschedule.';
      Alert.alert('Reschedule', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkVisitDone = async (visitId: string) => {
    if (!canEdit || !user) return;
    setUpdating(true);
    try {
      const scheduleUpdates = buildMarkVisitDoneUpdates(job, visitId, {
        id: user.$id,
        name: user.name || user.email || 'User',
      });
      await persistScheduleUpdates(scheduleUpdates);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to mark visit done.';
      Alert.alert('Visit', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!canEdit || !user || !addVisitAt) return;
    setUpdating(true);
    try {
      const { date, time } = schedulePartsFromDate(addVisitAt);
      const scheduleUpdates = buildAddFollowUpVisitUpdates(
        job,
        date,
        time,
        { id: user.$id, name: user.name || user.email || 'User' },
        addVisitLabel,
      );
      await persistScheduleUpdates(scheduleUpdates, addVisitAt);
      setShowAddVisit(false);
      setAddVisitAt(null);
      setAddVisitLabel('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add visit.';
      Alert.alert('Visit', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveWorkReport = async () => {
    if (!canEdit) return;
    setUpdating(true);
    try {
      const normalized = normalizeWorkReportForm(workDraft);
      const stored = serializeWorkReportsToStorage(normalized);
      await updateJobCard(job.id, {
        workReport: normalized,
        workPerformed: stored.workPerformed,
        partsUsed: stored.partsUsed,
      });
      setWorkDraftDirty(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save work report.';
      Alert.alert('Work report', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleExportPdf = async (options: JobRecapExportOptions) => {
    setExportingPdf(true);
    try {
      await shareJobRecapPdf(job, options);
      setShowExportSheet(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate PDF.';
      Alert.alert('PDF recap', message);
    } finally {
      setExportingPdf(false);
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
          for (const eventId of collectJobCalendarEventIds(job)) {
            await removeCalendarEvent(eventId);
          }
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
    <>
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
                {doneVisitCount(job.visits) > 0 ? `${doneVisitCount(job.visits)} done · ` : ''}
                {nextVisit
                  ? `Next ${formatScheduleWhen(nextVisit.date, nextVisit.time)}`
                  : scheduledVisitCount(job.visits) > 0
                    ? `${scheduledVisitCount(job.visits)} visit${scheduledVisitCount(job.visits) === 1 ? '' : 's'} planned`
                    : formatScheduleWhen(job.scheduledDate, job.scheduledTime)}
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
          <Text style={[styles.cardTitle, styles.cardHeaderRowTitle]}>Visits</Text>
          {canEdit ? (
            <Pressable
              onPress={() => {
                setShowAddVisit((open) => !open);
                setRescheduleVisitId(null);
                setAddVisitAt(new Date());
                setAddVisitLabel('');
              }}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={styles.linkBtnText}>{showAddVisit ? 'Cancel' : 'Add visit'}</Text>
            </Pressable>
          ) : null}
        </View>

        <DetailRow label="Card created" value={formatDateTime(job.createdAt)} />
        <DetailRow
          label="Initial visit"
          value={formatScheduleWhen(
            job.initialScheduledDate || job.scheduledDate,
            job.initialScheduledTime ?? job.scheduledTime,
          )}
        />

        <Text style={styles.visitTimelineTitle}>Visit timeline</Text>
        {timelineVisits.length > 0 ? (
          <View style={styles.visitTimeline}>
            {timelineVisits.map((visit, index) => {
              const status = visitStatus(visit);
              const isRescheduling = rescheduleVisitId === visit.id;
              return (
                <View key={visit.id} style={styles.visitRow}>
                  <View style={styles.visitRowTop}>
                    <View style={styles.visitRowTitleWrap}>
                      <Text style={styles.visitRowTitle}>{visit.label || `Visit ${index + 1}`}</Text>
                      <View style={[styles.visitStatusBadge, { backgroundColor: visitStatusBg(status) }]}>
                        <Text style={[styles.visitStatusText, { color: visitStatusColor(status) }]}>
                          {JOB_VISIT_STATUS_LABELS[status]}
                        </Text>
                      </View>
                    </View>
                    {canEdit && status === 'scheduled' ? (
                      <View style={styles.visitActions}>
                        <Pressable
                          onPress={() => handleMarkVisitDone(visit.id)}
                          disabled={updating}
                          style={({ pressed }) => [styles.visitActionBtn, pressed && styles.pressed]}
                        >
                          <Text style={styles.visitActionDone}>Done</Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            isRescheduling
                              ? setRescheduleVisitId(null)
                              : openReschedule(visit.id)
                          }
                          disabled={updating}
                          style={({ pressed }) => [styles.visitActionBtn, pressed && styles.pressed]}
                        >
                          <Text style={styles.visitActionReschedule}>
                            {isRescheduling ? 'Cancel' : 'Reschedule'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.visitRowWhen}>
                    {formatVisitWhen(visit)}
                    {status === 'rescheduled' && visit.rescheduledToId
                      ? ` → ${formatVisitWhen(
                          timelineVisits.find((row) => row.id === visit.rescheduledToId) ?? visit,
                        )}`
                      : ''}
                  </Text>
                  {formatVisitOnSiteTimes(visit) ? (
                    <Text style={styles.visitRowMeta}>
                      On site · {formatVisitOnSiteTimes(visit)}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => promptMapsForVisit(visit, job.siteAddress)}
                    style={({ pressed }) => [styles.visitLocationRow, pressed && styles.pressed]}
                  >
                    <Ionicons name="location-outline" size={14} color={colors.info} />
                    <Text style={styles.visitRowLocation}>
                      {formatVisitLocationLabel(visit, job.siteAddress)}
                    </Text>
                    <Ionicons name="navigate-outline" size={14} color={colors.info} />
                  </Pressable>
                  {status === 'done' && visit.completedAt ? (
                    <Text style={styles.visitRowMeta}>Completed · {formatDateTime(visit.completedAt)}</Text>
                  ) : null}
                  {isRescheduling && canEdit ? (
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
                        label="Create follow-up visit"
                        icon="checkmark-circle-outline"
                        onPress={handleReschedule}
                        disabled={updating || !rescheduleAt}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <DetailRow
            label="Visit scheduled"
            value={formatScheduleWhen(job.scheduledDate, job.scheduledTime)}
          />
        )}

        {showAddVisit && canEdit ? (
          <View style={styles.rescheduleForm}>
            <DateTimeField
              label="Follow-up date & time"
              value={addVisitAt}
              onChange={setAddVisitAt}
              mode="datetime"
              icon="calendar-outline"
            />
            <View style={styles.noteField}>
              <Text style={styles.detailLabel}>Label (optional)</Text>
              <TextInput
                value={addVisitLabel}
                onChangeText={setAddVisitLabel}
                placeholder="e.g. Phase 2, Warranty check"
                placeholderTextColor={colors.grey400}
                style={styles.noteInput}
              />
            </View>
            <PrimaryButton
              label="Program visit"
              icon="add-circle-outline"
              onPress={handleAddFollowUp}
              disabled={updating || !addVisitAt}
            />
          </View>
        ) : null}

        {job.scheduleLog?.length ? (
          <View style={styles.historyBlock}>
            <Text style={styles.historyTitle}>Schedule history</Text>
            {[...(job.scheduleLog ?? [])].reverse().map((entry, index) => (
              <View key={`${entry.at}-${index}`} style={styles.historyRow}>
                <Text style={styles.historyWhen}>{formatScheduleLogEntry(entry)}</Text>
                <Text style={styles.historyMeta}>
                  {entry.userName || 'User'} · {formatDate(entry.at)}
                </Text>
                {entry.note && entry.action !== 'done' ? (
                  <Text style={styles.historyNote}>{entry.note}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Client & Site</Text>
        {canOpenMapsForAddress(job.siteAddress) ? (
          <MapsDetailRow
            label="Address"
            value={job.siteAddress}
            onPress={() => promptMapsForAddress(job.siteAddress)}
          />
        ) : (
          <DetailRow label="Address" value={job.siteAddress} />
        )}
        <Text style={styles.detailLabel}>Contacts</Text>
        <JobContactVisitGroups job={job} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mission</Text>
        <DetailRow label="Types" value={job.missionType} />
        <DetailRow
          label="Equipment"
          value={
            job.equipmentItems?.length
              ? formatEquipmentList(job.equipmentItems)
              : job.equipment
          }
        />
        <DetailRow
          label="Team"
          value={
            job.assignees?.length
              ? formatAssigneesDisplay(job.assignees)
              : job.technicianName
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
        {canEdit ? (
          <>
            <JobWorkReportsField
              value={workDraft}
              onChange={(next) => {
                setWorkDraft(next);
                setWorkDraftDirty(true);
              }}
              visitOptions={workReportVisitOptionsList}
            />
            {workDraftDirty ? (
              <PrimaryButton
                label="Save work report"
                icon="save-outline"
                onPress={handleSaveWorkReport}
                disabled={updating}
              />
            ) : null}
          </>
        ) : (
          <WorkReportVisitGroups job={job} />
        )}
        <DetailRow label="Additional notes" value={job.notes} />
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
          label="Export PDF recap"
          icon="document-text-outline"
          variant="secondary"
          onPress={() => setShowExportSheet(true)}
          disabled={exportingPdf}
        />
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

    <JobRecapExportSheet
      visible={showExportSheet}
      job={job}
      exporting={exportingPdf}
      onClose={() => setShowExportSheet(false)}
      onExport={handleExportPdf}
    />
    </>
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
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
  },
  visitTimelineTitle: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  visitTimeline: { gap: spacing.sm, marginBottom: spacing.sm },
  visitRow: {
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.grey100,
  },
  visitRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  visitRowTitleWrap: { flex: 1, gap: spacing.xs },
  visitRowTitle: { ...typography.body, color: colors.black, fontWeight: '700' },
  visitStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  visitStatusText: { ...typography.caption, fontWeight: '700' },
  visitActions: { flexDirection: 'row', gap: spacing.sm },
  visitActionBtn: { paddingVertical: 2, paddingHorizontal: 4 },
  visitActionDone: { ...typography.caption, color: colors.success, fontWeight: '700' },
  visitActionReschedule: { ...typography.caption, color: colors.info, fontWeight: '700' },
  visitRowWhen: { ...typography.body, color: colors.grey600 },
  visitRowMeta: { ...typography.caption, color: colors.grey600 },
  visitRowLocation: { ...typography.caption, color: colors.grey600, flex: 1 },
  visitLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  mapsDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapsDetailValue: { color: colors.black },
  pressed: { opacity: 0.85 },
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
  workEmpty: {
    ...typography.body,
    color: colors.grey600,
    fontStyle: 'italic',
  },
  workGroups: { gap: spacing.sm },
  workGroup: {
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.grey100,
  },
  workGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  workGroupTitle: {
    ...typography.caption,
    color: colors.black,
    fontWeight: '700',
    flex: 1,
  },
  workGroupBlock: { gap: 4 },
  workEntry: { gap: spacing.xs, marginBottom: spacing.xs },
  workGroupLabel: {
    ...typography.label,
    color: colors.grey600,
    fontSize: 10,
  },
  workGroupItem: {
    ...typography.body,
    color: colors.black,
    fontSize: 14,
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
