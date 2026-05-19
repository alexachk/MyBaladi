import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MachineryBackground } from '../../components/MachineryBackground';
import { StackPageHeader } from '../../components/StackPageHeader';
import { colors, radius, shadow, spacing, typography } from '../../constants/theme';

export default function AdminConsoleScreen() {
  return (
    <View style={styles.safe}>
      <StackPageHeader title="Administrator" />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <MachineryBackground opacity={0.1} position="bottom" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AdminTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={colors.black} />
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
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
  tileLabel: { ...typography.caption, color: colors.black, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.88 },
});
