import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormField, FormSection } from './FormField';
import { MultiValueField } from './MultiValueField';
import { PickerSheet } from './PickerSheet';
import { PrimaryButton } from './PrimaryButton';
import {
  ASSIGNABLE_POSITIONS,
  APP_DEV_POSITION,
  getRoleDescription,
  getRoleLabel,
  isPlatformRole,
  managerOptionsForPosition,
  positionPickerOptions,
} from '../constants/positions';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  contactListForForm,
  invalidContactEmail,
  normalizeContactEmails,
  normalizeContactPhones,
} from '../lib/contactFields';
import type { AdminUser } from '../lib/appwrite/adminUsers';

interface AccountEditSheetProps {
  visible: boolean;
  account: AdminUser | null;
  allAccounts: AdminUser[];
  currentUserId?: string;
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
  onDelete: (userId: string) => Promise<void>;
  onSaveProfile: (input: {
    userId: string;
    firstName: string;
    lastName: string;
    position: string;
    managerId: string;
    email: string;
    password?: string;
    contactPhones: string[];
    contactEmails: string[];
  }) => Promise<AdminUser>;
}

export function AccountEditSheet({
  visible,
  account,
  allAccounts,
  currentUserId,
  onClose,
  onSaved,
  onDelete,
  onSaveProfile,
}: AccountEditSheetProps) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [contactPhones, setContactPhones] = useState<string[]>(['']);
  const [contactEmails, setContactEmails] = useState<string[]>(['']);
  const [position, setPosition] = useState('');
  const [managerId, setManagerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);

  useEffect(() => {
    if (!account) return;
    setFirstName(account.firstName || account.name.split(' ')[0] || '');
    setLastName(account.lastName || account.name.split(' ').slice(1).join(' ') || '');
    setEmail(account.email || '');
    setPassword('');
    setConfirmPassword('');
    setContactPhones(contactListForForm(account.contactPhones));
    setContactEmails(contactListForForm(account.contactEmails));
    setPosition(account.position || '');
    setManagerId(account.managerId || '');
  }, [account]);

  const managerLabel = useMemo(() => {
    if (!managerId) return '';
    const m = allAccounts.find((a) => a.id === managerId);
    return m?.name || m?.email || '';
  }, [managerId, allAccounts]);

  const eligibleManagers = useMemo(
    () =>
      position
        ? managerOptionsForPosition(
            position,
            allAccounts
              .filter((a) => a.id !== account?.id)
              .map((a) => ({ id: a.id, name: a.name, email: a.email, position: a.position })),
          )
        : [],
    [position, allAccounts, account?.id],
  );

  const handleSave = async () => {
    if (!account) return;
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Account', 'First and family name are required.');
      return;
    }
    const mail = email.trim().toLowerCase();
    if (!mail || !mail.includes('@')) {
      Alert.alert('Account', 'Valid email is required.');
      return;
    }
    if (password || confirmPassword) {
      if (password.length < 8) {
        Alert.alert('Account', 'Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Account', 'Passwords do not match.');
        return;
      }
    }
    const badContactEmail = invalidContactEmail(contactEmails);
    if (badContactEmail) {
      Alert.alert('Account', `Invalid email: ${badContactEmail}`);
      return;
    }
    if (!position || !(ASSIGNABLE_POSITIONS as readonly string[]).includes(position)) {
      Alert.alert('Account', 'Choose a role.');
      return;
    }
    if (
      !isPlatformRole(position) &&
      position !== 'Operations Manager' &&
      !managerId
    ) {
      Alert.alert('Account', 'Assign a manager (N+1).');
      return;
    }

    setSaving(true);
    try {
      const updated = await onSaveProfile({
        userId: account.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: mail,
        password: password || undefined,
        contactPhones: normalizeContactPhones(contactPhones),
        contactEmails: normalizeContactEmails(contactEmails),
        position,
        managerId:
          isPlatformRole(position) || position === 'Operations Manager' ? '' : managerId,
      });

      onSaved(updated);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      Alert.alert('Account', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!account || account.id === currentUserId) return;
    Alert.alert('Delete account', `Permanently delete ${account.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await onDelete(account.id);
              onClose();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Delete failed.';
              Alert.alert('Account', message);
            }
          })();
        },
      },
    ]);
  };

  if (!account) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={1}>
                  {account.name || account.email}
                </Text>
                <Text style={styles.subtitle}>{email || account.email}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.grey600} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <FormField label="First name" value={firstName} onChangeText={setFirstName} required />
                </View>
                <View style={styles.nameField}>
                  <FormField label="Family name" value={lastName} onChangeText={setLastName} required />
                </View>
              </View>

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
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                />
                <FormField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                />
              </FormSection>

              <Text style={styles.fieldLabel}>Role</Text>
              <Pressable
                onPress={() => setShowRolePicker(true)}
                style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
              >
                <Ionicons name="briefcase-outline" size={18} color={colors.black} />
                <View style={styles.selectorBody}>
                  <Text style={styles.selectorText}>{position || 'Choose role'}</Text>
                  {position && getRoleLabel(position) ? (
                    <Text style={styles.selectorHint}>{getRoleLabel(position)}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.grey400} />
              </Pressable>
              {position ? <Text style={styles.roleDesc}>{getRoleDescription(position)}</Text> : null}

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

              <PrimaryButton
                label={saving ? 'Saving…' : 'Save changes'}
                icon="checkmark-circle-outline"
                onPress={handleSave}
                disabled={saving}
              />

              {account.id !== currentUserId ? (
                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={styles.deleteText}>Delete account</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <PickerSheet
        visible={showRolePicker}
        compact
        title="Choose role"
        options={positionPickerOptions()}
        onClose={() => setShowRolePicker(false)}
        onSelect={(opt) => {
          setPosition(opt.label);
          if (opt.label === APP_DEV_POSITION) setManagerId('');
          setShowRolePicker(false);
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
        emptyLabel="No eligible manager for this role yet."
        onClose={() => setShowManagerPicker(false)}
        onSelect={(opt) => {
          setManagerId(opt.id);
          setShowManagerPicker(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey200,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...typography.subheading, color: colors.black },
  subtitle: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  form: { gap: spacing.sm, paddingBottom: spacing.lg },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  nameField: { flex: 1 },
  fieldLabel: { ...typography.label, color: colors.grey600, marginBottom: spacing.sm },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  selectorBody: { flex: 1, minWidth: 0 },
  selectorText: { ...typography.body, color: colors.black, fontSize: 15 },
  selectorHint: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  placeholder: { color: colors.grey400 },
  roleDesc: { ...typography.caption, color: colors.grey600, marginTop: -spacing.xs, marginBottom: spacing.sm },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  deleteText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
