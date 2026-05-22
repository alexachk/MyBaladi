import { newContactKey } from './clientContact';

export type AddressLabel =
  | 'Head office'
  | 'Branch'
  | 'Site'
  | 'Warehouse'
  | 'Billing'
  | 'Shipping'
  | 'Home'
  | 'Other';

export interface StoredAddress {
  text: string;
  label: AddressLabel;
  reference?: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressEntry extends StoredAddress {
  key: string;
}

export const ADDRESS_LABELS: AddressLabel[] = [
  'Head office',
  'Branch',
  'Site',
  'Warehouse',
  'Billing',
  'Shipping',
  'Home',
  'Other',
];

export function defaultAddressEntry(): AddressEntry {
  return {
    key: newContactKey('address'),
    text: '',
    label: 'Head office',
    reference: '',
  };
}

export function hasMapPin(entry: Pick<StoredAddress, 'latitude' | 'longitude'>): boolean {
  return typeof entry.latitude === 'number' && typeof entry.longitude === 'number';
}

export function normalizeAddressEntries(entries: AddressEntry[]): StoredAddress[] {
  const seen = new Set<string>();
  const out: StoredAddress[] = [];

  for (const entry of entries) {
    const text = entry.text.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());

    const stored: StoredAddress = {
      text,
      label: entry.label || 'Head office',
      reference: entry.reference?.trim() || undefined,
    };

    if (hasMapPin(entry)) {
      stored.latitude = entry.latitude;
      stored.longitude = entry.longitude;
    }

    out.push(stored);
  }

  return out;
}

export function serializeAddressEntries(entries: StoredAddress[]): string {
  return JSON.stringify(entries);
}

export function parseStoredAddressEntries(raw: unknown, legacyAddress?: string): StoredAddress[] {
  if (raw == null || raw === '') {
    const legacy = legacyAddress?.trim();
    return legacy ? [{ text: legacy, label: 'Head office' }] : [];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') {
              const text = item.trim();
              return text ? { text, label: 'Head office' as AddressLabel } : null;
            }
            if (item && typeof item === 'object') {
              const text = String(item.text ?? item.address ?? '').trim();
              if (!text) return null;
              const label = (item.label as AddressLabel) || 'Head office';
              const reference = item.reference ? String(item.reference).trim() : undefined;
              const latitude =
                typeof item.latitude === 'number' ? item.latitude : undefined;
              const longitude =
                typeof item.longitude === 'number' ? item.longitude : undefined;
              return { text, label, reference, latitude, longitude } satisfies StoredAddress;
            }
            return null;
          })
          .filter(Boolean) as StoredAddress[];
      }
    } catch {
      const text = raw.trim();
      return text ? [{ text, label: 'Head office' }] : [];
    }
  }

  if (Array.isArray(raw)) {
    return parseStoredAddressEntries(JSON.stringify(raw), legacyAddress);
  }

  const legacy = legacyAddress?.trim();
  return legacy ? [{ text: legacy, label: 'Head office' }] : [];
}

export function addressEntriesForForm(
  stored: StoredAddress[] | undefined,
  legacyAddress?: string,
): AddressEntry[] {
  const list = stored?.length ? stored : parseStoredAddressEntries('', legacyAddress);
  if (!list.length) return [defaultAddressEntry()];
  return list.map((entry) => ({
    key: newContactKey('address'),
    text: entry.text,
    label: entry.label || 'Head office',
    reference: entry.reference ?? '',
    latitude: entry.latitude,
    longitude: entry.longitude,
  }));
}

export function primaryAddressFromEntries(entries: StoredAddress[], legacyAddress?: string): string {
  const first = normalizeAddressEntries(
    entries.map((entry, index) => ({ key: `a-${index}`, ...entry })),
  )[0];
  if (first) return first.text;
  return legacyAddress?.trim() ?? '';
}

export function clientContactAddresses(client: {
  address?: string;
  contactAddresses?: StoredAddress[];
}): StoredAddress[] {
  if (client.contactAddresses?.length) return client.contactAddresses;
  return parseStoredAddressEntries('', client.address);
}

export function clientPrimaryAddress(client: {
  address?: string;
  contactAddresses?: StoredAddress[];
}): string {
  return primaryAddressFromEntries(client.contactAddresses ?? [], client.address);
}

export function formatAddressLine(entry: StoredAddress): string {
  const ref = entry.reference?.trim();
  const label = ref || entry.label;
  return label ? `${label} · ${entry.text}` : entry.text;
}

export function prepareClientAddressesPayload(entries: AddressEntry[]) {
  const contactAddresses = normalizeAddressEntries(entries);
  return {
    address: primaryAddressFromEntries(contactAddresses),
    contactAddresses,
  };
}
