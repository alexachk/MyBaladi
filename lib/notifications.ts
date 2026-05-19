import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

export async function configureNotifications() {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('job-reminders', {
      name: 'Job reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5BC00',
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain) {
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  }
  return false;
}

export async function scheduleJobReminder(input: {
  jobReference: string;
  clientName: string;
  fireAt: Date;
}): Promise<string | null> {
  await configureNotifications();
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  if (input.fireAt.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Upcoming mission · ${input.jobReference}`,
      body: input.clientName ? `Client: ${input.clientName}` : 'Tap to open the job card.',
      sound: 'default',
      data: { jobReference: input.jobReference },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: input.fireAt,
      channelId: 'job-reminders',
    },
  });
  return id;
}

export async function cancelReminder(id: string | null | undefined) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already cancelled or invalid id
  }
}
