import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatVisitNotesList, missionNotesFromJob } from '../lib/jobVisitNotes';
import { visitLinkLabel } from '../lib/jobVisitLink';
import type { JobCard } from '../types/jobCard';

export function JobMissionNotesGroups({ job }: { job: JobCard }) {
  const notes = missionNotesFromJob(job);
  if (!notes.length) return null;

  if (notes.length === 1 && !notes[0].visitId) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionLabel}>Mission notes</Text>
        <Text style={styles.noteText}>{notes[0].text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Mission notes</Text>
      {notes.map((note, index) => (
        <View key={`${note.visitId ?? 'g'}-${index}`} style={styles.card}>
          <Text style={styles.visitLabel}>
            {note.visitId ? visitLinkLabel(job.visits ?? [], note.visitId) : 'General (whole job)'}
          </Text>
          <Text style={styles.noteText}>{note.text}</Text>
        </View>
      ))}
    </View>
  );
}

export function formatMissionNotesForRow(job: JobCard): string {
  return formatVisitNotesList(missionNotesFromJob(job), job.visits ?? []);
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.grey600 },
  card: {
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  visitLabel: { ...typography.caption, color: colors.grey600, fontWeight: '700' },
  noteText: { ...typography.body, color: colors.black, fontSize: 14 },
});
