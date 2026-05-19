import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TeamMemberDetailSheet } from '../../components/TeamMemberDetailSheet';
import {
  APP_DEV_POSITION,
  compareRoleLevel,
  getRoleLabel,
  type Position,
} from '../../constants/positions';
import { colors, layout, radius, spacing, typography } from '../../constants/theme';
import { useAuth, useJobCards } from '../../context/JobCardsContext';
import { APP_DEV_LABEL, getEffectivePosition } from '../../lib/appwrite/auth';
import { parseStoredContactList } from '../../lib/contactFields';
import { getDescendantIds, getDirectReports, memberName } from '../../lib/orgHierarchy';
import { memberAccentColor } from '../../utils/teamColors';
import type { OrgMember } from '../../types/org';

type TeamScope = 'mine' | 'full';

const ROLE_SECTIONS: Array<{ position: Position | typeof APP_DEV_POSITION | ''; title: string }> = [
  { position: APP_DEV_POSITION, title: 'App developers' },
  { position: 'Operations Manager', title: 'Operations managers' },
  { position: 'Supervisor', title: 'Supervisors' },
  { position: 'Technician', title: 'Technicians' },
  { position: '', title: 'No role assigned' },
];

function sortMembers(members: OrgMember[]): OrgMember[] {
  return [...members].sort((a, b) => {
    const byRole = compareRoleLevel(b.position, a.position);
    if (byRole !== 0) return byRole;
    return a.name.localeCompare(b.name);
  });
}

function memberMatchesQuery(member: OrgMember, q: string, teamMembers: OrgMember[]): boolean {
  if (!q) return true;
  const manager = memberName(teamMembers, member.managerId);
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
    return sortMembers(teamMembers.filter((m) => ids.has(m.id)));
  }, [user, teamMembers]);

  const myTeamCount = myTeamReports.length + (selfMember ? 1 : 0);
  const fullTeam = useMemo(() => sortMembers(teamMembers), [teamMembers]);
  const baseList = scope === 'mine' ? myTeamReports : fullTeam.filter((m) => m.id !== user?.$id);
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return baseList;
    return baseList.filter((m) => memberMatchesQuery(m, q, teamMembers));
  }, [baseList, q, teamMembers]);

  const showSelf = useMemo(
    () => Boolean(selfMember && memberMatchesQuery(selfMember, q, teamMembers)),
    [selfMember, q, teamMembers],
  );

  const memberIds = useMemo(
    () => (selfMember ? [selfMember.id, ...baseList.map((m) => m.id)] : baseList.map((m) => m.id)),
    [selfMember, baseList],
  );

  const detailDirectReports = useMemo(
    () => (detailMember ? getDirectReports(detailMember.id, teamMembers) : []),
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle} numberOfLines={1} allowFontScaling={false}>
          Team
        </Text>

        <View style={styles.scopeRow}>
          <ScopeChip
            label={`My team · ${myTeamCount}`}
            active={scope === 'mine'}
            onPress={() => setScope('mine')}
          />
          <ScopeChip
            label={`Organization · ${fullTeam.length}`}
            active={scope === 'full'}
            onPress={() => setScope('full')}
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
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={colors.grey400} />
            </Pressable>
          ) : null}
        </View>

        {scope === 'mine' && myTeamReports.length === 0 && !showSelf ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={layout.iconLg} color={colors.grey400} />
            <Text style={styles.emptyTitle}>No direct team yet</Text>
            <Text style={styles.emptyText}>
              People who report to you will appear here. Switch to Organization to browse all staff.
            </Text>
          </View>
        ) : !showSelf && filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={layout.iconLg} color={colors.grey400} />
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>Try another name or role.</Text>
          </View>
        ) : (
          <>
            {showSelf && selfMember ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>You</Text>
                <View style={styles.listCard}>
                  <TeamMemberRow
                    member={selfMember}
                    accentColor={memberAccentColor(selfMember.id, memberIds)}
                    isSelf
                    onPress={() => openDetail(selfMember)}
                  />
                </View>
              </View>
            ) : null}

            {ROLE_SECTIONS.map((section) => {
              const sectionMembers = filtered.filter((m) => {
                if (section.position === APP_DEV_POSITION) {
                  return m.position === APP_DEV_POSITION || m.labels.includes(APP_DEV_LABEL);
                }
                if (section.position) return m.position === section.position;
                return !m.position && !m.labels.includes(APP_DEV_LABEL);
              });
              if (!sectionMembers.length) return null;

              return (
                <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionLabel}>{section.title}</Text>
                  <View style={styles.listCard}>
                    {sectionMembers.map((member, index) => (
                      <TeamMemberRow
                        key={member.id}
                        member={member}
                        accentColor={memberAccentColor(member.id, memberIds)}
                        isSelf={member.id === user?.$id}
                        onPress={() => openDetail(member)}
                        isLast={index === sectionMembers.length - 1}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <TeamMemberDetailSheet
        visible={!!detailMember}
        member={detailMember}
        managerLabel={detailMember ? memberName(teamMembers, detailMember.managerId) : ''}
        directReports={detailDirectReports}
        accentColor={
          detailMember ? memberAccentColor(detailMember.id, memberIds) : colors.primary
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

function TeamMemberRow({
  member,
  accentColor,
  isSelf,
  onPress,
  isLast = true,
}: {
  member: OrgMember;
  accentColor: string;
  isSelf: boolean;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
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
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
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
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.black, padding: 0 },
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
