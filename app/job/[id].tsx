import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimeField } from '../../components/DateTimeField';
import { JobVisitsField } from '../../components/JobVisitsField';
import { VisitScheduleWarnings } from '../../components/VisitScheduleWarnings';
import { JobAttachments } from '../../components/JobAttachments';
import { JobWorkReportsField } from '../../components/JobWorkReportsField';
import { WorkReportEntryAttachments } from '../../components/WorkReportEntryAttachments';
import { JobRecapExportSheet, type RecapDeliveryMode } from '../../components/JobRecapExportSheet';
import { JobRecapHistory } from '../../components/JobRecapHistory';
import { PdfPreviewModal } from '../../components/PdfPreviewModal';
import { JobReviewPanel } from '../../components/JobReviewPanel';
import {
  buildApproveReview,
  buildBypassComplete,
  buildRejectReview,
  buildSubmitForReview,
  canReviewJob,
} from '../../lib/jobReview';
import { JobMissionNotesGroups } from '../../components/JobMissionNotesGroups';
import { JobMissionScopeGroups } from '../../components/JobMissionScopeGroups';
import { JobClientSiteEditor } from '../../components/JobClientSiteEditor';
import { LaunchVisitSheet } from '../../components/LaunchVisitSheet';
import { JobMissionScopesField } from '../../components/JobMissionScopesField';
import { VisitLinkedNotesField } from '../../components/VisitLinkedNotesField';
import { JobCommentsThread } from '../../components/JobCommentsThread';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StackPageHeader } from '../../components/StackPageHeader';
import { PriorityDot, StatusBadge, StatusPicker } from '../../components/StatusBadge';
import { primaryAssigneeFromEntries, type StoredJobAssignee } from '../../lib/jobAssignees';
import { canManageJob } from '../../lib/jobAccess';
import { getEffectivePosition } from '../../lib/appwrite/auth';
import {
  buildReopenJobFields,
  canDeleteJobCard,
  canEditJobClientSite,
  canEditJobContent,
  canScheduleJobVisits,
  jobContentEditBlockReason,
  jobInFollowUpCycle,
  jobNeedsReopenForFollowUp,
  lockedVisitIdsForUser,
} from '../../lib/jobEditAccess';
import { applyJobCardPermissions, jobOwnerUserId } from '../../lib/appwrite/jobCards';
import { listPersonnel, type Personnel } from '../../lib/appwrite/adminUsers';
import { formatEquipmentDisplay, formatEquipmentLine } from '../../lib/jobEquipment';
import {
  legacyFieldsFromMissionScopes,
  missionScopesForForm,
  missionScopesFromJob,
  normalizeMissionScopeEntries,
  type MissionScopeEntry,
} from '../../lib/jobMissionScopes';
import { formatMissionTypesDisplay } from '../../lib/jobMissions';
import { buildJobClientSitePatch, jobClientSiteDraftFromJob } from '../../lib/jobClientSite';
import type { AddressEntry } from '../../lib/clientAddresses';
import type { JobContactEntry } from '../../lib/jobContacts';
import type { ClientType } from '../../types/client';
import { buildVisitLinkOptions } from '../../lib/jobVisitLink';
import {
  missionNotesFromJob,
  normalizeVisitNoteEntries,
  visitNotesForForm,
  type VisitNoteEntry,
} from '../../lib/jobVisitNotes';
import {
  collectJobContactEmails,
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
import {
  emailRecap,
  previewRecap,
  saveRecap,
  shareAndLogRecap,
} from '../../lib/jobRecapDelivery';
import { deleteJobRecap, listRecapsForJob } from '../../lib/appwrite/jobRecaps';
import { type JobRecap } from '../../lib/jobRecaps';
import { MailComposerStatus } from 'expo-mail-composer';
import type { JobRecapExportOptions } from '../../lib/jobRecapExport';
import type { PdfPreviewSource } from '../../lib/pdfPreview';
import { cancelReminder, scheduleJobReminder } from '../../lib/notifications';
import { removeCalendarEvent } from '../../lib/calendar';
import {
  buildAddFollowUpVisitUpdates,
  buildDeleteVisitUpdates,
  buildMarkVisitDoneUpdates,
  buildRemoveScheduleLogEntryUpdates,
  buildRescheduleVisitUpdates,
  canDeleteVisitFromTimeline,
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
  buildFinishVisitUpdates,
  buildLaunchVisitUpdates,
  buildStopVisitUpdates,
  visitInProgress,
  visitsEligibleForLaunch,
  type LaunchVisitLocationChoice,
} from '../../lib/jobOnSite';
import {
  assigneeUserIdsFromJob,
  getVisitDateTimeWarnings,
  storedVisitDurationMinutes,
} from '../../lib/visitScheduleWarnings';
import { DEFAULT_VISIT_DURATION_MINUTES } from '../../lib/visitDuration';
import {
  defaultVisitEntry,
  defaultVisitNumberLabel,
  doneVisitCount,
  visitRowLabel,
  formatVisitLocationLabel,
  formatVisitEstimatedWindow,
  formatVisitWhen,
  JOB_VISIT_STATUS_LABELS,
  normalizeVisitEntries,
  nextScheduledVisit,
  type JobVisitEntry,
  normalizeVisitsList,
  scheduledVisitCount,
  sortVisitsTimeline,
  visitStatus,
  visitToDate,
} from '../../lib/jobVisits';

function visitStatusColor(status: ReturnType<typeof visitStatus>): string {
  if (status === 'done') return colors.success;
  if (status === 'in_progress') return colors.primaryDark;
  if (status === 'rescheduled') return colors.grey600;
  if (status === 'cancelled') return colors.warning;
  return colors.info;
}

function visitStatusBg(status: ReturnType<typeof visitStatus>): string {
  if (status === 'done') return colors.successLight;
  if (status === 'in_progress') return colors.primaryLight;
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
          {group.noteItems.length ? (
            <View style={styles.workGroupBlock}>
              <Text style={styles.workGroupLabel}>Work notes</Text>
              {group.noteItems.map((item, index) => (
                <WorkReportEntryBlock
                  key={`n-${index}`}
                  item={item}
                  index={index}
                  total={group.noteItems.length}
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

function cancelDirtySectionEdit(
  dirty: boolean,
  sectionLabel: string,
  onDiscard: () => void,
  onClose: () => void,
) {
  const finish = () => {
    onDiscard();
    onClose();
  };
  if (dirty) {
    Alert.alert(
      'Discard changes?',
      `Unsaved ${sectionLabel} edits will be lost.`,
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: finish },
      ],
    );
    return;
  }
  finish();
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJobCard, updateJobCard, deleteJobCard, jobCards, teamMembers } = useJobCards();
  const { isAdmin, user } = useAuth();
  const { findPerson, findCompany, companies, persons } = useClients();

  const job = useMemo(() => (id ? getJobCard(id) : undefined), [getJobCard, id]);
  const [updating, setUpdating] = useState(false);
  const [rescheduleVisitId, setRescheduleVisitId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState<Date | null>(null);
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [addVisitDraft, setAddVisitDraft] = useState<JobVisitEntry[]>([defaultVisitEntry()]);
  const [recapBusyMode, setRecapBusyMode] = useState<RecapDeliveryMode | null>(null);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showLaunchSheet, setShowLaunchSheet] = useState(false);
  const [launchPreselectId, setLaunchPreselectId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    title: string;
    source: PdfPreviewSource;
  } | null>(null);
  const [recaps, setRecaps] = useState<JobRecap[]>([]);
  const [deletingRecapId, setDeletingRecapId] = useState<string | null>(null);
  const [workDraft, setWorkDraft] = useState<WorkReportFormState>(() =>
    workReportFormState(undefined, '', ''),
  );
  const [workDraftDirty, setWorkDraftDirty] = useState(false);
  const [workReportEditing, setWorkReportEditing] = useState(false);
  const [missionDraft, setMissionDraft] = useState<MissionScopeEntry[]>([]);
  const [missionNotesDraft, setMissionNotesDraft] = useState<VisitNoteEntry[]>([]);
  const [missionDirty, setMissionDirty] = useState(false);
  const [missionEditing, setMissionEditing] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [clientType, setClientType] = useState<ClientType | null>(null);
  const [clientName, setClientName] = useState('');
  const [manualClientName, setManualClientName] = useState('');
  const [siteAddresses, setSiteAddresses] = useState<AddressEntry[]>([]);
  const [jobContacts, setJobContacts] = useState<JobContactEntry[]>([]);
  const [clientDirty, setClientDirty] = useState(false);
  const [clientSiteEditing, setClientSiteEditing] = useState(false);
  const [clientError, setClientError] = useState<string | undefined>();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);

  const loadPersonnel = useCallback(async () => {
    if (personnel.length > 0 || personnelLoading) return;
    setPersonnelLoading(true);
    try {
      setPersonnel(await listPersonnel());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load personnel.';
      Alert.alert('Team', message);
    } finally {
      setPersonnelLoading(false);
    }
  }, [personnel.length, personnelLoading]);

  useEffect(() => {
    if (!job) return;
    setMissionDraft(missionScopesForForm(job));
    setMissionNotesDraft(visitNotesForForm(missionNotesFromJob(job)));
    setMissionDirty(false);
    setMissionEditing(false);
  }, [job?.id, job?.missionScopes, job?.missionNotes, job?.missionTypes, job?.equipmentItems, job?.assignees]);

  useEffect(() => {
    if (!job) return;
    const draft = jobClientSiteDraftFromJob(job, findPerson, findCompany);
    setCompanyId(draft.companyId);
    setClientType(draft.clientType);
    setClientName(draft.clientName);
    setManualClientName(draft.manualClientName);
    setSiteAddresses(draft.siteAddresses);
    setJobContacts(draft.jobContacts);
    setClientDirty(false);
    setClientSiteEditing(false);
    setClientError(undefined);
  }, [
    job?.id,
    job?.companyId,
    job?.personId,
    job?.clientName,
    job?.siteAddress,
    job?.clientType,
    job?.jobContacts,
    job?.contactName,
    job?.contactPhone,
    findPerson,
    findCompany,
  ]);

  useEffect(() => {
    if (!job || !user?.$id) return;
    const ownerId = jobOwnerUserId(job) || job.technicianId;
    if (!ownerId) return;
    applyJobCardPermissions(job.id, ownerId, job).catch(() => undefined);
  }, [job?.id, job?.technicianId, job?.assigneeId, job?.assignees, user?.$id, isAdmin, teamMembers]);

  useEffect(() => {
    if (!job) return;
    setWorkDraft(
      workReportFormState(job.workReport, job.workPerformed, job.partsUsed),
    );
    setWorkDraftDirty(false);
    setWorkReportEditing(false);
  }, [job?.id, job?.workReport, job?.workPerformed, job?.partsUsed]);

  const refreshRecaps = useCallback(async () => {
    if (!id) return;
    try {
      setRecaps(await listRecapsForJob(id));
    } catch {
      // best-effort — recap history is non-critical
    }
  }, [id]);

  useEffect(() => {
    refreshRecaps();
  }, [refreshRecaps]);

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

  const missionVisitOptions = useMemo(
    () => buildVisitLinkOptions(normalizeVisitsList(job?.visits ?? [])),
    [job?.visits],
  );

  const recapDefaultRecipients = useMemo(
    () => collectJobContactEmails(job?.jobContacts),
    [job?.jobContacts],
  );

  const canReview = useMemo(
    () => (job ? canReviewJob(job, user?.$id, isAdmin, teamMembers) : false),
    [job, user?.$id, isAdmin, teamMembers],
  );

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId],
  );

  const visitAssigneeIds = useMemo(
    () => (job ? assigneeUserIdsFromJob(job) : []),
    [job],
  );

  const timelineVisitsForWarnings = useMemo(
    () => (job ? sortVisitsTimeline(job.visits ?? []) : []),
    [job],
  );

  const rescheduleWarnings = useMemo(() => {
    if (!job || !rescheduleAt || !rescheduleVisitId) return [];
    const source = timelineVisitsForWarnings.find((row) => row.id === rescheduleVisitId);
    return getVisitDateTimeWarnings({
      at: rescheduleAt,
      durationMinutes: source
        ? storedVisitDurationMinutes(source)
        : DEFAULT_VISIT_DURATION_MINUTES,
      assigneeUserIds: visitAssigneeIds,
      jobs: jobCards,
      excludeVisitId: rescheduleVisitId,
    });
  }, [
    job,
    rescheduleAt,
    rescheduleVisitId,
    timelineVisitsForWarnings,
    visitAssigneeIds,
    jobCards,
  ]);

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <StackPageHeader title="Job card" />
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Job card not found</Text>
          <PrimaryButton label="Back to jobs" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const locked = isJobLocked(job);
  const canManage = canManageJob(job, user?.$id, isAdmin, teamMembers);
  const userPosition = getEffectivePosition(user);
  const canEdit =
    canManage && canEditJobContent(job, user?.$id, isAdmin, teamMembers);
  const canSchedule =
    canManage && canScheduleJobVisits(job, user?.$id, isAdmin, teamMembers);
  const canEditSite =
    canManage && canEditJobClientSite(job, user?.$id, isAdmin, teamMembers);
  const editBlockReason = jobContentEditBlockReason(
    job,
    user?.$id,
    isAdmin,
    teamMembers,
  );
  const reopenOnNextVisit = jobNeedsReopenForFollowUp(job);
  const followUpCycle = jobInFollowUpCycle(job);
  const lockedVisitIds = lockedVisitIdsForUser(
    job,
    user?.$id,
    isAdmin,
    teamMembers,
    userPosition,
  );
  const canDelete =
    canManage && canDeleteJobCard(job, user?.$id, isAdmin, teamMembers);
  const timelineVisits = sortVisitsTimeline(job.visits ?? []);
  const activeVisit = visitInProgress(timelineVisits);
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
      missionScopes: job.missionScopes,
      missionNotes: job.missionNotes,
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
      Alert.alert('Cannot edit', editBlockReason || 'Changes not allowed.');
      return;
    }
    setUpdating(true);
    try {
      await updateJobCard(job.id, { status });
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveMission = async () => {
    if (!canEdit) {
      Alert.alert('Cannot edit', editBlockReason || 'Changes not allowed.');
      return;
    }
    const normalizedScopes = normalizeMissionScopeEntries(missionDraft);
    const normalizedMissionNotes = normalizeVisitNoteEntries(missionNotesDraft);
    const legacy = legacyFieldsFromMissionScopes(normalizedScopes);
    if (!legacy.missionTypes.length) {
      Alert.alert('Mission', 'Select at least one mission type.');
      return;
    }
    if (!legacy.assignees.some((entry) => entry.userId)) {
      Alert.alert('Mission', 'Add at least one team member.');
      return;
    }
    const primary = primaryAssigneeFromEntries(legacy.assignees);
    setUpdating(true);
    try {
      await updateJobCard(job.id, {
        missionScopes: normalizedScopes,
        missionNotes: normalizedMissionNotes,
        missionTypes: legacy.missionTypes,
        missionType: formatMissionTypesDisplay(legacy.missionTypes),
        equipmentItems: legacy.equipmentItems.map((line) => formatEquipmentLine(line)),
        equipment: formatEquipmentDisplay(legacy.equipmentItems),
        assignees: legacy.assignees,
        assigneeId: primary.userId || null,
        assigneeName: primary.name,
        technicianName: primary.name,
        jobContacts: job.jobContacts,
        initialScheduledDate: job.initialScheduledDate,
        initialScheduledTime: job.initialScheduledTime,
        scheduleLog: job.scheduleLog,
        visits: job.visits,
      });
      setMissionDirty(false);
      setMissionEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save mission.';
      Alert.alert('Mission', message);
    } finally {
      setUpdating(false);
    }
  };

  const setPriority = async (priority: JobPriority) => {
    if (!canEdit) {
      Alert.alert('Cannot edit', editBlockReason || 'Changes not allowed.');
      return;
    }
    setUpdating(true);
    try {
      await updateJobCard(job.id, { priority });
    } finally {
      setUpdating(false);
    }
  };

  const persistOnSitePatch = async (patch: Partial<JobCard>) => {
    await updateJobCard(job.id, {
      ...patch,
      assignees: patch.assignees ?? job.assignees,
      jobContacts: job.jobContacts,
      missionTypes: patch.missionTypes ?? job.missionTypes,
      missionType: patch.missionType ?? job.missionType,
      missionScopes: patch.missionScopes ?? job.missionScopes,
      missionNotes: job.missionNotes,
      equipmentItems: patch.equipmentItems ?? job.equipmentItems,
    });
  };

  const handlePlanMission = async () => {
    if (!canEdit) return;
    const scopes = missionScopesFromJob(job);
    if (!scopes.length && !job.missionTypes?.length) {
      Alert.alert('Plan mission', 'Add at least one mission type before planning.');
      return;
    }
    if (!job.assignees?.some((row) => row.userId)) {
      Alert.alert('Plan mission', 'Add at least one team member.');
      return;
    }
    if (!scheduledVisitCount(job.visits)) {
      Alert.alert('Plan mission', 'Schedule at least one visit.');
      return;
    }
    setUpdating(true);
    try {
      await persistOnSitePatch({ status: 'planned' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to plan mission.';
      Alert.alert('Plan mission', message);
    } finally {
      setUpdating(false);
    }
  };

  const launchEligibleVisits = visitsEligibleForLaunch(timelineVisits);

  const openLaunchSheet = (preselectVisitId?: string) => {
    if (!canEdit) return;
    if (!launchEligibleVisits.length) {
      Alert.alert('Launch', 'No scheduled visits. Add or reschedule a visit first.');
      return;
    }
    setLaunchPreselectId(preselectVisitId ?? null);
    loadPersonnel().catch(() => undefined);
    setShowLaunchSheet(true);
  };

  const handleLaunchVisit = async (
    visitId: string,
    locationChoice: LaunchVisitLocationChoice,
    team: StoredJobAssignee[],
  ) => {
    if (!canEdit || !user) return;
    setUpdating(true);
    try {
      const patch = buildLaunchVisitUpdates(
        job,
        visitId,
        {
          id: user.$id,
          name: user.name || user.email || 'User',
        },
        team,
        locationChoice,
      );
      await persistOnSitePatch(patch);
      setShowLaunchSheet(false);
      setLaunchPreselectId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to launch visit.';
      Alert.alert('Launch', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleFinishOnSite = async () => {
    if (!canEdit || !user) return;
    setUpdating(true);
    try {
      const patch = buildFinishVisitUpdates(job, {
        id: user.$id,
        name: user.name || user.email || 'User',
      });
      await persistOnSitePatch(patch);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to finish visit.';
      Alert.alert('Finish', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveScheduleLogEntry = (logIndex: number) => {
    if (!canEdit) return;
    Alert.alert(
      'Remove from history?',
      'This undoes that schedule change — visit times and status are rolled back as if it never happened.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const patch = buildRemoveScheduleLogEntryUpdates(job, logIndex);
              await persistScheduleUpdates(patch, jobScheduledAt({ ...job, ...patch }));
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Unable to remove history entry.';
              Alert.alert('Schedule history', message);
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const handleStopVisit = (visitId?: string) => {
    Alert.alert(
      'Stop visit',
      'Clear on-site times and return this visit to scheduled? Use this if you launched by mistake.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const patch = buildStopVisitUpdates(job, visitId);
              await persistOnSitePatch(patch);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to stop visit.';
              Alert.alert('Stop', message);
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
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

  const handleDeleteVisit = (visitId: string) => {
    if (!canSchedule) return;
    const gate = canDeleteVisitFromTimeline(timelineVisits, visitId);
    if (!gate.ok) {
      Alert.alert('Remove visit', gate.reason);
      return;
    }
    const label = timelineVisits.find((row) => row.id === visitId)?.label?.trim() || 'this visit';
    Alert.alert(
      'Remove visit?',
      `Delete ${label} from the timeline? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              const patch = buildDeleteVisitUpdates(job, visitId);
              await persistScheduleUpdates(patch, jobScheduledAt({ ...job, ...patch }));
              if (rescheduleVisitId === visitId) {
                setRescheduleVisitId(null);
                setRescheduleAt(null);
                setRescheduleNote('');
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to remove visit.';
              Alert.alert('Remove visit', message);
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
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
    if (!canSchedule || !user) return;
    const stored = normalizeVisitEntries(addVisitDraft);
    if (!stored.length) {
      Alert.alert('Visit', 'Set a visit date and estimated arrival.');
      return;
    }
    const runAdd = async () => {
      setUpdating(true);
      try {
        const scheduleUpdates = buildAddFollowUpVisitUpdates(job, stored[0], {
          id: user.$id,
          name: user.name || user.email || 'User',
        });
        const reopen = reopenOnNextVisit ? buildReopenJobFields(job) : {};
        await updateJobCard(job.id, {
          ...scheduleUpdates,
          ...reopen,
          reminderAt: job.reminderAt,
          notificationId: job.notificationId,
          assignees: job.assignees,
          jobContacts: job.jobContacts,
          missionTypes: job.missionTypes,
          missionScopes: job.missionScopes,
          missionNotes: job.missionNotes,
          equipmentItems: job.equipmentItems,
        });
        const updatedJob = { ...job, ...scheduleUpdates, ...reopen };
        if (updatedJob.calendarEventId || updatedJob.scheduledDate) {
          try {
            await syncSingleJobToPhoneCalendar(updatedJob, user.$id, updateJobCard);
          } catch {
            // optional
          }
        }
        setShowAddVisit(false);
        setAddVisitDraft([
          {
            ...defaultVisitEntry(),
            label: defaultVisitNumberLabel(timelineVisits),
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to add visit.';
        Alert.alert('Visit', message);
      } finally {
        setUpdating(false);
      }
    };
    if (reopenOnNextVisit) {
      Alert.alert(
        'Reopen mission',
        'Schedules a new visit and reopens this job card so the team can work again. Prior supervisor approval will be cleared.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reopen', onPress: () => runAdd() },
        ],
      );
      return;
    }
    await runAdd();
  };

  const markClientDirty = () => setClientDirty(true);

  const resetClientSiteDraft = () => {
    const draft = jobClientSiteDraftFromJob(job, findPerson, findCompany);
    setCompanyId(draft.companyId);
    setClientType(draft.clientType);
    setClientName(draft.clientName);
    setManualClientName(draft.manualClientName);
    setSiteAddresses(draft.siteAddresses);
    setJobContacts(draft.jobContacts);
    setClientDirty(false);
    setClientError(undefined);
  };

  const resetMissionDraft = () => {
    setMissionDraft(missionScopesForForm(job));
    setMissionNotesDraft(visitNotesForForm(missionNotesFromJob(job)));
    setMissionDirty(false);
  };

  const resetWorkReportDraft = () => {
    setWorkDraft(workReportFormState(job.workReport, job.workPerformed, job.partsUsed));
    setWorkDraftDirty(false);
  };

  const cancelClientSiteEdit = () => {
    cancelDirtySectionEdit(clientDirty, 'client & site', resetClientSiteDraft, () =>
      setClientSiteEditing(false),
    );
  };

  const cancelMissionEdit = () => {
    cancelDirtySectionEdit(missionDirty, 'mission', resetMissionDraft, () => setMissionEditing(false));
  };

  const cancelWorkReportEdit = () => {
    cancelDirtySectionEdit(workDraftDirty, 'work report', resetWorkReportDraft, () =>
      setWorkReportEditing(false),
    );
  };

  const handleSaveClientSite = async () => {
    if (!canEdit) return;
    const { patch, error } = buildJobClientSitePatch(
      {
        companyId,
        clientType,
        clientName,
        manualClientName,
        siteAddresses,
        jobContacts,
      },
      selectedCompany?.name,
    );
    if (error) {
      setClientError(error);
      Alert.alert('Client & site', error);
      return;
    }
    setClientError(undefined);
    setUpdating(true);
    try {
      await updateJobCard(job.id, patch);
      setClientDirty(false);
      setClientSiteEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save client & site.';
      Alert.alert('Client & site', message);
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
      setWorkReportEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save work report.';
      Alert.alert('Work report', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRecap = async (recap: JobRecap) => {
    if (!canEdit) return;
    setDeletingRecapId(recap.id);
    try {
      await deleteJobRecap(recap);
      await refreshRecaps();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete recap.';
      Alert.alert('Recap history', message);
    } finally {
      setDeletingRecapId(null);
    }
  };

  const handleDeliverRecap = async (
    mode: RecapDeliveryMode,
    options: JobRecapExportOptions,
    recipients: string[],
  ) => {
    if (!user) return;
    const actor = { id: user.$id, name: user.name || user.email || 'User' };
    setRecapBusyMode(mode);
    try {
      if (mode === 'preview') {
        const uri = await previewRecap(job, options, actor);
        setShowExportSheet(false);
        setPdfPreview({
          title: `Recap · ${job.reference || job.clientName}`,
          source: { kind: 'uri', uri },
        });
        return;
      }
      if (mode === 'save') {
        await saveRecap(job, options, actor);
        await refreshRecaps();
        Alert.alert('Recap saved', 'The PDF was logged to this job card.');
      } else if (mode === 'share') {
        await shareAndLogRecap(job, options, actor);
      } else if (mode === 'email') {
        const { status } = await emailRecap(job, options, actor, recipients);
        if (status === MailComposerStatus.CANCELLED) {
          return;
        }
        if (status === MailComposerStatus.SENT) {
          Alert.alert('Recap sent', 'The intervention report was emailed.');
        }
      }
      setShowExportSheet(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate the recap.';
      Alert.alert('PDF recap', message);
    } finally {
      setRecapBusyMode(null);
    }
  };

  const runReviewUpdate = async (updates: Partial<JobCard>) => {
    setUpdating(true);
    try {
      await updateJobCard(job.id, updates);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update review.';
      Alert.alert('Validation', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmitReview = () => {
    if (!user) return;
    runReviewUpdate(buildSubmitForReview({ id: user.$id, name: user.name || user.email || 'User' }));
  };

  const handleApproveReview = () => {
    if (!user) return;
    runReviewUpdate(buildApproveReview({ id: user.$id, name: user.name || user.email || 'User' }));
  };

  const handleRejectReview = (note: string) => {
    if (!user) return;
    runReviewUpdate(
      buildRejectReview({ id: user.$id, name: user.name || user.email || 'User' }, note, job),
    );
  };

  const handleBypassReview = () => {
    if (!user) return;
    Alert.alert(
      'Complete without review',
      'This will mark the job completed and flag it as not revised by a supervisor. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () =>
            runReviewUpdate(buildBypassComplete({ id: user.$id, name: user.name || user.email || 'User' })),
        },
      ],
    );
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

  const openFollowUpVisitForm = () => {
    setShowAddVisit(true);
    setRescheduleVisitId(null);
    setAddVisitDraft([
      {
        ...defaultVisitEntry(jobScheduledAt(job) ?? new Date()),
        label: defaultVisitNumberLabel(timelineVisits),
      },
    ]);
  };

  const handleFollowUp = () => {
    if (!canSchedule) {
      Alert.alert('Add visit', editBlockReason || 'You cannot add a visit on this card.');
      return;
    }
    if (reopenOnNextVisit) {
      Alert.alert(
        'Add visit',
        'Schedules a new visit on this job card and reopens field work. Prior supervisor approval is cleared. Completed visits stay in history — only Level 2/3 can change their mission or work records.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: openFollowUpVisitForm },
        ],
      );
      return;
    }
    openFollowUpVisitForm();
  };

  const handleDelete = () => {
    if (!canDelete) {
      Alert.alert(
        'Cannot delete',
        editBlockReason || 'Only the team (before supervisor approval) or your N+1 can delete this card.',
      );
      return;
    }
    Alert.alert('Delete job card', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setUpdating(true);
          try {
            await cancelReminder(job.notificationId);
            for (const eventId of collectJobCalendarEventIds(job)) {
              await removeCalendarEvent(eventId);
            }
            await deleteJobCard(job.id);
            router.replace('/(tabs)/jobs');
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unable to delete this job card.';
            Alert.alert('Delete', message);
          } finally {
            setUpdating(false);
          }
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
      Alert.alert('Cannot edit', editBlockReason || 'Changes not allowed.');
      return;
    }
    await updateJobCard(job.id, { photoIds, documentIds });
  };

  return (
    <>
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StackPageHeader title="Job card" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
              {!canEdit && canSchedule ? ' · new visit can reopen' : ''}
            </Text>
          </View>
        ) : null}
        {!canEdit && canManage && editBlockReason ? (
          <Text style={styles.editHint}>{editBlockReason}</Text>
        ) : null}
      </View>

      {/* On-site action toolbar */}
      {!locked ? (
        <View style={styles.actionToolbar}>
          {job.status === 'draft' && canEdit ? (
            <PrimaryButton
              label="Plan mission"
              icon="calendar-outline"
              onPress={handlePlanMission}
              disabled={updating}
            />
          ) : null}
          {(job.status === 'planned' || job.status === 'in_progress') && canEdit && !activeVisit ? (
            <PrimaryButton
              label="Launch on site"
              icon="play-circle-outline"
              onPress={() => openLaunchSheet()}
              disabled={updating}
            />
          ) : null}
          {activeVisit && canEdit ? (
            <>
              <PrimaryButton
                label="Finish on site"
                icon="stop-circle-outline"
                variant="secondary"
                onPress={handleFinishOnSite}
                disabled={updating}
              />
              <PrimaryButton
                label="Stop visit"
                icon="close-circle-outline"
                variant="ghost"
                onPress={() => handleStopVisit(activeVisit.id)}
                disabled={updating}
              />
            </>
          ) : null}
          {job.status === 'pending_review' || (job.finishedAt && !activeVisit) ? (
            <PrimaryButton label="Sign-off & lock" icon="create-outline" onPress={handleSignOff} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, styles.cardHeaderRowTitle]}>Visits</Text>
          {canSchedule ? (
            <Pressable
              onPress={() => {
                setShowAddVisit((open) => !open);
                setRescheduleVisitId(null);
                setAddVisitDraft([
                  {
                    ...defaultVisitEntry(jobScheduledAt(job) ?? new Date()),
                    label: defaultVisitNumberLabel(timelineVisits),
                  },
                ]);
              }}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={styles.linkBtnText}>
                {showAddVisit ? 'Cancel' : reopenOnNextVisit ? 'Reopen · add visit' : 'Add visit'}
              </Text>
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
        {followUpCycle ? (
          <Text style={styles.followUpHint}>
            Another visit in progress — launch and stop apply to the active visit. Completed visits are
            read-only here; Level 2/3 can still adjust their mission and work records.
          </Text>
        ) : null}
        {timelineVisits.length > 0 ? (
          <View style={styles.visitTimeline}>
            {timelineVisits.map((visit, index) => {
              const status = visitStatus(visit);
              const isRescheduling = rescheduleVisitId === visit.id;
              return (
                <View key={visit.id} style={styles.visitRow}>
                  <View style={styles.visitRowTop}>
                    <View style={styles.visitRowTitleWrap}>
                      <Text style={styles.visitRowTitle}>{visitRowLabel(visit, index)}</Text>
                      <View style={[styles.visitStatusBadge, { backgroundColor: visitStatusBg(status) }]}>
                        <Text style={[styles.visitStatusText, { color: visitStatusColor(status) }]}>
                          {JOB_VISIT_STATUS_LABELS[status]}
                        </Text>
                      </View>
                    </View>
                    {canSchedule && status === 'scheduled' ? (
                      <View style={styles.visitActions}>
                        {canEdit ? (
                          <>
                            <Pressable
                              onPress={() => openLaunchSheet(visit.id)}
                              disabled={updating || Boolean(activeVisit)}
                              accessibilityLabel="Launch on site"
                              accessibilityRole="button"
                              style={({ pressed }) => [
                                styles.visitIconBtn,
                                (updating || activeVisit) && styles.visitIconBtnDisabled,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Ionicons name="play-circle-outline" size={22} color={colors.primaryDark} />
                            </Pressable>
                            <Pressable
                              onPress={() => handleMarkVisitDone(visit.id)}
                              disabled={updating}
                              accessibilityLabel="Mark visit done"
                              accessibilityRole="button"
                              style={({ pressed }) => [
                                styles.visitIconBtn,
                                updating && styles.visitIconBtnDisabled,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                isRescheduling
                                  ? setRescheduleVisitId(null)
                                  : openReschedule(visit.id)
                              }
                              disabled={updating}
                              accessibilityLabel={isRescheduling ? 'Cancel reschedule' : 'Reschedule visit'}
                              accessibilityRole="button"
                              style={({ pressed }) => [
                                styles.visitIconBtn,
                                updating && styles.visitIconBtnDisabled,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Ionicons
                                name={isRescheduling ? 'close-circle-outline' : 'calendar-outline'}
                                size={22}
                                color={isRescheduling ? colors.grey600 : colors.info}
                              />
                            </Pressable>
                          </>
                        ) : null}
                        {canDeleteVisitFromTimeline(timelineVisits, visit.id).ok ? (
                          <Pressable
                            onPress={() => handleDeleteVisit(visit.id)}
                            disabled={updating}
                            accessibilityLabel="Remove visit"
                            style={({ pressed }) => [styles.visitIconBtn, pressed && styles.pressed]}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.error} />
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                    {canEdit && status === 'in_progress' ? (
                      <View style={styles.visitActions}>
                        <Pressable
                          onPress={handleFinishOnSite}
                          disabled={updating}
                          accessibilityLabel="Finish on site"
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.visitIconBtn,
                            updating && styles.visitIconBtnDisabled,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Ionicons name="flag-outline" size={22} color={colors.success} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleStopVisit(visit.id)}
                          disabled={updating}
                          accessibilityLabel="Stop visit"
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.visitIconBtn,
                            updating && styles.visitIconBtnDisabled,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Ionicons name="stop-circle-outline" size={22} color={colors.error} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.visitRowWhen}>
                    Planned · {formatVisitEstimatedWindow(visit)}
                    {status === 'rescheduled' && visit.rescheduledToId
                      ? ` → ${formatVisitWhen(
                          timelineVisits.find((row) => row.id === visit.rescheduledToId) ?? visit,
                        )}`
                      : ''}
                  </Text>
                  {formatVisitOnSiteTimes(visit) ? (
                    <Text style={styles.visitRowMeta}>
                      Actual · {formatVisitOnSiteTimes(visit)}
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
                      <VisitScheduleWarnings warnings={rescheduleWarnings} />
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
                        label="Schedule new visit"
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

        {showAddVisit && canSchedule ? (
          <View style={styles.rescheduleForm}>
            <JobVisitsField
              allowMultiple={false}
              singleVisitTitle={defaultVisitNumberLabel(timelineVisits)}
              values={addVisitDraft}
              onChange={setAddVisitDraft}
              jobSiteAddress={job.siteAddress}
              assigneeUserIds={visitAssigneeIds}
              allJobs={jobCards}
            />
            <PrimaryButton
              label={reopenOnNextVisit ? 'Reopen & program visit' : 'Program visit'}
              icon="add-circle-outline"
              onPress={handleAddFollowUp}
              disabled={updating}
            />
          </View>
        ) : null}

        {job.scheduleLog?.length ? (
          <View style={styles.historyBlock}>
            <Text style={styles.historyTitle}>Schedule history</Text>
            {[...(job.scheduleLog ?? [])].reverse().map((entry, reverseIndex) => {
              const logIndex = (job.scheduleLog?.length ?? 0) - 1 - reverseIndex;
              return (
                <View key={`${entry.at}-${logIndex}`} style={styles.historyRow}>
                  <View style={styles.historyRowMain}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyWhen}>
                        {formatScheduleLogEntry(entry, timelineVisits)}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {entry.userName || 'User'} · {formatDate(entry.at)}
                      </Text>
                      {entry.note && entry.action !== 'done' ? (
                        <Text style={styles.historyNote}>{entry.note}</Text>
                      ) : null}
                    </View>
                    {canEdit ? (
                      <Pressable
                        onPress={() => handleRemoveScheduleLogEntry(logIndex)}
                        disabled={updating}
                        accessibilityLabel="Remove schedule history entry"
                        style={({ pressed }) => [styles.historyRemoveBtn, pressed && styles.pressed]}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, styles.cardHeaderRowTitle]}>Client & Site</Text>
          {canEditSite && !clientSiteEditing ? (
            <Pressable
              onPress={() => {
                setClientError(undefined);
                setClientSiteEditing(true);
              }}
              accessibilityLabel="Edit client and site"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.black} />
            </Pressable>
          ) : null}
          {canEditSite && clientSiteEditing ? (
            <Pressable
              onPress={cancelClientSiteEdit}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={styles.linkBtnText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
        {canEditSite && clientSiteEditing ? (
          <>
            <JobClientSiteEditor
              companyId={companyId}
              onCompanyIdChange={(id) => {
                setCompanyId(id);
                markClientDirty();
              }}
              onClientTypeChange={(type) => {
                setClientType(type);
                markClientDirty();
              }}
              clientName={clientName}
              onClientNameChange={(name) => {
                setClientName(name);
                markClientDirty();
              }}
              manualClientName={manualClientName}
              onManualClientNameChange={(name) => {
                setManualClientName(name);
                markClientDirty();
              }}
              siteAddresses={siteAddresses}
              onSiteAddressesChange={(next) => {
                setSiteAddresses(next);
                markClientDirty();
              }}
              jobContacts={jobContacts}
              onJobContactsChange={(next) => {
                setJobContacts(next);
                markClientDirty();
              }}
              companies={companies}
              persons={persons}
              findPerson={findPerson}
              visitOptions={missionVisitOptions}
              clientError={clientError}
              onClientErrorClear={() => setClientError(undefined)}
            />
            {clientDirty ? (
              <PrimaryButton
                label="Save client & site"
                icon="business-outline"
                onPress={handleSaveClientSite}
                disabled={updating}
              />
            ) : null}
          </>
        ) : (
          <>
            <DetailRow label="Client" value={job.clientName} />
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
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, styles.cardHeaderRowTitle]}>Mission</Text>
          {canEdit && !missionEditing ? (
            <Pressable
              onPress={() => {
                setMissionEditing(true);
                loadPersonnel().catch(() => undefined);
              }}
              accessibilityLabel="Edit mission"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.black} />
            </Pressable>
          ) : null}
          {canEdit && missionEditing ? (
            <Pressable
              onPress={cancelMissionEdit}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={styles.linkBtnText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
        {canEdit && missionEditing ? (
          <>
            <JobMissionScopesField
              values={missionDraft}
              onChange={(next) => {
                setMissionDraft(next);
                setMissionDirty(true);
              }}
              visitOptions={missionVisitOptions}
              personnel={personnel}
              personnelLoading={personnelLoading}
              onLoadPersonnel={() => {
                loadPersonnel().catch(() => undefined);
              }}
              lockedVisitIds={[...lockedVisitIds]}
            />
            <VisitLinkedNotesField
              label="Mission notes"
              values={missionNotesDraft}
              onChange={(next) => {
                setMissionNotesDraft(next);
                setMissionDirty(true);
              }}
              visitOptions={missionVisitOptions}
              lockedVisitIds={[...lockedVisitIds]}
            />
            {missionDirty ? (
              <PrimaryButton
                label="Save mission"
                icon="clipboard-outline"
                onPress={handleSaveMission}
                disabled={updating}
              />
            ) : null}
          </>
        ) : (
          <>
            <JobMissionScopeGroups job={job} />
            <JobMissionNotesGroups job={job} />
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, styles.cardHeaderRowTitle]}>Work report</Text>
          {canEdit && !workReportEditing ? (
            <Pressable
              onPress={() => setWorkReportEditing(true)}
              accessibilityLabel="Edit work report"
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.black} />
            </Pressable>
          ) : null}
          {canEdit && workReportEditing ? (
            <Pressable
              onPress={cancelWorkReportEdit}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Text style={styles.linkBtnText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
        {canEdit && workReportEditing ? (
          <>
            <JobWorkReportsField
              value={workDraft}
              onChange={(next) => {
                setWorkDraft(next);
                setWorkDraftDirty(true);
              }}
              visitOptions={workReportVisitOptionsList}
              lockedVisitIds={[...lockedVisitIds]}
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

      <JobReviewPanel
        job={job}
        canReview={canReview}
        canEdit={canEdit}
        busy={updating}
        onSubmit={handleSubmitReview}
        onApprove={handleApproveReview}
        onReject={handleRejectReview}
        onBypass={handleBypassReview}
      />

      <JobRecapHistory
        recaps={recaps}
        canDelete={canEdit}
        deletingId={deletingRecapId}
        onDelete={handleDeleteRecap}
      />

      <JobCommentsThread jobId={job.id} />

      <View style={styles.bottomActions}>
        <PrimaryButton
          label="Export recap"
          icon="document-text-outline"
          variant="secondary"
          onPress={() => setShowExportSheet(true)}
          disabled={recapBusyMode !== null}
        />
        <PrimaryButton
          label="Open follow-up"
          icon="git-branch-outline"
          variant="secondary"
          onPress={handleFollowUp}
        />
        {locked && (isAdmin || canReview) ? (
          <PrimaryButton
            label="Unlock"
            icon="lock-open-outline"
            variant="secondary"
            onPress={handleUnlock}
          />
        ) : null}
        {canDelete ? (
          <PrimaryButton
            label="Delete"
            icon="trash-outline"
            variant="ghost"
            onPress={handleDelete}
            disabled={updating}
          />
        ) : null}
      </View>
      </ScrollView>
    </SafeAreaView>

    <JobRecapExportSheet
      visible={showExportSheet}
      job={job}
      busyMode={recapBusyMode}
      defaultRecipients={recapDefaultRecipients}
      onClose={() => setShowExportSheet(false)}
      onDeliver={handleDeliverRecap}
    />
    <PdfPreviewModal
      visible={pdfPreview !== null}
      title={pdfPreview?.title ?? 'PDF'}
      source={pdfPreview?.source ?? null}
      onClose={() => setPdfPreview(null)}
    />
    <LaunchVisitSheet
      visible={showLaunchSheet}
      job={job}
      visits={launchEligibleVisits}
      jobSiteAddress={job.siteAddress}
      initialVisitId={launchPreselectId}
      personnel={personnel}
      personnelLoading={personnelLoading}
      onLoadPersonnel={() => {
        loadPersonnel().catch(() => undefined);
      }}
      busy={updating}
      onClose={() => {
        setShowLaunchSheet(false);
        setLaunchPreselectId(null);
      }}
      onLaunch={(visitId, location, team) => void handleLaunchVisit(visitId, location, team)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
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
  editHint: {
    ...typography.caption,
    color: colors.grey600,
    marginTop: spacing.xs,
  },
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
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
  followUpHint: {
    ...typography.caption,
    color: colors.grey600,
    marginBottom: spacing.sm,
    lineHeight: 18,
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
  visitActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  visitIconBtn: {
    padding: 6,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  visitIconBtnDisabled: { opacity: 0.4 },
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
    paddingVertical: spacing.xs,
  },
  historyRowMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  historyRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey100,
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
