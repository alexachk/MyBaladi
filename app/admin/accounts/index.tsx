import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountEditSheet } from '../../../components/AccountEditSheet';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { StackPageHeader } from '../../../components/StackPageHeader';
import { POSITIONS, APP_DEV_POSITION, getRoleLabel, type Position } from '../../../constants/positions';
import { APP_DEV_LABEL } from '../../../lib/appwrite/auth';
import {
  deleteAdminUser,
  listAdminUsers,
  updateAdminUserProfile,
  type AdminUser,
} from '../../../lib/appwrite/adminUsers';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { useAuth, useJobCards } from '../../../context/JobCardsContext';

type FilterKey = 'all' | Position | typeof APP_DEV_POSITION | 'unassigned';

const FILTERS: Array<{
  key: FilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'all', label: 'All', icon: 'people-outline' },
  { key: 'Technician', label: 'Technician', icon: 'construct-outline' },
  { key: 'Supervisor', label: 'Supervisor', icon: 'people-circle-outline' },
  { key: 'Operations Manager', label: 'Ops Manager', icon: 'business-outline' },
  { key: APP_DEV_POSITION, label: 'App Dev', icon: 'code-slash-outline' },
  { key: 'unassigned', label: 'No role', icon: 'help-circle-outline' },
];

function matchesFilter(account: AdminUser, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === APP_DEV_POSITION) {
    return account.labels.includes(APP_DEV_LABEL) || account.position === APP_DEV_POSITION;
  }
  if (filter === 'unassigned') return !account.position;
  return account.position === filter;
}

export default function ManageAccountsScreen() {
  const { user, refreshSession } = useAuth();
  const { refreshTeam } = useJobCards();
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setAccounts(await listAdminUsers());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load accounts.';
      Alert.alert('Accounts', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const counts = useMemo(() => {
    const base: Record<FilterKey, number> = {
      all: accounts.length,
      Technician: 0,
      Supervisor: 0,
      'Operations Manager': 0,
      [APP_DEV_POSITION]: 0,
      unassigned: 0,
    };
    for (const row of accounts) {
      if (!row.position) {
        base.unassigned += 1;
      } else if (row.position === APP_DEV_POSITION || row.labels.includes(APP_DEV_LABEL)) {
        base[APP_DEV_POSITION] += 1;
      } else if ((POSITIONS as readonly string[]).includes(row.position)) {
        base[row.position as Position] += 1;
      }
    }
    return base;
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!q) return true;
      const hay = `${row.name} ${row.email} ${row.position}`.toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, filter, query]);

  const handleSaved = (updated: AdminUser) => {
    setAccounts((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    if (user?.$id === updated.id) {
      void refreshSession();
      void refreshTeam();
    }
  };

  const handleSaveProfile = async (input: {
    userId: string;
    firstName: string;
    lastName: string;
    position: string;
    managerId: string;
    email: string;
    password?: string;
    contactPhones: string[];
    contactEmails: string[];
  }) => {
    const updated = await updateAdminUserProfile(input);
    setAccounts((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    return updated;
  };

  const handleDelete = async (userId: string) => {
    await deleteAdminUser(userId);
    setAccounts((prev) => prev.filter((row) => row.id !== userId));
  };

  return (
    <View style={styles.safe}>
      <StackPageHeader title="Manage accounts" />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
      <View style={styles.pagePad}>
      <View style={styles.toolbar}>
        <PrimaryButton
          label="Create account"
          icon="person-add"
          onPress={() => router.push('/admin/accounts/create')}
        />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.grey400} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or email…"
          placeholderTextColor={colors.grey400}
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={colors.grey400} />
          </Pressable>
        ) : null}
      </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
        decelerationRate="fast"
      >
        {FILTERS.map((item) => {
          const selected = filter === item.key;
          const count = counts[item.key] ?? 0;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={({ pressed }) => [
                styles.filterChip,
                selected && styles.filterChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={selected ? colors.white : colors.grey600}
              />
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                {item.label}
              </Text>
              <View
                style={[
                  styles.countBubble,
                  selected ? styles.countBubbleActive : styles.countBubbleIdle,
                ]}
              >
                <Text style={[styles.countText, selected && styles.countTextActive]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
        <View style={styles.filtersEndPad} />
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          style={styles.listScroll}
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true).catch(() => undefined);
              }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            filtered.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim() || filter !== 'all'
                ? 'No accounts match this filter.'
                : 'No accounts yet. Create the first technician account.'}
            </Text>
          }
          renderItem={({ item }) => {
            const isAppDev = item.labels.includes(APP_DEV_LABEL);
            const roleLine = item.position
              ? `${item.position}${getRoleLabel(item.position) ? ` · ${getRoleLabel(item.position)}` : ''}`
              : 'No role assigned';

            return (
              <Pressable
                onPress={() => setEditTarget(item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.name || item.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name || item.email}
                    </Text>
                    {isAppDev ? (
                      <View style={[styles.badge, styles.appDevBadge]}>
                        <Text style={styles.badgeText}>App Dev</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.email} numberOfLines={1}>
                    {item.email}
                  </Text>
                  <Text style={styles.role} numberOfLines={1}>
                    {roleLine}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.grey400} />
              </Pressable>
            );
          }}
        />
      )}

      <AccountEditSheet
        visible={!!editTarget}
        account={editTarget}
        allAccounts={accounts}
        currentUserId={user?.$id}
        onClose={() => setEditTarget(null)}
        onSaved={handleSaved}
        onDelete={handleDelete}
        onSaveProfile={handleSaveProfile}
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  pagePad: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  toolbar: { paddingTop: spacing.lg },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.black, padding: 0 },
  filtersScroll: { flexGrow: 0, marginBottom: spacing.sm },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  filtersEndPad: { width: spacing.lg },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterText: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '600',
  },
  filterTextActive: { color: colors.white },
  countBubble: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBubbleIdle: { backgroundColor: colors.grey100 },
  countBubbleActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { fontSize: 11, fontWeight: '700', color: colors.grey600 },
  countTextActive: { color: colors.white },
  loader: { marginTop: spacing.xl },
  listScroll: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  emptyText: { ...typography.body, color: colors.grey600, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.subheading, color: colors.black, fontSize: 16 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.subheading, color: colors.black, flexShrink: 1 },
  email: { ...typography.caption, color: colors.grey600 },
  role: { ...typography.caption, color: colors.grey400, marginTop: 2 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: colors.black },
  appDevBadge: { backgroundColor: colors.infoLight },
  pressed: { opacity: 0.7 },
});
