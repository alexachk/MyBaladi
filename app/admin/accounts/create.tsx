import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '../../../components/FormField';
import { PickerSheet } from '../../../components/PickerSheet';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { POSITIONS } from '../../../constants/positions';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { createAdminUser } from '../../../lib/appwrite/adminUsers';

export default function CreateAccountScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (password.length < 8) {
      Alert.alert('Create account', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Create account', 'Passwords do not match.');
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
        grantAdmin,
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Create a technician or administrator account. They can sign in with email and password.
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

          <Text style={styles.fieldLabel}>Position</Text>
          <Pressable
            onPress={() => setShowPositionPicker(true)}
            style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
          >
            <Ionicons name="briefcase-outline" size={18} color={colors.black} />
            <Text style={[styles.selectorText, !position && styles.placeholder]}>
              {position || 'Tap to choose a position'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.grey400} />
          </Pressable>

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

          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchLabel}>Administrator access</Text>
              <Text style={styles.switchHint}>Can manage accounts and operations console</Text>
            </View>
            <Switch
              value={grantAdmin}
              onValueChange={setGrantAdmin}
              trackColor={{ false: colors.grey200, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

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
        title="Choose position"
        options={POSITIONS.map((p) => ({ id: p, label: p, icon: 'briefcase-outline' }))}
        searchPlaceholder="Search positions"
        onClose={() => setShowPositionPicker(false)}
        onSelect={(opt) => setPosition(opt.label)}
      />
    </SafeAreaView>
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
  placeholder: { color: colors.grey400 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  switchCopy: { flex: 1, gap: 2 },
  switchLabel: { ...typography.subheading, color: colors.black },
  switchHint: { ...typography.caption, color: colors.grey600 },
  pressed: { opacity: 0.85 },
});
