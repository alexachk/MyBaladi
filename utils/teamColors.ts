/** Stable accent colors for team members in calendar views. */

const PALETTE = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#DB2777',
  '#0891B2',
  '#DC2626',
  '#4F46E5',
  '#0D9488',
  '#CA8A04',
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function memberAccentColor(memberId: string, memberIds?: string[]): string {
  if (memberIds?.length) {
    const idx = memberIds.indexOf(memberId);
    if (idx >= 0) return PALETTE[idx % PALETTE.length];
  }
  return PALETTE[hashId(memberId) % PALETTE.length];
}

export function memberAccentBg(color: string, alpha = 0.14): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
