import {
  defaultEmailEntry,
  defaultPhoneEntry,
  emailEntriesForForm,
  formatPhoneDisplay,
  newContactKey,
  normalizeEmailEntries,
  normalizePhoneEntries,
  parseStoredEmailEntries,
  parseStoredPhoneEntries,
  phoneEntriesForForm,
  primaryEmailFromEntries,
  primaryPhoneFromEntries,
  type EmailEntry,
  type PhoneEntry,
  type StoredEmail,
  type StoredPhone,
} from './clientContact';
import { buildFullName } from '../types/client';
import type { Person } from '../types/client';
import { visitLinkLabel } from './jobVisitLink';
import type { StoredJobVisit } from './jobVisits';

export type JobContactRole = 'Primary' | 'Site' | 'Technical' | 'Billing' | 'Other';

export interface StoredJobContact {
  personId?: string;
  firstName: string;
  lastName: string;
  contactPhones: StoredPhone[];
  contactEmails: StoredEmail[];
  role: JobContactRole;
  visitId?: string | null;
  /** Legacy single name — kept for backward compat reads */
  name?: string;
  /** Legacy single phone */
  phone?: string;
}

export interface JobContactEntry {
  key: string;
  personId?: string;
  firstName: string;
  lastName: string;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  role: JobContactRole;
  visitId: string | null;
}

export const JOB_CONTACT_ROLES: JobContactRole[] = [
  'Primary',
  'Site',
  'Technical',
  'Billing',
  'Other',
];

function splitLegacyName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function jobContactFullName(contact: Pick<StoredJobContact, 'firstName' | 'lastName' | 'name'>): string {
  const fromParts = buildFullName(contact.firstName, contact.lastName);
  return fromParts || contact.name?.trim() || '';
}

function contactHasContent(contact: Pick<
  StoredJobContact,
  'personId' | 'firstName' | 'lastName' | 'name' | 'phone' | 'contactPhones' | 'contactEmails'
>): boolean {
  return Boolean(
    contact.personId?.trim() ||
      contact.firstName.trim() ||
      contact.lastName.trim() ||
      contact.name?.trim() ||
      contact.phone?.trim() ||
      contact.contactPhones.length ||
      contact.contactEmails.length,
  );
}

export function defaultJobContactEntry(
  firstName = '',
  lastName = '',
  role: JobContactRole = 'Site',
  personId?: string,
  visitId: string | null = null,
): JobContactEntry {
  return {
    key: newContactKey('jobcontact'),
    personId,
    firstName,
    lastName,
    phones: [defaultPhoneEntry()],
    emails: [defaultEmailEntry()],
    role,
    visitId,
  };
}

export function jobContactFromPerson(person: Person, role: JobContactRole = 'Site'): JobContactEntry {
  return {
    key: newContactKey('jobcontact'),
    personId: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    phones: phoneEntriesForForm(person.contactPhones, person.phone),
    emails: emailEntriesForForm(person.contactEmails, person.email),
    role,
    visitId: null,
  };
}

export function normalizeJobContactEntries(entries: JobContactEntry[]): StoredJobContact[] {
  const seen = new Set<string>();
  const out: StoredJobContact[] = [];

  for (const entry of entries) {
    const firstName = entry.firstName.trim();
    const lastName = entry.lastName.trim();
    const contactPhones = normalizePhoneEntries(entry.phones);
    const contactEmails = normalizeEmailEntries(entry.emails);
    const fullName = buildFullName(firstName, lastName);

    if (!fullName && !contactPhones.length && !contactEmails.length) continue;

    const dedupeKey =
      entry.personId?.trim() ||
      `${fullName.toLowerCase()}|${contactPhones.map((p) => `${p.countryDial}${p.nationalNumber}`).join(',')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      personId: entry.personId?.trim() || undefined,
      firstName,
      lastName,
      contactPhones,
      contactEmails,
      role: entry.role,
      visitId: entry.visitId?.trim() || null,
    });
  }

  return out;
}

export function serializeJobContacts(entries: JobContactEntry[]): string {
  return JSON.stringify(normalizeJobContactEntries(entries));
}

function parseStoredContactRow(row: Record<string, unknown>): StoredJobContact | null {
  const legacyName = typeof row.name === 'string' ? row.name.trim() : '';
  const legacyPhone = typeof row.phone === 'string' ? row.phone.trim() : '';
  const split = splitLegacyName(
    typeof row.firstName === 'string' || typeof row.lastName === 'string'
      ? buildFullName(String(row.firstName ?? ''), String(row.lastName ?? ''))
      : legacyName,
  );

  const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : split.firstName;
  const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : split.lastName;
  const contactPhones = Array.isArray(row.contactPhones)
    ? parseStoredPhoneEntries(row.contactPhones, legacyPhone)
    : parseStoredPhoneEntries('', legacyPhone);
  const contactEmails = Array.isArray(row.contactEmails)
    ? parseStoredEmailEntries(row.contactEmails)
    : parseStoredEmailEntries('');

  const role = JOB_CONTACT_ROLES.includes(row.role as JobContactRole)
    ? (row.role as JobContactRole)
    : 'Site';
  const personId =
    typeof row.personId === 'string' && row.personId.trim() ? row.personId.trim() : undefined;
  const visitId =
    typeof row.visitId === 'string' && row.visitId.trim() ? row.visitId.trim() : null;

  const contact: StoredJobContact = {
    personId,
    firstName,
    lastName,
    contactPhones,
    contactEmails,
    role,
    visitId,
    name: legacyName || undefined,
    phone: legacyPhone || undefined,
  };

  return contactHasContent(contact) ? contact : null;
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
      .map((item) => (item && typeof item === 'object' ? parseStoredContactRow(item as Record<string, unknown>) : null))
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
      firstName: entry.firstName,
      lastName: entry.lastName,
      phones: phoneEntriesForForm(
        entry.contactPhones,
        entry.phone ?? primaryPhoneFromEntries(entry.contactPhones),
      ),
      emails: emailEntriesForForm(entry.contactEmails),
      role: entry.role,
      visitId: entry.visitId ?? null,
    }));
  }

  if (fallback?.name?.trim() || fallback?.phone?.trim()) {
    const split = splitLegacyName(fallback.name?.trim() ?? '');
    const entry = defaultJobContactEntry(
      split.firstName,
      split.lastName,
      'Primary',
      fallback.personId?.trim() || undefined,
    );
    return [
      {
        ...entry,
        phones: phoneEntriesForForm(undefined, fallback.phone?.trim() ?? ''),
      },
    ];
  }

  return [defaultJobContactEntry()];
}

export function primaryJobContactFromEntries(
  entries: StoredJobContact[],
): { personId: string | null; name: string; phone: string; email: string } {
  const primary =
    entries.find((e) => e.role === 'Primary' && contactHasContent(e)) ??
    entries.find((e) => contactHasContent(e));

  if (!primary) return { personId: null, name: '', phone: '', email: '' };

  return {
    personId: primary.personId ?? null,
    name: jobContactFullName(primary),
    phone: primaryPhoneFromEntries(primary.contactPhones, primary.phone),
    email: primaryEmailFromEntries(primary.contactEmails),
  };
}

function formatPhonesBlock(phones: StoredPhone[], legacyPhone?: string): string {
  const list = phones.length ? phones : parseStoredPhoneEntries('', legacyPhone);
  return list.map((entry) => `${formatPhoneDisplay(entry)} (${entry.label})`).join('\n');
}

function formatEmailsBlock(emails: StoredEmail[]): string {
  return emails.map((entry) => `${entry.address} (${entry.label})`).join('\n');
}

export function formatJobContactDisplay(
  entry: StoredJobContact,
  visits: StoredJobVisit[] = [],
): string {
  const lines: string[] = [];
  const name = jobContactFullName(entry);
  if (name) {
    lines.push(entry.role === 'Primary' ? name : `${name} (${entry.role})`);
  } else if (entry.role !== 'Primary') {
    lines.push(`(${entry.role})`);
  }

  if (visits.length > 0) {
    lines.push(`Linked · ${visitLinkLabel(visits, entry.visitId ?? null)}`);
  }

  const phones = formatPhonesBlock(entry.contactPhones, entry.phone);
  if (phones) lines.push(phones);

  const emails = formatEmailsBlock(entry.contactEmails);
  if (emails) lines.push(emails);

  return lines.join('\n');
}

export function formatJobContactsDisplay(
  entries: StoredJobContact[],
  visits: StoredJobVisit[] = [],
): string {
  if (!entries.length) return '';
  return entries.map((entry) => formatJobContactDisplay(entry, visits)).filter(Boolean).join('\n\n');
}

export interface JobContactVisitGroup {
  visitId: string | null;
  visitLabel: string;
  contacts: StoredJobContact[];
}

export function groupJobContactsByVisit(
  contacts: StoredJobContact[],
  visits: StoredJobVisit[],
): JobContactVisitGroup[] {
  const groups = new Map<string | null, JobContactVisitGroup>();
  const ensure = (visitId: string | null) => {
    if (!groups.has(visitId)) {
      groups.set(visitId, {
        visitId,
        visitLabel: visitLinkLabel(visits, visitId),
        contacts: [],
      });
    }
    return groups.get(visitId)!;
  };

  for (const contact of contacts) {
    ensure(contact.visitId ?? null).contacts.push(contact);
  }

  const orderedIds = [...visits.map((visit) => visit.id), null].filter(
    (id, index, arr) => groups.has(id) && arr.indexOf(id) === index,
  );
  return orderedIds.map((id) => groups.get(id)!);
}

export function splitJobContactName(name: string): { firstName: string; lastName: string } {
  return splitLegacyName(name);
}

/** Unique email addresses across all job contacts — used to prefill recap email recipients. */
export function collectJobContactEmails(contacts: StoredJobContact[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const contact of contacts ?? []) {
    for (const entry of contact.contactEmails ?? []) {
      const address = entry.address?.trim().toLowerCase();
      if (!address || seen.has(address)) continue;
      seen.add(address);
      out.push(entry.address.trim());
    }
  }
  return out;
}

export function jobContactRowHasContent(row: JobContactEntry): boolean {
  return Boolean(
    row.personId ||
      row.firstName.trim() ||
      row.lastName.trim() ||
      row.phones.some((phone) => phone.nationalNumber.trim()) ||
      row.emails.some((email) => email.address.trim()),
  );
}
