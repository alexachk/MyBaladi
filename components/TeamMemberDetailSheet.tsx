import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_DEV_POSITION, getRoleDescription, getRoleLabel } from '../constants/positions';
import { colors, radius, spacing, typography } from '../constants/theme';
import { APP_DEV_LABEL } from '../lib/appwrite/auth';
import type { OrgMember } from '../types/org';

function roleIcon(position: string): keyof typeof Ionicons.glyphMap {
  if (position === APP_DEV_POSITION) return 'code-slash-outline';
  if (position === 'Operations Manager') return 'business-outline';
  if (position === 'Supervisor') return 'people-circle-outline';
  if (position === 'Technician') return 'construct-outline';
  return 'help-circle-outline';
}

interface TeamMemberDetailSheetProps {
  visible: boolean;
  member: OrgMember | null;
  managerLabel: string;
  directReports: OrgMember[];
  accentColor: string;
  isSelf: boolean;
  onClose: () => void;
}

export function TeamMemberDetailSheet({
  visible,
  member,
  managerLabel,
  directReports,
  accentColor,
  isSelf,
  onClose,
}: TeamMemberDetailSheetProps) {
  const insets = useSafeAreaInsets();
  if (!member) return null;

  const isAppDev = member.labels.includes(APP_DEV_LABEL);
  const roleLine = member.position
    ? `${member.position}${getRoleLabel(member.position) ? ` · ${getRoleLabel(member.position)}` : ''}`
    : 'No role assigned';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: accentColor }]}>
              <Text style={styles.avatarText}>
                {(member.name || member.email).charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerBody}>
              <Text style={styles.title} numberOfLines={1}>
                {member.name || member.email}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {member.email}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.grey600} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.tagRow}>
              {isSelf ? <Tag label="You" tint={colors.primary} /> : null}
              {isAppDev ? <Tag label="App Dev" tint={colors.infoLight} /> : null}
            </View>

            <DetailBlock
              icon={roleIcon(member.position)}
              label="Role"
              value={roleLine}
              hint={member.position ? getRoleDescription(member.position) : undefined}
              accent={accentColor}
            />

            {managerLabel ? (
              <DetailBlock icon="person-outline" label="Reports to" value={managerLabel} />
            ) : member.position &&
              member.position !== 'Operations Manager' &&
              member.position !== APP_DEV_POSITION ? (
              <DetailBlock icon="person-outline" label="Reports to" value="No manager assigned" />
            ) : null}

            {member.contactPhones.length > 0 ? (
              <ContactListBlock
                icon="call-outline"
                label="Phone"
                values={member.contactPhones}
                onPress={(value) => Linking.openURL(`tel:${value}`)}
              />
            ) : null}

            {member.contactEmails.length > 0 ? (
              <ContactListBlock
                icon="mail-outline"
                label="Email"
                values={member.contactEmails}
                onPress={(value) => Linking.openURL(`mailto:${value}`)}
              />
            ) : null}

            {directReports.length > 0 ? (
              <View style={styles.block}>
                <View style={styles.blockHead}>
                  <Ionicons name="people-outline" size={16} color={colors.grey600} />
                  <Text style={styles.blockLabel}>
                    Direct reports · {directReports.length}
                  </Text>
                </View>
                <View style={styles.reportList}>
                  {directReports.map((r) => (
                    <Text key={r.id} style={styles.reportItem} numberOfLines={1}>
                      {r.name || r.email}
                      {r.position ? ` · ${r.position}` : ''}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Tag({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: tint }]}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function ContactListBlock({
  icon,
  label,
  values,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  values: string[];
  onPress: (value: string) => void;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Ionicons name={icon} size={16} color={colors.grey600} />
        <Text style={styles.blockLabel}>{label}</Text>
      </View>
      <View style={styles.contactList}>
        {values.map((value) => (
          <Pressable key={`${label}-${value}`} onPress={() => onPress(value)}>
            <Text style={styles.contactLink}>{value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DetailBlock({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Ionicons name={icon} size={16} color={accent ?? colors.grey600} />
        <Text style={styles.blockLabel}>{label}</Text>
      </View>
      <Text style={styles.blockValue}>{value}</Text>
      {hint ? <Text style={styles.blockHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey200,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.subheading, color: colors.white, fontSize: 18 },
  headerBody: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.subheading, color: colors.black },
  email: { ...typography.caption, color: colors.grey600 },
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tagText: { fontSize: 10, fontWeight: '700', color: colors.black },
  block: {
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockLabel: { ...typography.label, color: colors.grey600 },
  blockValue: { ...typography.body, color: colors.black, fontWeight: '600' },
  blockHint: { ...typography.caption, color: colors.grey600 },
  contactList: { gap: 6, marginTop: spacing.xs },
  contactLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
  reportList: { gap: 4, marginTop: spacing.xs },
  reportItem: { ...typography.caption, color: colors.black },
});
