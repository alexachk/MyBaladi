import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing, typography } from '../constants/theme';

interface StackPageHeaderProps {
  title: string;
  onBack?: () => void;
  /** Modal stacks already inset the screen — skip full status-bar padding. */
  compactTop?: boolean;
}

export function StackPageHeader({ title, onBack, compactTop }: StackPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = compactTop ? spacing.sm : insets.top;

  return (
    <View style={[styles.wrap, { paddingTop }]}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={10}
          style={({ pressed }) => [styles.sideSlot, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={layout.iconMd} color={colors.black} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1} allowFontScaling={false}>
          {title}
        </Text>
        <View style={styles.sideSlot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sideSlot: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.navTitle, color: colors.black, flex: 1, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
