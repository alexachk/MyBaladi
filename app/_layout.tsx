import { useEffect } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { stackScreenOptions } from '../constants/navigation';
import { SplashGate } from '../components/SplashGate';
import { ClientsProvider } from '../context/ClientsContext';
import { AuthProvider, JobCardsProvider, useAuth } from '../context/JobCardsContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { hydrateLocalStoragePolyfill } from '../lib/localStoragePolyfill';
import { configureNotifications } from '../lib/notifications';
import { verifyAppwriteSetup } from '../lib/appwrite/ping';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

void hydrateLocalStoragePolyfill();
verifyAppwriteSetup();
configureNotifications().catch(() => undefined);

function RootNavigator() {
  const { user, loading, isConfigured } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const onLoginScreen = segments[0] === 'login';

    if (isConfigured && !user && !onLoginScreen) {
      router.replace('/login');
      return;
    }

    if (user && onLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [user, loading, isConfigured, segments, router]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, title: 'Home', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="job/new"
          options={{ title: 'New Job Card', presentation: 'modal' }}
        />
        <Stack.Screen name="job/[id]" options={{ title: 'Job Card' }} />
        <Stack.Screen name="job/sign/[id]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="clients" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SplashGate durationMs={2500}>
        <AuthProvider>
          <ClientsProvider>
            <JobCardsProvider>
              <NotificationsProvider>
                <RootNavigator />
              </NotificationsProvider>
            </JobCardsProvider>
          </ClientsProvider>
        </AuthProvider>
      </SplashGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
