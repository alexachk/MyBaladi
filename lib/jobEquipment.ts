import { newContactKey } from './clientContact';

export interface EquipmentEntry {
  key: string;
  name: string;
}

export function defaultEquipmentEntry(name = ''): EquipmentEntry {
  return { key: newContactKey('equipment'), name };
}

export function normalizeEquipmentEntries(entries: EquipmentEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    const name = entry.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function parseEquipmentFromField(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return normalizeEquipmentEntries(
          parsed
            .filter((value): value is string => typeof value === 'string')
            .map((name) => defaultEquipmentEntry(name)),
        );
      }
    } catch {
      // fall through
    }
  }
  if (trimmed.includes(' · ')) {
    return normalizeEquipmentEntries(trimmed.split(' · ').map((name) => defaultEquipmentEntry(name)));
  }
  return normalizeEquipmentEntries([defaultEquipmentEntry(trimmed)]);
}

export function equipmentForForm(stored?: string[] | null, legacy?: string | null): EquipmentEntry[] {
  const items = stored?.length ? stored : parseEquipmentFromField(legacy ?? '');
  if (!items.length) return [defaultEquipmentEntry()];
  return items.map((name) => defaultEquipmentEntry(name));
}

export function formatEquipmentDisplay(items: string[]): string {
  return normalizeEquipmentEntries(items.map((name) => defaultEquipmentEntry(name))).join(' · ');
}

export function formatEquipmentList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

export function primaryEquipment(items: string[]): string {
  return items[0] ?? '';
}
