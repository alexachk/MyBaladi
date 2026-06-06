import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/theme';

export interface AttachmentImagePreview {
  fileId: string;
  uri: string;
  name: string;
  mimeType?: string;
}

interface AttachmentImageModalProps {
  visible: boolean;
  preview: AttachmentImagePreview | null;
  onClose: () => void;
  canDelete?: boolean;
  onDelete?: () => void | Promise<void>;
}

const CLOSE_DRAG = 80;

export function AttachmentImageModal({
  visible,
  preview,
  onClose,
  canDelete = false,
  onDelete,
}: AttachmentImageModalProps) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(0)).current;
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resetMotion = useCallback(() => {
    slideY.setValue(0);
  }, [slideY]);

  useEffect(() => {
    if (visible) resetMotion();
  }, [visible, preview?.fileId, resetMotion]);

  const dismiss = useCallback(() => {
    resetMotion();
    onClose();
  }, [onClose, resetMotion]);

  const snapBack = useCallback(() => {
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [slideY]);

  const handleDragRelease = useCallback(
    (dy: number, vy: number) => {
      if (dy > CLOSE_DRAG || vy > 0.65) {
        dismiss();
        return;
      }
      snapBack();
    },
    [dismiss, snapBack],
  );

  const dragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) => {
          const downward = gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
          return downward;
        },
        onMoveShouldSetPanResponder: (_, gesture) => {
          const downward = gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
          return downward;
        },
        onPanResponderGrant: () => {
          slideY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          slideY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          handleDragRelease(gesture.dy, gesture.vy);
        },
        onPanResponderTerminate: (_, gesture) => {
          handleDragRelease(gesture.dy, gesture.vy);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [handleDragRelease, slideY],
  );

  const backdropOpacity = slideY.interpolate({
    inputRange: [0, 280],
    outputRange: [1, 0.25],
    extrapolate: 'clamp',
  });

  const handleExport = async () => {
    if (!preview?.uri) return;
    setExporting(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Export', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(preview.uri, {
        mimeType: preview.mimeType ?? 'image/jpeg',
        dialogTitle: preview.name,
      });
    } catch (error) {
      Alert.alert('Export', error instanceof Error ? error.message : 'Could not export image.');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert('Delete photo', 'Remove this photo permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await onDelete();
              dismiss();
            } catch (error) {
              Alert.alert('Delete', error instanceof Error ? error.message : 'Could not delete photo.');
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  const title = preview?.name ?? 'Photo';

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Animated.View
          {...dragPanResponder.panHandlers}
          style={[
            styles.sheet,
            {
              paddingTop: insets.top,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={dismiss}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={20} color={colors.black} />
            </Pressable>
          </View>

          <View style={styles.imageStage} pointerEvents="none">
            {preview?.uri ? (
              <Image source={{ uri: preview.uri }} style={styles.image} resizeMode="contain" />
            ) : null}
          </View>

          <Text style={styles.dragHint}>Drag down to close</Text>

          <View style={styles.toolbar}>
            <Pressable
              onPress={() => void handleExport()}
              disabled={!preview?.uri || exporting}
              style={({ pressed }) => [styles.toolBtn, pressed && styles.pressed, exporting && styles.toolBtnDisabled]}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color={colors.black} />
                  <Text style={styles.toolBtnText}>Export</Text>
                </>
              )}
            </Pressable>

            {canDelete && onDelete ? (
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.toolBtn,
                  styles.toolBtnDanger,
                  pressed && styles.pressed,
                  deleting && styles.toolBtnDisabled,
                ]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={[styles.toolBtnText, styles.toolBtnDangerText]}>Delete</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.black },
  sheet: { flex: 1 },
  handleRow: { alignItems: 'center', paddingVertical: spacing.xs },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: { ...typography.caption, color: colors.white, flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageStage: { flex: 1, width: '100%' },
  image: { flex: 1, width: '100%' },
  dragHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontSize: 11,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minWidth: 108,
    justifyContent: 'center',
  },
  toolBtnDanger: { backgroundColor: colors.errorLight },
  toolBtnDisabled: { opacity: 0.5 },
  toolBtnText: { ...typography.caption, color: colors.black, fontWeight: '700' },
  toolBtnDangerText: { color: colors.error },
  pressed: { opacity: 0.85 },
});
