import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactAddressesField } from '../../components/ContactAddressesField';
import { DateTimeField } from '../../components/DateTimeField';
import { FormField, FormSection } from '../../components/FormField';
import { JobAssigneesField } from '../../components/JobAssigneesField';
import { JobContactsField } from '../../components/JobContactsField';
import { JobWorkReportsField } from '../../components/JobWorkReportsField';
import { MissionTypesField } from '../../components/MissionTypesField';
import { PickerSheet, type PickerOption } from '../../components/PickerSheet';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StackPageHeader } from '../../components/StackPageHeader';
import { StatusPicker } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { listPersonnel, type Personnel } from '../../lib/appwrite/adminUsers';
import {
  addressEntriesForForm,
  defaultAddressEntry,
  prepareClientAddressesPayload,
  type AddressEntry,
} from '../../lib/clientAddresses';
import {
  isPhoneCalendarJobsSyncActive,
  syncSingleJobToPhoneCalendar,
} from '../../lib/phoneCalendarSync';
import { jobFormErrorScrollKeys, useFormScrollToError, type JobFormFieldErrors } from '../../lib/formScroll';
import {
  assigneesForForm,
  defaultAssigneeEntry,
  normalizeAssigneeEntries,
  primaryAssigneeFromEntries,
  type AssigneeEntry,
} from '../../lib/jobAssignees';
import {
  defaultJobContactEntry,
  jobContactFromPerson,
  jobContactsForForm,
  normalizeJobContactEntries,
  primaryJobContactFromEntries,
  type JobContactEntry,
} from '../../lib/jobContacts';
import {
  formatMissionTypesDisplay,
  missionTypesForForm,
  normalizeMissionTypes,
} from '../../lib/jobMissions';
import {
  normalizeWorkReportEntries,
  serializeWorkReportsToStorage,
  workReportsForForm,
  type WorkReportEntry,
} from '../../lib/jobWorkReports';
import { scheduleJobReminder } from '../../lib/notifications';
import type { Company } from '../../types/client';
import {
  JOB_PRIORITY_LABELS,
  type JobPriority,
  type JobStatus,
} from '../../types/jobCard';
import type { ClientType } from '../../types/client';
import { generateReference, todayIsoDate } from '../../utils/formatDate';

const REMINDER_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'At start' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 24 * 60, label: '1 day' },
];

const PRIORITIES = Object.keys(JOB_PRIORITY_LABELS) as JobPriority[];

function clientAddressesForForm(
  client: { address?: string; contactAddresses?: Parameters<typeof addressEntriesForForm>[0] } | undefined,
  fallback?: string,
): AddressEntry[] {
  if (!client) return addressEntriesForForm(undefined, fallback);
  return addressEntriesForForm(client.contactAddresses, client.address ?? fallback);
}

export default function NewJobCardScreen() {
  const { addJobCard, getJobCard, updateJobCard } = useJobCards();
  const { user } = useAuth();
  const { findPerson, findCompany, persons, companies } = useClients();

  const params = useLocalSearchParams<{
    personId?: string;
    companyId?: string;
    parentJobId?: string;
    clientName?: string;
  }>();

  const parentJob = params.parentJobId ? getJobCard(params.parentJobId) : undefined;

  const initialPerson = params.personId ? findPerson(params.personId) : undefined;
  const initialCompany = params.companyId ? findCompany(params.companyId) : undefined;

  const [reference] = useState(generateReference);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<JobFormFieldErrors>({});
  const pendingScrollKeys = useRef<string[]>([]);
  const { scrollRef, contentRef, registerField, scrollToFirstError } = useFormScrollToError();

  const [companyId, setCompanyId] = useState(
    initialCompany?.id ?? initialPerson?.companyId ?? parentJob?.companyId ?? '',
  );
  const [clientType, setClientType] = useState<ClientType | null>(() => {
    if (initialCompany || initialPerson?.companyId || parentJob?.companyId) return 'company';
    if (initialPerson || parentJob?.personId) return 'person';
    return parentJob?.clientType ?? null;
  });
  const [clientName, setClientName] = useState(
    initialCompany?.name ??
      (initialPerson?.companyId ? findCompany(initialPerson.companyId)?.name : undefined) ??
      initialPerson?.fullName ??
      params.clientName ??
      parentJob?.clientName ??
      '',
  );
  const [manualClientName, setManualClientName] = useState('');

  const initialClient = initialPerson ?? initialCompany;
  const [siteAddresses, setSiteAddresses] = useState<AddressEntry[]>(() =>
    clientAddressesForForm(initialClient, parentJob?.siteAddress),
  );
  const [jobContacts, setJobContacts] = useState<JobContactEntry[]>(() => {
    if (parentJob?.jobContacts?.length) return jobContactsForForm(parentJob.jobContacts);
    if (initialPerson) return [jobContactFromPerson(initialPerson, 'Primary')];
    return jobContactsForForm(undefined, {
      personId: parentJob?.personId,
      name: parentJob?.contactName,
      phone: parentJob?.contactPhone,
    });
  });

  const [assignees, setAssignees] = useState<AssigneeEntry[]>(() => {
    if (parentJob?.assignees?.length) return assigneesForForm(parentJob.assignees);
    if (parentJob?.assigneeId) {
      return assigneesForForm(undefined, parentJob.assigneeId, parentJob.assigneeName ?? '');
    }
    if (user?.$id) return [defaultAssigneeEntry(user.$id, user.name ?? '', 'Lead')];
    return [defaultAssigneeEntry()];
  });

  const [missionTypes, setMissionTypes] = useState<string[]>(() =>
    parentJob?.missionTypes?.length
      ? [...parentJob.missionTypes]
      : missionTypesForForm(parentJob?.missionType),
  );
  const [equipment, setEquipment] = useState(parentJob?.equipment ?? '');
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  const [scheduledAt, setScheduledAt] = useState<Date | null>(new Date());
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(60);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [phoneCalendarSyncActive, setPhoneCalendarSyncActive] = useState(false);
  const [arrivalAt, setArrivalAt] = useState<Date | null>(null);
  const [departureAt, setDepartureAt] = useState<Date | null>(null);
  const [workReports, setWorkReports] = useState<WorkReportEntry[]>(() =>
    workReportsForForm(parentJob?.workReports, parentJob?.workPerformed, parentJob?.partsUsed),
  );
  const [notes, setNotes] = useState(
    parentJob ? `Follow-up of ${parentJob.reference}.\n${parentJob.notes ?? ''}`.trim() : '',
  );
  const [status, setStatus] = useState<JobStatus>('draft');
  const [priority, setPriority] = useState<JobPriority>(parentJob?.priority ?? 'normal');

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId],
  );
  const linkedPersons = useMemo(
    () =>
      companyId
        ? persons.filter((p) => p.companyId === companyId)
        : [],
    [persons, companyId],
  );

  const companyOptions = useMemo(
    () => [
      { id: '', label: 'No company', hint: 'Independent contact', icon: 'remove-circle-outline' as const },
      ...companies.map((c) => ({
        id: c.id,
        label: c.name,
        hint: c.industry || c.email || undefined,
        icon: 'business-outline' as const,
      })),
    ],
    [companies],
  );

  const hasLinkedClient = Boolean(companyId || jobContacts.some((c) => c.personId || c.name.trim()));
  const displayClientName = selectedCompany?.name ?? clientName ?? manualClientName;

  useEffect(() => {
    if (pendingScrollKeys.current.length === 0) return;
    const keys = pendingScrollKeys.current;
    pendingScrollKeys.current = [];
    scrollToFirstError(keys);
  }, [errors, scrollToFirstError]);

  useEffect(() => {
    isPhoneCalendarJobsSyncActive()
      .then((active) => {
        setPhoneCalendarSyncActive(active);
        if (!active) setAddToCalendar(true);
      })
      .catch(() => undefined);
  }, []);

  const loadPersonnel = useCallback(async () => {
    if (personnel.length > 0 || personnelLoading) return;
    setPersonnelLoading(true);
    try {
      setPersonnel(await listPersonnel());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load personnel.';
      Alert.alert('Technicians', message);
    } finally {
      setPersonnelLoading(false);
    }
  }, [personnel.length, personnelLoading]);

  useEffect(() => {
    loadPersonnel().catch(() => undefined);
  }, [loadPersonnel]);

  const applyCompany = (company: Company | undefined) => {
    if (!company) {
      setCompanyId('');
      setClientType(null);
      setClientName(manualClientName);
      setJobContacts((prev) => prev.filter((c) => !c.personId));
      return;
    }
    setCompanyId(company.id);
    setClientType('company');
    setClientName(company.name);
    setSiteAddresses(clientAddressesForForm(company));
    setJobContacts((prev) =>
      prev.filter((c) => !c.personId || findPerson(c.personId)?.companyId === company.id),
    );
    if (errors.client) setErrors((prev) => ({ ...prev, client: undefined }));
  };

  const [deviceContacts, setDeviceContacts] = useState<Contacts.ExistingContact[]>([]);
  const [showContactsPicker, setShowContactsPicker] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  const importContact = async () => {
    try {
      setContactsLoading(true);
      const perm = await Contacts.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Contacts', 'Allow contacts access to import a phone number.');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Addresses,
        ],
        sort: Contacts.SortTypes.FirstName,
      });
      if (!data.length) {
        Alert.alert('Contacts', 'No contacts found on this device.');
        return;
      }
      setDeviceContacts(data);
      setShowContactsPicker(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read contacts.';
      Alert.alert('Contacts', message);
    } finally {
      setContactsLoading(false);
    }
  };

  const contactsOptions: PickerOption[] = useMemo(
    () =>
      deviceContacts
        .filter((c) => c.name)
        .map((c, idx) => ({
          id: c.id ?? `${c.name ?? 'contact'}-${idx}`,
          label: c.name ?? '',
          hint: c.phoneNumbers?.[0]?.number ?? c.emails?.[0]?.email ?? '',
          icon: 'person-outline',
        })),
    [deviceContacts],
  );

  const onPickContact = (opt: PickerOption) => {
    const found = deviceContacts.find(
      (c, idx) => (c.id ?? `${c.name ?? 'contact'}-${idx}`) === opt.id,
    );
    if (!found) return;
    const phone = found.phoneNumbers?.[0]?.number?.replace(/\s+/g, ' ').trim() ?? '';
    const name = found.name ?? '';
    setJobContacts((prev) => {
      const filled = prev.filter((row) => row.name.trim() || row.phone.trim() || row.personId);
      return [...filled, defaultJobContactEntry(name, phone, filled.length === 0 ? 'Primary' : 'Site')];
    });
    const addr = found.addresses?.[0];
    const currentAddress = prepareClientAddressesPayload(siteAddresses).address;
    if (addr && !currentAddress.trim()) {
      const parts = [addr.street, addr.city, addr.region, addr.postalCode, addr.country].filter(
        Boolean,
      );
      if (parts.length) {
        setSiteAddresses((prev) => {
          const rows = prev.length > 0 ? [...prev] : [defaultAddressEntry()];
          rows[0] = { ...rows[0], text: parts.join(', ') };
          return rows;
        });
      }
    }
  };

  const handleSave = async () => {
    const finalClientName = (displayClientName || manualClientName).trim();
    const normalizedAssignees = normalizeAssigneeEntries(assignees);
    const nextErrors: JobFormFieldErrors = {};

    if (!finalClientName) {
      nextErrors.client = 'Pick a company, contact, or enter a client name';
    }
    if (!normalizedAssignees.some((entry) => entry.userId)) {
      nextErrors.assignees = 'Add at least one team member';
    }
    if (!normalizeMissionTypes(missionTypes).length) {
      nextErrors.missions = 'Select at least one mission type';
    }

    if (Object.keys(nextErrors).length > 0) {
      pendingScrollKeys.current = jobFormErrorScrollKeys(nextErrors);
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    const addressPayload = prepareClientAddressesPayload(siteAddresses);
    const normalizedContacts = normalizeJobContactEntries(jobContacts);
    const normalizedMissionTypes = normalizeMissionTypes(missionTypes);
    const missionSummary = formatMissionTypesDisplay(normalizedMissionTypes);
    const primaryContact = primaryJobContactFromEntries(normalizedContacts);
    const primary = primaryAssigneeFromEntries(normalizedAssignees);
    const normalizedWorkReports = normalizeWorkReportEntries(workReports);
    const workReportStorage = serializeWorkReportsToStorage(normalizedWorkReports);
    let resolvedClientType = clientType;
    let resolvedClientName = finalClientName;
    if (!companyId && primaryContact.personId) {
      resolvedClientType = 'person';
      if (!resolvedClientName) resolvedClientName = primaryContact.name;
    }

    setSaving(true);
    try {
      const scheduledDate = scheduledAt
        ? `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, '0')}-${String(scheduledAt.getDate()).padStart(2, '0')}`
        : todayIsoDate();
      const scheduledTime = scheduledAt
        ? `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`
        : '';

      const reminderAt =
        scheduledAt && reminderMinutes !== null
          ? new Date(scheduledAt.getTime() - reminderMinutes * 60 * 1000)
          : null;

      let notificationId: string | null = null;

      if (reminderAt && reminderAt.getTime() > Date.now()) {
        try {
          notificationId = await scheduleJobReminder({
            jobReference: reference,
            clientName: resolvedClientName,
            fireAt: reminderAt,
          });
        } catch {
          notificationId = null;
        }
      }

      const job = await addJobCard({
        reference,
        clientName: resolvedClientName,
        siteAddress: addressPayload.address,
        contactName: primaryContact.name,
        contactPhone: primaryContact.phone,
        jobContacts: normalizedContacts,
        missionType: missionSummary,
        missionTypes: normalizedMissionTypes,
        equipment: equipment.trim(),
        technicianName: primary.name,
        assigneeId: primary.userId || null,
        assigneeName: primary.name,
        assignees: normalizedAssignees,
        scheduledDate,
        scheduledTime,
        initialScheduledDate: scheduledDate,
        initialScheduledTime: scheduledTime || null,
        scheduleLog: [],
        reminderAt: reminderAt ? reminderAt.toISOString() : null,
        notificationId,
        calendarEventId: null,
        arrivalTime: arrivalAt
          ? `${String(arrivalAt.getHours()).padStart(2, '0')}:${String(arrivalAt.getMinutes()).padStart(2, '0')}`
          : '',
        departureTime: departureAt
          ? `${String(departureAt.getHours()).padStart(2, '0')}:${String(departureAt.getMinutes()).padStart(2, '0')}`
          : '',
        workReports: normalizedWorkReports,
        workPerformed: workReportStorage.workPerformed,
        partsUsed: workReportStorage.partsUsed,
        notes: notes.trim(),
        status,
        priority,
        clientType: resolvedClientType,
        personId: primaryContact.personId,
        companyId: companyId || null,
        parentJobId: parentJob?.id ?? null,
      });

      if (scheduledAt && addToCalendar && user) {
        try {
          await syncSingleJobToPhoneCalendar(job, user.$id, updateJobCard);
        } catch {
          // Job saved; calendar is optional.
        }
      }

      router.replace(`/job/${job.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save job card.';
      Alert.alert('Save', message);
    } finally {
      setSaving(false);
    }
  };

  const screenTitle = parentJob ? 'Follow-up job card' : 'New job card';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StackPageHeader title={screenTitle} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View ref={contentRef} collapsable={false}>
            <View style={styles.referenceBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.referenceLabel}>Reference</Text>
                <Text style={styles.referenceValue}>{reference}</Text>
              </View>
              {parentJob ? (
                <View style={styles.followUpBadge}>
                  <Ionicons name="link-outline" size={12} color={colors.black} />
                  <Text style={styles.followUpText}>Follow-up of {parentJob.reference}</Text>
                </View>
              ) : null}
            </View>

            <FormSection title="Client">
              <Text style={styles.fieldLabel}>Company</Text>
              <View ref={registerField('client')} collapsable={false}>
                <Pressable
                  onPress={() => setShowCompanyPicker(true)}
                  style={({ pressed }) => [
                    styles.selector,
                    errors.client ? styles.selectorError : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="business-outline" size={18} color={colors.black} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectorText, !selectedCompany && styles.placeholder]}>
                      {selectedCompany?.name ?? 'Pick a company or skip'}
                    </Text>
                    {selectedCompany?.industry ? (
                      <Text style={styles.selectorHint}>{selectedCompany.industry}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-down" size={16} color={colors.grey400} />
                </Pressable>
                {errors.client ? <Text style={styles.errorText}>{errors.client}</Text> : null}
              </View>

              {!hasLinkedClient ? (
                <FormField
                  label="Or enter client name"
                  value={manualClientName}
                  onChangeText={(text) => {
                    setManualClientName(text);
                    setClientName(text);
                    if (errors.clientName) setErrors((prev) => ({ ...prev, clientName: undefined }));
                  }}
                  error={errors.clientName}
                  anchorRef={registerField('clientName')}
                  required
                  placeholder="e.g. Acme Industries"
                />
              ) : (
                <View style={styles.clientSummary}>
                  <Text style={styles.clientSummaryLabel}>Client on job card</Text>
                  <Text style={styles.clientSummaryValue}>{displayClientName || '—'}</Text>
                </View>
              )}

              <ContactAddressesField values={siteAddresses} onChange={setSiteAddresses} />

              <JobContactsField
                values={jobContacts}
                onChange={setJobContacts}
                linkedPersons={linkedPersons}
                allPersons={persons}
                companyId={companyId || undefined}
              />
              <Pressable
                onPress={importContact}
                disabled={contactsLoading}
                style={({ pressed }) => [styles.inlineBtn, styles.inlineBtnFull, pressed && styles.pressed]}
              >
                <Ionicons
                  name={contactsLoading ? 'sync-outline' : 'people-outline'}
                  size={14}
                  color={colors.black}
                />
                <Text style={styles.inlineBtnText}>
                  {contactsLoading ? 'Loading…' : 'Import from contacts'}
                </Text>
              </Pressable>
            </FormSection>

            <FormSection title="Mission">
              <MissionTypesField
                values={missionTypes}
                onChange={(next) => {
                  setMissionTypes(next);
                  if (errors.missions) setErrors((prev) => ({ ...prev, missions: undefined }));
                }}
                error={errors.missions}
                anchorRef={registerField('missions')}
              />
              <FormField
                label="Equipment / system"
                value={equipment}
                onChangeText={setEquipment}
                placeholder="e.g. Compressor unit #4"
              />

              <JobAssigneesField
                values={assignees}
                onChange={(next) => {
                  setAssignees(next);
                  if (errors.assignees) setErrors((prev) => ({ ...prev, assignees: undefined }));
                }}
                personnel={personnel}
                personnelLoading={personnelLoading}
                onLoadPersonnel={() => loadPersonnel()}
                error={errors.assignees}
                anchorRef={registerField('assignees')}
              />

              <DateTimeField
                label="Scheduled date & time"
                value={scheduledAt}
                onChange={setScheduledAt}
                mode="datetime"
                icon="calendar-outline"
              />

              <Text style={styles.fieldLabel}>Reminder</Text>
              <View style={styles.chipRow}>
                {REMINDER_OPTIONS.map((opt) => {
                  const selected = reminderMinutes === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setReminderMinutes(opt.value)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setReminderMinutes(null)}
                  style={[styles.chip, reminderMinutes === null && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, reminderMinutes === null && styles.chipTextSelected]}>
                    None
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setAddToCalendar((v) => !v)}
                style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
              >
                <Ionicons
                  name={addToCalendar ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={addToCalendar ? colors.primary : colors.grey400}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Add to phone calendar</Text>
                  <Text style={styles.toggleHint}>
                    {phoneCalendarSyncActive
                      ? 'Schedule sync is active — leave off to avoid duplicates, or sync from Schedule.'
                      : 'Adds one event now. Schedule sync updates the same event later.'}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.row}>
                <View style={styles.half}>
                  <DateTimeField
                    label="Planned arrival"
                    value={arrivalAt}
                    onChange={setArrivalAt}
                    mode="time"
                    icon="time-outline"
                    placeholder="Pick time"
                  />
                </View>
                <View style={styles.half}>
                  <DateTimeField
                    label="Planned departure"
                    value={departureAt}
                    onChange={setDepartureAt}
                    mode="time"
                    icon="time-outline"
                    placeholder="Pick time"
                  />
                </View>
              </View>
            </FormSection>

            <FormSection title="Work report">
              <JobWorkReportsField values={workReports} onChange={setWorkReports} />
              <FormField
                label="Additional notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Follow-up required, observations..."
                multiline
              />
            </FormSection>

            <FormSection title="Status & priority">
              <Text style={styles.fieldLabel}>Status</Text>
              <StatusPicker value={status} onChange={setStatus} />
              <Text style={[styles.fieldLabel, styles.priorityLabel]}>Priority</Text>
              <View style={styles.chipRow}>
                {PRIORITIES.map((level) => {
                  const selected = priority === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => setPriority(level)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {JOB_PRIORITY_LABELS[level]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </FormSection>

            <PrimaryButton
              label={saving ? 'Saving…' : 'Save Job Card'}
              icon="save-outline"
              onPress={handleSave}
              disabled={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={showCompanyPicker}
        title="Pick company"
        options={companyOptions}
        searchPlaceholder="Search companies"
        emptyLabel="No companies yet."
        onClose={() => setShowCompanyPicker(false)}
        onSelect={(opt) => {
          if (!opt.id) {
            applyCompany(undefined);
          } else {
            const company = findCompany(opt.id);
            if (company) applyCompany(company);
          }
        }}
      />

      <PickerSheet
        visible={showContactsPicker}
        title="Import contact"
        options={contactsOptions}
        emptyLabel="No contacts available."
        searchPlaceholder="Search contacts"
        onClose={() => setShowContactsPicker(false)}
        onSelect={onPickContact}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  referenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  referenceLabel: {
    ...typography.label,
    color: colors.grey600,
    marginBottom: spacing.xs,
  },
  referenceValue: {
    ...typography.subheading,
    color: colors.black,
  },
  followUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  followUpText: { ...typography.caption, color: colors.black, fontSize: 11, fontWeight: '600' },
  fieldLabel: {
    ...typography.label,
    color: colors.grey600,
    marginBottom: spacing.sm,
  },
  subLabel: {
    ...typography.caption,
    color: colors.grey600,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  requiredMark: {
    color: colors.error,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  selectorError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  selectorText: { ...typography.body, color: colors.black, fontSize: 15, textAlign: 'left' },
  selectorHint: { ...typography.caption, color: colors.grey600, fontSize: 12, marginTop: 2 },
  placeholder: { color: colors.grey400 },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  clientSummary: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
    marginBottom: spacing.md,
  },
  clientSummaryLabel: { ...typography.caption, color: colors.grey600, marginBottom: 4 },
  clientSummaryValue: { ...typography.subheading, color: colors.black, fontSize: 15 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.grey600,
  },
  chipTextSelected: {
    color: colors.black,
    fontWeight: '700',
  },
  priorityLabel: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    marginBottom: spacing.md,
  },
  toggleLabel: { ...typography.subheading, color: colors.black, fontSize: 14 },
  toggleHint: { ...typography.caption, color: colors.grey600 },
  inlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  inlineBtnFull: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  inlineBtnText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
