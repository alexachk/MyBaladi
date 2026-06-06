import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, radius, spacing, typography } from '../constants/theme';
import { buildPdfPreviewHtml } from '../lib/pdfPreviewHtml';
import { loadPdfPreviewBase64, resolvePdfShareUri, type PdfPreviewSource } from '../lib/pdfPreview';

interface PdfPreviewModalProps {
  visible: boolean;
  title: string;
  source: PdfPreviewSource | null;
  onClose: () => void;
}

export function PdfPreviewModal({ visible, title, source, onClose }: PdfPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!source) return;
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const base64 = await loadPdfPreviewBase64(source);
      setHtml(buildPdfPreviewHtml(base64, title));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open PDF.');
    } finally {
      setLoading(false);
    }
  }, [source, title]);

  useEffect(() => {
    if (visible && source) void load();
    if (!visible) {
      setHtml(null);
      setError(null);
    }
  }, [visible, source, load]);

  const handleExport = async () => {
    if (!source) return;
    setExporting(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Export', 'Sharing is not available on this device.');
        return;
      }
      const file = await resolvePdfShareUri(source, title);
      await Sharing.shareAsync(file.uri, {
        mimeType: file.mimeType,
        dialogTitle: file.name,
      });
    } catch (e) {
      Alert.alert('Export', e instanceof Error ? e.message : 'Could not export PDF.');
    } finally {
      setExporting(false);
    }
  };

  const onWebMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; message?: string };
      if (data.type === 'error' && data.message) setError(data.message);
    } catch {
      // ignore
    }
  };

  const canExport = Boolean(source) && !loading && !error;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.barSide}>
            <Ionicons name="close" size={26} color={colors.black} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={() => void handleExport()}
            disabled={!canExport || exporting}
            hitSlop={12}
            style={({ pressed }) => [
              styles.barSide,
              styles.exportBtn,
              pressed && canExport && styles.pressed,
              (!canExport || exporting) && styles.exportBtnDisabled,
            ]}
            accessibilityLabel="Export PDF"
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={colors.black} />
                <Text style={styles.exportLabel}>Export</Text>
              </>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.hint}>Loading PDF…</Text>
          </View>
        ) : null}

        {error && !loading ? (
          <View style={styles.centered}>
            <Ionicons name="document-outline" size={40} color={colors.grey400} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {html && !error ? (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.web}
            onMessage={onWebMessage}
            setBuiltInZoomEnabled
            setDisplayZoomControls={false}
            allowsInlineMediaPlayback
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.grey900 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey200,
    width: '100%',
  },
  barSide: { width: 88, alignItems: 'flex-start' },
  title: { ...typography.subheading, flex: 1, textAlign: 'center', color: colors.black },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  exportBtnDisabled: { opacity: 0.45 },
  exportLabel: { ...typography.caption, color: colors.black, fontWeight: '700' },
  pressed: { opacity: 0.88 },
  web: { flex: 1, backgroundColor: '#525659' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  hint: { ...typography.body, color: colors.grey400 },
  errorText: { ...typography.body, color: colors.grey400, textAlign: 'center' },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryText: { ...typography.body, color: colors.white, fontWeight: '600' },
});
