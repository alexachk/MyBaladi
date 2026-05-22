import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { FormField, FormSection } from '../../components/FormField';
import { ContactAddressesField } from '../../components/ContactAddressesField';
import { ContactEmailsField } from '../../components/ContactEmailsField';
import { ContactPhonesField } from '../../components/ContactPhonesField';
import { ContactWebsitesField } from '../../components/ContactWebsitesField';
import { IndustryPickerField } from '../../components/IndustryPickerField';
import { PickerSheet } from '../../components/PickerSheet';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StackPageHeader } from '../../components/StackPageHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { useClients } from '../../context/ClientsContext';
import { promptEmailActions, openWebsite, promptPhoneActions } from '../../lib/contactActions';
import {
  addressEntriesForForm,
  formatAddressLine,
  hasMapPin,
  prepareClientAddressesPayload,
  type AddressEntry,
} from '../../lib/clientAddresses';
import {
  clientPrimaryEmail,
  clientPrimaryPhone,
  emailEntriesForForm,
  formatPhoneDisplay,
  formatPhoneE164,
  phoneEntriesForForm,
  prepareClientContactPayload,
  emailEntryErrors,
  type EmailEntry,
  type PhoneEntry,
} from '../../lib/clientContact';
import { promptMapsForAddressEntry } from '../../lib/maps';
import { clientFormErrorScrollKeys, useFormScrollToError } from '../../lib/formScroll';
import {
  prepareClientWebsitesPayload,
  websiteEntriesForForm,
  type WebsiteEntry,
} from '../../lib/clientWebsites';

type ClientEditErrors = {
  firstName?: string;
  name?: string;
  emails?: Record<string, string>;
};

export default function ClientDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const { isAdmin } = useAuth();
  const { jobCards } = useJobCards();
  const { findPerson, findCompany, companies, editPerson, editCompany, removePerson, removeCompany } =
    useClients();

  const isPerson = type === 'person';
  const person = isPerson ? findPerson(id) : undefined;
  const company = !isPerson ? findCompany(id) : undefined;

  const linkedJobs = useMemo(
    () =>
      jobCards.filter((j) =>
        isPerson ? j.personId === id : j.companyId === id,
      ),
    [jobCards, isPerson, id],
  );

  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ClientEditErrors>({});
  const pendingScrollKeys = useRef<string[]>([]);
  const { scrollRef, contentRef, registerField, scrollToFirstError } = useFormScrollToError();

  useEffect(() => {
    if (pendingScrollKeys.current.length === 0) return;
    const keys = pendingScrollKeys.current;
    pendingScrollKeys.current = [];
    scrollToFirstError(keys);
  }, [errors, scrollToFirstError]);

  // Editable fields
  const [firstName, setFirstName] = useState(person?.firstName ?? '');
  const [lastName, setLastName] = useState(person?.lastName ?? '');
  const [name, setName] = useState(company?.name ?? '');
  const [legalName, setLegalName] = useState(company?.legalName ?? '');
  const [phones, setPhones] = useState<PhoneEntry[]>(phoneEntriesForForm(person?.contactPhones, person?.phone));
  const [emails, setEmails] = useState<EmailEntry[]>(emailEntriesForForm(person?.contactEmails, person?.email));
  const [addresses, setAddresses] = useState<AddressEntry[]>(
    addressEntriesForForm(person?.contactAddresses ?? company?.contactAddresses, person?.address ?? company?.address),
  );
  const [notes, setNotes] = useState((person?.notes ?? company?.notes) ?? '');
  const [companyId, setCompanyId] = useState(person?.companyId ?? '');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [industry, setIndustry] = useState(company?.industry ?? '');
  const [websites, setWebsites] = useState<WebsiteEntry[]>(
    websiteEntriesForForm(company?.contactWebsites, company?.website),
  );

  const entity = person ?? company;

  useEffect(() => {
    if (!entity) return;
    if (isPerson && person) {
      setFirstName(person.firstName);
      setLastName(person.lastName);
      setCompanyId(person.companyId);
      setPhones(phoneEntriesForForm(person.contactPhones, person.phone));
      setEmails(emailEntriesForForm(person.contactEmails, person.email));
      setAddresses(addressEntriesForForm(person.contactAddresses, person.address));
    } else if (company) {
      setName(company.name);
      setLegalName(company.legalName);
      setIndustry(company.industry);
      setWebsites(websiteEntriesForForm(company.contactWebsites, company.website));
      setPhones(phoneEntriesForForm(company.contactPhones, company.phone));
      setEmails(emailEntriesForForm(company.contactEmails, company.email));
      setAddresses(addressEntriesForForm(company.contactAddresses, company.address));
    }
    setNotes(entity.notes);
  }, [entity, isPerson, person, company]);

  const primaryPhone = entity ? clientPrimaryPhone(entity) : '';
  const primaryEmail = entity ? clientPrimaryEmail(entity) : '';

  const linkedCompany = useMemo(
    () => (person?.companyId ? findCompany(person.companyId) : undefined),
    [person?.companyId, findCompany],
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

  if (!person && !company) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Client not found</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const title = isPerson ? person?.fullName ?? '' : company?.name ?? '';
  const subtitle = isPerson
    ? primaryEmail || primaryPhone || '—'
    : company?.industry || primaryEmail || '—';

  const handleSave = async () => {
    const nextErrors: ClientEditErrors = {};
    if (isPerson && !firstName.trim()) {
      nextErrors.firstName = 'First name is required';
    }
    if (!isPerson && !name.trim()) {
      nextErrors.name = 'Company name is required';
    }
    const emailErrs = emailEntryErrors(emails);
    if (Object.keys(emailErrs).length > 0) {
      nextErrors.emails = emailErrs;
    }
    if (nextErrors.firstName || nextErrors.name || nextErrors.emails) {
      pendingScrollKeys.current = clientFormErrorScrollKeys(nextErrors, emails);
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const contact = prepareClientContactPayload(phones, emails);
      const addressPayload = prepareClientAddressesPayload(addresses);
      const websitePayload = prepareClientWebsitesPayload(websites);
      if (isPerson && person) {
        await editPerson(person.id, {
          firstName,
          lastName,
          phone: contact.phone,
          email: contact.email,
          contactPhones: contact.contactPhones,
          contactEmails: contact.contactEmails,
          address: addressPayload.address,
          contactAddresses: addressPayload.contactAddresses,
          notes,
          companyId,
          createdBy: person.createdBy,
        });
      } else if (company) {
        await editCompany(company.id, {
          name,
          legalName,
          phone: contact.phone,
          email: contact.email,
          contactPhones: contact.contactPhones,
          contactEmails: contact.contactEmails,
          address: addressPayload.address,
          contactAddresses: addressPayload.contactAddresses,
          notes,
          industry,
          website: websitePayload.website,
          contactWebsites: websitePayload.contactWebsites,
          primaryContactId: company.primaryContactId,
          createdBy: company.createdBy,
        });
      }
      setEdit(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed.';
      Alert.alert('Update', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete client', 'This client will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isPerson && person) await removePerson(person.id);
            if (!isPerson && company) await removeCompany(company.id);
            router.back();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Delete failed.';
            Alert.alert('Delete', message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StackPageHeader title={title} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View ref={contentRef} collapsable={false}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Ionicons name={isPerson ? 'person-outline' : 'business-outline'} size={28} color={colors.black} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {!edit ? (
              <Pressable onPress={() => { setErrors({}); setEdit(true); }} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
                <Ionicons name="pencil-outline" size={18} color={colors.black} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            {primaryPhone ? (
              <Pressable
                onPress={() => promptPhoneActions(primaryPhone)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Ionicons name="call-outline" size={16} color={colors.black} />
                <Text style={styles.actionText}>Call</Text>
              </Pressable>
            ) : null}
            {primaryEmail ? (
              <Pressable
                onPress={() => promptEmailActions(primaryEmail)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Ionicons name="mail-outline" size={16} color={colors.black} />
                <Text style={styles.actionText}>Email</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/job/new',
                  params: isPerson
                    ? { personId: id, clientName: title }
                    : { companyId: id, clientName: title },
                })
              }
              style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={16} color={colors.black} />
              <Text style={styles.actionText}>New job</Text>
            </Pressable>
            {!isPerson ? (
              <Pressable
                onPress={() => router.push({ pathname: '/clients/new-person', params: { companyId: id } })}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Ionicons name="person-add-outline" size={16} color={colors.black} />
                <Text style={styles.actionText}>Add person</Text>
              </Pressable>
            ) : null}
          </View>

          {edit ? (
            <View style={styles.formCard}>
              {isPerson ? (
                <>
                  <FormField
                    label="First name"
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                    }}
                    error={errors.firstName}
                    anchorRef={registerField('firstName')}
                    required
                  />
                  <FormField label="Last name" value={lastName} onChangeText={setLastName} />
                  <Text style={styles.fieldLabel}>Company</Text>
                  <Pressable
                    onPress={() => setShowCompanyPicker(true)}
                    style={({ pressed }) => [styles.companySelector, pressed && styles.pressed]}
                  >
                    <Ionicons name="business-outline" size={18} color={colors.black} />
                    <Text style={styles.companySelectorText}>
                      {companies.find((c) => c.id === companyId)?.name ?? 'No company'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.grey400} />
                  </Pressable>
                </>
              ) : (
                <>
                  <FormField
                    label="Company name"
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    error={errors.name}
                    anchorRef={registerField('name')}
                    required
                  />
                  <FormField label="Legal name" value={legalName} onChangeText={setLegalName} />
                  <IndustryPickerField value={industry} onChange={setIndustry} />
                  <ContactWebsitesField values={websites} onChange={setWebsites} />
                </>
              )}
              <FormSection title="Contact">
                <ContactPhonesField values={phones} onChange={setPhones} />
                <ContactEmailsField
                  values={emails}
                  onChange={(next) => {
                    setEmails(next);
                    if (errors.emails) setErrors((prev) => ({ ...prev, emails: undefined }));
                  }}
                  errors={errors.emails}
                  registerField={registerField}
                />
                <ContactAddressesField values={addresses} onChange={setAddresses} />
              </FormSection>
              <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />

              <View style={styles.formActions}>
                <PrimaryButton label="Cancel" variant="secondary" onPress={() => { setErrors({}); setEdit(false); }} />
                <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              {entity?.contactPhones.length ? (
                entity.contactPhones.map((entry, index) => {
                  const value = formatPhoneDisplay(entry);
                  const e164 = formatPhoneE164(entry);
                  return (
                    <ContactInfoRow
                      key={`phone-${index}`}
                      icon="call-outline"
                      label={entry.label}
                      value={value}
                      onPress={() => promptPhoneActions(e164)}
                    />
                  );
                })
              ) : (
                <InfoRow icon="call-outline" label="Phone" value="—" />
              )}
              {entity?.contactEmails.length ? (
                entity.contactEmails.map((entry, index) => (
                  <ContactInfoRow
                    key={`email-${index}`}
                    icon="mail-outline"
                    label={entry.label}
                    value={entry.address}
                    onPress={() => promptEmailActions(entry.address)}
                  />
                ))
              ) : (
                <InfoRow icon="mail-outline" label="Email" value="—" />
              )}
              {entity?.contactAddresses.length ? (
                entity.contactAddresses.map((entry, index) => (
                  <ContactInfoRow
                    key={`address-${index}`}
                    icon="location-outline"
                    label={entry.reference?.trim() || entry.label}
                    value={formatAddressLine(entry)}
                    hint={hasMapPin(entry) ? 'Map pin saved' : undefined}
                    onPress={() => promptMapsForAddressEntry(entry)}
                  />
                ))
              ) : (
                <InfoRow icon="location-outline" label="Address" value="—" />
              )}
              {isPerson ? (
                linkedCompany ? (
                  <Pressable
                    onPress={() => router.push(`/clients/${linkedCompany.id}?type=company`)}
                    style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
                  >
                    <View style={styles.infoIcon}>
                      <Ionicons name="business-outline" size={16} color={colors.black} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>Company</Text>
                      <Text style={[styles.infoValue, styles.linkValue]}>{linkedCompany.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
                  </Pressable>
                ) : (
                  <InfoRow icon="business-outline" label="Company" value="—" />
                )
              ) : null}
              {!isPerson ? <InfoRow icon="briefcase-outline" label="Industry" value={industry || '—'} /> : null}
              {!isPerson && company?.contactWebsites.length ? (
                company.contactWebsites.map((entry, index) => (
                  <ContactInfoRow
                    key={`website-${index}`}
                    icon="globe-outline"
                    label={entry.label}
                    value={entry.url}
                    onPress={() => openWebsite(entry.url)}
                  />
                ))
              ) : !isPerson ? (
                <InfoRow icon="globe-outline" label="Website" value="—" />
              ) : null}
              {notes ? <InfoRow icon="document-text-outline" label="Notes" value={notes} /> : null}
            </View>
          )}

          <Text style={styles.sectionLabel}>
            Job cards{' '}
            <Text style={styles.countDim}>({linkedJobs.length})</Text>
          </Text>
          {linkedJobs.length === 0 ? (
            <Text style={styles.dim}>No job cards linked to this client yet.</Text>
          ) : (
            <View style={styles.jobsList}>
              {linkedJobs.map((j) => (
                <Pressable
                  key={j.id}
                  onPress={() => router.push(`/job/${j.id}`)}
                  style={({ pressed }) => [styles.jobRow, pressed && styles.pressed]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobRef}>{j.reference}</Text>
                    <Text style={styles.jobMission}>{j.missionType || '—'} · {j.status}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
                </Pressable>
              ))}
            </View>
          )}

          {isAdmin ? (
            <Pressable onPress={handleDelete} style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteText}>Delete client</Text>
            </Pressable>
          ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {isPerson ? (
        <PickerSheet
          visible={showCompanyPicker}
          title="Link to company"
          options={companyOptions}
          searchPlaceholder="Search companies"
          emptyLabel="No companies yet."
          onClose={() => setShowCompanyPicker(false)}
          onSelect={(opt) => setCompanyId(opt.id)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ContactInfoRow({
  icon,
  label,
  value,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={colors.black} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, styles.linkValue]}>{value}</Text>
        {hint ? <Text style={styles.infoHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
    </Pressable>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={colors.black} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyTitle: { ...typography.subheading, color: colors.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.title, color: colors.black, fontSize: 18 },
  subtitle: { ...typography.caption, color: colors.grey600 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.xs },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { ...typography.caption, color: colors.grey600 },
  infoHint: { ...typography.caption, color: colors.info, marginTop: 2 },
  infoValue: { ...typography.body, color: colors.black, textAlign: 'left' },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.grey600, marginTop: spacing.md, marginBottom: spacing.sm },
  countDim: { color: colors.grey400, fontWeight: '400' },
  dim: { ...typography.caption, color: colors.grey400 },
  jobsList: { gap: spacing.sm },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  jobRef: { ...typography.subheading, color: colors.black, fontSize: 14 },
  jobMission: { ...typography.caption, color: colors.grey600 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  deleteText: { ...typography.subheading, color: colors.error, fontSize: 14, fontWeight: '600' },
  linkValue: { color: colors.info, fontWeight: '600' },
  fieldLabel: { ...typography.label, color: colors.grey600, marginBottom: spacing.sm },
  companySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  companySelectorText: { flex: 1, ...typography.body, color: colors.black, fontSize: 15, textAlign: 'left' },
  pressed: { opacity: 0.85 },
});
