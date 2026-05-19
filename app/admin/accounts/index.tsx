import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PickerSheet } from '../../../components/PickerSheet';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { POSITIONS } from '../../../constants/positions';
import { ADMIN_LABEL } from '../../../lib/appwrite/auth';
import {
  deleteAdminUser,
  listAdminUsers,
  setAdminUserRole,
  updateAdminUserProfile,
  type AdminUser,
} from '../../../lib/appwrite/adminUsers';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../context/JobCardsContext';

export default function ManageAccountsScreen() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [positionTarget, setPositionTarget] = useState<AdminUser | null>(null);

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

  const toggleAdmin = (account: AdminUser, enabled: boolean) => {
    if (account.id === user?.$id && !enabled) {
      Alert.alert('Accounts', 'You cannot remove admin from your own account.');
      return;
    }

    Alert.alert(
      enabled ? 'Grant admin' : 'Revoke admin',
      `${enabled ? 'Grant' : 'Remove'} administrator access for ${account.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const updated = await setAdminUserRole(account.id, enabled);
              setAccounts((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Update failed.';
              Alert.alert('Accounts', message);
            }
          },
        },
      ],
    );
  };

  const changePosition = async (account: AdminUser, nextPosition: string) => {
    try {
      const updated = await updateAdminUserProfile({
        userId: account.id,
        firstName: account.firstName,
        lastName: account.lastName,
        position: nextPosition,
      });
      setAccounts((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update position.';
      Alert.alert('Accounts', message);
    }
  };

  const confirmDelete = (account: AdminUser) => {
    Alert.alert('Delete account', `Permanently delete ${account.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAdminUser(account.id);
            setAccounts((prev) => prev.filter((row) => row.id !== account.id));
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Delete failed.';
            Alert.alert('Accounts', message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.toolbar}>
        <PrimaryButton
          label="Create account"
          icon="person-add"
          onPress={() => router.push('/admin/accounts/create')}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={accounts}
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
          contentContainerStyle={accounts.length ? styles.list : styles.emptyList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No accounts yet. Create the first technician account.</Text>
          }
          renderItem={({ item }) => {
            const isAdmin = item.labels.includes(ADMIN_LABEL);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardBody}>
                    <Text style={styles.name}>{item.name || item.email}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                  </View>
                  {isAdmin ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Admin</Text>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => setPositionTarget(item)}
                  style={({ pressed }) => [styles.positionRow, pressed && styles.pressed]}
                >
                  <Ionicons name="briefcase-outline" size={16} color={colors.black} />
                  <Text style={styles.positionText}>
                    {item.position || 'Set position'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.grey400} />
                </Pressable>

                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Administrator</Text>
                  <Switch
                    value={isAdmin}
                    onValueChange={(next) => toggleAdmin(item, next)}
                    trackColor={{ false: colors.grey200, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>

                {item.id !== user?.$id ? (
                  <Pressable
                    onPress={() => confirmDelete(item)}
                    style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={styles.deleteText}>Delete account</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <PickerSheet
        visible={!!positionTarget}
        title={`Position for ${positionTarget?.name || positionTarget?.email || ''}`}
        options={POSITIONS.map((p) => ({ id: p, label: p, icon: 'briefcase-outline' }))}
        searchPlaceholder="Search positions"
        onClose={() => setPositionTarget(null)}
        onSelect={(opt) => {
          if (positionTarget) {
            changePosition(positionTarget, opt.label).catch(() => undefined);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  toolbar: { padding: spacing.lg, paddingBottom: spacing.sm },
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  emptyList: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  emptyText: { ...typography.body, color: colors.grey600, textAlign: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardBody: { flex: 1, gap: 2 },
  name: { ...typography.subheading, color: colors.black },
  email: { ...typography.caption, color: colors.grey600 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.black },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { ...typography.body, color: colors.black },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    backgroundColor: colors.grey100,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  positionText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  deleteText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
