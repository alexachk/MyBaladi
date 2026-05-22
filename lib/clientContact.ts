import {
  COUNTRY_DIAL_CODES,
  DEFAULT_COUNTRY_DIAL,
} from '../constants/countryDialCodes';
import {
  invalidContactEmail,
  normalizeContactEmails,
} from './contactFields';

export type PhoneLabel = 'Mobile' | 'Work' | 'Home' | 'Main' | 'Fax' | 'Other';
export type EmailLabel = 'Work' | 'Personal' | 'Other';

export interface StoredPhone {
  countryDial: string;
  nationalNumber: string;
  label: PhoneLabel;
}

export interface StoredEmail {
  address: string;
  label: EmailLabel;
}

export interface PhoneEntry extends StoredPhone {
  key: string;
}

export interface EmailEntry extends StoredEmail {
  key: string;
}

export const PHONE_LABELS: PhoneLabel[] = ['Mobile', 'Work', 'Home', 'Main', 'Fax', 'Other'];
export const EMAIL_LABELS: EmailLabel[] = ['Work', 'Personal', 'Other'];

let entryKey = 0;
export function newContactKey(prefix: string): string {
  entryKey += 1;
  return `${prefix}-${entryKey}`;
}

export function defaultPhoneEntry(): PhoneEntry {
  return {
    key: newContactKey('phone'),
    countryDial: DEFAULT_COUNTRY_DIAL,
    nationalNumber: '',
    label: 'Mobile',
  };
}

export function defaultEmailEntry(): EmailEntry {
  return {
    key: newContactKey('email'),
    address: '',
    label: 'Work',
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function parsePhoneString(value: string): Pick<StoredPhone, 'countryDial' | 'nationalNumber'> {
  const trimmed = value.trim();
  if (!trimmed) {
    return { countryDial: DEFAULT_COUNTRY_DIAL, nationalNumber: '' };
  }

  if (trimmed.startsWith('+')) {
    const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
    for (const country of sorted) {
      if (trimmed.startsWith(country.dial)) {
        return {
          countryDial: country.dial,
          nationalNumber: digitsOnly(trimmed.slice(country.dial.length)),
        };
      }
    }
  }

  return {
    countryDial: DEFAULT_COUNTRY_DIAL,
    nationalNumber: digitsOnly(trimmed),
  };
}

export function formatPhoneE164(entry: Pick<StoredPhone, 'countryDial' | 'nationalNumber'>): string {
  const national = digitsOnly(entry.nationalNumber).replace(/^0+/, '');
  if (!national) return '';
  return `${entry.countryDial}${national}`;
}

export function formatPhoneDisplay(entry: Pick<StoredPhone, 'countryDial' | 'nationalNumber'>): string {
  const e164 = formatPhoneE164(entry);
  if (!e164) return '';
  const national = e164.slice(entry.countryDial.length);
  const grouped = national.replace(/(\d{2,3})(?=\d)/g, '$1 ').trim();
  return `${entry.countryDial} ${grouped}`.trim();
}

export function normalizePhoneEntries(entries: PhoneEntry[]): StoredPhone[] {
  const seen = new Set<string>();
  const out: StoredPhone[] = [];

  for (const entry of entries) {
    const e164 = formatPhoneE164(entry);
    if (!e164 || seen.has(e164)) continue;
    seen.add(e164);
    out.push({
      countryDial: entry.countryDial || DEFAULT_COUNTRY_DIAL,
      nationalNumber: digitsOnly(entry.nationalNumber).replace(/^0+/, ''),
      label: entry.label || 'Mobile',
    });
  }

  return out;
}

export function normalizeEmailEntries(entries: EmailEntry[]): StoredEmail[] {
  const seen = new Set<string>();
  const out: StoredEmail[] = [];

  for (const entry of entries) {
    const address = entry.address.trim().toLowerCase();
    if (!address || seen.has(address)) continue;
    seen.add(address);
    out.push({
      address,
      label: entry.label || 'Work',
    });
  }

  return out;
}

export function serializePhoneEntries(entries: StoredPhone[]): string {
  return JSON.stringify(entries);
}

export function serializeEmailEntries(entries: StoredEmail[]): string {
  return JSON.stringify(entries);
}

export function parseStoredPhoneEntries(raw: unknown, legacyPhone?: string): StoredPhone[] {
  if (raw == null || raw === '') {
    if (legacyPhone?.trim()) {
      const parsed = parsePhoneString(legacyPhone);
      return [{ ...parsed, label: 'Mobile' }];
    }
    return [];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') {
              const phone = parsePhoneString(item);
              return { ...phone, label: 'Mobile' as PhoneLabel };
            }
            if (item && typeof item === 'object') {
              const countryDial = String(item.countryDial ?? item.dial ?? DEFAULT_COUNTRY_DIAL);
              const nationalNumber = digitsOnly(String(item.nationalNumber ?? item.number ?? ''));
              const label = (item.label as PhoneLabel) || 'Mobile';
              if (!nationalNumber) return null;
              return { countryDial, nationalNumber, label };
            }
            return null;
          })
          .filter(Boolean) as StoredPhone[];
      }
    } catch {
      const phone = parsePhoneString(raw);
      if (!phone.nationalNumber) return [];
      return [{ ...phone, label: 'Mobile' }];
    }
  }

  if (Array.isArray(raw)) {
    return parseStoredPhoneEntries(JSON.stringify(raw), legacyPhone);
  }

  return legacyPhone?.trim()
    ? [{ ...parsePhoneString(legacyPhone), label: 'Mobile' }]
    : [];
}

export function parseStoredEmailEntries(raw: unknown, legacyEmail?: string): StoredEmail[] {
  if (raw == null || raw === '') {
    const legacy = legacyEmail?.trim().toLowerCase();
    return legacy ? [{ address: legacy, label: 'Work' }] : [];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') {
              const address = item.trim().toLowerCase();
              return address ? { address, label: 'Work' as EmailLabel } : null;
            }
            if (item && typeof item === 'object') {
              const address = String(item.address ?? item.email ?? '').trim().toLowerCase();
              const label = (item.label as EmailLabel) || 'Work';
              return address ? { address, label } : null;
            }
            return null;
          })
          .filter(Boolean) as StoredEmail[];
      }
    } catch {
      const address = raw.trim().toLowerCase();
      return address ? [{ address, label: 'Work' }] : [];
    }
  }

  if (Array.isArray(raw)) {
    return parseStoredEmailEntries(JSON.stringify(raw), legacyEmail);
  }

  const legacy = legacyEmail?.trim().toLowerCase();
  return legacy ? [{ address: legacy, label: 'Work' }] : [];
}

export function phoneEntriesForForm(stored: StoredPhone[] | undefined, legacyPhone?: string): PhoneEntry[] {
  const list = stored?.length ? stored : parseStoredPhoneEntries('', legacyPhone);
  if (!list.length) return [defaultPhoneEntry()];
  return list.map((entry) => ({
    key: newContactKey('phone'),
    countryDial: entry.countryDial || DEFAULT_COUNTRY_DIAL,
    nationalNumber: entry.nationalNumber,
    label: entry.label || 'Mobile',
  }));
}

export function emailEntriesForForm(stored: StoredEmail[] | undefined, legacyEmail?: string): EmailEntry[] {
  const list = stored?.length ? stored : parseStoredEmailEntries('', legacyEmail);
  if (!list.length) return [defaultEmailEntry()];
  return list.map((entry) => ({
    key: newContactKey('email'),
    address: entry.address,
    label: entry.label || 'Work',
  }));
}

export function primaryPhoneFromEntries(entries: StoredPhone[], legacyPhone?: string): string {
  const first = normalizePhoneEntries(
    entries.map((entry, index) => ({ key: `p-${index}`, ...entry })),
  )[0];
  if (first) return formatPhoneE164(first);
  return legacyPhone?.trim() ?? '';
}

export function primaryEmailFromEntries(entries: StoredEmail[], legacyEmail?: string): string {
  const first = normalizeEmailEntries(
    entries.map((entry, index) => ({ key: `e-${index}`, ...entry })),
  )[0];
  if (first) return first.address;
  return legacyEmail?.trim().toLowerCase() ?? '';
}

export function clientContactPhones(client: {
  phone?: string;
  contactPhones?: StoredPhone[];
}): string[] {
  const stored = client.contactPhones?.length
    ? client.contactPhones
    : parseStoredPhoneEntries('', client.phone);
  return stored.map(formatPhoneE164).filter(Boolean);
}

export function clientContactEmails(client: {
  email?: string;
  contactEmails?: StoredEmail[];
}): string[] {
  const stored = client.contactEmails?.length
    ? client.contactEmails
    : parseStoredEmailEntries('', client.email);
  return stored.map((entry) => entry.address);
}

export function clientPrimaryPhone(client: { phone?: string; contactPhones?: StoredPhone[] }): string {
  return clientContactPhones(client)[0] ?? client.phone?.trim() ?? '';
}

export function clientPrimaryEmail(client: { email?: string; contactEmails?: StoredEmail[] }): string {
  return clientContactEmails(client)[0] ?? client.email?.trim().toLowerCase() ?? '';
}

export function invalidEmailEntries(entries: EmailEntry[]): string | null {
  return invalidContactEmail(entries.map((entry) => entry.address));
}

export function emailEntryErrors(entries: EmailEntry[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const entry of entries) {
    const address = entry.address.trim().toLowerCase();
    if (!address) continue;
    if (!address.includes('@')) {
      errors[entry.key] = 'Enter a valid email address';
    }
  }
  return errors;
}

export function prepareClientContactPayload(phones: PhoneEntry[], emails: EmailEntry[]) {
  const normalizedPhones = normalizePhoneEntries(phones);
  const normalizedEmails = normalizeEmailEntries(emails);
  const badEmail = invalidContactEmail(normalizedEmails.map((entry) => entry.address));
  if (badEmail) {
    throw new Error(`Invalid email: ${badEmail}`);
  }

  return {
    phone: primaryPhoneFromEntries(normalizedPhones),
    email: primaryEmailFromEntries(normalizedEmails),
    contactPhones: normalizedPhones,
    contactEmails: normalizedEmails,
  };
}
