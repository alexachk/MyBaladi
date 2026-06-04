import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, spacing, typography } from '../constants/theme';
import { buildPdfPreviewHtml } from '../lib/pdfPreviewHtml';
import { loadPdfPreviewBase64, type PdfPreviewSource } from '../lib/pdfPreview';

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

  const onWebMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; message?: string };
      if (data.type === 'error' && data.message) setError(data.message);
    } catch {
      // ignore
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={colors.black} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.closeBtn} />
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
  closeBtn: { width: 40, alignItems: 'flex-start' },
  title: { ...typography.subheading, flex: 1, textAlign: 'center', color: colors.black },
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
