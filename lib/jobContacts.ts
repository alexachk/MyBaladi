import { clientPrimaryPhone, newContactKey } from './clientContact';
import type { Person } from '../types/client';

export type JobContactRole = 'Primary' | 'Site' | 'Technical' | 'Billing' | 'Other';

export interface StoredJobContact {
  personId?: string;
  name: string;
  phone: string;
  role: JobContactRole;
}

export interface JobContactEntry extends StoredJobContact {
  key: string;
}

export const JOB_CONTACT_ROLES: JobContactRole[] = [
  'Primary',
  'Site',
  'Technical',
  'Billing',
  'Other',
];

export function defaultJobContactEntry(
  name = '',
  phone = '',
  role: JobContactRole = 'Site',
  personId?: string,
): JobContactEntry {
  return {
    key: newContactKey('jobcontact'),
    personId,
    name,
    phone,
    role,
  };
}

export function jobContactFromPerson(person: Person, role: JobContactRole = 'Site'): JobContactEntry {
  return defaultJobContactEntry(person.fullName, clientPrimaryPhone(person), role, person.id);
}

export function normalizeJobContactEntries(entries: JobContactEntry[]): StoredJobContact[] {
  const seen = new Set<string>();
  const out: StoredJobContact[] = [];
  for (const entry of entries) {
    const name = entry.name.trim();
    const phone = entry.phone.trim();
    if (!name && !phone) continue;
    const dedupeKey = entry.personId?.trim() || `${name.toLowerCase()}|${phone}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      personId: entry.personId?.trim() || undefined,
      name: name || phone,
      phone,
      role: entry.role,
    });
  }
  return out;
}

export function serializeJobContacts(entries: JobContactEntry[]): string {
  return JSON.stringify(normalizeJobContactEntries(entries));
}

export function parseStoredJobContacts(raw: unknown): StoredJobContact[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return parseStoredJobContacts(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        const phone = typeof row.phone === 'string' ? row.phone.trim() : '';
        if (!name && !phone) return null;
        const role = JOB_CONTACT_ROLES.includes(row.role as JobContactRole)
          ? (row.role as JobContactRole)
          : 'Site';
        const personId =
          typeof row.personId === 'string' && row.personId.trim() ? row.personId.trim() : undefined;
        return { personId, name, phone, role };
      })
      .filter(Boolean) as StoredJobContact[];
  }
  return [];
}

export function jobContactsForForm(
  stored: StoredJobContact[] | undefined,
  fallback?: { personId?: string | null; name?: string | null; phone?: string | null },
): JobContactEntry[] {
  if (stored?.length) {
    return stored.map((entry) => ({
      key: newContactKey('jobcontact'),
      personId: entry.personId,
      name: entry.name,
      phone: entry.phone,
      role: entry.role,
    }));
  }
  if (fallback?.name?.trim() || fallback?.phone?.trim()) {
    return [
      defaultJobContactEntry(
        fallback.name?.trim() ?? '',
        fallback.phone?.trim() ?? '',
        'Primary',
        fallback.personId?.trim() || undefined,
      ),
    ];
  }
  return [defaultJobContactEntry()];
}

export function primaryJobContactFromEntries(
  entries: StoredJobContact[],
): { personId: string | null; name: string; phone: string } {
  const primary =
    entries.find((e) => e.role === 'Primary' && (e.name || e.phone)) ??
    entries.find((e) => e.name || e.phone);
  if (!primary) return { personId: null, name: '', phone: '' };
  return {
    personId: primary.personId ?? null,
    name: primary.name,
    phone: primary.phone,
  };
}

export function formatJobContactsDisplay(entries: StoredJobContact[]): string {
  if (!entries.length) return '';
  return entries
    .map((e) => {
      const label = e.name || e.phone;
      const phone = e.phone && e.name ? ` · ${e.phone}` : e.phone;
      return e.role === 'Primary' ? `${label}${phone}` : `${label}${phone} (${e.role})`;
    })
    .join('\n');
}
