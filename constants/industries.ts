/** Curated industries — keeps client data consistent without being overwhelming. */
export const INDUSTRIES = [
  'Agriculture & farming',
  'Automotive & vehicles',
  'Banking & finance',
  'Construction & contractors',
  'Consulting & professional services',
  'Education & training',
  'Energy & utilities',
  'Engineering',
  'Entertainment & events',
  'Food & beverage',
  'Government & public sector',
  'Healthcare & medical',
  'Hospitality & tourism',
  'Insurance',
  'IT & software',
  'Legal services',
  'Logistics & transport',
  'Manufacturing',
  'Media & advertising',
  'Mining & quarrying',
  'Non-profit & NGO',
  'Oil & gas',
  'Pharmaceuticals',
  'Real estate & property',
  'Retail & shops',
  'Security services',
  'Telecommunications',
  'Textiles & fashion',
  'Trading & import-export',
  'Wholesale & distribution',
  'Other',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export function industryPickerOptions(current?: string) {
  const options = INDUSTRIES.map((label) => ({ id: label, label }));
  if (current && !INDUSTRIES.includes(current as Industry)) {
    return [{ id: current, label: current, hint: 'Current value' }, ...options];
  }
  return options;
}
