import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

interface OpenInMapsButtonProps {
  onPress: () => void;
  label?: string;
  compact?: boolean;
}

export function OpenInMapsButton({
  onPress,
  label = 'Open in maps',
  compact = false,
}: OpenInMapsButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        compact ? styles.compact : styles.btn,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="navigate-outline" size={compact ? 14 : 16} color={colors.info} />
      <Text style={compact ? styles.compactText : styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
  },
  text: { ...typography.caption, color: colors.info, fontWeight: '700' },
  compactText: { ...typography.caption, color: colors.info, fontWeight: '600', fontSize: 11 },
  pressed: { opacity: 0.85 },
});
