import { clientContactAddresses } from './clientAddresses';
import { clientContactEmails, clientContactPhones, formatPhoneE164 } from './clientContact';
import type { Company, Person } from '../types/client';

export interface ClientSearchQuery {
  text: string;
  digits: string;
}

export function parseClientSearchQuery(raw: string): ClientSearchQuery {
  const text = raw.trim().toLowerCase();
  return { text, digits: text.replace(/\D/g, '') };
}

function joinParts(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function phoneHaystack(client: { contactPhones: Person['contactPhones']; phone?: string }): string[] {
  const parts: string[] = [];
  if (client.phone?.trim()) parts.push(client.phone.trim());

  for (const entry of client.contactPhones ?? []) {
    parts.push(entry.label, entry.countryDial, entry.nationalNumber, formatPhoneE164(entry));
  }

  for (const stored of clientContactPhones(client)) {
    parts.push(stored);
  }

  return parts;
}

function emailHaystack(client: { contactEmails: Person['contactEmails']; email?: string }): string[] {
  const parts: string[] = [];
  if (client.email?.trim()) parts.push(client.email.trim());

  for (const entry of client.contactEmails ?? []) {
    parts.push(entry.label, entry.address);
  }

  for (const stored of clientContactEmails(client)) {
    parts.push(stored);
  }

  return parts;
}

function addressHaystack(client: {
  address?: string;
  contactAddresses?: Person['contactAddresses'];
}): string[] {
  const parts: string[] = [];
  if (client.address?.trim()) parts.push(client.address.trim());

  for (const entry of clientContactAddresses(client)) {
    parts.push(entry.label, entry.reference ?? '', entry.text);
  }

  return parts;
}

export function personSearchHaystack(person: Person, linkedCompanyName?: string): string {
  return joinParts([
    person.firstName,
    person.lastName,
    person.fullName,
    linkedCompanyName,
    person.notes,
    ...phoneHaystack(person),
    ...emailHaystack(person),
    ...addressHaystack(person),
  ]);
}

export function companySearchHaystack(company: Company): string {
  return joinParts([
    company.name,
    company.legalName,
    company.industry,
    company.website,
    company.notes,
    ...phoneHaystack(company),
    ...emailHaystack(company),
    ...addressHaystack(company),
    ...(company.contactWebsites ?? []).flatMap((entry) => [entry.label, entry.url]),
  ]);
}

function haystackDigits(haystack: string): string {
  return haystack.replace(/\D/g, '');
}

export function matchesClientSearch(haystack: string, query: ClientSearchQuery): boolean {
  if (!query.text) return true;

  if (haystack.includes(query.text)) return true;

  if (query.digits.length >= 3) {
    const digits = haystackDigits(haystack);
    if (digits.includes(query.digits)) return true;
  }

  return false;
}

export function filterPersonsBySearch(
  persons: Person[],
  queryRaw: string,
  companyNameById?: Map<string, string>,
): Person[] {
  const query = parseClientSearchQuery(queryRaw);
  if (!query.text) return persons;

  return persons.filter((person) => {
    const companyName = person.companyId ? companyNameById?.get(person.companyId) : undefined;
    return matchesClientSearch(personSearchHaystack(person, companyName), query);
  });
}

export function filterCompaniesBySearch(companies: Company[], queryRaw: string): Company[] {
  const query = parseClientSearchQuery(queryRaw);
  if (!query.text) return companies;

  return companies.filter((company) => matchesClientSearch(companySearchHaystack(company), query));
}

export function companyNameLookup(companies: Company[]): Map<string, string> {
  return new Map(companies.map((company) => [company.id, company.name]));
}
