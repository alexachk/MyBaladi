import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';

type Tab = 'persons' | 'companies';

export default function ClientsIndex() {
  const { persons, companies, loading, refresh } = useClients();
  const [tab, setTab] = useState<Tab>('persons');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filteredPersons = useMemo(() => {
    const q = query.trim().toLowerCase();
    return persons.filter(
      (p) =>
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q),
    );
  }, [persons, query]);

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [companies, query]);

  const hasResults = tab === 'persons' ? filteredPersons.length > 0 : filteredCompanies.length > 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.tabsRow}>
        <TabButton label={`Persons (${persons.length})`} active={tab === 'persons'} onPress={() => setTab('persons')} />
        <TabButton label={`Companies (${companies.length})`} active={tab === 'companies'} onPress={() => setTab('companies')} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.grey400} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'persons' ? 'Search persons…' : 'Search companies…'}
          placeholderTextColor={colors.grey400}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {!hasResults ? (
            <Text style={styles.empty}>
              {query
                ? 'No matches.'
                : tab === 'persons'
                  ? 'No persons yet. Add one to start linking jobs.'
                  : 'No companies yet. Add one to start linking jobs.'}
            </Text>
          ) : tab === 'persons' ? (
            filteredPersons.map((p) => (
              <ClientRow
                key={p.id}
                title={p.fullName}
                subtitle={p.phone || p.email || '—'}
                icon="person-outline"
                onPress={() => router.push(`/clients/${p.id}?type=person`)}
              />
            ))
          ) : (
            filteredCompanies.map((c) => (
              <ClientRow
                key={c.id}
                title={c.name}
                subtitle={c.phone || c.email || c.industry || '—'}
                icon="business-outline"
                onPress={() => router.push(`/clients/${c.id}?type=company`)}
              />
            ))
          )}
        </ScrollView>
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        onPress={() => router.push(tab === 'persons' ? '/clients/new-person' : '/clients/new-company')}
      >
        <Ionicons name="add" size={layout.iconMd} color={colors.black} />
      </Pressable>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabBtn, active && styles.tabBtnActive, pressed && styles.pressed]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ClientRow({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.black} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.grey400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabsRow: { flexDirection: 'row', padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: colors.black, borderColor: colors.black },
  tabText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.black, paddingVertical: 4 },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm, paddingBottom: spacing.xxl + 60 },
  empty: { ...typography.body, color: colors.grey600, textAlign: 'center', marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.subheading, color: colors.black },
  rowSubtitle: { ...typography.caption, color: colors.grey600 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  pressed: { opacity: 0.85 },
});
