import { MISSION_TYPES } from '../types/jobCard';

const MISSION_SET = new Set<string>(MISSION_TYPES);

export function normalizeMissionTypes(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || !MISSION_SET.has(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function parseMissionTypesFromField(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeMissionTypes(parsed.filter((v): v is string => typeof v === 'string'));
      }
    } catch {
      // fall through
    }
  }
  if (trimmed.includes(' · ')) {
    return normalizeMissionTypes(trimmed.split(' · '));
  }
  return normalizeMissionTypes([trimmed]);
}

export function missionTypesForForm(raw?: string | null, fallback?: string | null): string[] {
  const fromRaw = parseMissionTypesFromField(raw ?? '');
  if (fromRaw.length) return fromRaw;
  const fromFallback = parseMissionTypesFromField(fallback ?? '');
  if (fromFallback.length) return fromFallback;
  return [MISSION_TYPES[0]];
}

export function formatMissionTypesDisplay(values: string[]): string {
  return normalizeMissionTypes(values).join(' · ');
}

export function primaryMissionType(values: string[]): string {
  return normalizeMissionTypes(values)[0] ?? '';
}
