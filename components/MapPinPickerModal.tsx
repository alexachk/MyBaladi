import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing, typography } from '../constants/theme';
import { buildMapPinPickerHtml } from '../lib/mapPinPickerHtml';
import { searchPlaces, type PlaceSearchResult } from '../lib/nominatim';

const DEFAULT_LAT = 33.8938;
const DEFAULT_LNG = 35.5018;

export interface MapPinPickerResult {
  text: string;
  latitude: number;
  longitude: number;
}

interface MapPinPickerModalProps {
  visible: boolean;
  initial?: { latitude?: number; longitude?: number; text?: string };
  onClose: () => void;
  onConfirm: (result: MapPinPickerResult) => void;
}

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

export function MapPinPickerModal({ visible, initial, onClose, onConfirm }: MapPinPickerModalProps) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLat = initial?.latitude ?? DEFAULT_LAT;
  const startLng = initial?.longitude ?? DEFAULT_LNG;
  const startZoom = initial?.latitude != null ? 16 : 12;

  const [pin, setPin] = useState({ latitude: startLat, longitude: startLng });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(initial?.text?.trim() ?? '');

  const mapHtml = useMemo(
    () => buildMapPinPickerHtml(startLat, startLng, startZoom),
    [startLat, startLng, startZoom],
  );

  const reversePreview = useCallback(async (latitude: number, longitude: number) => {
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        setPreview(formatPlace(place));
        return;
      }
    } catch {
      // fall through
    }
    setPreview(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setPin({ latitude: startLat, longitude: startLng });
    setQuery('');
    setResults([]);
    setPreview(initial?.text?.trim() ?? '');
    if (initial?.latitude != null && initial?.longitude != null && !initial?.text?.trim()) {
      void reversePreview(initial.latitude, initial.longitude);
    }
  }, [visible, startLat, startLng, initial?.text, initial?.latitude, initial?.longitude, reversePreview]);

  const flyToPin = useCallback((latitude: number, longitude: number, zoom = 16) => {
    setPin({ latitude, longitude });
    webRef.current?.injectJavaScript(
      `window.setMapPin && window.setMapPin(${latitude}, ${longitude}, ${zoom}); true;`,
    );
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void searchPlaces(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, visible]);

  const onWebMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        latitude?: number;
        longitude?: number;
      };
      if (msg.type === 'pinMoved' && msg.latitude != null && msg.longitude != null) {
        setPin({ latitude: msg.latitude, longitude: msg.longitude });
        void reversePreview(msg.latitude, msg.longitude);
      }
    } catch {
      // ignore
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Location', 'Allow location to center the map on you.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      flyToPin(pos.coords.latitude, pos.coords.longitude, 17);
      await reversePreview(pos.coords.latitude, pos.coords.longitude);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to get location.';
      Alert.alert('Location', message);
    } finally {
      setLocating(false);
    }
  };

  const pickSearchResult = (item: PlaceSearchResult) => {
    setQuery(item.label);
    setResults([]);
    flyToPin(item.latitude, item.longitude, 17);
    setPreview(item.label);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      let text = preview.trim();
      if (!text) {
        const [place] = await Location.reverseGeocodeAsync(pin);
        text = place ? formatPlace(place) : `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;
      }
      onConfirm({ text, latitude: pin.latitude, longitude: pin.longitude });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save location.';
      Alert.alert('Location', message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerSide}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Pick location</Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.grey400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search address or place…"
            placeholderTextColor={colors.grey400}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        {results.length > 0 ? (
          <View style={styles.results}>
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pickSearchResult(item)}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                >
                  <Ionicons name="location-outline" size={16} color={colors.black} />
                  <Text style={styles.resultText} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        <View style={styles.mapWrap}>
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            onMessage={onWebMessage}
            style={styles.map}
            javaScriptEnabled
            domStorageEnabled
          />
          <Pressable
            onPress={useMyLocation}
            disabled={locating}
            style={({ pressed }) => [styles.myLocationBtn, pressed && styles.pressed]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <Ionicons name="navigate-outline" size={20} color={colors.black} />
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.previewLabel}>Selected address</Text>
          <Text style={styles.previewText} numberOfLines={3}>
            {preview || 'Tap the map or search to place the pin.'}
          </Text>
          <Pressable
            onPress={handleConfirm}
            disabled={confirming}
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
          >
            {confirming ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.black} />
                <Text style={styles.confirmText}>Use this location</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
  },
  headerSide: { width: 72 },
  title: { ...typography.navTitle, color: colors.black, flex: 1, textAlign: 'center' },
  cancelText: { ...typography.body, color: colors.info, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.black, padding: 0 },
  results: {
    maxHeight: 160,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey100,
  },
  resultText: { ...typography.caption, color: colors.black, flex: 1 },
  mapWrap: { flex: 1, marginHorizontal: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  map: { flex: 1, backgroundColor: colors.grey100 },
  myLocationBtn: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: layout.iconButtonSize + 4,
    height: layout.iconButtonSize + 4,
    borderRadius: (layout.iconButtonSize + 4) / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.grey200,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grey200,
    backgroundColor: colors.white,
  },
  previewLabel: { ...typography.label, color: colors.grey600 },
  previewText: { ...typography.body, color: colors.black, minHeight: 44 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  confirmText: { ...typography.subheading, color: colors.black, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
