import { newContactKey } from './clientContact';
import { APP_DEV_LABEL } from './appwrite/auth';
import { isPlatformRole } from '../constants/positions';
import type { Personnel } from './appwrite/adminUsers';

export type AssigneeRole = 'Lead' | 'Support' | 'Supervisor' | 'Other';

export interface StoredJobAssignee {
  userId: string;
  name: string;
  role: AssigneeRole;
}

export interface AssigneeEntry extends StoredJobAssignee {
  key: string;
}

export const ASSIGNEE_ROLES: AssigneeRole[] = ['Lead', 'Support', 'Supervisor', 'Other'];

export function isJobAssignablePersonnel(person: Pick<Personnel, 'position' | 'labels'>): boolean {
  return !isPlatformRole(person.position) && !person.labels.includes(APP_DEV_LABEL);
}

/** Job-card roles are labels only — not tied to org level / managerId. */
export function personnelMatchesAssigneeRole(
  position: string,
  labels: string[],
  _role?: AssigneeRole,
): boolean {
  return isJobAssignablePersonnel({ position, labels });
}

export function filterPersonnelForAssigneeRole(
  personnel: Personnel[],
  _role?: AssigneeRole,
): Personnel[] {
  return personnel.filter(isJobAssignablePersonnel);
}

export function assigneeRolePickerTitle(role: AssigneeRole): string {
  switch (role) {
    case 'Lead':
      return 'Pick lead';
    case 'Support':
      return 'Pick support';
    case 'Supervisor':
      return 'Pick supervisor';
    case 'Other':
    default:
      return 'Pick team member';
  }
}

export function assigneeRolePickerEmptyLabel(_role?: AssigneeRole): string {
  return 'No personnel found. Create field accounts in Admin.';
}

export function assigneeRolePickHint(role: AssigneeRole): string {
  switch (role) {
    case 'Lead':
      return 'Tap to pick a lead';
    case 'Support':
      return 'Tap to pick support';
    case 'Supervisor':
      return 'Tap to pick a supervisor';
    case 'Other':
    default:
      return 'Tap to pick a team member';
  }
}

export function defaultAssigneeEntry(
  userId = '',
  name = '',
  role: AssigneeRole = 'Lead',
): AssigneeEntry {
  return {
    key: newContactKey('assignee'),
    userId,
    name,
    role,
  };
}

export function normalizeAssigneeEntries(entries: AssigneeEntry[]): StoredJobAssignee[] {
  const seen = new Set<string>();
  const out: StoredJobAssignee[] = [];
  for (const entry of entries) {
    const userId = entry.userId.trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    out.push({
      userId,
      name: entry.name.trim() || userId,
      role: entry.role,
    });
  }
  return out;
}

export function serializeAssignees(entries: AssigneeEntry[]): string {
  return JSON.stringify(normalizeAssigneeEntries(entries));
}

export function parseStoredAssignees(raw: unknown): StoredJobAssignee[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return parseStoredAssignees(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const userId = typeof row.userId === 'string' ? row.userId.trim() : '';
        if (!userId) return null;
        const role = ASSIGNEE_ROLES.includes(row.role as AssigneeRole)
          ? (row.role as AssigneeRole)
          : 'Lead';
        return {
          userId,
          name: typeof row.name === 'string' ? row.name.trim() : userId,
          role,
        };
      })
      .filter(Boolean) as StoredJobAssignee[];
  }
  return [];
}

export function assigneesForForm(
  stored: StoredJobAssignee[] | undefined,
  fallbackUserId?: string | null,
  fallbackName?: string | null,
): AssigneeEntry[] {
  const list = stored?.length ? stored : [];
  if (list.length) {
    return list.map((entry) => ({
      key: newContactKey('assignee'),
      userId: entry.userId,
      name: entry.name,
      role: entry.role,
    }));
  }
  if (fallbackUserId?.trim()) {
    return [defaultAssigneeEntry(fallbackUserId, fallbackName?.trim() ?? '', 'Lead')];
  }
  return [defaultAssigneeEntry()];
}

export function primaryAssigneeFromEntries(
  entries: StoredJobAssignee[],
): { userId: string; name: string } {
  const lead = entries.find((e) => e.role === 'Lead' && e.userId);
  const first = lead ?? entries.find((e) => e.userId);
  if (!first) return { userId: '', name: '' };
  return { userId: first.userId, name: first.name };
}

export function formatAssigneesDisplay(entries: StoredJobAssignee[]): string {
  if (!entries.length) return '';
  return entries.map((e) => (e.role === 'Lead' ? e.name : `${e.name} (${e.role})`)).join(', ');
}
