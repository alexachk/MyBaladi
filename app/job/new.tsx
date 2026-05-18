import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FormField, FormSection } from '../../components/FormField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { StatusPicker } from '../../components/StatusBadge';
import { colors, spacing, typography } from '../../constants/theme';
import { useJobCards } from '../../context/JobCardsContext';
import {
  JOB_PRIORITY_LABELS,
  MISSION_TYPES,
  type JobPriority,
  type JobStatus,
} from '../../types/jobCard';
import { generateReference, todayIsoDate } from '../../utils/formatDate';

const PRIORITIES = Object.keys(JOB_PRIORITY_LABELS) as JobPriority[];

export default function NewJobCardScreen() {
  const { addJobCard } = useJobCards();
  const [saving, setSaving] = useState(false);

  const [reference] = useState(generateReference);
  const [clientName, setClientName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [missionType, setMissionType] = useState<string>(MISSION_TYPES[0]);
  const [equipment, setEquipment] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [scheduledDate, setScheduledDate] = useState(todayIsoDate());
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<JobStatus>('draft');
  const [priority, setPriority] = useState<JobPriority>('normal');

  const handleSave = async () => {
    if (!clientName.trim() || !technicianName.trim()) {
      Alert.alert('Required fields', 'Please enter client name and technician name.');
      return;
    }

    setSaving(true);
    try {
      const job = await addJobCard({
        reference,
        clientName: clientName.trim(),
        siteAddress: siteAddress.trim(),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        missionType,
        equipment: equipment.trim(),
        technicianName: technicianName.trim(),
        scheduledDate,
        arrivalTime: arrivalTime.trim(),
        departureTime: departureTime.trim(),
        workPerformed: workPerformed.trim(),
        partsUsed: partsUsed.trim(),
        notes: notes.trim(),
        status,
        priority,
      });
      router.replace(`/job/${job.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.referenceBanner}>
          <Text style={styles.referenceLabel}>Reference</Text>
          <Text style={styles.referenceValue}>{reference}</Text>
        </View>

        <FormSection title="Client & Site">
          <FormField
            label="Client name"
            required
            value={clientName}
            onChangeText={setClientName}
            placeholder="e.g. Acme Industries"
          />
          <FormField
            label="Site address"
            value={siteAddress}
            onChangeText={setSiteAddress}
            placeholder="Street, city, postcode"
          />
          <FormField
            label="Site contact"
            value={contactName}
            onChangeText={setContactName}
            placeholder="Contact person on site"
          />
          <FormField
            label="Contact phone"
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+32 ..."
            keyboardType="phone-pad"
          />
        </FormSection>

        <FormSection title="Mission">
          <Text style={styles.fieldLabel}>Mission type</Text>
          <View style={styles.chipRow}>
            {MISSION_TYPES.map((type) => {
              const selected = missionType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setMissionType(type)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FormField
            label="Equipment / system"
            value={equipment}
            onChangeText={setEquipment}
            placeholder="e.g. Compressor unit #4"
          />
          <FormField
            label="Technician"
            required
            value={technicianName}
            onChangeText={setTechnicianName}
            placeholder="Your name"
          />
          <FormField
            label="Scheduled date"
            value={scheduledDate}
            onChangeText={setScheduledDate}
            placeholder="YYYY-MM-DD"
          />
          <View style={styles.row}>
            <FormField
              label="Arrival"
              value={arrivalTime}
              onChangeText={setArrivalTime}
              placeholder="09:30"
              containerStyle={styles.half}
            />
            <FormField
              label="Departure"
              value={departureTime}
              onChangeText={setDepartureTime}
              placeholder="12:15"
              containerStyle={styles.half}
            />
          </View>
        </FormSection>

        <FormSection title="Work report">
          <FormField
            label="Work performed"
            value={workPerformed}
            onChangeText={setWorkPerformed}
            placeholder="Describe diagnostics, repairs, and actions taken..."
            multiline
          />
          <FormField
            label="Parts used"
            value={partsUsed}
            onChangeText={setPartsUsed}
            placeholder="List parts and quantities"
            multiline
          />
          <FormField
            label="Additional notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Follow-up required, observations..."
            multiline
          />
        </FormSection>

        <FormSection title="Status & priority">
          <Text style={styles.fieldLabel}>Status</Text>
          <StatusPicker value={status} onChange={setStatus} />
          <Text style={[styles.fieldLabel, styles.priorityLabel]}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((level) => {
              const selected = priority === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => setPriority(level)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {JOB_PRIORITY_LABELS[level]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <PrimaryButton
          label={saving ? 'Saving...' : 'Save Job Card'}
          icon="save-outline"
          onPress={handleSave}
          disabled={saving}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  referenceBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  referenceLabel: {
    ...typography.label,
    color: colors.grey600,
    marginBottom: spacing.xs,
  },
  referenceValue: {
    ...typography.subheading,
    color: colors.black,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.grey600,
    marginBottom: spacing.sm,
  },
  priorityLabel: {
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  chipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.grey600,
  },
  chipTextSelected: {
    color: colors.black,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
});
