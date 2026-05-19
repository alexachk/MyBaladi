import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '../../components/FormField';
import { PickerSheet } from '../../components/PickerSheet';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { useClients } from '../../context/ClientsContext';

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

  // Editable fields
  const [firstName, setFirstName] = useState(person?.firstName ?? '');
  const [lastName, setLastName] = useState(person?.lastName ?? '');
  const [name, setName] = useState(company?.name ?? '');
  const [legalName, setLegalName] = useState(company?.legalName ?? '');
  const [phone, setPhone] = useState((person?.phone ?? company?.phone) ?? '');
  const [email, setEmail] = useState((person?.email ?? company?.email) ?? '');
  const [address, setAddress] = useState((person?.address ?? company?.address) ?? '');
  const [notes, setNotes] = useState((person?.notes ?? company?.notes) ?? '');
  const [companyId, setCompanyId] = useState(person?.companyId ?? '');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [industry, setIndustry] = useState(company?.industry ?? '');
  const [website, setWebsite] = useState(company?.website ?? '');

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
    ? person?.email || person?.phone || '—'
    : company?.industry || company?.email || '—';

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isPerson && person) {
        await editPerson(person.id, { firstName, lastName, phone, email, address, notes, companyId });
      } else if (company) {
        await editCompany(company.id, { name, legalName, phone, email, address, notes, industry, website });
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Ionicons name={isPerson ? 'person-outline' : 'business-outline'} size={28} color={colors.black} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {!edit ? (
              <Pressable onPress={() => setEdit(true)} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
                <Ionicons name="pencil-outline" size={18} color={colors.black} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            {phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${phone}`)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Ionicons name="call-outline" size={16} color={colors.black} />
                <Text style={styles.actionText}>Call</Text>
              </Pressable>
            ) : null}
            {email ? (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${email}`)}
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
                  <FormField label="First name" value={firstName} onChangeText={setFirstName} required />
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
                  <FormField label="Company name" value={name} onChangeText={setName} required />
                  <FormField label="Legal name" value={legalName} onChangeText={setLegalName} />
                  <FormField label="Industry" value={industry} onChangeText={setIndustry} />
                  <FormField label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" />
                </>
              )}
              <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <FormField label="Address" value={address} onChangeText={setAddress} multiline />
              <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />

              <View style={styles.formActions}>
                <PrimaryButton label="Cancel" variant="secondary" onPress={() => setEdit(false)} />
                <PrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              <InfoRow icon="call-outline" label="Phone" value={phone || '—'} />
              <InfoRow icon="mail-outline" label="Email" value={email || '—'} />
              <InfoRow icon="location-outline" label="Address" value={address || '—'} />
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
              {!isPerson ? <InfoRow icon="globe-outline" label="Website" value={website || '—'} /> : null}
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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyTitle: { ...typography.subheading, color: colors.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
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
  actionRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
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
    padding: spacing.md,
    gap: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { ...typography.caption, color: colors.grey600 },
  infoValue: { ...typography.body, color: colors.black, textAlign: 'left' },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.md,
    gap: spacing.sm,
  },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.grey600, marginTop: spacing.sm },
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
