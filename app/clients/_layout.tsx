import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../constants/navigation';

export default function ClientsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new-person" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="new-company" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
