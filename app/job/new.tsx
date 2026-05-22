import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ClientsSidebar } from '../../components/ClientsSidebar';
import { DateTimeField } from '../../components/DateTimeField';
import { FormField, FormSection } from '../../components/FormField';
import { PickerSheet, type PickerOption } from '../../components/PickerSheet';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StatusPicker } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { listPersonnel, type Personnel } from '../../lib/appwrite/adminUsers';
import { createCalendarEvent } from '../../lib/calendar';
import { promptMapsForAddress } from '../../lib/maps';
import { scheduleJobReminder } from '../../lib/notifications';
import {
  JOB_PRIORITY_LABELS,
  MISSION_TYPES,
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

export default function NewJobCardScreen() {
  const { addJobCard, getJobCard } = useJobCards();
  const { user } = useAuth();
  const { findPerson, findCompany } = useClients();

  const params = useLocalSearchParams<{
    personId?: string;
    companyId?: string;
    parentJobId?: string;
    clientName?: string;
  }>();

  const parentJob = params.parentJobId ? getJobCard(params.parentJobId) : undefined;

  const [reference] = useState(generateReference);
  const [saving, setSaving] = useState(false);
  const [showClients, setShowClients] = useState(false);

  // Client selection
  const initialPerson = params.personId ? findPerson(params.personId) : undefined;
  const initialCompany = params.companyId ? findCompany(params.companyId) : undefined;
  const initialType: ClientType | null = initialPerson
    ? 'person'
    : initialCompany
      ? 'company'
      : parentJob?.clientType ?? null;
  const initialPersonId = initialPerson?.id ?? parentJob?.personId ?? null;
  const initialCompanyId = initialCompany?.id ?? parentJob?.companyId ?? null;
  const initialClientName =
    initialPerson?.fullName ??
    initialCompany?.name ??
    params.clientName ??
    parentJob?.clientName ??
    '';

  const [clientType, setClientType] = useState<ClientType | null>(initialType);
  const [personId, setPersonId] = useState<string | null>(initialPersonId);
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId);
  const [clientName, setClientName] = useState(initialClientName);

  const [siteAddress, setSiteAddress] = useState(
    initialPerson?.address ?? initialCompany?.address ?? parentJob?.siteAddress ?? '',
  );
  const [contactName, setContactName] = useState(
    initialPerson?.fullName ?? parentJob?.contactName ?? '',
  );
  const [contactPhone, setContactPhone] = useState(
    initialPerson?.phone ?? initialCompany?.phone ?? parentJob?.contactPhone ?? '',
  );
  const [missionType, setMissionType] = useState<string>(parentJob?.missionType ?? MISSION_TYPES[0]);
  const [equipment, setEquipment] = useState(parentJob?.equipment ?? '');

  const [assigneeId, setAssigneeId] = useState<string | null>(
    parentJob?.assigneeId ?? user?.$id ?? null,
  );
  const [assigneeName, setAssigneeName] = useState<string>(
    parentJob?.assigneeName ?? user?.name ?? '',
  );
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  const [scheduledAt, setScheduledAt] = useState<Date | null>(new Date());
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(60);
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [arrivalAt, setArrivalAt] = useState<Date | null>(null);
  const [departureAt, setDepartureAt] = useState<Date | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [workPerformed, setWorkPerformed] = useState('');
  const [partsUsed, setPartsUsed] = useState(parentJob?.partsUsed ?? '');
  const [notes, setNotes] = useState(parentJob ? `Follow-up of ${parentJob.reference}.\n${parentJob.notes ?? ''}`.trim() : '');
  const [status, setStatus] = useState<JobStatus>('draft');
  const [priority, setPriority] = useState<JobPriority>(parentJob?.priority ?? 'normal');

  const selectedClientLabel = useMemo(() => {
    if (clientType === 'person' && personId) {
      const p = findPerson(personId);
      return p ? p.fullName : clientName;
    }
    if (clientType === 'company' && companyId) {
      const c = findCompany(companyId);
      return c ? c.name : clientName;
    }
    return clientName;
  }, [clientType, personId, companyId, clientName, findPerson, findCompany]);

  const openAssigneePicker = useCallback(async () => {
    setShowAssigneePicker(true);
    if (personnel.length === 0 && !personnelLoading) {
      setPersonnelLoading(true);
      try {
        const list = await listPersonnel();
        setPersonnel(list);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load personnel.';
        Alert.alert('Technicians', message);
      } finally {
        setPersonnelLoading(false);
      }
    }
  }, [personnel.length, personnelLoading]);

  useEffect(() => {
    // Warm the list in the background so first tap is instant
    if (personnel.length === 0 && !personnelLoading) {
      setPersonnelLoading(true);
      listPersonnel()
        .then(setPersonnel)
        .catch(() => undefined)
        .finally(() => setPersonnelLoading(false));
    }
  }, [personnel.length, personnelLoading]);

  const useCurrentLocation = async () => {
    setResolvingAddress(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Location', 'Allow location access to auto-fill the site address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (place) {
        const parts = [
          place.streetNumber,
          place.street,
          place.district,
          place.city,
          place.region,
          place.postalCode,
          place.country,
        ].filter(Boolean);
        setSiteAddress(parts.join(', '));
      } else {
        setSiteAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch location.';
      Alert.alert('Location', message);
    } finally {
      setResolvingAddress(false);
    }
  };

  const openInMaps = () => {
    promptMapsForAddress(siteAddress);
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
    if (found.name) setContactName(found.name);
    if (phone) setContactPhone(phone);
    const addr = found.addresses?.[0];
    if (addr && !siteAddress) {
      const parts = [addr.street, addr.city, addr.region, addr.postalCode, addr.country].filter(
        Boolean,
      );
      if (parts.length) setSiteAddress(parts.join(', '));
    }
  };

  const handlePick = (
    selection:
      | { type: 'person'; person: ReturnType<typeof findPerson> }
      | { type: 'company'; company: ReturnType<typeof findCompany> },
  ) => {
    if (selection.type === 'person' && selection.person) {
      setClientType('person');
      setPersonId(selection.person.id);
      setCompanyId(null);
      setClientName(selection.person.fullName);
      if (!siteAddress) setSiteAddress(selection.person.address);
      if (!contactName) setContactName(selection.person.fullName);
      if (!contactPhone) setContactPhone(selection.person.phone);
    } else if (selection.type === 'company' && selection.company) {
      setClientType('company');
      setCompanyId(selection.company.id);
      setPersonId(null);
      setClientName(selection.company.name);
      if (!siteAddress) setSiteAddress(selection.company.address);
      if (!contactPhone) setContactPhone(selection.company.phone);
    }
  };

  const handleSave = async () => {
    if (!clientName.trim() || !assigneeName.trim()) {
      Alert.alert('Required fields', 'Pick a client and assign a technician.');
      return;
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

      // Schedule local notification + calendar event before saving so we can persist their IDs
      let notificationId: string | null = null;
      let calendarEventId: string | null = null;

      if (reminderAt && reminderAt.getTime() > Date.now()) {
        try {
          notificationId = await scheduleJobReminder({
            jobReference: reference,
            clientName: clientName.trim(),
            fireAt: reminderAt,
          });
        } catch {
          notificationId = null;
        }
      }

      if (scheduledAt && addToCalendar) {
        try {
          calendarEventId = await createCalendarEvent({
            title: `[${reference}] ${clientName.trim()}`,
            notes: `${missionType}${equipment.trim() ? ` · ${equipment.trim()}` : ''}${notes.trim() ? `\n\n${notes.trim()}` : ''}`,
            location: siteAddress.trim() || undefined,
            startDate: scheduledAt,
            alarmMinutesBefore: reminderMinutes ?? undefined,
          });
        } catch {
          calendarEventId = null;
        }
      }

      const job = await addJobCard({
        reference,
        clientName: clientName.trim(),
        siteAddress: siteAddress.trim(),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        missionType,
        equipment: equipment.trim(),
        technicianName: assigneeName.trim(),
        assigneeId,
        assigneeName: assigneeName.trim(),
        scheduledDate,
        scheduledTime,
        reminderAt: reminderAt ? reminderAt.toISOString() : null,
        notificationId,
        calendarEventId,
        arrivalTime: arrivalAt
          ? `${String(arrivalAt.getHours()).padStart(2, '0')}:${String(arrivalAt.getMinutes()).padStart(2, '0')}`
          : '',
        departureTime: departureAt
          ? `${String(departureAt.getHours()).padStart(2, '0')}:${String(departureAt.getMinutes()).padStart(2, '0')}`
          : '',
        workPerformed: workPerformed.trim(),
        partsUsed: partsUsed.trim(),
        notes: notes.trim(),
        status,
        priority,
        clientType,
        personId,
        companyId,
        parentJobId: parentJob?.id ?? null,
      });
      router.replace(`/job/${job.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save job card.';
      Alert.alert('Save', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <Pressable
            onPress={() => setShowClients(true)}
            style={({ pressed }) => [styles.clientCard, pressed && styles.pressed]}
          >
            <View style={styles.clientIcon}>
              <Ionicons
                name={
                  clientType === 'person'
                    ? 'person-outline'
                    : clientType === 'company'
                      ? 'business-outline'
                      : 'search-outline'
                }
                size={20}
                color={colors.black}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientLabel}>
                {clientType === 'person' ? 'Person' : clientType === 'company' ? 'Company' : 'Tap to pick a client'}
              </Text>
              <Text style={styles.clientName}>
                {selectedClientLabel || 'No client selected'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.grey400} />
          </Pressable>

          {!clientType ? (
            <FormField
              label="Or enter client name"
              value={clientName}
              onChangeText={setClientName}
              placeholder="e.g. Acme Industries"
            />
          ) : null}

          <FormField
            label="Site address"
            value={siteAddress}
            onChangeText={setSiteAddress}
            placeholder="Street, city, postcode"
          />
          <View style={styles.inlineActions}>
            <Pressable
              onPress={useCurrentLocation}
              disabled={resolvingAddress}
              style={({ pressed }) => [styles.inlineBtn, pressed && styles.pressed]}
            >
              <Ionicons
                name={resolvingAddress ? 'sync-outline' : 'locate-outline'}
                size={14}
                color={colors.black}
              />
              <Text style={styles.inlineBtnText}>
                {resolvingAddress ? 'Locating…' : 'Use my location'}
              </Text>
            </Pressable>
            <Pressable
              onPress={openInMaps}
              style={({ pressed }) => [styles.inlineBtn, pressed && styles.pressed]}
            >
              <Ionicons name="map-outline" size={14} color={colors.black} />
              <Text style={styles.inlineBtnText}>Open in Maps</Text>
            </Pressable>
          </View>

          <FormField
            label="Site contact"
            value={contactName}
            onChangeText={setContactName}
            placeholder="Contact person on site"
          />
          <FormField
            label="Contact phone"
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+961 ..."
            keyboardType="phone-pad"
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
          <Text style={styles.fieldLabel}>Mission type</Text>
          <View style={styles.chipRow}>
            {MISSION_TYPES.map((type) => {
              const selected = missionType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setMissionType(type)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type}</Text>
                </Pressable>
              );
            })}
          </View>
          <FormField
            label="Equipment / system"
            value={equipment}
            onChangeText={setEquipment}
            placeholder="e.g. Compressor unit #4"
          />
          <Text style={styles.fieldLabel}>
            Technician <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <Pressable
            onPress={openAssigneePicker}
            style={({ pressed }) => [styles.clientCard, pressed && styles.pressed]}
          >
            <View style={styles.clientIcon}>
              <Ionicons name="construct-outline" size={18} color={colors.black} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientLabel}>Assignee</Text>
              <Text style={styles.clientName}>
                {assigneeName || 'Tap to pick a technician'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.grey400} />
          </Pressable>
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
              <Text style={styles.toggleHint}>Sync this mission to your native calendar.</Text>
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
          <FormField
            label="Work performed"
            value={workPerformed}
            onChangeText={setWorkPerformed}
            placeholder="Describe diagnostics, repairs, and actions taken..."
            multiline
          />
          <FormField
            label="Parts used"
            value={partsUsed}
            onChangeText={setPartsUsed}
            placeholder="List parts and quantities"
            multiline
          />
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
      </ScrollView>

      <ClientsSidebar
        visible={showClients}
        onClose={() => setShowClients(false)}
        pickerMode
        onPick={handlePick}
      />

      <PickerSheet
        visible={showAssigneePicker}
        title="Pick technician"
        loading={personnelLoading}
        options={personnel.map((p) => {
          const hintParts = [p.position, p.labels.includes('admin') ? 'Admin' : null].filter(Boolean);
          return {
            id: p.id,
            label: p.name || p.email,
            hint: hintParts.length ? hintParts.join(' · ') : p.email,
            icon: 'person-circle-outline',
          };
        })}
        emptyLabel="No personnel found. Create accounts in Admin."
        searchPlaceholder="Search by name or email"
        onClose={() => setShowAssigneePicker(false)}
        onSelect={(opt) => {
          setAssigneeId(opt.id);
          setAssigneeName(opt.label);
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
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
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    marginBottom: spacing.md,
  },
  clientIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientLabel: { ...typography.caption, color: colors.grey600 },
  clientName: { ...typography.subheading, color: colors.black, fontSize: 15 },
  fieldLabel: {
    ...typography.label,
    color: colors.grey600,
    marginBottom: spacing.sm,
  },
  priorityLabel: {
    marginTop: spacing.md,
  },
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
  inlineActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
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
