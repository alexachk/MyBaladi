import { newContactKey } from './clientContact';

export type WebsiteLabel = 'Main' | 'Shop' | 'Support' | 'Other';

export interface StoredWebsite {
  url: string;
  label: WebsiteLabel;
}

export interface WebsiteEntry extends StoredWebsite {
  key: string;
}

export const WEBSITE_LABELS: WebsiteLabel[] = ['Main', 'Shop', 'Support', 'Other'];

export function defaultWebsiteEntry(): WebsiteEntry {
  return {
    key: newContactKey('website'),
    url: '',
    label: 'Main',
  };
}

export function formatWebsiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function normalizeWebsiteEntries(entries: WebsiteEntry[]): StoredWebsite[] {
  const seen = new Set<string>();
  const out: StoredWebsite[] = [];

  for (const entry of entries) {
    const url = entry.url.trim();
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url,
      label: entry.label || 'Main',
    });
  }

  return out;
}

export function serializeWebsiteEntries(entries: StoredWebsite[]): string {
  return JSON.stringify(entries);
}

export function parseStoredWebsiteEntries(raw: unknown, legacyWebsite?: string): StoredWebsite[] {
  if (raw == null || raw === '') {
    const legacy = legacyWebsite?.trim();
    return legacy ? [{ url: legacy, label: 'Main' }] : [];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') {
              const url = item.trim();
              return url ? { url, label: 'Main' as WebsiteLabel } : null;
            }
            if (item && typeof item === 'object') {
              const url = String(item.url ?? item.website ?? '').trim();
              if (!url) return null;
              const label = (item.label as WebsiteLabel) || 'Main';
              return { url, label };
            }
            return null;
          })
          .filter(Boolean) as StoredWebsite[];
      }
    } catch {
      const text = raw.trim();
      return text ? [{ url: text, label: 'Main' }] : [];
    }
  }

  if (Array.isArray(raw)) {
    return parseStoredWebsiteEntries(JSON.stringify(raw), legacyWebsite);
  }

  const legacy = legacyWebsite?.trim();
  return legacy ? [{ url: legacy, label: 'Main' }] : [];
}

export function websiteEntriesForForm(
  stored: StoredWebsite[] | undefined,
  legacyWebsite?: string,
): WebsiteEntry[] {
  const list = stored?.length ? stored : parseStoredWebsiteEntries('', legacyWebsite);
  if (!list.length) return [defaultWebsiteEntry()];
  return list.map((entry) => ({
    key: newContactKey('website'),
    url: entry.url,
    label: entry.label || 'Main',
  }));
}

export function primaryWebsiteFromEntries(entries: StoredWebsite[], legacyWebsite?: string): string {
  const first = normalizeWebsiteEntries(
    entries.map((entry, index) => ({ key: `w-${index}`, ...entry })),
  )[0];
  if (first) return first.url;
  return legacyWebsite?.trim() ?? '';
}

export function prepareClientWebsitesPayload(entries: WebsiteEntry[]) {
  const contactWebsites = normalizeWebsiteEntries(entries);
  return {
    website: primaryWebsiteFromEntries(contactWebsites),
    contactWebsites,
  };
}
