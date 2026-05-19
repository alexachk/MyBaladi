export const POSITIONS = [
  'Field Technician',
  'Senior Technician',
  'Lead Technician',
  'Apprentice',
  'Supervisor',
  'Operations Manager',
  'Dispatcher',
  'Office Staff',
  'Sales',
] as const;

export type Position = (typeof POSITIONS)[number];
