import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { FormField } from '../../components/FormField';
import { PickerSheet } from '../../components/PickerSheet';
import { PrimaryButton } from '../../components/PrimaryButton';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';

export default function NewPersonScreen() {
  const { companyId: presetCompanyId } = useLocalSearchParams<{ companyId?: string }>();
  const { addPerson, companies } = useClients();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [companyId, setCompanyId] = useState(presetCompanyId ?? '');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('New person', 'First name is required.');
      return;
    }

    setSaving(true);
    try {
      const created = await addPerson({
        firstName,
        lastName,
        email,
        phone,
        address,
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormField label="First name" value={firstName} onChangeText={setFirstName} required autoCapitalize="words" />
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

          <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Address" value={address} onChangeText={setAddress} multiline />
          <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />

          <PrimaryButton
            label={saving ? 'Saving…' : 'Create person'}
            icon="person-add"
            onPress={handleSave}
            disabled={saving}
          />
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
