import * as MailComposer from 'expo-mail-composer';
import { Alert, Platform } from 'react-native';

/** How to hand off the recap PDF + message to the user’s mail app. */
export type RecapEmailLaunch = 'composer' | 'share';

function installedMailLabels(): string {
  const clients = MailComposer.getClients();
  if (!clients.length) return 'Outlook, Gmail, or your mail app';
  const names = clients.map((c) => c.label);
  if (names.length <= 4) return names.join(', ');
  return `${names.slice(0, 3).join(', ')}, …`;
}

/** Ask which mail app flow to use before generating/sending. */
export function pickRecapEmailLaunch(): Promise<RecapEmailLaunch | null> {
  const installed = installedMailLabels();

  return new Promise((resolve) => {
    const add = (text: string, choice: RecapEmailLaunch) => ({
      text,
      onPress: () => resolve(choice),
    });

    if (Platform.OS === 'android') {
      Alert.alert(
        'Send email with',
        `Next step opens your mail app.\n\nDetected: ${installed}`,
        [
          add('Choose app (Gmail, Outlook…)', 'composer'),
          add('Share sheet', 'share'),
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ],
      );
      return;
    }

    void MailComposer.isAvailableAsync().then((canUseAppleMail) => {
      const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' }> = [];

      if (canUseAppleMail) {
        buttons.push(add('Apple Mail', 'composer'));
      }
      buttons.push(add(`Other apps (${installed})`, 'share'));
      buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => resolve(null) });

      Alert.alert(
        'Send email with',
        canUseAppleMail
          ? 'Apple Mail attaches the PDF automatically. Other apps open the share sheet — pick Outlook, Gmail, etc.'
          : `Use the share sheet and pick your mail app.\n\nInstalled: ${installed}`,
        buttons,
      );
    });
  });
}
