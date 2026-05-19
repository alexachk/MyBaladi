import { Platform } from 'react-native';

export const colors = {
  primary: '#F5BC00',
  primaryDark: '#D9A500',
  primaryLight: '#FFF4CC',
  black: '#1A1A1A',
  grey900: '#374151',
  grey600: '#6B7280',
  grey400: '#9CA3AF',
  grey200: '#E5E7EB',
  grey100: '#F3F4F6',
  white: '#FFFFFF',
  background: '#F8F9FB',
  success: '#059669',
  successLight: '#D1FAE5',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  error: '#DC2626',
  errorLight: '#FEE2E2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  /** Marketing / hero only — too large for page chrome on Android */
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  /** In-screen page titles (Home greeting, Jobs, Settings, etc.) */
  screenTitle: {
    fontSize: Platform.OS === 'android' ? 22 : 28,
    fontWeight: '700' as const,
    letterSpacing: Platform.OS === 'android' ? -0.3 : -0.5,
  },
  /** Native stack header titles */
  navTitle: {
    fontSize: Platform.OS === 'android' ? 18 : 17,
    fontWeight: '600' as const,
  },
  heading: { fontSize: 20, fontWeight: '700' as const },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

/** Shared sizes for top bars, tab bar, and header actions */
export const layout = {
  iconButtonSize: Platform.OS === 'android' ? 36 : 40,
  iconSm: Platform.OS === 'android' ? 18 : 20,
  iconMd: Platform.OS === 'android' ? 20 : 22,
  iconLg: Platform.OS === 'android' ? 22 : 24,
  tabIconSize: Platform.OS === 'android' ? 22 : 24,
  /** Icon + label row — safe-area padding added in tab layout */
  tabBarInnerHeight: Platform.OS === 'android' ? 52 : 48,
  tabBarPaddingTop: Platform.OS === 'android' ? 6 : 8,
  /** Minimum bottom pad when inset is 0 (fallback only) */
  tabBarPaddingBottom: Platform.OS === 'android' ? 10 : 8,
  logoCompact: Platform.OS === 'android' ? 32 : 36,
  fabSize: Platform.OS === 'android' ? 48 : 56,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
