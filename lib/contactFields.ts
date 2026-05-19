export function normalizeContactPhones(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function normalizeContactEmails(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim().toLowerCase();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function contactListForForm(values: string[] | undefined): string[] {
  if (values?.length) return [...values];
  return [''];
}

export function invalidContactEmail(values: string[]): string | null {
  for (const email of normalizeContactEmails(values)) {
    if (!email.includes('@')) return email;
  }
  return null;
}

export function parseStoredContactList(
  raw: unknown,
  opts?: { lowercase?: boolean },
): string[] {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return opts?.lowercase
      ? normalizeContactEmails(raw.map(String))
      : normalizeContactPhones(raw.map(String));
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return opts?.lowercase
          ? normalizeContactEmails(parsed.map(String))
          : normalizeContactPhones(parsed.map(String));
      }
    } catch {
      return opts?.lowercase
        ? normalizeContactEmails([raw])
        : normalizeContactPhones([raw]);
    }
  }
  return [];
}

export function serializeContactList(values: string[]): string {
  return JSON.stringify(values);
}
