import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, spacing } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';

export default function NewCompanyScreen() {
  const { addCompany } = useClients();
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('New company', 'Company name is required.');
      return;
    }

    setSaving(true);
    try {
      const created = await addCompany({
        name,
        legalName,
        phone,
        email,
        address,
        industry,
        website,
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormField label="Company name" value={name} onChangeText={setName} required autoCapitalize="words" />
          <FormField label="Legal name" value={legalName} onChangeText={setLegalName} autoCapitalize="words" />
          <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Website" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
          <FormField label="Industry" value={industry} onChangeText={setIndustry} />
          <FormField label="Address" value={address} onChangeText={setAddress} multiline />
          <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />

          <PrimaryButton
            label={saving ? 'Saving…' : 'Create company'}
            icon="business-outline"
            onPress={handleSave}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
});
