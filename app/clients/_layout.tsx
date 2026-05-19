import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../constants/navigation';

export default function ClientsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Clients' }} />
      <Stack.Screen name="new-person" options={{ title: 'New person', presentation: 'modal' }} />
      <Stack.Screen name="new-company" options={{ title: 'New company', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Client' }} />
    </Stack>
  );
}
