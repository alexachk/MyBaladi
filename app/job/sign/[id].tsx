import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { useMemo, useRef, useState, type RefObject } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { colors, layout, radius, spacing, typography } from '../../../constants/theme';
import { useAuth, useJobCards } from '../../../context/JobCardsContext';
import { uploadAttachment } from '../../../lib/appwrite/storage';
import {
  formatSignOffVisitLabel,
  resolveSignOffVisitId,
} from '../../../lib/jobSignatures';
import { normalizeVisitsList, visitStatus } from '../../../lib/jobVisits';

type Step = 'technician' | 'client' | 'done';

const PAD_HEIGHT = 220;

const signatureWebStyle = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; width: 100%; height: 100%; }
  .m-signature-pad--body { border: 1px dashed #E5E7EB; border-radius: 12px; margin: 0; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body, html {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    position: fixed;
    touch-action: none;
    background: white;
  }
  canvas { width: 100% !important; height: 100% !important; }
`;

export default function SignJobCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJobCard, updateJobCard } = useJobCards();
  const { user } = useAuth();
  const job = id ? getJobCard(id) : undefined;

  const techRef = useRef<SignatureViewRef>(null);
  const clientRef = useRef<SignatureViewRef>(null);
  const [step, setStep] = useState<Step>('technician');
  const [techSignatureId, setTechSignatureId] = useState<string | null>(null);
  const [technicianSignedAt, setTechnicianSignedAt] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [saving, setSaving] = useState(false);

  const doneVisits = useMemo(() => {
    if (!job) return [];
    return normalizeVisitsList(job.visits ?? []).filter((visit) => visitStatus(visit) === 'done');
  }, [job]);

  const defaultVisitId = useMemo(
    () => (job ? resolveSignOffVisitId(job) : null),
    [job],
  );

  const [signatureVisitId, setSignatureVisitId] = useState<string | null>(null);
  const activeVisitId = signatureVisitId ?? defaultVisitId;

  const visitPickerLabel = useMemo(() => {
    if (!job || !activeVisitId) return null;
    const visits = normalizeVisitsList(job.visits ?? []);
    const visit = visits.find((row) => row.id === activeVisitId);
    return visit ? formatSignOffVisitLabel(visit, visits) : null;
  }, [job, activeVisitId]);

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Job card not found</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const uploadBase64Png = async (base64DataUrl: string, label: string): Promise<string> => {
    const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const filename = `signature-${label}-${Date.now()}.png`;
    const file = new File(Paths.cache, filename);
    if (!file.exists) file.create();
    file.write(base64, { encoding: 'base64' });
    const fileId = await uploadAttachment({
      uri: file.uri,
      name: filename,
      type: 'image/png',
      size: file.size ?? 0,
    });
    try {
      file.delete();
    } catch {
      // ignore
    }
    return fileId;
  };

  const handleTechSign = async (signature: string) => {
    setSaving(true);
    try {
      const fileId = await uploadBase64Png(signature, 'tech');
      setTechSignatureId(fileId);
      setTechnicianSignedAt(new Date().toISOString());
      setStep('client');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      Alert.alert('Signature', message);
    } finally {
      setSaving(false);
    }
  };

  const handleClientSign = async (signature: string) => {
    if (!clientName.trim()) {
      Alert.alert('Client signature', 'Please enter the name of the person signing.');
      return;
    }
    if (!techSignatureId) {
      Alert.alert('Signature', 'Please complete the technician signature first.');
      return;
    }

    setSaving(true);
    try {
      const clientFileId = await uploadBase64Png(signature, 'client');
      const lockedAt = new Date().toISOString();
      await updateJobCard(job.id, {
        status: 'completed',
        technicianSignatureId: techSignatureId,
        clientSignatureId: clientFileId,
        clientSignatureName: clientName.trim(),
        signatureVisitId: activeVisitId,
        technicianSignedAt: technicianSignedAt ?? lockedAt,
        finishedAt: job.finishedAt ?? lockedAt,
        lockedAt,
        lockedBy: user?.$id ?? '',
      });
      setStep('done');
      setTimeout(() => router.replace(`/job/${job.id}`), 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      Alert.alert('Sign-off', message);
    } finally {
      setSaving(false);
    }
  };

  const renderPad = (
    ref: RefObject<SignatureViewRef | null>,
    onOk: (sig: string) => void,
    emptyMessage: string,
    primaryLabel: string,
    onPrimary: () => void,
  ) => (
    <>
      <View style={styles.padWrap}>
        <SignatureCanvas
          ref={ref}
          onOK={onOk}
          onEmpty={() => Alert.alert('Signature', emptyMessage)}
          webStyle={signatureWebStyle}
          style={styles.padCanvas}
          imageType="image/png"
          trimWhitespace
          autoClear={false}
          descriptionText=""
          androidHardwareAccelerationDisabled
        />
      </View>
      <View style={styles.padActions}>
        <Pressable onPress={() => ref.current?.clearSignature()} style={styles.ghostBtn}>
          <Ionicons name="refresh-outline" size={16} color={colors.error} />
          <Text style={styles.ghostBtnText}>Clear</Text>
        </Pressable>
        <PrimaryButton
          label={saving ? 'Saving…' : primaryLabel}
          icon={step === 'technician' ? 'arrow-forward' : 'lock-closed-outline'}
          onPress={onPrimary}
          disabled={saving}
        />
      </View>
    </>
  );

  const body =
    step === 'done' ? (
      <View style={styles.successCard}>
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        <Text style={styles.successText}>Job card signed and locked.</Text>
      </View>
    ) : step === 'technician' ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Technician signature</Text>
        <Text style={styles.cardHint}>{job.technicianName || user?.name || ''}</Text>
        {renderPad(
          techRef,
          handleTechSign,
          'Please sign before continuing.',
          saving ? 'Uploading…' : 'Save & continue',
          () => techRef.current?.readSignature(),
        )}
      </View>
    ) : (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Client signature</Text>
          {doneVisits.length > 1 ? (
            <View style={styles.visitPick}>
              <Text style={styles.visitPickLabel}>Sign-off visit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {doneVisits.map((visit) => {
                  const visits = normalizeVisitsList(job.visits ?? []);
                  const label = formatSignOffVisitLabel(visit, visits);
                  const selected = visit.id === activeVisitId;
                  return (
                    <Pressable
                      key={visit.id}
                      onPress={() => setSignatureVisitId(visit.id)}
                      style={[styles.visitChip, selected && styles.visitChipOn]}
                    >
                      <Text style={[styles.visitChipText, selected && styles.visitChipTextOn]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : visitPickerLabel ? (
            <Text style={styles.visitHint}>Visit: {visitPickerLabel}</Text>
          ) : null}
          <FormField
            label="Client / Person signing"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Full name"
            required
          />
          {renderPad(
            clientRef,
            handleClientSign,
            'Please ask the client to sign.',
            saving ? 'Finalising…' : 'Sign & lock',
            () => clientRef.current?.readSignature(),
          )}
        </View>
      </KeyboardAvoidingView>
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Close sign-off"
            hitSlop={8}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="close" size={layout.iconMd} color={colors.black} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              Sign-off
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {job.reference} · {job.clientName}
            </Text>
          </View>
        </View>

        <View style={styles.steps}>
          <StepBadge label="1. Technician" active={step === 'technician'} done={!!techSignatureId} />
          <View style={styles.stepLine} />
          <StepBadge label="2. Client" active={step === 'client'} done={step === 'done'} />
        </View>

        <View style={styles.flex}>{body}</View>
      </View>
    </SafeAreaView>
  );
}

function StepBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <View
      style={[
        styles.stepBadge,
        active && styles.stepBadgeActive,
        done && styles.stepBadgeDone,
      ]}
    >
      {done ? (
        <Ionicons name="checkmark" size={14} color={colors.white} />
      ) : null}
      <Text
        style={[
          styles.stepBadgeText,
          (active || done) && styles.stepBadgeTextActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minHeight: 0 },
  page: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyTitle: { ...typography.subheading, color: colors.black },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  closeBtn: {
    width: layout.iconButtonSize,
    height: layout.iconButtonSize,
    borderRadius: layout.iconButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { ...typography.heading, color: colors.black },
  headerSub: { ...typography.caption, color: colors.grey600, marginTop: 4 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  stepBadgeActive: { borderColor: colors.black, backgroundColor: colors.black },
  stepBadgeDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepBadgeText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  stepBadgeTextActive: { color: colors.white },
  stepLine: { flex: 1, height: 1, backgroundColor: colors.grey200 },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { ...typography.subheading, color: colors.black },
  cardHint: { ...typography.caption, color: colors.grey600 },
  visitHint: { ...typography.caption, color: colors.grey600 },
  visitPick: { gap: spacing.xs },
  visitPickLabel: { ...typography.label, color: colors.grey600 },
  visitChip: {
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.grey200,
    backgroundColor: colors.background,
    maxWidth: 280,
  },
  visitChipOn: { borderColor: colors.black, backgroundColor: colors.black },
  visitChipText: { ...typography.caption, color: colors.grey900, fontWeight: '600' },
  visitChipTextOn: { color: colors.white },
  padWrap: {
    height: PAD_HEIGHT,
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  padCanvas: {
    width: '100%',
    height: PAD_HEIGHT,
  },
  padActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexShrink: 0,
  },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm },
  ghostBtnText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  successText: { ...typography.subheading, color: colors.black, textAlign: 'center' },
});
