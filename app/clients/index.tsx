import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackPageHeader } from '../../components/StackPageHeader';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useClients } from '../../context/ClientsContext';
import { clientContactEmails, clientPrimaryPhone } from '../../lib/clientContact';
import {
  companyNameLookup,
  filterCompaniesBySearch,
  filterPersonsBySearch,
} from '../../lib/clientSearch';

type Tab = 'persons' | 'companies';

export default function ClientsIndex() {
  const { persons, companies, loading, refresh } = useClients();
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('persons');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const companyNames = useMemo(() => companyNameLookup(companies), [companies]);

  const filteredPersons = useMemo(
    () => filterPersonsBySearch(persons, query, companyNames),
    [persons, query, companyNames],
  );

  const filteredCompanies = useMemo(
    () => filterCompaniesBySearch(companies, query),
    [companies, query],
  );

  const goToTab = (next: Tab) => {
    setTab(next);
    pagerRef.current?.scrollTo({ x: next === 'persons' ? 0 : pageWidth, animated: true });
  };

  const onPagerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setTab(index === 0 ? 'persons' : 'companies');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const renderList = (pageTab: Tab) => {
    const filtered = pageTab === 'persons' ? filteredPersons : filteredCompanies;
    const emptyText = query
      ? 'No matches.'
      : pageTab === 'persons'
        ? 'No persons yet. Add one to start linking jobs.'
        : 'No companies yet. Add one to start linking jobs.';

    return (
      <ScrollView
        style={{ width: pageWidth }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : pageTab === 'persons' ? (
          (filtered as typeof filteredPersons).map((p) => (
            <ClientRow
              key={p.id}
              title={p.fullName}
              subtitle={clientPrimaryPhone(p) || clientContactEmails(p)[0] || '—'}
              icon="person-outline"
              onPress={() => router.push(`/clients/${p.id}?type=person`)}
            />
          ))
        ) : (
          (filtered as typeof filteredCompanies).map((c) => (
            <ClientRow
              key={c.id}
              title={c.name}
              subtitle={clientPrimaryPhone(c) || clientContactEmails(c)[0] || c.industry || '—'}
              icon="business-outline"
              onPress={() => router.push(`/clients/${c.id}?type=company`)}
            />
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StackPageHeader title="Clients" />

      <View style={styles.tabsRow}>
        <TabButton
          label={`Persons (${persons.length})`}
          active={tab === 'persons'}
          onPress={() => goToTab('persons')}
        />
        <TabButton
          label={`Companies (${companies.length})`}
          active={tab === 'companies'}
          onPress={() => goToTab('companies')}
        />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.grey400} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, phone, email, address, notes…"
          placeholderTextColor={colors.grey400}
          style={styles.searchInput}
          textAlignVertical="center"
        />
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {(['persons', 'companies'] as Tab[]).map((pageTab) => (
          <View key={pageTab} style={[styles.page, { width: pageWidth }]}>
            {renderList(pageTab)}
          </View>
        ))}
      </ScrollView>

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
    minHeight: 44,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.black,
    padding: 0,
    paddingVertical: 10,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  pager: { flex: 1 },
  page: { flex: 1 },
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
