import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_DEV_POSITION, getRoleDescription, getRoleLabel } from '../constants/positions';
import { colors, radius, spacing, typography } from '../constants/theme';
import { APP_DEV_LABEL } from '../lib/appwrite/auth';
import { promptEmailActions, promptPhoneActions } from '../lib/contactActions';
import { memberContactEmails, memberContactPhones } from '../lib/contactFields';
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
  const scrollY = useRef(0);
  const closing = useRef(false);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slideY, {
      toValue: 480,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      closing.current = false;
      if (finished) onClose();
    });
  }, [onClose, slideY]);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    scrollY.current = 0;
    slideY.setValue(480);
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [visible, slideY, member?.id]);

  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          slideY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          slideY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldClose = gesture.dy > 80 || gesture.vy > 0.65;
          if (shouldClose) {
            handleClose();
            return;
          }
          Animated.spring(slideY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 220,
          }).start();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [handleClose, slideY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) => {
          const downward = gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
          return scrollY.current <= 0 && downward;
        },
        onMoveShouldSetPanResponder: (_, gesture) => {
          const downward = gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
          return scrollY.current <= 0 && downward;
        },
        onPanResponderGrant: () => {
          slideY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          slideY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldClose = gesture.dy > 100 || gesture.vy > 0.65;
          if (shouldClose) {
            handleClose();
            return;
          }
          Animated.spring(slideY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 220,
          }).start();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [handleClose, slideY],
  );

  if (!member) return null;

  const isAppDev = member.labels.includes(APP_DEV_LABEL);
  const roleLine = member.position
    ? `${member.position}${getRoleLabel(member.position) ? ` · ${getRoleLabel(member.position)}` : ''}`
    : 'No role assigned';
  const phones = memberContactPhones(member);
  const emails = memberContactEmails(member);
  const hasContact = phones.length > 0 || emails.length > 0;
  const contactRows = [
    ...phones.map((phone) => ({
      key: `phone-${phone}`,
      icon: 'call-outline' as const,
      label: 'Phone',
      value: phone,
      onPress: () => promptPhoneActions(phone),
    })),
    ...emails.map((email) => ({
      key: `email-${email}`,
      icon: 'mail-outline' as const,
      label: 'Email',
      value: email,
      onPress: () => promptEmailActions(email),
    })),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.md, transform: [{ translateY: slideY }] },
          ]}
        >
          <View {...headerPanResponder.panHandlers}>
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
              <Pressable onPress={handleClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.grey600} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
          >
            <View style={styles.tagRow}>
              {isSelf ? <Tag label="You" tint={colors.primary} /> : null}
              {isAppDev ? <Tag label="App Dev" tint={colors.infoLight} /> : null}
            </View>

            {hasContact ? (
              <View style={styles.contactCard}>
                {contactRows.map((row, index) => (
                  <ContactRow
                    key={row.key}
                    icon={row.icon}
                    label={row.label}
                    value={row.value}
                    onPress={row.onPress}
                    isLast={index === contactRows.length - 1}
                  />
                ))}
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
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactRow,
        !isLast && styles.contactRowBorder,
        pressed && styles.pressed,
      ]}
    >
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
    marginTop: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, paddingBottom: spacing.xs },
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
  },
  contactRowBorder: {
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
