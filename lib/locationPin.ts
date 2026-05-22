import * as Location from 'expo-location';
import { Alert } from 'react-native';

function formatPlace(place: Location.LocationGeocodedAddress): string {
  const parts = [
    place.streetNumber,
    place.street,
    place.district,
    place.city,
    place.region,
    place.postalCode,
    place.country,
  ].filter(Boolean);
  return parts.join(', ');
}

export interface LocationPin {
  text: string;
  latitude: number;
  longitude: number;
}

/** Request GPS, reverse-geocode, return address text + coordinates. */
export async function resolveLocationPin(): Promise<LocationPin | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Location', 'Allow location access to save a map pin for this address.');
    return null;
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
  const text = place ? formatPlace(place) : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  return { text, latitude, longitude };
}
