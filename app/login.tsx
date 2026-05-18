import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { colors, radius, shadow, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/JobCardsContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Sign in', 'Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign in. Check your credentials.';
      Alert.alert('Sign in failed', message);
    } finally {
      setSubmitting(false);
    }
  };

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
            <View style={styles.actions}>
              <PrimaryButton
                label={submitting ? 'Signing in…' : 'Sign in'}
                icon="arrow-forward"
                onPress={handleLogin}
                disabled={submitting}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>Baladi Frères SAL</Text>
            <Text style={styles.footerLine}>Heavy equipment & field services since 1962</Text>
            <Text style={styles.footerCredit}>Made by Alexandre EL ACHKAR</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
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
  welcome: {
    ...typography.title,
    color: colors.black,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.grey600,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    gap: spacing.sm,
    ...shadow.card,
  },
  actions: {
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.md,
  },
  footerBrand: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
  },
  footerLine: {
    ...typography.caption,
    color: colors.grey400,
  },
  footerCredit: {
    ...typography.caption,
    color: colors.grey400,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
