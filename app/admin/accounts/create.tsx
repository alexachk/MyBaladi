import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { FormField, FormSection } from '../../../components/FormField';
import { MultiValueField } from '../../../components/MultiValueField';
import { PickerSheet } from '../../../components/PickerSheet';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { StackPageHeader } from '../../../components/StackPageHeader';
import {
  ASSIGNABLE_POSITIONS,
  getRoleDescription,
  isPlatformRole,
  managerOptionsForPosition,
  positionPickerOptions,
} from '../../../constants/positions';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import {
  invalidContactEmail,
  normalizeContactEmails,
  normalizeContactPhones,
} from '../../../lib/contactFields';
import { createAdminUser, listAdminUsers, type AdminUser } from '../../../lib/appwrite/adminUsers';

export default function CreateAccountScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [managerId, setManagerId] = useState('');
  const [managers, setManagers] = useState<AdminUser[]>([]);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [contactPhones, setContactPhones] = useState(['']);
  const [contactEmails, setContactEmails] = useState(['']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAdminUsers()
      .then(setManagers)
      .catch(() => setManagers([]));
  }, []);

  const managerLabel = useMemo(() => {
    if (!managerId) return '';
    return managers.find((m) => m.id === managerId)?.name || managers.find((m) => m.id === managerId)?.email || '';
  }, [managerId, managers]);

  const eligibleManagers = useMemo(
    () =>
      position
        ? managerOptionsForPosition(
            position,
            managers.map((m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              position: m.position,
            })),
          )
        : [],
    [position, managers],
  );

  const handleCreate = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      Alert.alert('Create account', 'Email and password are required.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Create account', 'First and family name are required.');
      return;
    }
    if (!position || !(ASSIGNABLE_POSITIONS as readonly string[]).includes(position)) {
      Alert.alert('Create account', 'Choose a role.');
      return;
    }
    if (!isPlatformRole(position) && position !== 'Operations Manager' && !managerId) {
      Alert.alert('Create account', 'Assign a manager (N+1) for this role.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Create account', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Create account', 'Passwords do not match.');
      return;
    }
    const badContactEmail = invalidContactEmail(contactEmails);
    if (badContactEmail) {
      Alert.alert('Create account', `Invalid email: ${badContactEmail}`);
      return;
    }

    setSaving(true);
    try {
      await createAdminUser({
        email: mail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        position: position.trim(),
        managerId: managerId || undefined,
        contactPhones: normalizeContactPhones(contactPhones),
        contactEmails: normalizeContactEmails(contactEmails),
      });
      Alert.alert('Account created', `${mail} can now sign in.`, [
        { text: 'OK', onPress: () => router.replace('/admin/accounts') },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create account.';
      Alert.alert('Create account', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.safe}>
      <StackPageHeader title="Create account" />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Create a team account. They can sign in with email and password.
          </Text>

          <View style={styles.row}>
            <View style={styles.half}>
              <FormField
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                required
              />
            </View>
            <View style={styles.half}>
              <FormField
                label="Family name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                required
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Role</Text>
          <Pressable
            onPress={() => setShowPositionPicker(true)}
            style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
          >
            <Ionicons name="briefcase-outline" size={18} color={colors.black} />
            <Text style={[styles.selectorText, !position && styles.placeholder]}>
              {position || 'Choose role level'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.grey400} />
          </Pressable>
          {position ? <Text style={styles.roleHint}>{getRoleDescription(position)}</Text> : null}

          {position && !isPlatformRole(position) && position !== 'Operations Manager' ? (
            <>
              <Text style={styles.fieldLabel}>Reports to (N+1)</Text>
              <Pressable
                onPress={() => setShowManagerPicker(true)}
                style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
              >
                <Ionicons name="people-outline" size={18} color={colors.black} />
                <Text style={[styles.selectorText, !managerId && styles.placeholder]}>
                  {managerLabel || 'Choose manager'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.grey400} />
              </Pressable>
            </>
          ) : null}

          <FormSection title="Contact">
            <MultiValueField
              label="Phone"
              values={contactPhones}
              onChange={setContactPhones}
              placeholder="Phone number"
              keyboardType="phone-pad"
              addLabel="Add phone"
            />
            <MultiValueField
              label="Email"
              values={contactEmails}
              onChange={setContactEmails}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              addLabel="Add email"
            />
          </FormSection>

          <FormSection title="Sign-in">
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            required
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            required
          />
          <FormField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            required
          />
          </FormSection>

          <PrimaryButton
            label={saving ? 'Creating…' : 'Create account'}
            icon="person-add"
            onPress={handleCreate}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={showPositionPicker}
        compact
        title="Choose role"
        options={positionPickerOptions()}
        onClose={() => setShowPositionPicker(false)}
        onSelect={(opt) => {
          setPosition(opt.label);
          if (isPlatformRole(opt.label)) setManagerId('');
          else setManagerId('');
          setShowPositionPicker(false);
        }}
      />
      <PickerSheet
        visible={showManagerPicker}
        title="Choose manager"
        options={eligibleManagers.map((m) => ({
          id: m.id,
          label: m.name || m.email,
          hint: m.position || undefined,
          icon: 'person-outline' as const,
        }))}
        searchPlaceholder="Search managers"
        onClose={() => setShowManagerPicker(false)}
        onSelect={(opt) => setManagerId(opt.id)}
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
  lead: { ...typography.body, color: colors.grey600, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
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
  selectorText: { flex: 1, ...typography.body, color: colors.black, fontSize: 15 },
  roleHint: { ...typography.caption, color: colors.grey600, marginTop: -spacing.sm, marginBottom: spacing.md },
  placeholder: { color: colors.grey400 },
  pressed: { opacity: 0.85 },
});
