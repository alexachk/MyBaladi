/** Sample client — seeded via `npm run appwrite:seed-clients`. */

/** @deprecated Removed demo clients — purged on seed. */
export const LEGACY_COMPANY_IDS = [
  'mock-company-medtech',
  'mock-company-cedar',
  'mock-company-beirut-logistics',
  'mock-company-phoenicia-retail',
  'mock-company-levant-build',
];

/** @deprecated Removed demo persons — purged on seed. */
export const LEGACY_PERSON_IDS = [
  'mock-person-karim',
  'mock-person-lina',
  'mock-person-rami',
  'mock-person-nour',
  'mock-person-elias',
  'mock-person-maya',
  'mock-person-sami',
  'mock-person-rana',
];

export const MOCK_COMPANIES = [
  {
    id: 'mock-company-demo',
    name: 'Baladi Demo Site',
    legalName: 'Baladi Demo Site SARL',
    email: 'site@baladidemo.lb',
    phone: '+9611445566',
    contactPhones: [
      { countryDial: '+961', nationalNumber: '1445566', label: 'Main' },
      { countryDial: '+961', nationalNumber: '70111222', label: 'Mobile' },
    ],
    contactEmails: [{ address: 'site@baladidemo.lb', label: 'Work' }],
    address: 'Mar Mikhael, Beirut',
    contactAddresses: [
      {
        text: 'Mar Mikhael, Beirut',
        label: 'Site',
        reference: 'Building 12',
        latitude: 33.8968,
        longitude: 35.5234,
      },
    ],
    industry: 'Commercial buildings',
    website: '',
    contactWebsites: [],
    notes: 'Demo client — one job with a visit programmed for tomorrow.',
    primaryContactId: 'mock-person-demo',
  },
];

export const MOCK_PERSONS = [
  {
    id: 'mock-person-demo',
    firstName: 'Karim',
    lastName: 'Haddad',
    email: 'karim@baladidemo.lb',
    phone: '+96170111222',
    contactPhones: [{ countryDial: '+961', nationalNumber: '70111222', label: 'Mobile' }],
    contactEmails: [{ address: 'karim@baladidemo.lb', label: 'Work' }],
    address: 'Mar Mikhael, Beirut',
    contactAddresses: [{ text: 'Mar Mikhael, Beirut', label: 'Site' }],
    notes: 'On-site contact for tomorrow\'s visit.',
    companyId: 'mock-company-demo',
  },
];
