import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_EMAIL = 'mybaladi.bio.email';
const KEY_PASSWORD = 'mybaladi.bio.password';

export interface BiometricCapability {
  available: boolean;
  type: 'face' | 'fingerprint' | 'iris' | 'generic' | null;
  label: string;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  if (!hardware || !enrolled) {
    return { available: false, type: null, label: 'Biometrics' };
  }

  const isIOS = Platform.OS === 'ios';

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { available: true, type: 'face', label: isIOS ? 'Face ID' : 'Face Unlock' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available: true, type: 'fingerprint', label: isIOS ? 'Touch ID' : 'Fingerprint' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return { available: true, type: 'iris', label: 'Iris' };
  }
  return { available: true, type: 'generic', label: 'Biometrics' };
}

export async function promptBiometric(reason: string): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
  });
  return res.success;
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_EMAIL, email);
  await SecureStore.setItemAsync(KEY_PASSWORD, password);
}

export async function loadCredentials(): Promise<{ email: string; password: string } | null> {
  const email = await SecureStore.getItemAsync(KEY_EMAIL);
  const password = await SecureStore.getItemAsync(KEY_PASSWORD);
  if (!email || !password) return null;
  return { email, password };
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_EMAIL);
  await SecureStore.deleteItemAsync(KEY_PASSWORD);
}

export async function hasSavedCredentials(): Promise<boolean> {
  const email = await SecureStore.getItemAsync(KEY_EMAIL);
  return !!email;
}
