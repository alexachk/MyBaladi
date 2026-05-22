import { Alert, Linking } from 'react-native';

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function openUrl(url: string, failTitle: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(failTitle, 'Could not open this app.');
    return false;
  }
}

async function openWhatsApp(phone: string) {
  const n = digitsOnly(phone);
  if (!n) return;
  const deepLink = `whatsapp://send?phone=${n}`;
  if (await openUrl(deepLink, 'WhatsApp')) return;
  await openUrl(`https://wa.me/${n}`, 'WhatsApp');
}

export function promptPhoneActions(phone: string) {
  const value = phone.trim();
  if (!value) return;

  Alert.alert(value, 'Choose an app', [
    { text: 'Call', onPress: () => void openUrl(`tel:${encodeURIComponent(value)}`, 'Call') },
    { text: 'Text message', onPress: () => void openUrl(`sms:${encodeURIComponent(value)}`, 'Message') },
    { text: 'WhatsApp', onPress: () => void openWhatsApp(value) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export function promptEmailActions(email: string) {
  const value = email.trim().toLowerCase();
  if (!value) return;

  const encoded = encodeURIComponent(value);
  Alert.alert(value, 'Choose an app', [
    { text: 'Mail', onPress: () => void openUrl(`mailto:${value}`, 'Email') },
    { text: 'Gmail', onPress: () => void openUrl(`googlegmail:///co?to=${encoded}`, 'Gmail') },
    { text: 'Outlook', onPress: () => void openUrl(`ms-outlook://compose?to=${encoded}`, 'Outlook') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export function openWebsite(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  void openUrl(href, 'Browser');
}
