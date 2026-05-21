import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Alert, Animated, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_DEV_POSITION, getRoleDescription, getRoleLabel } from '../constants/positions';
import { colors, radius, spacing, typography } from '../constants/theme';
import { APP_DEV_LABEL } from '../lib/appwrite/auth';
import {
  memberContactEmails,
  memberContactPhones,
  memberPrimaryEmail,
  memberPrimaryPhone,
} from '../lib/contactFields';
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
  managerChain: OrgMember[];
  directReports: OrgMember[];
  accentColor: string;
  isSelf: boolean;
  onClose: () => void;
}

export function TeamMemberDetailSheet({
  visible,
  member,
  managerChain,
  directReports,
  accentColor,
  isSelf,
  onClose,
}: TeamMemberDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(480)).current;

  useEffect(() => {
    if (!visible) return;
    slideY.setValue(480);
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [visible, slideY]);

  if (!member) return null;

  const isAppDev = member.labels.includes(APP_DEV_LABEL);
  const roleLine = member.position
    ? `${member.position}${getRoleLabel(member.position) ? ` · ${getRoleLabel(member.position)}` : ''}`
    : 'No role assigned';
  const phones = memberContactPhones(member);
  const emails = memberContactEmails(member);
  const primaryPhone = memberPrimaryPhone(member);
  const primaryEmail = memberPrimaryEmail(member);
  const hasContact = phones.length > 0 || emails.length > 0;

  const openPhone = (value: string) => {
    Linking.openURL(`tel:${value}`).catch(() => {
      Alert.alert('Call', 'Unable to open the phone app.');
    });
  };

  const openEmail = (value: string) => {
    Linking.openURL(`mailto:${value}`).catch(() => {
      Alert.alert('Email', 'Unable to open the mail app.');
    });
  };

  const openSms = (value: string) => {
    Linking.openURL(`sms:${value}`).catch(() => {
      Alert.alert('Message', 'Unable to open the messaging app.');
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.md, transform: [{ translateY: slideY }] },
          ]}
        >
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
              <Text style={styles.subtitle} numberOfLines={1}>
                {shortRoleLine(member.position)}
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

            {hasContact ? (
              <View style={styles.contactSection}>
                <View style={styles.actionRow}>
                  {primaryPhone ? (
                    <Pressable
                      onPress={() => openPhone(primaryPhone)}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="call-outline" size={16} color={colors.black} />
                      <Text style={styles.actionText}>Call</Text>
                    </Pressable>
                  ) : null}
                  {primaryEmail ? (
                    <Pressable
                      onPress={() => openEmail(primaryEmail)}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="mail-outline" size={16} color={colors.black} />
                      <Text style={styles.actionText}>Email</Text>
                    </Pressable>
                  ) : null}
                  {primaryPhone ? (
                    <Pressable
                      onPress={() => openSms(primaryPhone)}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color={colors.black} />
                      <Text style={styles.actionText}>Text</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.contactCard}>
                  {phones.map((phone) => (
                    <ContactRow
                      key={`phone-${phone}`}
                      icon="call-outline"
                      label="Phone"
                      value={phone}
                      onPress={() => openPhone(phone)}
                    />
                  ))}
                  {emails.map((email) => (
                    <ContactRow
                      key={`email-${email}`}
                      icon="mail-outline"
                      label="Email"
                      value={email}
                      onPress={() => openEmail(email)}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.block}>
                <Text style={styles.blockHint}>No contact details on file.</Text>
              </View>
            )}

            <DetailBlock
              icon={roleIcon(member.position)}
              label="Role"
              value={roleLine}
              hint={member.position ? getRoleDescription(member.position) : undefined}
              accent={accentColor}
            />

            {managerChain.length > 0 ? (
              <View style={styles.block}>
                <View style={styles.blockHead}>
                  <Ionicons name="git-network-outline" size={16} color={colors.grey600} />
                  <Text style={styles.blockLabel}>Reporting line</Text>
                </View>
                <View style={styles.chainList}>
                  {[...managerChain].reverse().map((manager, index) => (
                    <View key={manager.id}>
                      {index > 0 ? (
                        <View style={styles.chainStep}>
                          <Ionicons name="arrow-down" size={12} color={colors.grey400} />
                        </View>
                      ) : null}
                      <Text style={styles.chainItem} numberOfLines={2}>
                        {manager.name || manager.email}
                        {manager.position
                          ? ` · ${manager.position}${getRoleLabel(manager.position) ? ` (${getRoleLabel(manager.position)})` : ''}`
                          : ''}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.chainStep}>
                    <Ionicons name="arrow-down" size={12} color={colors.grey400} />
                  </View>
                  <Text style={[styles.chainItem, styles.chainItemSelf]} numberOfLines={2}>
                    {member.name || member.email}
                    {member.position
                      ? ` · ${member.position}${getRoleLabel(member.position) ? ` (${getRoleLabel(member.position)})` : ''}`
                      : ''}
                    {isSelf ? ' · You' : ''}
                  </Text>
                </View>
              </View>
            ) : member.position &&
              member.position !== 'Operations Manager' &&
              member.position !== APP_DEV_POSITION ? (
              <DetailBlock icon="person-outline" label="Reports to" value="No manager assigned" />
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
        </Animated.View>
      </View>
    </Modal>
  );
}

function shortRoleLine(position: string): string {
  if (!position) return 'No role assigned';
  const label = getRoleLabel(position);
  return label ? `${position} · ${label}` : position;
}

function Tag({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: tint }]}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.contactRow, pressed && styles.pressed]}>
      <View style={styles.contactIcon}>
        <Ionicons name={icon} size={16} color={colors.black} />
      </View>
      <View style={styles.contactBody}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.grey400} />
    </Pressable>
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
    maxHeight: '82%',
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
  subtitle: { ...typography.caption, color: colors.grey600 },
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tagText: { fontSize: 10, fontWeight: '700', color: colors.black },
  contactSection: { gap: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  actionText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  contactCard: {
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey200,
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBody: { flex: 1, gap: 2 },
  contactLabel: { ...typography.label, color: colors.grey600 },
  contactValue: { ...typography.body, color: colors.black, fontWeight: '600' },
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
  reportList: { gap: 4, marginTop: spacing.xs },
  reportItem: { ...typography.caption, color: colors.black },
  chainList: { gap: 2, marginTop: spacing.xs },
  chainStep: { alignItems: 'center', paddingVertical: 2 },
  chainItem: { ...typography.caption, color: colors.black, fontWeight: '600' },
  chainItemSelf: { color: colors.grey600, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
