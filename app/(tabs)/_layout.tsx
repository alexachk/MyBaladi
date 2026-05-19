import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '../../constants/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const tabBarBottom = Math.max(insets.bottom, layout.tabBarPaddingBottom);
  const tabBarHeight = layout.tabBarPaddingTop + layout.tabBarInnerHeight + tabBarBottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.black,
        tabBarInactiveTintColor: colors.grey400,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.grey200,
          height: tabBarHeight,
          paddingTop: layout.tabBarPaddingTop,
          paddingBottom: tabBarBottom,
        },
        tabBarLabelStyle: {
          fontSize: Platform.OS === 'android' ? 11 : 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={layout.tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Job Cards',
          tabBarIcon: ({ color }) => (
            <Ionicons name="clipboard-outline" size={layout.tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={layout.tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={layout.tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={layout.tabIconSize} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
