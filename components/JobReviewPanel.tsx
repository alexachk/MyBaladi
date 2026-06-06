import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { PrimaryButton } from './PrimaryButton';
import { canSubmitForReview, reviewBadge } from '../lib/jobReview';
import { formatDateTime } from '../utils/formatDate';
import type { JobCard } from '../types/jobCard';

interface JobReviewPanelProps {
  job: JobCard;
  canReview: boolean;
  canEdit: boolean;
  busy: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: (note: string) => void;
  onBypass: () => void;
}

const TONE_COLORS = {
  pending: { bg: colors.warningLight, fg: colors.warning },
  approved: { bg: colors.successLight, fg: colors.success },
  rejected: { bg: colors.errorLight, fg: colors.error },
  none: { bg: colors.grey100, fg: colors.grey600 },
} as const;

export function JobReviewPanel({
  job,
  canReview,
  canEdit,
  busy,
  onSubmit,
  onApprove,
  onReject,
  onBypass,
}: JobReviewPanelProps) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const badge = reviewBadge(job);
  const submitted = job.reviewStatus === 'submitted';
  const showSubmit = canSubmitForReview(job) && canEdit && !submitted;

  // Nothing actionable and no status to show — hide entirely.
  if (!badge && !showSubmit && !(submitted && canReview)) return null;

  const tone = TONE_COLORS[badge?.tone ?? 'none'];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.black} />
        <Text style={styles.title}>Validation</Text>
      </View>

      {badge ? (
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.fg }]}>{badge.label}</Text>
        </View>
      ) : null}

      {job.reviewStatus === 'rejected' && job.reviewNote ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Supervisor note</Text>
          <Text style={styles.noteText}>{job.reviewNote}</Text>
        </View>
      ) : null}

      {(job.reviewStatus === 'approved' || job.reviewStatus === 'rejected') && job.reviewedByName ? (
        <Text style={styles.meta}>
          {job.reviewStatus === 'approved' ? 'Approved' : 'Reviewed'} by {job.reviewedByName}
          {job.reviewedAt ? ` · ${formatDateTime(job.reviewedAt)}` : ''}
        </Text>
      ) : null}

      {submitted && job.submittedAt ? (
        <Text style={styles.meta}>Submitted {formatDateTime(job.submittedAt)}</Text>
      ) : null}

      {showSubmit ? (
        <PrimaryButton
          label="Submit for review"
          icon="paper-plane-outline"
          variant="secondary"
          onPress={onSubmit}
          disabled={busy}
        />
      ) : null}

      {submitted && canReview ? (
        rejecting ? (
          <View style={styles.rejectForm}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="What needs to change?"
              placeholderTextColor={colors.grey400}
              multiline
            />
            <View style={styles.row}>
              <PrimaryButton
                label="Cancel"
                variant="ghost"
                fill
                onPress={() => {
                  setRejecting(false);
                  setNote('');
                }}
                disabled={busy}
              />
              <PrimaryButton
                label="Send back"
                icon="arrow-undo-outline"
                fill
                onPress={() => {
                  onReject(note);
                  setRejecting(false);
                  setNote('');
                }}
                disabled={busy}
              />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <PrimaryButton
              label="Request changes"
              icon="arrow-undo-outline"
              variant="secondary"
              fill
              onPress={() => setRejecting(true)}
              disabled={busy}
            />
            <PrimaryButton
              label="Approve & complete"
              icon="checkmark-circle-outline"
              fill
              onPress={onApprove}
              disabled={busy}
            />
          </View>
        )
      ) : null}

      {showSubmit ? (
        <Pressable onPress={onBypass} disabled={busy} style={styles.bypass} hitSlop={6}>
          <Ionicons name="warning-outline" size={14} color={colors.grey600} />
          <Text style={styles.bypassText}>Complete without review (flagged as not revised)</Text>
        </Pressable>
      ) : null}
    </View>
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
  title: { ...typography.subheading, color: colors.black },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  badgeText: { ...typography.caption, fontWeight: '700' },
  noteBox: {
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  noteLabel: { ...typography.caption, color: colors.grey600, fontWeight: '700' },
  noteText: { ...typography.body, color: colors.black },
  meta: { ...typography.caption, color: colors.grey600 },
  rejectForm: { gap: spacing.sm },
  noteInput: {
    ...typography.body,
    color: colors.black,
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.grey200,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: 'top',
    backgroundColor: colors.grey100,
  },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  bypass: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  bypassText: { ...typography.caption, color: colors.grey600, textDecorationLine: 'underline' },
});
