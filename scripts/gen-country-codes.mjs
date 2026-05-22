import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('constants/countryDialCodes.generated.json', 'utf8'));
const fixes = { US: '+1', CA: '+1', RU: '+7', KZ: '+7', AU: '+61', CX: '+61', CC: '+61', GB: '+44', GG: '+44', IM: '+44', JE: '+44' };

for (const c of data.countries) {
  if (fixes[c.iso]) c.dial = fixes[c.iso];
}

function flag(iso) {
  if (iso.length !== 2) return '';
  return String.fromCodePoint(...iso.toUpperCase().split('').map((ch) => 127397 + ch.charCodeAt(0)));
}

const body = `export const DEFAULT_COUNTRY_DIAL = '+961';
export const DEFAULT_COUNTRY_ISO = 'LB';

export interface CountryDialCode {
  iso: string;
  name: string;
  dial: string;
  flag: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
${data.countries
  .map(
    (c) =>
      `  { iso: '${c.iso}', name: ${JSON.stringify(c.name)}, dial: '${c.dial}', flag: '${flag(c.iso)}' },`,
  )
  .join('\n')}
];

export function findCountryByDial(dial: string): CountryDialCode | undefined {
  return COUNTRY_DIAL_CODES.find((c) => c.dial === dial);
}

export function countryDialPickerOptions() {
  return COUNTRY_DIAL_CODES.map((c) => ({
    id: c.dial,
    label: \`\${c.flag} \${c.name}\`,
    hint: c.dial,
  }));
}
`;

fs.writeFileSync('constants/countryDialCodes.ts', body);
console.log(`Wrote ${data.countries.length} countries`);
