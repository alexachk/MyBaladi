import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
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
import { clientContactEmails, clientContactPhones, clientPrimaryPhone } from '../lib/clientContact';
import {
  companyNameLookup,
  filterCompaniesBySearch,
  filterPersonsBySearch,
} from '../lib/clientSearch';
import type { Company, Person } from '../types/client';
import { PickerSheet } from './PickerSheet';

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
  const { persons, companies, loading, refresh } = useClients();
  const [tab, setTab] = useState<Tab>('persons');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showNewPicker, setShowNewPicker] = useState(false);
  const { width } = useWindowDimensions();
  const sidebarWidth = Math.min(360, Math.round(width * 0.86));
  const insets = useSafeAreaInsets();
  const slideX = useRef(new Animated.Value(-sidebarWidth)).current;
  const pagerRef = useRef<ScrollView>(null);
  const closing = useRef(false);
  const pageWidth = sidebarWidth;
  const topPad = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 20,
  );
  const bottomPad = Math.max(insets.bottom, 12);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    slideX.setValue(-sidebarWidth);
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 26,
      stiffness: 220,
    }).start();
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: tab === 'persons' ? 0 : pageWidth, animated: false });
    });
  }, [visible, sidebarWidth, slideX, pageWidth]);

  useEffect(() => {
    if (!visible) {
      setKeyboardOpen(false);
      setShowNewPicker(false);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slideX, {
      toValue: -sidebarWidth,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      closing.current = false;
      if (finished) onClose();
    });
  }, [onClose, sidebarWidth, slideX]);

  const companyNames = useMemo(() => companyNameLookup(companies), [companies]);

  const filteredPersons = useMemo(
    () => filterPersonsBySearch(persons, query, companyNames),
    [query, persons, companyNames],
  );

  const filteredCompanies = useMemo(
    () => filterCompaniesBySearch(companies, query),
    [query, companies],
  );

  const goToTab = (next: Tab) => {
    setTab(next);
    pagerRef.current?.scrollTo({ x: next === 'persons' ? 0 : pageWidth, animated: true });
  };

  const onPagerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setTab(index === 0 ? 'persons' : 'companies');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const renderList = (pageTab: Tab) => {
    const filtered = pageTab === 'persons' ? filteredPersons : filteredCompanies;

    return (
      <ScrollView
        style={{ width: pageWidth, flex: 1 }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <Text style={styles.dim}>Loading…</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.dim}>
            {query ? 'No matches.' : 'No clients yet. Add one below.'}
          </Text>
        ) : pageTab === 'persons' ? (
          (filtered as Person[]).map((p) => (
            <ClientRow
              key={p.id}
              icon="person-outline"
              title={p.fullName}
              subtitle={clientPrimaryPhone(p) || clientContactEmails(p)[0] || '—'}
              onPress={() => {
                handleClose();
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
              subtitle={clientPrimaryPhone(c) || clientContactEmails(c)[0] || c.industry || '—'}
              onPress={() => {
                handleClose();
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
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View
          style={[
            styles.sheet,
            { width: sidebarWidth, transform: [{ translateX: slideX }] },
          ]}
        >
          <KeyboardAvoidingView
            style={[styles.safe, { paddingTop: topPad }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? topPad : 0}
          >
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="people-circle-outline" size={layout.iconMd} color={colors.black} />
                <Text style={styles.headerTitle} numberOfLines={1} allowFontScaling={false}>
                  Clients
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
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

            <View style={[styles.footer, { paddingBottom: spacing.sm + bottomPad }, keyboardOpen && styles.footerKeyboard]}>
              <Pressable
                onPress={() => setShowNewPicker(true)}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color={colors.black} />
                <Text style={styles.primaryBtnText}>New</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>

      <PickerSheet
        visible={showNewPicker}
        compact
        title="Create new"
        options={[
          { id: 'person', label: 'Person', hint: 'Individual contact', icon: 'person-outline' },
          { id: 'company', label: 'Company', hint: 'Business or organization', icon: 'business-outline' },
        ]}
        onClose={() => setShowNewPicker(false)}
        onSelect={(opt) => {
          setShowNewPicker(false);
          handleClose();
          router.push(opt.id === 'person' ? '/clients/new-person' : '/clients/new-company');
        }}
      />
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
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-start' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.white,
    height: '100%',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  safe: { flex: 1, backgroundColor: colors.white },
  pager: { flex: 1, minHeight: 0, backgroundColor: colors.background },
  page: { flex: 1, backgroundColor: colors.background },
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
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
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
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
    backgroundColor: colors.white,
  },
  footerKeyboard: {
    display: 'none',
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
  pressed: { opacity: 0.85 },
});
