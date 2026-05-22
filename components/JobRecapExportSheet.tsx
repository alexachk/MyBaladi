import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from './PrimaryButton';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  defaultJobRecapExportOptions,
  type JobRecapExportOptions,
} from '../lib/jobRecapExport';
import { formatVisitWhen, normalizeVisitsList, sortVisitsTimeline } from '../lib/jobVisits';
import type { JobCard } from '../types/jobCard';

interface JobRecapExportSheetProps {
  visible: boolean;
  job: JobCard | null;
  exporting?: boolean;
  onClose: () => void;
  onExport: (options: JobRecapExportOptions) => void;
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
  exporting = false,
  onClose,
  onExport,
}: JobRecapExportSheetProps) {
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useState<JobRecapExportOptions | null>(null);

  useEffect(() => {
    if (visible && job) {
      setOptions(defaultJobRecapExportOptions(job));
    }
  }, [visible, job?.id]);

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Export PDF recap</Text>
              <Text style={styles.subtitle}>{job.reference} · choose sections & visits</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
              <Ionicons name="close" size={22} color={colors.grey600} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              label="Signatures"
              value={resolvedOptions.includeSignatures}
              onChange={(includeSignatures) => patch({ includeSignatures })}
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
          </ScrollView>

          <PrimaryButton
            label={exporting ? 'Generating…' : 'Generate PDF'}
            icon="document-text-outline"
            onPress={() => onExport(resolvedOptions)}
            disabled={exporting}
          />
        </View>
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
});
