import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useNotifications } from '../context/NotificationsContext';
import { NotificationsContent, NotificationsHeader } from './NotificationsContent';

interface NotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ visible, onClose }: NotificationsPanelProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.min(420, Math.round(width * 0.92));
  const slideX = useRef(new Animated.Value(panelWidth)).current;
  const closing = useRef(false);
  const { unread, markAllRead } = useNotifications();

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    slideX.setValue(panelWidth);
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 24,
      stiffness: 240,
    }).start();
  }, [visible, panelWidth, slideX]);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slideX, {
      toValue: panelWidth,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      closing.current = false;
      if (finished) onClose();
    });
  }, [onClose, panelWidth, slideX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2;
          return horizontal && gesture.dx > 8;
        },
        onPanResponderGrant: () => {
          slideX.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          slideX.setValue(Math.max(0, Math.min(panelWidth, gesture.dx)));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldClose = gesture.dx > panelWidth * 0.22 || gesture.vx > 0.35;
          if (shouldClose) {
            handleClose();
            return;
          }
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 240,
          }).start();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [handleClose, panelWidth, slideX],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          <View style={styles.dragEdge} />
          <NotificationsHeader
            onClose={handleClose}
            unread={unread}
            onMarkAllRead={markAllRead}
          />
          <View style={styles.content}>
            <NotificationsContent onClose={handleClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    overflow: 'hidden',
  },
  dragEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 16,
    zIndex: 2,
  },
  content: { flex: 1 },
});
