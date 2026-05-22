import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactAddressesField } from '../../components/ContactAddressesField';
import { ContactEmailsField } from '../../components/ContactEmailsField';
import { ContactPhonesField } from '../../components/ContactPhonesField';
import { ContactWebsitesField } from '../../components/ContactWebsitesField';
import { IndustryPickerField } from '../../components/IndustryPickerField';
import { FormField, FormSection } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StackPageHeader } from '../../components/StackPageHeader';
import { colors, spacing } from '../../constants/theme';
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
import {
  defaultWebsiteEntry,
  prepareClientWebsitesPayload,
  type WebsiteEntry,
} from '../../lib/clientWebsites';

type CompanyFormErrors = {
  name?: string;
  emails?: Record<string, string>;
};

export default function NewCompanyScreen() {
  const { addCompany } = useClients();
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phones, setPhones] = useState<PhoneEntry[]>([defaultPhoneEntry()]);
  const [emails, setEmails] = useState<EmailEntry[]>([defaultEmailEntry()]);
  const [addresses, setAddresses] = useState<AddressEntry[]>([defaultAddressEntry()]);
  const [industry, setIndustry] = useState('');
  const [websites, setWebsites] = useState<WebsiteEntry[]>([defaultWebsiteEntry()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<CompanyFormErrors>({});
  const pendingScrollKeys = useRef<string[]>([]);
  const { scrollRef, contentRef, registerField, scrollToFirstError } = useFormScrollToError();

  useEffect(() => {
    if (pendingScrollKeys.current.length === 0) return;
    const keys = pendingScrollKeys.current;
    pendingScrollKeys.current = [];
    scrollToFirstError(keys);
  }, [errors, scrollToFirstError]);

  const handleSave = async () => {
    const nextErrors: CompanyFormErrors = {};
    if (!name.trim()) {
      nextErrors.name = 'Company name is required';
    }
    const emailErrs = emailEntryErrors(emails);
    if (Object.keys(emailErrs).length > 0) {
      nextErrors.emails = emailErrs;
    }
    if (nextErrors.name || nextErrors.emails) {
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
      const created = await addCompany({
        name,
        legalName,
        phone: contact.phone,
        email: contact.email,
        contactPhones: contact.contactPhones,
        contactEmails: contact.contactEmails,
        address: addressPayload.address,
        contactAddresses: addressPayload.contactAddresses,
        industry,
        website: websitePayload.website,
        contactWebsites: websitePayload.contactWebsites,
        notes,
        primaryContactId: '',
      });
      router.replace(`/clients/${created.id}?type=company`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create company.';
      Alert.alert('New company', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StackPageHeader title="New company" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View ref={contentRef} collapsable={false}>
          <FormSection title="Company">
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
              autoCapitalize="words"
            />
            <FormField label="Legal name" value={legalName} onChangeText={setLegalName} autoCapitalize="words" />
            <ContactWebsitesField values={websites} onChange={setWebsites} />
            <IndustryPickerField value={industry} onChange={setIndustry} />
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
            label={saving ? 'Saving…' : 'Create company'}
            icon="business-outline"
            onPress={handleSave}
            disabled={saving}
          />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
});
