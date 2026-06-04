import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  defaultJobRecapExportOptions,
  RECAP_DOCUMENT_TYPE_META,
  type JobRecapExportOptions,
  type RecapDocumentType,
} from '../lib/jobRecapExport';
import { formatVisitWhen, normalizeVisitsList, sortVisitsTimeline } from '../lib/jobVisits';
import type { JobCard } from '../types/jobCard';

export type RecapDeliveryMode = 'preview' | 'email' | 'share' | 'save';

interface JobRecapExportSheetProps {
  visible: boolean;
  job: JobCard | null;
  /** The action currently running, if any */
  busyMode?: RecapDeliveryMode | null;
  defaultRecipients?: string[];
  onClose: () => void;
  onDeliver: (mode: RecapDeliveryMode, options: JobRecapExportOptions, recipients: string[]) => void;
}

function SectionToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
    >
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={20}
        color={value ? colors.primary : colors.grey400}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

function RecapActionIcon({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  busy,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  accent?: 'primary' | 'default';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.actionIconBtn,
        accent === 'primary' && styles.actionIconBtnPrimary,
        (disabled || busy) && styles.actionIconBtnDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={accent === 'primary' ? colors.black : colors.grey600} />
      ) : (
        <Ionicons name={icon} size={22} color={colors.black} />
      )}
    </Pressable>
  );
}

function ChipSelect({
  label,
  items,
  selectedIds,
  onChange,
}: {
  label: string;
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!items.length) return null;

  const allSelected = selectedIds.length === 0 || selectedIds.length === items.length;

  const toggle = (id: string) => {
    if (selectedIds.length === 0) {
      onChange(items.map((item) => item.id).filter((itemId) => itemId !== id));
      return;
    }
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((itemId) => itemId !== id);
      onChange(next.length === items.length ? [] : next);
      return;
    }
    const next = [...selectedIds, id];
    onChange(next.length === items.length ? [] : next);
  };

  return (
    <View style={styles.chipBlock}>
      <View style={styles.chipHead}>
        <Text style={styles.chipTitle}>{label}</Text>
        <Pressable
          onPress={() => onChange(allSelected ? items.map((item) => item.id) : [])}
          hitSlop={8}
        >
          <Text style={styles.chipAction}>{allSelected ? 'All' : 'Select all'}</Text>
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        {items.map((item) => {
          const selected = allSelected || selectedIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggle(item.id)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function JobRecapExportSheet({
  visible,
  job,
  busyMode = null,
  defaultRecipients = [],
  onClose,
  onDeliver,
}: JobRecapExportSheetProps) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(480)).current;
  const scrollY = useRef(0);
  const closing = useRef(false);
  const [options, setOptions] = useState<JobRecapExportOptions | null>(null);
  const [recipients, setRecipients] = useState('');

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
  }, [visible, slideY]);

  useEffect(() => {
    if (visible && job) {
      setOptions(defaultJobRecapExportOptions(job));
      setRecipients(defaultRecipients.join(', '));
    }
  }, [visible, job?.id]);

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

  const busy = busyMode !== null;
  const recipientList = recipients
    .split(/[,;\n]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const resolvedOptions = options ?? (job ? defaultJobRecapExportOptions(job) : null);

  const visits = useMemo(
    () => sortVisitsTimeline(normalizeVisitsList(job?.visits ?? [])),
    [job?.visits],
  );

  const visitItems = useMemo(
    () =>
      visits.map((visit, index) => ({
        id: visit.id,
        label: visit.label ? `${visit.label} · ${formatVisitWhen(visit)}` : `Visit ${index + 1} · ${formatVisitWhen(visit)}`,
      })),
    [visits],
  );

  const photoItems = useMemo(
    () =>
      (job?.photoIds ?? []).map((id, index) => ({
        id,
        label: `Photo ${index + 1}`,
      })),
    [job?.photoIds],
  );

  const documentItems = useMemo(
    () =>
      (job?.documentIds ?? []).map((id, index) => ({
        id,
        label: `Document ${index + 1}`,
      })),
    [job?.documentIds],
  );

  if (!job || !resolvedOptions) return null;

  const patch = (patchOptions: Partial<JobRecapExportOptions>) => {
    setOptions((prev) => ({ ...(prev ?? resolvedOptions), ...patchOptions }));
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          <View {...headerPanResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Export PDF recap</Text>
                <Text style={styles.subtitle}>{job.reference} · choose sections & visits</Text>
              </View>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close" size={22} color={colors.grey600} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
          >
            <Text style={styles.groupTitle}>Document type</Text>
            <View style={styles.segment}>
              {(['draft', 'final'] as RecapDocumentType[]).map((type) => {
                const active = resolvedOptions.documentType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => patch({ documentType: type })}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Ionicons
                      name={type === 'final' ? 'shield-checkmark' : 'document-text-outline'}
                      size={16}
                      color={active ? colors.black : colors.grey600}
                    />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {RECAP_DOCUMENT_TYPE_META[type].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.recipientHint}>
              {RECAP_DOCUMENT_TYPE_META[resolvedOptions.documentType].description}
            </Text>

            <Text style={styles.groupTitle}>Sections</Text>
            <SectionToggle
              label="Client & site"
              value={resolvedOptions.includeClient}
              onChange={(includeClient) => patch({ includeClient })}
            />
            <SectionToggle
              label="Site contacts"
              hint="General + visit-linked contacts"
              value={resolvedOptions.includeContacts}
              onChange={(includeContacts) => patch({ includeContacts })}
            />
            <SectionToggle
              label="Mission & team"
              value={resolvedOptions.includeMission}
              onChange={(includeMission) => patch({ includeMission })}
            />
            <SectionToggle
              label="Visit timeline"
              value={resolvedOptions.includeVisits}
              onChange={(includeVisits) => patch({ includeVisits })}
            />
            <SectionToggle
              label="Work report"
              value={resolvedOptions.includeWorkReport}
              onChange={(includeWorkReport) => patch({ includeWorkReport })}
            />
            <SectionToggle
              label="Schedule history"
              value={resolvedOptions.includeScheduleHistory}
              onChange={(includeScheduleHistory) => patch({ includeScheduleHistory })}
            />
            <SectionToggle
              label="Comments"
              value={resolvedOptions.includeComments}
              onChange={(includeComments) => patch({ includeComments })}
            />
            <SectionToggle
              label="Photos"
              value={resolvedOptions.includePhotos}
              onChange={(includePhotos) => patch({ includePhotos })}
            />
            <SectionToggle
              label="Documents"
              value={resolvedOptions.includeDocuments}
              onChange={(includeDocuments) => patch({ includeDocuments })}
            />

            <Text style={styles.groupTitle}>Scope</Text>
            <SectionToggle
              label="Include general items"
              hint="Work report & contacts not linked to a visit"
              value={resolvedOptions.includeGeneral}
              onChange={(includeGeneral) => patch({ includeGeneral })}
            />

            {resolvedOptions.includeVisits && visitItems.length ? (
              <ChipSelect
                label="Visits"
                items={visitItems}
                selectedIds={resolvedOptions.visitIds}
                onChange={(visitIds) => patch({ visitIds })}
              />
            ) : null}

            {resolvedOptions.includePhotos && photoItems.length ? (
              <ChipSelect
                label="Photos"
                items={photoItems}
                selectedIds={resolvedOptions.photoIds}
                onChange={(photoIds) => patch({ photoIds })}
              />
            ) : null}

            {resolvedOptions.includeDocuments && documentItems.length ? (
              <ChipSelect
                label="Documents"
                items={documentItems}
                selectedIds={resolvedOptions.documentIds}
                onChange={(documentIds) => patch({ documentIds })}
              />
            ) : null}

            <Text style={styles.groupTitle}>Send by email</Text>
            <TextInput
              style={styles.recipientInput}
              value={recipients}
              onChangeText={setRecipients}
              placeholder="client@email.com, …"
              placeholderTextColor={colors.grey400}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              multiline
            />
            <Text style={styles.recipientHint}>
              Pre-fills a professional email with the PDF attached. You can edit recipients in your mail app.
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <RecapActionIcon
              icon="eye-outline"
              accessibilityLabel="Preview PDF"
              onPress={() => onDeliver('preview', resolvedOptions, recipientList)}
              disabled={busy}
              busy={busyMode === 'preview'}
            />
            <RecapActionIcon
              icon="share-outline"
              accessibilityLabel="Share PDF"
              onPress={() => onDeliver('share', resolvedOptions, recipientList)}
              disabled={busy}
              busy={busyMode === 'share'}
            />
            <RecapActionIcon
              icon="save-outline"
              accessibilityLabel="Save PDF"
              onPress={() => onDeliver('save', resolvedOptions, recipientList)}
              disabled={busy}
              busy={busyMode === 'save'}
            />
            <RecapActionIcon
              icon="mail-outline"
              accessibilityLabel="Send by email"
              onPress={() => onDeliver('email', resolvedOptions, recipientList)}
              disabled={busy}
              busy={busyMode === 'email'}
              accent="primary"
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey200,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: { ...typography.screenTitle, color: colors.black, fontSize: 20 },
  subtitle: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  content: { paddingBottom: spacing.md, gap: 2 },
  groupTitle: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: colors.black, fontWeight: '600' },
  toggleHint: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  segmentText: { ...typography.caption, color: colors.grey600, fontWeight: '700' },
  segmentTextActive: { color: colors.black },
  chipBlock: { marginTop: spacing.sm, marginBottom: spacing.xs },
  chipHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chipTitle: { ...typography.label, color: colors.grey600 },
  chipAction: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  chipTextSelected: { color: colors.black },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  recipientInput: {
    ...typography.body,
    color: colors.black,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.grey100,
  },
  recipientHint: { ...typography.caption, color: colors.grey600, marginTop: spacing.xs, marginBottom: spacing.sm },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionIconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  actionIconBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionIconBtnDisabled: { opacity: 0.45 },
});
