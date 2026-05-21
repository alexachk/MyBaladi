import { compareRoleLevel } from '../constants/positions';
import type { OrgMember } from '../types/org';

export type TeamTreeNode = {
  member: OrgMember;
  children: TeamTreeNode[];
};

function sortMembers(members: OrgMember[]): OrgMember[] {
  return [...members].sort((a, b) => {
    const byRole = compareRoleLevel(b.position, a.position);
    if (byRole !== 0) return byRole;
    return a.name.localeCompare(b.name);
  });
}

/** Nested tree of direct and indirect reports for a manager. */
export function buildTeamTree(rootId: string, members: OrgMember[]): TeamTreeNode[] {
  return sortMembers(getDirectReports(rootId, members)).map((member) => ({
    member,
    children: buildTeamTree(member.id, members),
  }));
}

/** Top-level org branches (roots without a manager in the set). */
export function buildOrgTree(members: OrgMember[]): TeamTreeNode[] {
  const ids = new Set(members.map((m) => m.id));
  const roots = sortMembers(members.filter((m) => !m.managerId || !ids.has(m.managerId)));
  return roots.map((member) => ({
    member,
    children: buildTeamTree(member.id, members),
  }));
}

/** Keep matches plus their managers and reports so nested context stays visible. */
export function expandMembersForSearch(
  members: OrgMember[],
  query: string,
  allMembers: OrgMember[],
  matchesQuery: (member: OrgMember, q: string, all: OrgMember[]) => boolean,
): OrgMember[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;

  const byId = new Map(allMembers.map((m) => [m.id, m]));
  const poolIds = new Set(members.map((m) => m.id));
  const visible = new Set<string>();

  for (const member of members) {
    if (!matchesQuery(member, q, allMembers)) continue;
    visible.add(member.id);

    let current: OrgMember | undefined = member;
    while (current?.managerId && poolIds.has(current.managerId)) {
      visible.add(current.managerId);
      current = byId.get(current.managerId);
    }

    for (const id of getDescendantIds(member.id, members)) {
      visible.add(id);
    }
  }

  return members.filter((m) => visible.has(m.id));
}

export function flattenTree(nodes: TeamTreeNode[]): OrgMember[] {
  const out: OrgMember[] = [];
  for (const node of nodes) {
    out.push(node.member, ...flattenTree(node.children));
  }
  return out;
}

export function countTreeNodes(nodes: TeamTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countTreeNodes(node.children), 0);
}

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

/** Managers from direct N+1 up to the top of the org. */
export function getManagerChainMembers(userId: string, members: OrgMember[]): OrgMember[] {
  const chain: OrgMember[] = [];
  let current = members.find((m) => m.id === userId);
  while (current?.managerId) {
    const manager = members.find((m) => m.id === current!.managerId);
    if (!manager || chain.some((m) => m.id === manager.id)) break;
    chain.push(manager);
    current = manager;
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
