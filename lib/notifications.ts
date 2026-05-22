import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { syncExpoPushToken } from './appwrite/pushTokens';

let configured = false;

export const ACTIVITY_CHANNEL_ID = 'default';

export async function configureNotifications() {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ACTIVITY_CHANNEL_ID, {
      name: 'Activity',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5BC00',
    });
    await Notifications.setNotificationChannelAsync('job-reminders', {
      name: 'Job reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5BC00',
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  await configureNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain) {
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  }
  return false;
}

export async function registerDeviceForPushNotifications(): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return false;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await syncExpoPushToken(token.data);
    return true;
  } catch {
    return false;
  }
}

export async function presentActivityNotification(input: {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body || undefined,
      sound: 'default',
      data: input.data ?? {},
      ...(Platform.OS === 'android' ? { channelId: ACTIVITY_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export async function scheduleJobReminder(input: {
  jobReference: string;
  clientName: string;
  fireAt: Date;
}): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  if (input.fireAt.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Upcoming mission · ${input.jobReference}`,
      body: input.clientName ? `Client: ${input.clientName}` : 'Tap to open the job card.',
      sound: 'default',
      data: { jobReference: input.jobReference },
      ...(Platform.OS === 'android' ? { channelId: 'job-reminders' } : {}),
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
