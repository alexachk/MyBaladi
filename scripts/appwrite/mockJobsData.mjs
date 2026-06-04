/**
 * Demo job cards — link to `mockClientsData.mjs` companies/persons.
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

function isoAt(offsetDays, hours = 9, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** @param {{ ownerId: string; ownerName: string; supervisorId?: string; supervisorName?: string }} ctx */
export function buildMockJobs(ctx) {
  const { ownerId, ownerName, supervisorId, supervisorName } = ctx;
  const supId = supervisorId ?? ownerId;
  const supName = supervisorName ?? ownerName;

  const teamLead = { userId: ownerId, name: ownerName, role: 'Lead' };
  const teamSupport = { userId: supId, name: supName, role: 'Support' };

  return [
    {
      id: 'mock-job-medtech-planned',
      reference: 'JC-20990101-001',
      clientName: 'MedTech Lebanon',
      clientType: 'company',
      companyId: 'mock-company-medtech',
      siteAddress: 'Mar Mikhael, Beirut — Building 12',
      contactName: 'Karim Haddad',
      contactPhone: '+961 70 111 222',
      missionType: 'Maintenance',
      status: 'planned',
      priority: 'normal',
      scheduledDate: dateOnly(3),
      scheduledTime: '09:00',
      notes: 'Quarterly HVAC preventive maintenance. Demo card for visits + mission scopes.',
      reviewStatus: 'none',
      people: {
        team: [teamLead, teamSupport],
        contacts: [
          {
            visitId: null,
            firstName: 'Karim',
            lastName: 'Haddad',
            contactPhones: [{ countryDial: '+961', nationalNumber: '70111222', label: 'Mobile' }],
            contactEmails: [{ address: 'karim@medtech.lb', label: 'Work' }],
          },
        ],
        missions: ['Maintenance', 'Inspection'],
        equipment: ['FCU units × 4', 'BMS panel'],
        missionScopes: [
          {
            visitId: 'mock-v-med-1',
            missionTypes: ['Maintenance'],
            equipment: [{ name: 'FCU', quantity: 4 }],
            team: [teamLead],
          },
        ],
        missionNotes: [
          { visitId: 'mock-v-med-1', text: 'Bring ladder for ceiling units.' },
        ],
        schedule: {
          initialDate: dateOnly(3),
          initialTime: '09:00',
          log: [],
          visits: [
            {
              id: 'mock-v-med-1',
              date: dateOnly(3),
              time: '09:00',
              label: 'Visit 1',
              status: 'scheduled',
              location: 'Mar Mikhael, Beirut',
              latitude: 33.8968,
              longitude: 35.5234,
              durationMinutes: 120,
            },
            {
              id: 'mock-v-med-2',
              date: dateOnly(10),
              time: '14:00',
              label: 'Visit 2',
              status: 'scheduled',
              durationMinutes: 90,
            },
          ],
        },
      },
      workReport: { workItems: [], partItems: [], noteItems: [] },
    },
    {
      id: 'mock-job-cedar-progress',
      reference: 'JC-20990101-002',
      clientName: 'Cedar Hospitality',
      clientType: 'company',
      companyId: 'mock-company-cedar',
      siteAddress: 'Downtown, Beirut',
      contactName: 'Lina Khoury',
      contactPhone: '+961 1 998 877',
      missionType: 'Repair',
      status: 'in_progress',
      priority: 'high',
      scheduledDate: dateOnly(0),
      scheduledTime: '08:30',
      startedAt: isoAt(-1, 8, 15),
      notes: 'Kitchen exhaust fault — on site now. Tests recap + work report.',
      reviewStatus: 'none',
      people: {
        team: [teamLead],
        contacts: [],
        missions: ['Repair'],
        equipment: ['Exhaust fan', 'Electrical panel'],
        schedule: {
          initialDate: dateOnly(-2),
          initialTime: '08:30',
          log: [
            {
              at: isoAt(-1, 8, 15),
              userId: ownerId,
              userName: ownerName,
              fromDate: dateOnly(-2),
              fromTime: '08:30',
              toDate: dateOnly(0),
              toTime: '08:30',
              action: 'launched',
              visitId: 'mock-v-cedar-1',
              arrivalTime: '08:22',
            },
          ],
          visits: [
            {
              id: 'mock-v-cedar-1',
              date: dateOnly(0),
              time: '08:30',
              label: 'Visit 1',
              status: 'in_progress',
              arrivalTime: '08:22',
              durationMinutes: 180,
            },
          ],
        },
      },
      workReport: {
        workItems: [
          {
            text: 'Replaced faulty capacitor on exhaust motor.',
            visitId: 'mock-v-cedar-1',
          },
        ],
        partItems: [{ text: 'Capacitor 45µF × 1', visitId: 'mock-v-cedar-1' }],
        noteItems: [{ text: 'Client requested evening noise test.', visitId: 'mock-v-cedar-1' }],
      },
    },
    {
      id: 'mock-job-logistics-review',
      reference: 'JC-20990101-003',
      clientName: 'Beirut Logistics Hub',
      clientType: 'company',
      companyId: 'mock-company-beirut-logistics',
      siteAddress: 'Dora, Metn — Warehouse 3',
      contactName: 'Rami Nassar',
      contactPhone: '+961 3 445 566',
      missionType: 'Inspection',
      status: 'pending_review',
      priority: 'normal',
      scheduledDate: dateOnly(-5),
      scheduledTime: '10:00',
      startedAt: isoAt(-6, 9, 45),
      finishedAt: isoAt(-5, 16, 20),
      notes: 'Awaiting supervisor approval. Demo validation workflow.',
      reviewStatus: 'submitted',
      submittedById: ownerId,
      submittedAt: isoAt(-4, 17, 0),
      people: {
        team: [teamLead, { userId: supId, name: supName, role: 'Supervisor' }],
        missions: ['Inspection'],
        equipment: ['Dock levellers × 2'],
        schedule: {
          initialDate: dateOnly(-5),
          initialTime: '10:00',
          log: [
            {
              at: isoAt(-5, 16, 5),
              userId: ownerId,
              userName: ownerName,
              fromDate: dateOnly(-5),
              fromTime: '10:00',
              toDate: dateOnly(-5),
              toTime: '10:00',
              action: 'done',
              visitId: 'mock-v-log-1',
              arrivalTime: '09:55',
              departureTime: '16:05',
            },
          ],
          visits: [
            {
              id: 'mock-v-log-1',
              date: dateOnly(-5),
              time: '10:00',
              label: 'Visit 1',
              status: 'done',
              arrivalTime: '09:55',
              departureTime: '16:05',
              completedAt: isoAt(-5, 16, 5),
            },
          ],
        },
      },
      workReport: {
        workItems: [
          {
            text: 'Inspected dock levellers; lubricated chains; noted wear on #2.',
            visitId: 'mock-v-log-1',
          },
        ],
        partItems: [{ text: 'Chain lubricant', visitId: 'mock-v-log-1' }],
        noteItems: [],
      },
    },
    {
      id: 'mock-job-retail-completed',
      reference: 'JC-20990101-004',
      clientName: 'Phoenicia Retail',
      clientType: 'company',
      companyId: 'mock-company-phoenicia-retail',
      siteAddress: 'Hamra, Beirut',
      contactName: 'Nour Saleh',
      contactPhone: '+961 76 222 333',
      missionType: 'Installation',
      status: 'completed',
      priority: 'low',
      scheduledDate: dateOnly(-14),
      scheduledTime: '11:00',
      startedAt: isoAt(-15, 10, 30),
      finishedAt: isoAt(-14, 15, 0),
      clientSignatureName: 'Nour Saleh',
      lockedAt: isoAt(-14, 15, 5),
      lockedBy: ownerId,
      notes: 'Signed off — demo completed + approved job.',
      reviewStatus: 'approved',
      submittedById: ownerId,
      submittedAt: isoAt(-14, 15, 10),
      reviewedById: supId,
      reviewedByName: supName,
      reviewedAt: isoAt(-13, 9, 0),
      people: {
        team: [teamLead],
        missions: ['Installation'],
        equipment: ['Split AC 24k BTU'],
        schedule: {
          initialDate: dateOnly(-14),
          initialTime: '11:00',
          log: [],
          visits: [
            {
              id: 'mock-v-ret-1',
              date: dateOnly(-14),
              time: '11:00',
              label: 'Visit 1',
              status: 'done',
              arrivalTime: '10:58',
              departureTime: '14:55',
              completedAt: isoAt(-14, 14, 55),
            },
          ],
        },
      },
      workReport: {
        workItems: [{ text: 'Installed and commissioned split AC unit.', visitId: 'mock-v-ret-1' }],
        partItems: [{ text: 'Copper line set, wall bracket', visitId: 'mock-v-ret-1' }],
        noteItems: [],
      },
    },
    {
      id: 'mock-job-levant-draft',
      reference: 'JC-20990101-005',
      clientName: 'Levant Build Co.',
      clientType: 'company',
      companyId: 'mock-company-levant-build',
      siteAddress: 'Jounieh — Site B',
      contactName: 'Elias Gemayel',
      contactPhone: '+961 3 778 899',
      missionType: 'Commissioning',
      status: 'draft',
      priority: 'normal',
      scheduledDate: dateOnly(14),
      scheduledTime: null,
      notes: 'Draft quote visit — minimal data for new-job flow testing.',
      reviewStatus: 'none',
      people: {
        team: [teamLead],
        missions: ['Commissioning'],
        equipment: [],
      },
      workReport: { workItems: [], partItems: [], noteItems: [] },
    },
    {
      id: 'mock-job-medtech-urgent',
      reference: 'JC-20990101-006',
      clientName: 'MedTech Lebanon',
      clientType: 'company',
      companyId: 'mock-company-medtech',
      siteAddress: 'Mar Mikhael, Beirut — ICU wing',
      contactName: 'Maya Khoury',
      contactPhone: '+961 76 333 444',
      missionType: 'Emergency Call-out',
      status: 'in_progress',
      priority: 'urgent',
      scheduledDate: dateOnly(0),
      scheduledTime: '07:00',
      startedAt: isoAt(0, 6, 50),
      notes: 'Urgent OR air-handling alarm — multi-visit demo.',
      reviewStatus: 'none',
      people: {
        team: [teamLead, teamSupport],
        missions: ['Emergency Call-out', 'Repair'],
        equipment: ['AHU-OR-1', 'Filter bank'],
        schedule: {
          initialDate: dateOnly(0),
          initialTime: '07:00',
          log: [],
          visits: [
            {
              id: 'mock-v-urg-1',
              date: dateOnly(0),
              time: '07:00',
              label: 'Emergency',
              status: 'done',
              arrivalTime: '06:52',
              departureTime: '09:10',
              completedAt: isoAt(0, 9, 10),
            },
            {
              id: 'mock-v-urg-2',
              date: dateOnly(2),
              time: '15:00',
              label: 'Follow-up',
              status: 'scheduled',
            },
          ],
        },
      },
      workReport: {
        workItems: [
          {
            text: 'Reset AHU fault; replaced clogged pre-filters.',
            visitId: 'mock-v-urg-1',
          },
        ],
        partItems: [{ text: 'Pre-filter set × 2', visitId: 'mock-v-urg-1' }],
        noteItems: [{ text: 'Schedule follow-up after pressure test.', visitId: 'mock-v-urg-2' }],
      },
    },
    {
      id: 'mock-job-person-rejected',
      reference: 'JC-20990101-007',
      clientName: 'Sami Rahme',
      clientType: 'person',
      personId: 'mock-person-sami',
      siteAddress: 'Achrafieh, Beirut',
      contactName: 'Sami Rahme',
      contactPhone: '+961 70 555 666',
      missionType: 'Maintenance',
      status: 'in_progress',
      priority: 'normal',
      scheduledDate: dateOnly(-3),
      scheduledTime: '13:00',
      notes: 'Supervisor requested changes — demo rejected review.',
      reviewStatus: 'rejected',
      submittedById: ownerId,
      submittedAt: isoAt(-2, 18, 0),
      reviewedById: supId,
      reviewedByName: supName,
      reviewedAt: isoAt(-1, 10, 30),
      reviewNote: 'Add photos of meter readings and update parts list.',
      people: {
        team: [teamLead],
        missions: ['Maintenance'],
        equipment: ['Water heater'],
        schedule: {
          initialDate: dateOnly(-3),
          initialTime: '13:00',
          log: [],
          visits: [
            {
              id: 'mock-v-sami-1',
              date: dateOnly(-3),
              time: '13:00',
              label: 'Visit 1',
              status: 'done',
              arrivalTime: '12:58',
              departureTime: '15:20',
            },
          ],
        },
      },
      workReport: {
        workItems: [{ text: 'Serviced water heater; descaled tank.', visitId: 'mock-v-sami-1' }],
        partItems: [],
        noteItems: [],
      },
    },
  ];
}
