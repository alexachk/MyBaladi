import type { JobCard } from '../types/jobCard';
import type { Company, Person } from '../types/client';
import type { ClientType } from '../types/client';
import {
  addressEntriesForForm,
  prepareClientAddressesPayload,
  type AddressEntry,
} from './clientAddresses';
import {
  jobContactsForForm,
  normalizeJobContactEntries,
  primaryJobContactFromEntries,
  type JobContactEntry,
} from './jobContacts';

export function clientAddressesForForm(
  client: { address?: string; contactAddresses?: Parameters<typeof addressEntriesForForm>[0] } | undefined,
  fallback?: string,
): AddressEntry[] {
  if (!client) return addressEntriesForForm(undefined, fallback);
  return addressEntriesForForm(client.contactAddresses, client.address ?? fallback);
}

export type JobClientSiteDraft = {
  companyId: string;
  clientType: ClientType | null;
  clientName: string;
  manualClientName: string;
  siteAddresses: AddressEntry[];
  jobContacts: JobContactEntry[];
};

export function jobClientSiteDraftFromJob(
  job: Pick<
    JobCard,
    | 'companyId'
    | 'personId'
    | 'clientName'
    | 'siteAddress'
    | 'clientType'
    | 'jobContacts'
    | 'contactName'
    | 'contactPhone'
  >,
  findPerson: (id: string | null | undefined) => Person | undefined,
  findCompany: (id: string | null | undefined) => Company | undefined,
): JobClientSiteDraft {
  const company = findCompany(job.companyId);
  const person = findPerson(job.personId);
  const linked = company ?? person;
  const hasLink = Boolean(job.companyId || job.personId);
  return {
    companyId: job.companyId ?? '',
    clientType: job.clientType ?? null,
    clientName: job.clientName ?? '',
    manualClientName: hasLink ? '' : (job.clientName ?? ''),
    siteAddresses: clientAddressesForForm(linked, job.siteAddress),
    jobContacts: jobContactsForForm(job.jobContacts, {
      personId: job.personId,
      name: job.contactName,
      phone: job.contactPhone,
    }),
  };
}

export function buildJobClientSitePatch(
  draft: JobClientSiteDraft,
  selectedCompanyName?: string,
): { patch: Partial<JobCard>; error?: string } {
  const normalizedContacts = normalizeJobContactEntries(draft.jobContacts);
  const primaryContact = primaryJobContactFromEntries(normalizedContacts);
  const finalClientName = (selectedCompanyName ?? draft.clientName ?? draft.manualClientName).trim();
  if (!finalClientName) {
    return { patch: {}, error: 'Pick a company, contact, or enter a client name.' };
  }

  const addressPayload = prepareClientAddressesPayload(draft.siteAddresses);
  let resolvedClientType = draft.clientType;
  let resolvedClientName = finalClientName;
  if (!draft.companyId && primaryContact.personId) {
    resolvedClientType = 'person';
    if (!resolvedClientName) resolvedClientName = primaryContact.name;
  }

  return {
    patch: {
      clientName: resolvedClientName,
      siteAddress: addressPayload.address,
      companyId: draft.companyId || null,
      personId: primaryContact.personId ?? null,
      clientType: resolvedClientType,
      contactName: primaryContact.name,
      contactPhone: primaryContact.phone,
      jobContacts: normalizedContacts,
    },
  };
}
