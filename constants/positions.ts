/** Three-level org roles — maps to N / N-1 / N+1 calendar access via managerId. */

import type { Ionicons } from '@expo/vector-icons';

export const APP_DEV_POSITION = 'App Dev' as const;

export const POSITIONS = ['Technician', 'Supervisor', 'Operations Manager'] as const;

export const ASSIGNABLE_POSITIONS = [...POSITIONS, APP_DEV_POSITION] as const;

export type Position = (typeof POSITIONS)[number];

export type AssignablePosition = (typeof ASSIGNABLE_POSITIONS)[number];

export type RoleLevel = 1 | 2 | 3;

export const ROLE_LEVEL: Record<Position, RoleLevel> = {
  Technician: 1,
  Supervisor: 2,
  'Operations Manager': 3,
};

export const ROLE_LABEL: Record<Position, string> = {
  Technician: 'Level 1 · Field',
  Supervisor: 'Level 2 · Team lead',
  'Operations Manager': 'Level 3 · Operations',
};

export const ROLE_DESCRIPTION: Record<Position, string> = {
  Technician: 'Own missions and schedule only.',
  Supervisor: 'Own missions + direct reports (technicians).',
  'Operations Manager': 'Own missions + supervisors and their teams.',
};

const LEVEL_ORDER: Record<RoleLevel, number> = { 1: 1, 2: 2, 3: 3 };

export function isPlatformRole(position: string): boolean {
  return position === APP_DEV_POSITION;
}

export function getRoleLevel(position: string): RoleLevel | null {
  if ((POSITIONS as readonly string[]).includes(position)) {
    return ROLE_LEVEL[position as Position];
  }
  return null;
}

/** Positions that may be selected as manager for someone at `position`. */
export function allowedManagerPositions(position: string): Position[] {
  if (isPlatformRole(position)) return [];
  const level = getRoleLevel(position);
  if (level === 1) return ['Supervisor', 'Operations Manager'];
  if (level === 2) return ['Operations Manager'];
  return [];
}

export function canHaveDirectReports(position: string): boolean {
  const level = getRoleLevel(position);
  return level === 2 || level === 3;
}

export function isValidManagerFor(position: string, managerPosition: string): boolean {
  const reportLevel = getRoleLevel(position);
  const managerLevel = getRoleLevel(managerPosition);
  if (!reportLevel || !managerLevel) return false;
  return managerLevel === reportLevel + 1 || (reportLevel === 1 && managerLevel === 3);
}

/** Prefer direct N+1; allow skip-level for small teams. */
export function managerOptionsForPosition(
  position: string,
  candidates: Array<{ id: string; name: string; email: string; position: string }>,
): Array<{ id: string; name: string; email: string; position: string }> {
  const allowed = new Set(allowedManagerPositions(position));
  return candidates.filter((c) => allowed.has(c.position as Position));
}

export function getRoleLabel(position: string): string {
  if (position === APP_DEV_POSITION) return 'Platform · Developer';
  if ((POSITIONS as readonly string[]).includes(position)) {
    return ROLE_LABEL[position as Position];
  }
  return '';
}

export function getRoleDescription(position: string): string {
  if (position === APP_DEV_POSITION) {
    return 'Full app management — accounts, schema, and all missions.';
  }
  if ((POSITIONS as readonly string[]).includes(position)) {
    return ROLE_DESCRIPTION[position as Position];
  }
  return '';
}

export function compareRoleLevel(a: string, b: string): number {
  const rank = (position: string) => {
    if (isPlatformRole(position)) return 99;
    return LEVEL_ORDER[getRoleLevel(position) ?? 1] ?? 0;
  };
  return rank(b) - rank(a);
}

export function positionPickerOptions(): Array<{
  id: AssignablePosition;
  label: AssignablePosition;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}> {
  return ASSIGNABLE_POSITIONS.map((p) => ({
    id: p,
    label: p,
    hint: getRoleLabel(p),
    icon:
      p === APP_DEV_POSITION
        ? 'code-slash-outline'
        : p === 'Operations Manager'
          ? 'business-outline'
          : p === 'Supervisor'
            ? 'people-outline'
            : 'construct-outline',
  }));
}
