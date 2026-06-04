import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ContactAddressesField } from './ContactAddressesField';
import { FormField } from './FormField';
import { JobContactsField } from './JobContactsField';
import { PickerSheet } from './PickerSheet';
import type { VisitLinkOption } from '../lib/jobVisitLink';
import { colors, radius, spacing, typography } from '../constants/theme';
import { clientAddressesForForm } from '../lib/jobClientSite';
import { jobContactRowHasContent, type JobContactEntry } from '../lib/jobContacts';
import type { AddressEntry } from '../lib/clientAddresses';
import type { Company, Person } from '../types/client';
import type { ClientType } from '../types/client';

type Props = {
  companyId: string;
  onCompanyIdChange: (id: string) => void;
  onClientTypeChange: (type: ClientType | null) => void;
  clientName: string;
  onClientNameChange: (name: string) => void;
  manualClientName: string;
  onManualClientNameChange: (name: string) => void;
  siteAddresses: AddressEntry[];
  onSiteAddressesChange: (entries: AddressEntry[]) => void;
  jobContacts: JobContactEntry[];
  onJobContactsChange: (entries: JobContactEntry[]) => void;
  companies: Company[];
  persons: Person[];
  findPerson: (id: string | null | undefined) => Person | undefined;
  visitOptions: VisitLinkOption[];
  clientError?: string;
  onClientErrorClear?: () => void;
};

export function JobClientSiteEditor({
  companyId,
  onCompanyIdChange,
  onClientTypeChange,
  clientName,
  onClientNameChange,
  manualClientName,
  onManualClientNameChange,
  siteAddresses,
  onSiteAddressesChange,
  jobContacts,
  onJobContactsChange,
  companies,
  persons,
  findPerson,
  visitOptions,
  clientError,
  onClientErrorClear,
}: Props) {
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId),
    [companies, companyId],
  );
  const linkedPersons = useMemo(
    () => (companyId ? persons.filter((p) => p.companyId === companyId) : []),
    [persons, companyId],
  );
  const companyOptions = useMemo(
    () => [
      { id: '', label: 'No company', hint: 'Independent contact', icon: 'remove-circle-outline' as const },
      ...companies.map((c) => ({
        id: c.id,
        label: c.name,
        hint: c.industry || c.email || undefined,
        icon: 'business-outline' as const,
      })),
    ],
    [companies],
  );
  const hasLinkedClient = Boolean(companyId || jobContacts.some((c) => jobContactRowHasContent(c)));
  const displayClientName = selectedCompany?.name ?? clientName ?? manualClientName;

  const applyCompany = (company: Company | undefined) => {
    if (!company) {
      onCompanyIdChange('');
      onClientTypeChange(null);
      onClientNameChange(manualClientName);
      onJobContactsChange(jobContacts.filter((c) => !c.personId));
      onClientErrorClear?.();
      return;
    }
    onCompanyIdChange(company.id);
    onClientTypeChange('company');
    onClientNameChange(company.name);
    onSiteAddressesChange(clientAddressesForForm(company));
    onJobContactsChange(
      jobContacts.filter(
        (c) => !c.personId || findPerson(c.personId)?.companyId === company.id,
      ),
    );
    onClientErrorClear?.();
  };

  return (
    <>
      <Text style={styles.fieldLabel}>Company</Text>
      <Pressable
        onPress={() => setShowCompanyPicker(true)}
        style={({ pressed }) => [
          styles.selector,
          clientError ? styles.selectorError : null,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="business-outline" size={18} color={colors.black} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectorText, !selectedCompany && styles.placeholder]}>
            {selectedCompany?.name ?? 'Pick a company or skip'}
          </Text>
          {selectedCompany?.industry ? (
            <Text style={styles.selectorHint}>{selectedCompany.industry}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.grey400} />
      </Pressable>
      {clientError ? <Text style={styles.errorText}>{clientError}</Text> : null}

      {!hasLinkedClient ? (
        <FormField
          label="Or enter client name"
          value={manualClientName}
          onChangeText={(text) => {
            onManualClientNameChange(text);
            onClientNameChange(text);
            onClientErrorClear?.();
          }}
          required
          placeholder="e.g. Acme Industries"
        />
      ) : (
        <View style={styles.clientSummary}>
          <Text style={styles.clientSummaryLabel}>Client on job card</Text>
          <Text style={styles.clientSummaryValue}>{displayClientName || '—'}</Text>
        </View>
      )}

      <ContactAddressesField values={siteAddresses} onChange={onSiteAddressesChange} />

      <JobContactsField
        values={jobContacts}
        onChange={onJobContactsChange}
        linkedPersons={linkedPersons}
        allPersons={persons}
        companyId={companyId || undefined}
        visitOptions={visitOptions}
      />

      <PickerSheet
        visible={showCompanyPicker}
        title="Company"
        options={companyOptions}
        searchPlaceholder="Search companies"
        emptyLabel="No companies yet."
        onClose={() => setShowCompanyPicker(false)}
        onSelect={(opt) => {
          setShowCompanyPicker(false);
          if (!opt.id) {
            applyCompany(undefined);
            return;
          }
          const company = companies.find((c) => c.id === opt.id);
          if (company) applyCompany(company);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    ...typography.caption,
    color: colors.grey600,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  selectorError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  pressed: { opacity: 0.85 },
  selectorText: { ...typography.body, color: colors.black, fontSize: 15, textAlign: 'left' },
  selectorHint: { ...typography.caption, color: colors.grey600, fontSize: 12, marginTop: 2 },
  placeholder: { color: colors.grey400 },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  clientSummary: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
    marginBottom: spacing.md,
  },
  clientSummaryLabel: { ...typography.caption, color: colors.grey600, marginBottom: 4 },
  clientSummaryValue: { ...typography.subheading, color: colors.black, fontSize: 15 },
});
