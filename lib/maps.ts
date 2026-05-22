import { Alert, Linking, Platform } from 'react-native';

async function openUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

function mapsOptionsForAddress(address: string) {
  const encoded = encodeURIComponent(address.trim());
  const options =
    Platform.OS === 'ios'
      ? [
          {
            text: 'Apple Maps',
            onPress: () => void openUrl(`https://maps.apple.com/?q=${encoded}`),
          },
          {
            text: 'Google Maps',
            onPress: () => void openUrl(`https://www.google.com/maps/search/?api=1&query=${encoded}`),
          },
        ]
      : [
          {
            text: 'Google Maps',
            onPress: () => void openUrl(`https://www.google.com/maps/search/?api=1&query=${encoded}`),
          },
          {
            text: 'Waze',
            onPress: () => void openUrl(`https://waze.com/ul?q=${encoded}&navigate=yes`),
          },
        ];

  return options;
}

function mapsOptionsForCoordinates(latitude: number, longitude: number, label?: string) {
  const name = encodeURIComponent(label?.trim() || 'Location');
  const coords = `${latitude},${longitude}`;
  const options =
    Platform.OS === 'ios'
      ? [
          {
            text: 'Apple Maps',
            onPress: () => void openUrl(`https://maps.apple.com/?ll=${latitude},${longitude}&q=${name}`),
          },
          {
            text: 'Google Maps',
            onPress: () => void openUrl(`https://www.google.com/maps/search/?api=1&query=${coords}`),
          },
        ]
      : [
          {
            text: 'Google Maps',
            onPress: () => void openUrl(`https://www.google.com/maps/search/?api=1&query=${coords}`),
          },
          {
            text: 'Waze',
            onPress: () =>
              void openUrl(`https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`),
          },
        ];

  return options;
}

export function promptMapsForAddress(address: string): void {
  const trimmed = address.trim();
  if (!trimmed) {
    Alert.alert('Address', 'No address to show.');
    return;
  }

  Alert.alert(trimmed, 'Choose an app', [
    ...mapsOptionsForAddress(trimmed),
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export function promptMapsForCoordinates(latitude: number, longitude: number, label?: string): void {
  Alert.alert(label?.trim() || 'Location', 'Choose an app', [
    ...mapsOptionsForCoordinates(latitude, longitude, label),
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export function promptMapsForAddressEntry(entry: {
  text: string;
  latitude?: number;
  longitude?: number;
}): void {
  if (typeof entry.latitude === 'number' && typeof entry.longitude === 'number') {
    promptMapsForCoordinates(entry.latitude, entry.longitude, entry.text);
    return;
  }
  promptMapsForAddress(entry.text);
}

/** @deprecated Use promptMapsForAddress */
export async function openMapsForAddress(address: string): Promise<void> {
  promptMapsForAddress(address);
}

/** @deprecated Use promptMapsForCoordinates */
export async function openMapsForCoordinates(
  latitude: number,
  longitude: number,
  label?: string,
): Promise<void> {
  promptMapsForCoordinates(latitude, longitude, label);
}

/** @deprecated Use promptMapsForAddressEntry */
export async function openMapsForAddressEntry(entry: {
  text: string;
  latitude?: number;
  longitude?: number;
}): Promise<void> {
  promptMapsForAddressEntry(entry);
}
