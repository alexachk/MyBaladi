/**
 * Single demo job — visit programmed for tomorrow.
 * Seeded via `npm run appwrite:seed-jobs` (run `appwrite:seed-clients` first).
 */

function dateOnly(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function demoReference() {
  const tomorrow = dateOnly(1).replace(/-/g, '');
  return `JC-${tomorrow}-DEMO`;
}

/** @deprecated Removed demo jobs — purged on seed. */
export const LEGACY_JOB_IDS = [
  'mock-job-medtech-planned',
  'mock-job-cedar-progress',
  'mock-job-logistics-review',
  'mock-job-retail-completed',
  'mock-job-levant-draft',
  'mock-job-medtech-urgent',
  'mock-job-person-rejected',
];

/** @param {{ ownerId: string; ownerName: string; supervisorId?: string; supervisorName?: string }} ctx */
export function buildMockJobs(ctx) {
  const { ownerId, ownerName } = ctx;
  const tomorrow = dateOnly(1);
  const visitId = `mock-v-${tomorrow}`;

  return [
    {
      id: 'mock-job-tomorrow',
      reference: demoReference(),
      clientName: 'Baladi Demo Site',
      clientType: 'company',
      companyId: 'mock-company-demo',
      siteAddress: 'Mar Mikhael, Beirut — Building 12',
      contactName: 'Karim Haddad',
      contactPhone: '+961 70 111 222',
      missionType: 'Maintenance',
      status: 'planned',
      priority: 'normal',
      scheduledDate: tomorrow,
      scheduledTime: '09:00',
      notes: 'Demo card — visit programmed for tomorrow. Mark launched or complete when ready.',
      reviewStatus: 'none',
      people: {
        team: [{ userId: ownerId, name: ownerName, role: 'Lead' }],
        contacts: [
          {
            visitId: null,
            firstName: 'Karim',
            lastName: 'Haddad',
            contactPhones: [{ countryDial: '+961', nationalNumber: '70111222', label: 'Mobile' }],
            contactEmails: [{ address: 'karim@baladidemo.lb', label: 'Work' }],
          },
        ],
        missions: ['Maintenance'],
        equipment: ['FCU units × 2'],
        missionScopes: [
          {
            visitId,
            missionTypes: ['Maintenance'],
            equipment: [{ name: 'FCU', quantity: 2 }],
            team: [{ userId: ownerId, name: ownerName, role: 'Lead' }],
          },
        ],
        missionNotes: [
          { visitId, text: 'Access via reception — ask for Karim.' },
        ],
        schedule: {
          initialDate: tomorrow,
          initialTime: '09:00',
          log: [],
          visits: [
            {
              id: visitId,
              date: tomorrow,
              time: '09:00',
              label: 'Visit 1',
              status: 'scheduled',
              location: 'Mar Mikhael, Beirut',
              latitude: 33.8968,
              longitude: 35.5234,
              durationMinutes: 120,
            },
          ],
        },
      },
      workReport: { workItems: [], partItems: [], noteItems: [] },
    },
  ];
}
