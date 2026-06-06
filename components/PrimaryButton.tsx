import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  /** Equal-width button in a horizontal row */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  fill,
  style,
}: PrimaryButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        fill && styles.fill,
        isPrimary && styles.primary,
        variant === 'secondary' && styles.secondary,
        isGhost && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? (
        <View style={fill ? styles.fillIcon : undefined}>
          <Ionicons
            name={icon}
            size={18}
            color={isPrimary ? colors.black : isGhost ? colors.info : colors.black}
          />
        </View>
      ) : null}
      <Text
        numberOfLines={fill ? 1 : undefined}
        adjustsFontSizeToFit={fill}
        minimumFontScale={fill ? 0.85 : undefined}
        style={[
          styles.label,
          fill && styles.fillLabel,
          isPrimary && styles.primaryLabel,
          variant === 'secondary' && styles.secondaryLabel,
          isGhost && styles.ghostLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  fill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  fillIcon: { flexShrink: 0 },
  fillLabel: { ...typography.caption, fontWeight: '700', flexShrink: 1 },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.subheading,
  },
  primaryLabel: {
    color: colors.black,
  },
  secondaryLabel: {
    color: colors.black,
  },
  ghostLabel: {
    color: colors.info,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.black,
  },
  statLabel: {
    ...typography.caption,
    color: colors.grey600,
    marginTop: 2,
  },
});
