import type { StoredAddress } from '../lib/clientAddresses';
import type { StoredEmail, StoredPhone } from '../lib/clientContact';
import type { StoredWebsite } from '../lib/clientWebsites';

export type ClientType = 'person' | 'company';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  contactPhones: StoredPhone[];
  contactEmails: StoredEmail[];
  address: string;
  contactAddresses: StoredAddress[];
  notes: string;
  companyId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  legalName: string;
  email: string;
  phone: string;
  contactPhones: StoredPhone[];
  contactEmails: StoredEmail[];
  address: string;
  contactAddresses: StoredAddress[];
  industry: string;
  website: string;
  contactWebsites: StoredWebsite[];
  notes: string;
  primaryContactId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type Client =
  | ({ type: 'person' } & Person)
  | ({ type: 'company' } & Company);

export function buildFullName(firstName: string, lastName: string): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ') || firstName?.trim() || '';
}

export function clientDisplayName(c: { type: ClientType; fullName?: string; name?: string }): string {
  return c.type === 'person' ? c.fullName ?? '' : c.name ?? '';
}
