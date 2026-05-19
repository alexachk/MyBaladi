import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing, typography } from '../constants/theme';
import { useClients } from '../context/ClientsContext';
import type { Company, Person } from '../types/client';

interface ClientsSidebarProps {
  visible: boolean;
  onClose: () => void;
  onPick?: (selection:
    | { type: 'person'; person: Person }
    | { type: 'company'; company: Company }) => void;
  /** When true, the sidebar acts as a picker. When false, it navigates to client detail. */
  pickerMode?: boolean;
}

type Tab = 'persons' | 'companies';

export function ClientsSidebar({ visible, onClose, onPick, pickerMode }: ClientsSidebarProps) {
  const { persons, companies, loading } = useClients();
  const [tab, setTab] = useState<Tab>('persons');
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const sidebarWidth = Math.min(360, Math.round(width * 0.86));
  const insets = useSafeAreaInsets();
  const topPad = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20,
  );
  const bottomPad = Math.max(insets.bottom, 12);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === 'persons') {
      return persons.filter(
        (p) =>
          !q ||
          p.fullName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q),
      );
    }
    return companies.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [tab, query, persons, companies]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { width: sidebarWidth }]}
        >
          <View style={[styles.safe, { paddingTop: topPad, paddingBottom: bottomPad }]}>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="people-circle-outline" size={layout.iconMd} color={colors.black} />
                <Text style={styles.headerTitle} numberOfLines={1} allowFontScaling={false}>
                  Clients
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={layout.iconMd} color={colors.grey600} />
              </Pressable>
            </View>

            <View style={styles.tabsRow}>
              <TabButton
                label={`Persons (${persons.length})`}
                active={tab === 'persons'}
                onPress={() => setTab('persons')}
              />
              <TabButton
                label={`Companies (${companies.length})`}
                active={tab === 'companies'}
                onPress={() => setTab('companies')}
              />
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.grey400} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={tab === 'persons' ? 'Search by name, phone…' : 'Search company…'}
                placeholderTextColor={colors.grey400}
                style={styles.searchInput}
              />
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {loading ? (
                <Text style={styles.dim}>Loading…</Text>
              ) : filtered.length === 0 ? (
                <Text style={styles.dim}>
                  {query ? 'No matches.' : 'No clients yet. Add one below.'}
                </Text>
              ) : tab === 'persons' ? (
                (filtered as Person[]).map((p) => (
                  <ClientRow
                    key={p.id}
                    icon="person-outline"
                    title={p.fullName}
                    subtitle={p.phone || p.email || '—'}
                    onPress={() => {
                      onClose();
                      if (pickerMode && onPick) {
                        onPick({ type: 'person', person: p });
                      } else {
                        router.push(`/clients/${p.id}?type=person`);
                      }
                    }}
                  />
                ))
              ) : (
                (filtered as Company[]).map((c) => (
                  <ClientRow
                    key={c.id}
                    icon="business-outline"
                    title={c.name}
                    subtitle={c.phone || c.email || c.industry || '—'}
                    onPress={() => {
                      onClose();
                      if (pickerMode && onPick) {
                        onPick({ type: 'company', company: c });
                      } else {
                        router.push(`/clients/${c.id}?type=company`);
                      }
                    }}
                  />
                ))
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push(tab === 'persons' ? '/clients/new-person' : '/clients/new-company');
                }}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color={colors.black} />
                <Text style={styles.primaryBtnText}>
                  {tab === 'persons' ? 'New person' : 'New company'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/clients');
                }}
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
              >
                <Text style={styles.ghostBtnText}>Open clients portfolio</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tabBtn, active && styles.tabBtnActive, pressed && styles.pressed]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ClientRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.black} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.background, height: '100%' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { ...typography.screenTitle, color: colors.black },
  closeBtn: { padding: 4 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
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
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.black, padding: 0 },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, flexGrow: 1 },
  dim: { ...typography.caption, color: colors.grey400, textAlign: 'center', marginTop: spacing.xl },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.subheading, color: colors.black, fontSize: 14 },
  rowSubtitle: { ...typography.caption, color: colors.grey600 },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
    backgroundColor: colors.white,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  primaryBtnText: { ...typography.subheading, color: colors.black, fontWeight: '700', fontSize: 14 },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  ghostBtnText: { ...typography.caption, color: colors.info, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
