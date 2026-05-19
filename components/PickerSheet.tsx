import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/theme';

export interface PickerOption {
  id: string;
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface Props {
  visible: boolean;
  title: string;
  options: PickerOption[];
  loading?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Short lists (e.g. 3 roles) — no search, sheet fits content */
  compact?: boolean;
  onClose: () => void;
  onSelect: (option: PickerOption) => void;
}

export function PickerSheet({
  visible,
  title,
  options,
  loading,
  searchPlaceholder = 'Search…',
  emptyLabel = 'No results.',
  compact = false,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = windowHeight * (compact ? 0.48 : 0.75);
  const listMaxHeight = Math.max(
    120,
    sheetMaxHeight - (compact ? 88 : 140) - insets.bottom,
  );

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  const handleSelect = (opt: PickerOption) => {
    onClose();
    onSelect(opt);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />

        <View
          style={[
            styles.sheet,
            compact && styles.sheetCompact,
            { paddingBottom: insets.bottom + spacing.md, maxHeight: sheetMaxHeight },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.grey600} />
            </Pressable>
          </View>

          {!compact ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.grey400} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.grey400}
                style={styles.searchInput}
              />
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : filtered.length === 0 ? (
            <Text style={styles.empty}>{emptyLabel}</Text>
          ) : compact ? (
            <View style={styles.compactList}>
              {filtered.map((opt) => (
                <Pressable
                  key={opt.id || '__none__'}
                  onPress={() => handleSelect(opt)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  {opt.icon ? (
                    <View style={styles.icon}>
                      <Ionicons name={opt.icon} size={16} color={colors.black} />
                    </View>
                  ) : null}
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    {opt.hint ? <Text style={styles.rowHint}>{opt.hint}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
                </Pressable>
              ))}
            </View>
          ) : (
            <ScrollView
              style={[styles.list, { maxHeight: listMaxHeight }]}
              contentContainerStyle={{ paddingBottom: spacing.md }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {filtered.map((opt) => (
                <Pressable
                  key={opt.id || '__none__'}
                  onPress={() => handleSelect(opt)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  {opt.icon ? (
                    <View style={styles.icon}>
                      <Ionicons name={opt.icon} size={16} color={colors.black} />
                    </View>
                  ) : null}
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    {opt.hint ? <Text style={styles.rowHint}>{opt.hint}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheetCompact: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  list: {
    flexGrow: 0,
  },
  compactList: {
    gap: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey200,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { ...typography.subheading, color: colors.black, flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.black, padding: 0 },
  empty: { ...typography.body, color: colors.grey600, textAlign: 'center', padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey100,
  },
  rowBody: { flex: 1, minWidth: 0 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...typography.subheading, color: colors.black, fontSize: 14 },
  rowHint: { ...typography.caption, color: colors.grey600, fontSize: 12 },
  pressed: { opacity: 0.85 },
});
