import { Alert, Linking, Platform } from 'react-native';

/** Open the device maps app for a street address (works in Expo Go). */
export async function openMapsForAddress(address: string): Promise<void> {
  const trimmed = address.trim();
  if (!trimmed) {
    Alert.alert('Address', 'Enter an address first.');
    return;
  }

  const encoded = encodeURIComponent(trimmed);
  const urls =
    Platform.OS === 'ios'
      ? [
          `https://maps.apple.com/?q=${encoded}`,
          `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        ]
      : [`https://www.google.com/maps/search/?api=1&query=${encoded}`];

  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // try next URL
    }
  }

  Alert.alert('Maps', 'Unable to open maps for this address.');
}
