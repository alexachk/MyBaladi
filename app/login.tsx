import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { BaladiLogo } from '../components/BaladiLogo';
import { FormField } from '../components/FormField';
import { MachineryBackground } from '../components/MachineryBackground';
import { PrimaryButton } from '../components/PrimaryButton';
import { APP_CREDIT, APP_VERSION } from '../constants/app';
import { colors, radius, shadow, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/JobCardsContext';
import {
  clearCredentials,
  getBiometricCapability,
  hasSavedCredentials,
  loadCredentials,
  promptBiometric,
  saveCredentials,
  type BiometricCapability,
} from '../lib/biometric';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);
  const [bio, setBio] = useState<BiometricCapability>({
    available: false,
    type: null,
    label: 'Biometrics',
  });
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const cap = await getBiometricCapability();
      setBio(cap);
      setHasSaved(await hasSavedCredentials());
    })().catch(() => undefined);
  }, []);

  const doLogin = async (mail: string, pass: string) => {
    setSubmitting(true);
    try {
      await login(mail.trim(), pass);
      if (remember) {
        await saveCredentials(mail.trim(), pass);
      } else {
        await clearCredentials();
      }
      router.replace('/(tabs)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign in. Check your credentials.';
      Alert.alert('Sign in failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Sign in', 'Please enter your email and password.');
      return;
    }
    await doLogin(email, password);
  };

  const handleBiometric = async () => {
    try {
      const creds = await loadCredentials();
      if (!creds) {
        Alert.alert('Biometrics', 'Sign in with password first to enable quick unlock.');
        return;
      }
      const ok = await promptBiometric(`Unlock MyBaladi with ${bio.label}`);
      if (!ok) return;
      await doLogin(creds.email, creds.password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Biometric unlock failed.';
      Alert.alert('Biometrics', message);
    }
  };

  const biometricIcon: keyof typeof Ionicons.glyphMap =
    bio.type === 'face' ? 'scan-outline' : bio.type === 'fingerprint' ? 'finger-print' : 'lock-closed-outline';

  const showBiometric = bio.available && hasSaved;

  return (
    <SafeAreaView style={styles.safe}>
      <MachineryBackground opacity={0.22} position="bottom" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <BaladiLogo variant="full" size={64} />
          </View>

          <View style={styles.intro}>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to manage missions, job cards, and field operations.
            </Text>
          </View>

          <View style={styles.form}>
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="name@baladifreres.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              textContentType="password"
            />

            <Pressable
              onPress={() => setRemember((v) => !v)}
              style={({ pressed }) => [styles.remember, pressed && styles.pressed]}
              hitSlop={6}
            >
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                {remember ? <Ionicons name="checkmark" size={14} color={colors.black} /> : null}
              </View>
              <Text style={styles.rememberText}>Remember me on this device</Text>
            </Pressable>

            <View style={styles.actions}>
              <PrimaryButton
                label={submitting ? 'Signing in…' : 'Sign in'}
                icon="arrow-forward"
                onPress={handleLogin}
                disabled={submitting}
              />
            </View>

            {showBiometric ? (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <Pressable
                  onPress={handleBiometric}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.bioButton,
                    pressed && styles.pressed,
                    submitting && styles.disabled,
                  ]}
                >
                  <Ionicons name={biometricIcon} size={20} color={colors.black} />
                  <Text style={styles.bioText}>Unlock with {bio.label}</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>Baladi Frères SAL</Text>
            <Text style={styles.footerLine}>Heavy equipment & field services since 1962</Text>
            <Text style={styles.footerCredit}>{APP_CREDIT}</Text>
            <Text style={styles.footerVersion}>v{APP_VERSION}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  intro: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  welcome: { ...typography.title, color: colors.black, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.grey600, textAlign: 'center' },
  form: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    gap: spacing.sm,
    ...shadow.card,
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.grey400,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    ...typography.caption,
    color: colors.grey900,
  },
  actions: { marginTop: spacing.sm },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.grey200,
  },
  dividerText: {
    ...typography.caption,
    color: colors.grey400,
  },
  bioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  bioText: {
    ...typography.subheading,
    color: colors.black,
  },
  footer: {
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.md,
  },
  footerBrand: { ...typography.caption, color: colors.grey600, fontWeight: '700' },
  footerLine: { ...typography.caption, color: colors.grey400 },
  footerCredit: {
    ...typography.caption,
    color: colors.grey400,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  footerVersion: {
    fontSize: 11,
    color: colors.grey400,
    marginTop: 2,
    letterSpacing: 0.4,
  },
});
