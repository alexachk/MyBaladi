import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { emailListToArray, type JobRecap } from '../lib/jobRecaps';
import { formatDateTime } from '../utils/formatDate';
import { PdfPreviewModal } from './PdfPreviewModal';
import type { PdfPreviewSource } from '../lib/pdfPreview';

interface JobRecapHistoryProps {
  recaps: JobRecap[];
  canDelete?: boolean;
  deletingId?: string | null;
  onDelete?: (recap: JobRecap) => void;
}

export function JobRecapHistory({
  recaps,
  canDelete = false,
  deletingId = null,
  onDelete,
}: JobRecapHistoryProps) {
  const [pdfPreview, setPdfPreview] = useState<{
    title: string;
    source: PdfPreviewSource;
  } | null>(null);

  if (!recaps.length) return null;

  const confirmDelete = (recap: JobRecap) => {
    if (!onDelete) return;
    Alert.alert(
      'Delete recap?',
      'Remove this saved PDF from the job history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(recap) },
      ],
    );
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="archive-outline" size={18} color={colors.black} />
          <Text style={styles.title}>Recap history</Text>
          <Text style={styles.count}>{recaps.length}</Text>
        </View>

        {recaps.map((recap) => {
          const emails = emailListToArray(recap.emailedTo);
          const busy = deletingId === recap.id;
          return (
            <View key={recap.id} style={styles.row}>
              <Pressable
                onPress={() =>
                  setPdfPreview({
                    title: recap.summary || 'Recap PDF',
                    source: { kind: 'fileId', fileId: recap.fileId },
                  })
                }
                disabled={busy}
                style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
              >
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{formatDateTime(recap.createdAt)}</Text>
                  <Text style={styles.rowMeta} numberOfLines={2}>
                    {recap.summary || 'Recap PDF'}
                  </Text>
                  <Text style={styles.rowSub}>By {recap.generatedByName || 'Unknown'}</Text>
                  {recap.clientSignatureName ? (
                    <View style={styles.badgeRow}>
                      <Ionicons name="create-outline" size={12} color={colors.success} />
                      <Text style={styles.badgeText}>Signed · {recap.clientSignatureName}</Text>
                    </View>
                  ) : null}
                  {emails.length ? (
                    <View style={styles.badgeRow}>
                      <Ionicons name="mail-outline" size={12} color={colors.grey600} />
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {recap.emailedAt ? 'Emailed' : 'Prepared'} · {emails.join(', ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
              <View style={styles.rowActions}>
                <Pressable
                  onPress={() =>
                    setPdfPreview({
                      title: recap.summary || 'Recap PDF',
                      source: { kind: 'fileId', fileId: recap.fileId },
                    })
                  }
                  disabled={busy}
                  hitSlop={8}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  accessibilityLabel="View recap"
                >
                  <Ionicons name="eye-outline" size={18} color={colors.grey400} />
                </Pressable>
                {canDelete && onDelete ? (
                  <Pressable
                    onPress={() => confirmDelete(recap)}
                    disabled={busy || deletingId !== null}
                    hitSlop={8}
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    accessibilityLabel="Delete recap"
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      <PdfPreviewModal
        visible={pdfPreview !== null}
        title={pdfPreview?.title ?? 'Recap PDF'}
        source={pdfPreview?.source ?? null}
        onClose={() => setPdfPreview(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.subheading, color: colors.black, flex: 1 },
  count: {
    ...typography.caption,
    color: colors.grey600,
    fontWeight: '700',
    backgroundColor: colors.grey100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.grey100,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
  rowText: { flex: 1 },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  actionBtn: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  pressed: { opacity: 0.7 },
  rowTitle: { ...typography.body, color: colors.black, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: colors.grey600, marginTop: 2 },
  rowSub: { ...typography.caption, color: colors.grey400, marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  badgeText: { ...typography.caption, color: colors.grey600 },
});
