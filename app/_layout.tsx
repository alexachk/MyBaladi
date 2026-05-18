import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { SplashGate } from '../components/SplashGate';
import { AuthProvider, JobCardsProvider, useAuth } from '../context/JobCardsContext';
import { verifyAppwriteSetup } from '../lib/appwrite/ping';

verifyAppwriteSetup();

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
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.black,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="job/new"
          options={{ title: 'New Job Card', presentation: 'modal' }}
        />
        <Stack.Screen name="job/[id]" options={{ title: 'Job Card' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SplashGate durationMs={2500}>
      <AuthProvider>
        <JobCardsProvider>
          <RootNavigator />
        </JobCardsProvider>
      </AuthProvider>
    </SplashGate>
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
