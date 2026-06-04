import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaladiLogo } from '../../components/BaladiLogo';
import { MachineryBackground } from '../../components/MachineryBackground';
import { APP_CREDIT, APP_VERSION } from '../../constants/app';
import { getRoleDescription, getRoleLabel } from '../../constants/positions';
import { colors, layout, radius, shadow, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../context/JobCardsContext';
import { getEffectivePosition, isAppDevUser } from '../../lib/appwrite/auth';
import {
  clearCredentials,
  getBiometricCapability,
  hasSavedCredentials,
  type BiometricCapability,
} from '../../lib/biometric';

export default function SettingsScreen() {
  const { user, logout, isAdmin } = useAuth();
  const showAppDevBadge = isAppDevUser(user);
  const userPosition = getEffectivePosition(user);
  const [bio, setBio] = useState<BiometricCapability>({
    available: false,
    type: null,
    label: 'Biometrics',
  });
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      setBio(await getBiometricCapability());
      setBioEnabled(await hasSavedCredentials());
    })().catch(() => undefined);
  }, []);

  const handleBioToggle = async (next: boolean) => {
    if (next) {
      Alert.alert(
        `Enable ${bio.label}`,
        `Sign out and sign back in with “Remember me” checked to enable ${bio.label} unlock.`,
      );
      return;
    }
    await clearCredentials();
    setBioEnabled(false);
    Alert.alert('Quick unlock disabled', 'Saved credentials have been removed from this device.');
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'You will need to enter your password again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MachineryBackground opacity={0.1} position="bottom" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BaladiLogo variant="compact" size={layout.logoCompact} />
          <Text style={styles.headerTitle} numberOfLines={1} allowFontScaling={false}>
            Settings
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials((user?.name || user?.email || '').trim())}
            </Text>
          </View>
          <View style={styles.profileBody}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{user?.name ?? 'Signed out'}</Text>
              {showAppDevBadge ? (
                <View style={[styles.adminBadge, styles.appDevBadge]}>
                  <Ionicons name="code-slash" size={11} color={colors.black} />
                  <Text style={styles.adminBadgeText}>App Dev</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
            {userPosition ? (
              <Text style={styles.profileRole}>
                {userPosition}
                {getRoleLabel(userPosition) ? ` · ${getRoleLabel(userPosition)}` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        {isAdmin ? (
          <Section title="Administrator">
            <Row
              icon="shield-checkmark-outline"
              label="Operations console"
              description="Accounts, team, and all job cards"
              onPress={() => router.push('/admin')}
              chevron
            />
          </Section>
        ) : null}

        <Section title="Activity">
          <Row
            icon="stats-chart-outline"
            label="Your activity"
            description={
              isAdmin
                ? 'Jobs, visits, and recaps across the team'
                : 'Jobs, visits, and recaps for you and your team'
            }
            onPress={() => router.push('/stats')}
            chevron
          />
        </Section>

        <Section title="Security">
          <Row
            icon={
              bio.type === 'face' ? 'scan-outline' : bio.type === 'fingerprint' ? 'finger-print' : 'lock-closed-outline'
            }
            label={`Unlock with ${bio.label}`}
            description={
              !bio.available
                ? 'Not available on this device'
                : bioEnabled
                ? 'Quick unlock is enabled'
                : 'Sign in with Remember me to enable'
            }
            right={
              <Switch
                value={bioEnabled && bio.available}
                onValueChange={handleBioToggle}
                disabled={!bio.available}
                trackColor={{ false: colors.grey200, true: colors.primary }}
                thumbColor={colors.white}
              />
            }
          />
          <Divider />
          <Row
            icon="log-out-outline"
            label="Sign out"
            description="Clear session on this device"
            onPress={handleSignOut}
            destructive
          />
        </Section>

        <Section title="About">
          <Row icon="information-circle-outline" label="Version" description={`v${APP_VERSION}`} />
          <Divider />
          <Row icon="business-outline" label="Operator" description="Baladi Frères SAL" />
          <Divider />
          <Row icon="globe-outline" label="Website" description="baladifreres.com" onPress={() => Linking.openURL('https://baladifreres.com')} chevron />
        </Section>

        <Text style={styles.credit}>{APP_CREDIT}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  description,
  right,
  onPress,
  chevron,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
}) {
  const inner = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={destructive ? colors.error : colors.black} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {right}
      {chevron && !right ? <Ionicons name="chevron-forward" size={18} color={colors.grey400} /> : null}
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {inner}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function initials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTitle: { ...typography.screenTitle, color: colors.black },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    ...shadow.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.black },
  profileBody: { flex: 1, gap: 2 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  profileName: { ...typography.subheading, color: colors.black },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  adminBadgeText: { fontSize: 10, fontWeight: '700', color: colors.black, letterSpacing: 0.3 },
  appDevBadge: { backgroundColor: colors.infoLight },
  profileEmail: { ...typography.caption, color: colors.grey600 },
  profileRole: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.label,
    color: colors.grey600,
    marginLeft: spacing.xs,
  },
  sectionBody: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { ...typography.subheading, color: colors.black },
  rowLabelDestructive: { color: colors.error },
  rowDescription: { ...typography.caption, color: colors.grey600 },
  divider: { height: 1, backgroundColor: colors.grey100, marginLeft: spacing.md + 32 + spacing.md },
  pressed: { opacity: 0.7 },
  credit: {
    ...typography.caption,
    color: colors.grey400,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
});
