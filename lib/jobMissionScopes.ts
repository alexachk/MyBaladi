import { newContactKey } from './clientContact';
import {
  assigneesForForm,
  normalizeAssigneeEntries,
  type AssigneeEntry,
  type StoredJobAssignee,
} from './jobAssignees';
import {
  defaultEquipmentLineEntry,
  formatEquipmentLine,
  normalizeEquipmentLines,
  parseEquipmentLine,
  type EquipmentLineEntry,
  type StoredEquipmentLine,
} from './jobEquipment';
import { normalizeMissionTypes, formatMissionTypesDisplay, missionTypesForForm } from './jobMissions';
import type { JobCard } from '../types/jobCard';
import type { StoredJobVisit } from './jobVisits';
import { visitLinkLabel } from './jobVisitLink';

export interface StoredMissionScope {
  visitId: string | null;
  missionTypes: string[];
  equipment: StoredEquipmentLine[];
  team: StoredJobAssignee[];
}

export interface MissionScopeEntry {
  key: string;
  visitId: string | null;
  missionTypes: string[];
  equipment: EquipmentLineEntry[];
  team: AssigneeEntry[];
}

export function defaultMissionScopeEntry(visitId: string | null = null): MissionScopeEntry {
  return {
    key: newContactKey('msci'),
    visitId,
    missionTypes: [],
    equipment: [defaultEquipmentLineEntry()],
    team: assigneesForForm(undefined),
  };
}

export function parseStoredMissionScopes(raw: unknown): StoredMissionScope[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredMissionScope[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const visitId =
      typeof row.visitId === 'string' && row.visitId.trim() ? row.visitId.trim() : null;
    const missionTypes = normalizeMissionTypes(
      Array.isArray(row.missionTypes)
        ? row.missionTypes.filter((v): v is string => typeof v === 'string')
        : [],
    );
    const equipment = Array.isArray(row.equipment)
      ? normalizeEquipmentLines(
          row.equipment.map((line) => {
            if (!line || typeof line !== 'object') return defaultEquipmentLineEntry();
            const entry = line as Record<string, unknown>;
            return {
              key: newContactKey('eq'),
              name: typeof entry.name === 'string' ? entry.name : '',
              quantity:
                typeof entry.quantity === 'number' && Number.isFinite(entry.quantity)
                  ? entry.quantity
                  : null,
              quantifiable:
                typeof entry.quantity === 'number' &&
                Number.isFinite(entry.quantity) &&
                entry.quantity > 0,
            };
          }),
        )
      : [];
    const team = Array.isArray(row.team)
      ? normalizeAssigneeEntries(
          assigneesForForm(row.team as StoredJobAssignee[]),
        )
      : [];
    if (!missionTypes.length && !equipment.length && !team.length) continue;
    out.push({ visitId, missionTypes, equipment, team });
  }
  return out;
}

export function missionScopesFromJob(
  job: Pick<
    JobCard,
    'missionScopes' | 'missionTypes' | 'missionType' | 'equipmentItems' | 'equipment' | 'assignees' | 'assigneeId' | 'assigneeName'
  >,
): StoredMissionScope[] {
  if (job.missionScopes?.length) return job.missionScopes;
  const missionTypes = job.missionTypes?.length
    ? job.missionTypes
    : missionTypesForForm(job.missionType);
  const equipment = (job.equipmentItems ?? []).map((item) =>
    typeof item === 'string' ? parseEquipmentLine(item) : item,
  );
  const team =
    job.assignees?.length
      ? job.assignees
      : job.assigneeId
        ? [{ userId: job.assigneeId, name: job.assigneeName ?? '', role: 'Lead' as const }]
        : [];
  return [
    {
      visitId: null,
      missionTypes,
      equipment,
      team,
    },
  ];
}

export function missionScopesForForm(
  job: Parameters<typeof missionScopesFromJob>[0],
): MissionScopeEntry[] {
  return missionScopesFromJob(job).map((scope) => ({
    key: newContactKey('msci'),
    visitId: scope.visitId,
    missionTypes: [...scope.missionTypes],
    equipment: scope.equipment.length
      ? scope.equipment.map((line) => ({
          key: newContactKey('eq'),
          name: line.name,
          quantity: line.quantity ?? null,
          quantifiable: line.quantity != null && line.quantity > 0,
        }))
      : [defaultEquipmentLineEntry()],
    team: assigneesForForm(scope.team),
  }));
}

export function normalizeMissionScopeEntries(entries: MissionScopeEntry[]): StoredMissionScope[] {
  const out: StoredMissionScope[] = [];
  const seenVisits = new Set<string | null>();
  for (const entry of entries) {
    const missionTypes = normalizeMissionTypes(entry.missionTypes);
    const equipment = normalizeEquipmentLines(entry.equipment);
    const team = normalizeAssigneeEntries(entry.team);
    if (!missionTypes.length && !equipment.length && !team.length) continue;
    const visitKey = entry.visitId ?? null;
    if (seenVisits.has(visitKey)) continue;
    seenVisits.add(visitKey);
    out.push({
      visitId: entry.visitId,
      missionTypes,
      equipment,
      team,
    });
  }
  return out;
}

export function mergeTeamsFromScopes(scopes: StoredMissionScope[]): StoredJobAssignee[] {
  const seen = new Set<string>();
  const out: StoredJobAssignee[] = [];
  for (const scope of scopes) {
    for (const member of scope.team) {
      if (!member.userId || seen.has(member.userId)) continue;
      seen.add(member.userId);
      out.push(member);
    }
  }
  return out;
}

export function generalMissionScope(scopes: StoredMissionScope[]): StoredMissionScope | undefined {
  return scopes.find((s) => !s.visitId) ?? scopes[0];
}

/** Flat fields for legacy columns + search. */
export function legacyFieldsFromMissionScopes(scopes: StoredMissionScope[]): {
  missionTypes: string[];
  equipmentItems: StoredEquipmentLine[];
  assignees: StoredJobAssignee[];
} {
  const general = generalMissionScope(scopes);
  const missionTypes = general?.missionTypes.length
    ? general.missionTypes
    : normalizeMissionTypes(scopes.flatMap((s) => s.missionTypes));
  const equipmentItems = general?.equipment.length
    ? general.equipment
    : scopes.flatMap((s) => s.equipment);
  const assignees = mergeTeamsFromScopes(scopes);
  return { missionTypes, equipmentItems, assignees };
}

export function scopeHasContent(scope: StoredMissionScope): boolean {
  return Boolean(
    scope.missionTypes.length ||
      scope.equipment.length ||
      scope.team.length,
  );
}

export function formatScopeTitle(visits: StoredJobVisit[], visitId: string | null): string {
  return visitId ? visitLinkLabel(visits, visitId) : 'General (whole job)';
}

/** Team shown when launching a visit (visit scope → general → merged). */
export function assigneesForVisitLaunch(
  job: Parameters<typeof missionScopesFromJob>[0],
  visitId: string,
): AssigneeEntry[] {
  const scopes = missionScopesFromJob(job);
  const visitScope = scopes.find((scope) => scope.visitId === visitId);
  if (visitScope?.team.length) return assigneesForForm(visitScope.team);
  const general = scopes.find((scope) => !scope.visitId);
  if (general?.team.length) return assigneesForForm(general.team);
  const merged = mergeTeamsFromScopes(scopes);
  return merged.length ? assigneesForForm(merged) : assigneesForForm(undefined);
}

/** Save confirmed on-site team on the visit mission scope. */
export function patchVisitTeamOnMissionScopes(
  job: Parameters<typeof missionScopesFromJob>[0],
  visitId: string,
  team: StoredJobAssignee[],
): StoredMissionScope[] {
  const scopes = [...missionScopesFromJob(job)];
  const index = scopes.findIndex((scope) => scope.visitId === visitId);
  if (index >= 0) {
    const next = [...scopes];
    next[index] = { ...next[index], team };
    return next;
  }
  const general = scopes.find((scope) => !scope.visitId);
  scopes.push({
    visitId,
    missionTypes: general?.missionTypes ?? [],
    equipment: general?.equipment.length ? [...general.equipment] : [],
    team,
  });
  return scopes;
}

export function formatScopeSummary(scope: StoredMissionScope): string {
  const parts: string[] = [];
  if (scope.missionTypes.length) parts.push(formatMissionTypesDisplay(scope.missionTypes));
  if (scope.equipment.length) {
    parts.push(scope.equipment.map((line) => formatEquipmentLine(line)).join(' · '));
  }
  if (scope.team.length) {
    parts.push(scope.team.map((t) => (t.role === 'Lead' ? t.name : `${t.name} (${t.role})`)).join(', '));
  }
  return parts.join(' · ') || '—';
}
