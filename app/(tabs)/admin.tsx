import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaladiLogo } from '../../components/BaladiLogo';
import { MachineryBackground } from '../../components/MachineryBackground';
import { colors, radius, shadow, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../context/JobCardsContext';

export default function AdminTabScreen() {
  const { isAdmin } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) {
        router.replace('/(tabs)');
      }
    }, [isAdmin]),
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MachineryBackground opacity={0.1} position="bottom" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BaladiLogo variant="compact" size={36} />
          <Text style={styles.headerTitle}>Administrator</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.black} />
            <Text style={styles.adminBadgeText}>Operations console</Text>
          </View>
          <Text style={styles.heroTitle}>Team & workspace</Text>
          <Text style={styles.heroText}>
            Create accounts, manage technicians, and review all job cards.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Accounts</Text>
        <View style={styles.grid}>
          <AdminTile
            icon="person-add-outline"
            label="Create account"
            onPress={() => router.push('/admin/accounts/create')}
          />
          <AdminTile
            icon="people-outline"
            label="Manage accounts"
            onPress={() => router.push('/admin/accounts')}
          />
        </View>

        <Text style={styles.sectionLabel}>Operations</Text>
        <View style={styles.grid}>
          <AdminTile
            icon="clipboard-outline"
            label="All job cards"
            onPress={() => router.push('/(tabs)/jobs')}
          />
          <AdminTile
            icon="construct-outline"
            label="Sync schema"
            hint="npm run appwrite:sync"
            onPress={() => undefined}
            disabled
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AdminTile({
  icon,
  label,
  hint,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        disabled && styles.tileDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={22} color={disabled ? colors.grey400 : colors.black} />
      <Text style={[styles.tileLabel, disabled && styles.tileLabelDisabled]}>{label}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTitle: { ...typography.title, color: colors.black },
  heroCard: {
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  adminBadgeText: {
    ...typography.caption,
    color: colors.black,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroTitle: { ...typography.heading, color: colors.white },
  heroText: { ...typography.body, color: colors.grey200 },
  sectionLabel: {
    ...typography.label,
    color: colors.grey600,
    marginLeft: spacing.xs,
    marginTop: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
    minHeight: 108,
    justifyContent: 'center',
  },
  tileDisabled: { backgroundColor: colors.grey100 },
  tileLabel: { ...typography.caption, color: colors.black, fontWeight: '600', textAlign: 'center' },
  tileLabelDisabled: { color: colors.grey400 },
  tileHint: { ...typography.caption, color: colors.grey400, fontSize: 10, textAlign: 'center' },
  pressed: { opacity: 0.88 },
});
