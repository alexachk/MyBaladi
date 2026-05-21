import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
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
  const { unread, markAllRead } = useNotifications();

  useEffect(() => {
    if (!visible) return;
    slideX.setValue(panelWidth);
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 24,
      stiffness: 240,
    }).start();
  }, [visible, panelWidth, slideX]);

  const handleClose = () => {
    Animated.timing(slideX, {
      toValue: panelWidth,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View
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
  content: { flex: 1 },
});
