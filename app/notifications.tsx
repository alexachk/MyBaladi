import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationsContent, NotificationsHeader } from '../components/NotificationsContent';
import { colors } from '../constants/theme';
import { useNotifications } from '../context/NotificationsContext';

export default function NotificationsScreen() {
  const { unread, markAllRead } = useNotifications();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <NotificationsHeader
        onClose={() => router.back()}
        unread={unread}
        onMarkAllRead={markAllRead}
      />
      <View style={styles.content}>
        <NotificationsContent />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
