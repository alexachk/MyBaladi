import {
  parseStoredAddressEntries,
  serializeAddressEntries,
  type StoredAddress,
} from './clientAddresses';
import {
  parseStoredEmailEntries,
  serializeEmailEntries,
  type StoredEmail,
} from './clientContact';

interface ContactsBlobV2 {
  v: 2;
  emails: StoredEmail[];
  addresses: StoredAddress[];
}

function isContactsBlobV2(value: unknown): value is ContactsBlobV2 {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ContactsBlobV2).v === 2 &&
    Array.isArray((value as ContactsBlobV2).emails)
  );
}

export function serializeContactsBlob(emails: StoredEmail[], addresses: StoredAddress[]): string {
  return JSON.stringify({ v: 2, emails, addresses } satisfies ContactsBlobV2);
}

export function parseContactsBlob(
  raw: unknown,
  legacyEmail?: string,
  legacyAddress?: string,
): { emails: StoredEmail[]; addresses: StoredAddress[] } {
  if (raw == null || raw === '') {
    return {
      emails: parseStoredEmailEntries('', legacyEmail),
      addresses: parseStoredAddressEntries('', legacyAddress),
    };
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (isContactsBlobV2(parsed)) {
        return {
          emails: parseStoredEmailEntries(JSON.stringify(parsed.emails), legacyEmail),
          addresses: parseStoredAddressEntries(JSON.stringify(parsed.addresses ?? []), legacyAddress),
        };
      }
      if (Array.isArray(parsed)) {
        return {
          emails: parseStoredEmailEntries(raw, legacyEmail),
          addresses: parseStoredAddressEntries('', legacyAddress),
        };
      }
    } catch {
      return {
        emails: parseStoredEmailEntries(raw, legacyEmail),
        addresses: parseStoredAddressEntries('', legacyAddress),
      };
    }
  }

  if (Array.isArray(raw)) {
    return parseContactsBlob(JSON.stringify(raw), legacyEmail, legacyAddress);
  }

  return {
    emails: parseStoredEmailEntries('', legacyEmail),
    addresses: parseStoredAddressEntries('', legacyAddress),
  };
}

export function serializeEmailEntriesOnly(emails: StoredEmail[]): string {
  return serializeEmailEntries(emails);
}

export { serializeAddressEntries };
