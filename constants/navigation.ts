import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, typography } from './theme';

export const stackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.white },
  headerTintColor: colors.black,
  headerTitleStyle: typography.navTitle,
  headerTitleAlign: Platform.OS === 'android' ? 'left' : 'center',
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};
