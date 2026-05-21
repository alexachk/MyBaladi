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

/** Login email plus optional extra contact emails, deduped. */
export function memberContactEmails(member: { email: string; contactEmails: string[] }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...member.contactEmails, member.email]) {
    const v = raw.trim().toLowerCase();
    if (!v || !v.includes('@') || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function memberContactPhones(member: { contactPhones: string[] }): string[] {
  return normalizeContactPhones(member.contactPhones);
}

export function memberPrimaryPhone(member: { contactPhones: string[] }): string | null {
  return memberContactPhones(member)[0] ?? null;
}

export function memberPrimaryEmail(member: { email: string; contactEmails: string[] }): string | null {
  return memberContactEmails(member)[0] ?? null;
}
