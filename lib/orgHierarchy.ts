import type { OrgMember } from '../types/org';

/** Direct reports (N-1) for a manager. */
export function getDirectReports(managerId: string, members: OrgMember[]): OrgMember[] {
  if (!managerId) return [];
  return members.filter((m) => m.managerId === managerId);
}

/** All descendants — each N+1 level sees everyone below in the chain. */
export function getDescendantIds(managerId: string, members: OrgMember[]): string[] {
  const direct = getDirectReports(managerId, members).map((m) => m.id);
  const nested = direct.flatMap((id) => getDescendantIds(id, members));
  return [...new Set([...direct, ...nested])];
}

/** User ids whose scheduled jobs this person may view in the calendar. */
export function getVisibleUserIds(
  userId: string,
  isAdmin: boolean,
  members: OrgMember[],
): string[] | null {
  if (isAdmin) return null;
  const descendants = getDescendantIds(userId, members);
  return [...new Set([userId, ...descendants])];
}

export function getManagerChain(userId: string, members: OrgMember[]): string[] {
  const chain: string[] = [];
  let current = members.find((m) => m.id === userId);
  while (current?.managerId) {
    if (!chain.includes(current.managerId)) chain.push(current.managerId);
    current = members.find((m) => m.id === current!.managerId);
  }
  return chain;
}

export function getManagerReadersForJob(
  ownerId: string,
  assigneeId: string | null | undefined,
  members: OrgMember[],
): string[] {
  const ids = new Set<string>();
  for (const id of getManagerChain(ownerId, members)) ids.add(id);
  if (assigneeId) {
    for (const id of getManagerChain(assigneeId, members)) ids.add(id);
  }
  return [...ids];
}

export function memberName(members: OrgMember[], id: string | null | undefined): string {
  if (!id) return '';
  return members.find((m) => m.id === id)?.name ?? '';
}
