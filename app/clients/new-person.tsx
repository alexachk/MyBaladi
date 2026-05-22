import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useEffect, useRef, useState } from 'react';
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
import { ContactEmailsField } from '../../components/ContactEmailsField';
import { ContactPhonesField } from '../../components/ContactPhonesField';
import { FormField, FormSection } from '../../components/FormField';
import { PickerSheet } from '../../components/PickerSheet';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StackPageHeader } from '../../components/StackPageHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';
import {
  defaultAddressEntry,
  prepareClientAddressesPayload,
  type AddressEntry,
} from '../../lib/clientAddresses';
import {
  defaultEmailEntry,
  defaultPhoneEntry,
  emailEntryErrors,
  prepareClientContactPayload,
  type EmailEntry,
  type PhoneEntry,
} from '../../lib/clientContact';
import { clientFormErrorScrollKeys, useFormScrollToError } from '../../lib/formScroll';

type PersonFormErrors = {
  firstName?: string;
  emails?: Record<string, string>;
};

export default function NewPersonScreen() {
  const { companyId: presetCompanyId } = useLocalSearchParams<{ companyId?: string }>();
  const { addPerson, companies } = useClients();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phones, setPhones] = useState<PhoneEntry[]>([defaultPhoneEntry()]);
  const [emails, setEmails] = useState<EmailEntry[]>([defaultEmailEntry()]);
  const [addresses, setAddresses] = useState<AddressEntry[]>([defaultAddressEntry()]);
  const [notes, setNotes] = useState('');
  const [companyId, setCompanyId] = useState(presetCompanyId ?? '');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<PersonFormErrors>({});
  const pendingScrollKeys = useRef<string[]>([]);
  const { scrollRef, contentRef, registerField, scrollToFirstError } = useFormScrollToError();

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId],
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

  useEffect(() => {
    if (pendingScrollKeys.current.length === 0) return;
    const keys = pendingScrollKeys.current;
    pendingScrollKeys.current = [];
    scrollToFirstError(keys);
  }, [errors, scrollToFirstError]);

  const handleSave = async () => {
    const nextErrors: PersonFormErrors = {};
    if (!firstName.trim()) {
      nextErrors.firstName = 'First name is required';
    }
    const emailErrs = emailEntryErrors(emails);
    if (Object.keys(emailErrs).length > 0) {
      nextErrors.emails = emailErrs;
    }
    if (nextErrors.firstName || nextErrors.emails) {
      pendingScrollKeys.current = clientFormErrorScrollKeys(nextErrors, emails);
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const contact = prepareClientContactPayload(phones, emails);
      const addressPayload = prepareClientAddressesPayload(addresses);
      const created = await addPerson({
        firstName,
        lastName,
        email: contact.email,
        phone: contact.phone,
        contactPhones: contact.contactPhones,
        contactEmails: contact.contactEmails,
        address: addressPayload.address,
        contactAddresses: addressPayload.contactAddresses,
        notes,
        companyId,
      });
      router.replace(`/clients/${created.id}?type=person`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create person.';
      Alert.alert('New person', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StackPageHeader title="New person" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View ref={contentRef} collapsable={false}>
          <FormSection title="Identity">
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
              autoCapitalize="words"
            />
            <FormField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>Company</Text>
            <Pressable
              onPress={() => setShowCompanyPicker(true)}
              style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
            >
              <Ionicons name="business-outline" size={18} color={colors.black} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectorText, !selectedCompany && styles.placeholder]}>
                  {selectedCompany?.name ?? 'No company'}
                </Text>
                {selectedCompany?.industry ? (
                  <Text style={styles.selectorHint}>{selectedCompany.industry}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.grey400} />
            </Pressable>
          </FormSection>

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

          <FormSection title="Other">
            <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
          </FormSection>

          <PrimaryButton
            label={saving ? 'Saving…' : 'Create person'}
            icon="person-add"
            onPress={handleSave}
            disabled={saving}
          />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={showCompanyPicker}
        title="Link to company"
        options={companyOptions}
        searchPlaceholder="Search companies"
        emptyLabel="No companies yet. Create one first."
        onClose={() => setShowCompanyPicker(false)}
        onSelect={(opt) => setCompanyId(opt.id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.grey600, marginBottom: spacing.sm },
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
  selectorText: { ...typography.body, color: colors.black, fontSize: 15, textAlign: 'left' },
  selectorHint: { ...typography.caption, color: colors.grey600, fontSize: 12, marginTop: 2 },
  placeholder: { color: colors.grey400 },
  pressed: { opacity: 0.85 },
});
