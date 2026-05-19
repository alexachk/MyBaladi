import { Stack } from 'expo-router';
import { colors } from '../../constants/theme';

export default function ClientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.black,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Clients' }} />
      <Stack.Screen name="new-person" options={{ title: 'New person', presentation: 'modal' }} />
      <Stack.Screen name="new-company" options={{ title: 'New company', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Client' }} />
    </Stack>
  );
}
