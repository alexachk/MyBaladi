import { newContactKey } from './clientContact';

export interface StoredEquipmentLine {
  name: string;
  quantity?: number | null;
}

export interface EquipmentLineEntry {
  key: string;
  name: string;
  quantity: number | null;
  quantifiable: boolean;
}

export interface EquipmentEntry {
  key: string;
  name: string;
}

export function defaultEquipmentLineEntry(name = ''): EquipmentLineEntry {
  return { key: newContactKey('equipment'), name, quantity: null, quantifiable: false };
}

const QTY_SUFFIX_RE = /\s+x(\d+(?:\.\d+)?)\s*$/i;
const QTY_PAREN_RE = /\s*\(qty\s*[:.]?\s*(\d+(?:\.\d+)?)\)\s*$/i;

export function parseEquipmentLine(raw: string): StoredEquipmentLine {
  const trimmed = raw.trim();
  if (!trimmed) return { name: '' };
  let name = trimmed;
  let quantity: number | null = null;
  const paren = trimmed.match(QTY_PAREN_RE);
  if (paren) {
    quantity = Number(paren[1]);
    name = trimmed.replace(QTY_PAREN_RE, '').trim();
  } else {
    const suffix = trimmed.match(QTY_SUFFIX_RE);
    if (suffix) {
      quantity = Number(suffix[1]);
      name = trimmed.replace(QTY_SUFFIX_RE, '').trim();
    }
  }
  return {
    name,
    quantity: quantity != null && Number.isFinite(quantity) && quantity > 0 ? quantity : null,
  };
}

export function formatEquipmentLine(line: StoredEquipmentLine): string {
  const name = line.name.trim();
  if (!name) return '';
  if (line.quantity != null && line.quantity > 0) return `${name} x${line.quantity}`;
  return name;
}

export function normalizeEquipmentLines(entries: EquipmentLineEntry[]): StoredEquipmentLine[] {
  const seen = new Set<string>();
  const out: StoredEquipmentLine[] = [];
  for (const entry of entries) {
    const name = entry.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const quantity =
      entry.quantifiable && entry.quantity != null && entry.quantity > 0 ? entry.quantity : null;
    out.push({ name, quantity });
  }
  return out;
}

export function equipmentLinesForForm(
  stored?: StoredEquipmentLine[] | string[] | null,
  legacy?: string | null,
): EquipmentLineEntry[] {
  let lines: StoredEquipmentLine[] = [];
  if (stored?.length) {
    lines = stored.map((item) =>
      typeof item === 'string' ? parseEquipmentLine(item) : item,
    );
  } else if (legacy) {
    lines = parseEquipmentFromField(legacy).map((name) => parseEquipmentLine(name));
  }
  if (!lines.length) return [defaultEquipmentLineEntry()];
  return lines.map((line) => ({
    key: newContactKey('equipment'),
    name: line.name,
    quantity: line.quantity ?? null,
    quantifiable: line.quantity != null && line.quantity > 0,
  }));
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

export function formatEquipmentDisplay(
  items: string[] | StoredEquipmentLine[],
): string {
  if (!items.length) return '';
  if (typeof items[0] === 'string') {
    return normalizeEquipmentEntries(
      (items as string[]).map((name) => defaultEquipmentEntry(name)),
    ).join(' · ');
  }
  return (items as StoredEquipmentLine[])
    .map((line) => formatEquipmentLine(line))
    .filter(Boolean)
    .join(' · ');
}

export function formatEquipmentList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

export function primaryEquipment(items: string[]): string {
  return items[0] ?? '';
}
