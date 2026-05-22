import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TeamMemberDetailSheet } from '../../components/TeamMemberDetailSheet';
import {
  APP_DEV_POSITION,
  getRoleLabel,
} from '../../constants/positions';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { getEffectivePosition } from '../../lib/appwrite/auth';
import { parseStoredContactList } from '../../lib/contactFields';
import {
  buildOrgTree,
  buildTeamTree,
  countTreeNodes,
  expandMembersForSearch,
  flattenTree,
  getDescendantIds,
  getDirectReports,
  getManagerChainMembers,
  type TeamTreeNode,
} from '../../lib/orgHierarchy';
import { memberAccentColor } from '../../utils/teamColors';
import type { OrgMember } from '../../types/org';

type TeamScope = 'mine' | 'full';

function memberMatchesQuery(member: OrgMember, q: string, teamMembers: OrgMember[]): boolean {
  if (!q) return true;
  const manager = teamMembers.find((m) => m.id === member.managerId)?.name ?? '';
  const hay = `${member.name} ${member.email} ${member.position} ${manager}`.toLowerCase();
  return hay.includes(q);
}

function shortRole(position: string): string {
  if (!position) return 'No role';
  if (position === APP_DEV_POSITION) return APP_DEV_POSITION;
  const label = getRoleLabel(position);
  return label ? position.split(' ')[0] : position;
}

export default function TeamScreen() {
  const { width: pageWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const { teamMembers, refreshTeam } = useJobCards();
  const [scope, setScope] = useState<TeamScope>('mine');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [detailMember, setDetailMember] = useState<OrgMember | null>(null);

  const selfMember = useMemo((): OrgMember | null => {
    if (!user) return null;
    const fromTeam = teamMembers.find((m) => m.id === user.$id);
    if (fromTeam) return fromTeam;
    const prefs = user.prefs as {
      position?: string;
      managerId?: string;
      contactPhones?: unknown;
      contactEmails?: unknown;
    } | undefined;
    return {
      id: user.$id,
      name: user.name ?? '',
      email: user.email ?? '',
      labels: user.labels ?? [],
      position: getEffectivePosition(user),
      managerId: prefs?.managerId ?? '',
      contactPhones: parseStoredContactList(prefs?.contactPhones),
      contactEmails: parseStoredContactList(prefs?.contactEmails, { lowercase: true }),
    };
  }, [user, teamMembers]);

  const myTeamReports = useMemo(() => {
    if (!user) return [];
    const ids = new Set(getDescendantIds(user.$id, teamMembers));
    return teamMembers.filter((m) => ids.has(m.id));
  }, [user, teamMembers]);

  const myTeamCount = myTeamReports.length + (selfMember ? 1 : 0);
  const fullTeam = useMemo(() => teamMembers, [teamMembers]);
  const q = query.trim().toLowerCase();

  const myLeadershipChain = useMemo(() => {
    if (!selfMember) return [];
    return getManagerChainMembers(selfMember.id, teamMembers);
  }, [selfMember, teamMembers]);

  const pageData = useMemo(() => {
    const build = (pageScope: TeamScope) => {
      const pool = pageScope === 'mine' ? myTeamReports : fullTeam;
      const visible = expandMembersForSearch(pool, q, teamMembers, memberMatchesQuery);
      const tree =
        pageScope === 'mine' && user
          ? buildTeamTree(user.$id, visible)
          : buildOrgTree(visible);
      const flat = flattenTree(tree);
      const memberIds =
        pageScope === 'mine' && selfMember
          ? [selfMember.id, ...flat.map((m) => m.id)]
          : flat.map((m) => m.id);
      const emptyMine =
        pageScope === 'mine' &&
        myTeamReports.length === 0 &&
        !(selfMember && memberMatchesQuery(selfMember, q, teamMembers));
      const showMineLeadership =
        pageScope === 'mine' && Boolean(myLeadershipChain.length > 0 || selfMember);
      const emptySearch =
        !emptyMine &&
        countTreeNodes(tree) === 0 &&
        !(pageScope === 'mine' && showMineLeadership);

      return { tree, memberIds, emptyMine, emptySearch };
    };

    return { mine: build('mine'), full: build('full') };
  }, [myTeamReports, fullTeam, user, q, teamMembers, selfMember, myLeadershipChain]);

  const activeMemberIds = scope === 'mine' ? pageData.mine.memberIds : pageData.full.memberIds;

  const detailDirectReports = useMemo(
    () => (detailMember ? getDirectReports(detailMember.id, teamMembers) : []),
    [detailMember, teamMembers],
  );

  const detailManagerChain = useMemo(
    () => (detailMember ? getManagerChainMembers(detailMember.id, teamMembers) : []),
    [detailMember, teamMembers],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTeam();
    } finally {
      setRefreshing(false);
    }
  };

  const openDetail = (member: OrgMember) => setDetailMember(member);

  const goToScope = (next: TeamScope) => {
    setScope(next);
    pagerRef.current?.scrollTo({ x: next === 'mine' ? 0 : pageWidth, animated: true });
  };

  const onPagerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setScope(index === 0 ? 'mine' : 'full');
  };

  const renderScopeContent = (pageScope: TeamScope) => {
    const { tree, memberIds, emptyMine, emptySearch } = pageData[pageScope];

    if (emptyMine) {
      return (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={layout.iconLg} color={colors.grey400} />
          <Text style={styles.emptyTitle}>No direct team yet</Text>
          <Text style={styles.emptyText}>
            People who report to you will appear here. Swipe left for Organization.
          </Text>
        </View>
      );
    }

    if (emptySearch) {
      return (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={layout.iconLg} color={colors.grey400} />
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyText}>Try another name or role.</Text>
        </View>
      );
    }

    return (
      <>
        {pageScope === 'mine' && (myLeadershipChain.length > 0 || selfMember) ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Leadership chain</Text>
            <View style={styles.listCard}>
              <LeadershipChain
                managers={myLeadershipChain}
                member={selfMember}
                accentColor={
                  selfMember ? memberAccentColor(selfMember.id, memberIds) : colors.primary
                }
                onPressMember={openDetail}
              />
            </View>
          </View>
        ) : null}

        {countTreeNodes(tree) > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {pageScope === 'mine' ? 'Your team' : 'Organization'}
            </Text>
            <View style={styles.listCard}>
              <TeamTreeBranch
                nodes={tree}
                memberIds={memberIds}
                selfId={user?.$id}
                onPress={openDetail}
              />
            </View>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.screenTitle} numberOfLines={1} allowFontScaling={false}>
          Team
        </Text>

        <View style={styles.scopeRow}>
          <ScopeChip
            label={`My team · ${myTeamCount}`}
            active={scope === 'mine'}
            onPress={() => goToScope('mine')}
          />
          <ScopeChip
            label={`Organization · ${fullTeam.length}`}
            active={scope === 'full'}
            onPress={() => goToScope('full')}
          />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.grey400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, role, manager…"
            placeholderTextColor={colors.grey400}
            style={styles.searchInput}
            textAlignVertical="center"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={colors.grey400} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {(['mine', 'full'] as TeamScope[]).map((pageScope) => (
          <ScrollView
            key={pageScope}
            style={{ width: pageWidth }}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            refreshControl={
              pageScope === scope ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
              ) : undefined
            }
          >
            {renderScopeContent(pageScope)}
          </ScrollView>
        ))}
      </ScrollView>

      <TeamMemberDetailSheet
        visible={!!detailMember}
        member={detailMember}
        managerChain={detailManagerChain}
        directReports={detailDirectReports}
        accentColor={
          detailMember ? memberAccentColor(detailMember.id, activeMemberIds) : colors.primary
        }
        isSelf={detailMember?.id === user?.$id}
        onClose={() => setDetailMember(null)}
      />
    </SafeAreaView>
  );
}

function ScopeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.scopeChip, active && styles.scopeChipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LeadershipChain({
  managers,
  member,
  accentColor,
  onPressMember,
}: {
  managers: OrgMember[];
  member: OrgMember | null;
  accentColor: string;
  onPressMember: (member: OrgMember) => void;
}) {
  const topDown = [...managers].reverse();
  const chain = member ? [...topDown, member] : topDown;
  if (!chain.length) return null;

  return (
    <View style={styles.chainWrap}>
      {chain.map((link, index) => {
        const isSelf = member?.id === link.id;
        return (
          <View key={link.id}>
            {index > 0 ? (
              <View style={styles.chainConnector}>
                <View style={styles.chainLine} />
                <Ionicons name="arrow-down" size={12} color={colors.grey400} />
                <View style={styles.chainLine} />
              </View>
            ) : null}
            <Pressable
              onPress={() => onPressMember(link)}
              style={({ pressed }) => [styles.chainRow, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isSelf ? accentColor : memberAccentColor(link.id, chain.map((m) => m.id)) },
                ]}
              />
              <View style={styles.rowBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {link.name || link.email}
                  </Text>
                  {isSelf ? (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>You</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.role} numberOfLines={1}>
                  {shortRole(link.position)}
                  {getRoleLabel(link.position) ? ` · ${getRoleLabel(link.position)}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function TeamTreeBranch({
  nodes,
  memberIds,
  selfId,
  onPress,
  depth = 0,
  isLastGroup = true,
}: {
  nodes: TeamTreeNode[];
  memberIds: string[];
  selfId?: string;
  onPress: (member: OrgMember) => void;
  depth?: number;
  isLastGroup?: boolean;
}) {
  return (
    <>
      {nodes.map((node, index) => {
        const isLast = isLastGroup && index === nodes.length - 1;
        const hasChildren = node.children.length > 0;

        return (
          <View key={node.member.id}>
            <TeamMemberRow
              member={node.member}
              accentColor={memberAccentColor(node.member.id, memberIds)}
              isSelf={node.member.id === selfId}
              onPress={() => onPress(node.member)}
              isLast={isLast && !hasChildren}
              indent={depth}
            />
            {hasChildren ? (
              <View style={styles.treeChildren}>
                <TeamTreeBranch
                  nodes={node.children}
                  memberIds={memberIds}
                  selfId={selfId}
                  onPress={onPress}
                  depth={depth + 1}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function TeamMemberRow({
  member,
  accentColor,
  isSelf,
  onPress,
  isLast = true,
  indent = 0,
}: {
  member: OrgMember;
  accentColor: string;
  isSelf: boolean;
  onPress: () => void;
  isLast?: boolean;
  indent?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { paddingLeft: spacing.md + indent * 20 },
        !isLast && styles.rowBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: accentColor }]} />
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {member.name || member.email}
          </Text>
          {isSelf ? (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>You</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.role} numberOfLines={1}>
          {shortRole(member.position)}
          {getRoleLabel(member.position) ? ` · ${getRoleLabel(member.position)}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  pager: { flex: 1 },
  pageContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  screenTitle: { ...typography.screenTitle, color: colors.black },
  scopeRow: { flexDirection: 'row', gap: spacing.sm },
  scopeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  scopeChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  scopeChipText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  scopeChipTextActive: { color: colors.white },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.black,
    padding: 0,
    paddingVertical: 10,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  section: { gap: spacing.xs },
  sectionLabel: { ...typography.label, color: colors.grey600, marginLeft: spacing.xs },
  listCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.body, color: colors.black, fontWeight: '600', flexShrink: 1 },
  youBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  youBadgeText: { fontSize: 8, fontWeight: '700', color: colors.black },
  role: { ...typography.caption, color: colors.grey600, fontSize: 12 },
  treeChildren: {
    marginLeft: 26,
    borderLeftWidth: 2,
    borderLeftColor: colors.grey200,
  },
  chainWrap: { paddingVertical: spacing.xs },
  chainConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  chainLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.grey200 },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  emptyTitle: { ...typography.subheading, color: colors.black },
  emptyText: { ...typography.body, color: colors.grey600, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
