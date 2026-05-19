import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { useRef, useState } from 'react';
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

type Step = 'technician' | 'client' | 'done';

export default function SignJobCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJobCard, updateJobCard } = useJobCards();
  const { user } = useAuth();
  const job = id ? getJobCard(id) : undefined;

  const techRef = useRef<SignatureViewRef>(null);
  const clientRef = useRef<SignatureViewRef>(null);
  const [step, setStep] = useState<Step>('technician');
  const [techSignatureId, setTechSignatureId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [saving, setSaving] = useState(false);

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
      await updateJobCard(job.id, {
        status: 'completed',
        technicianSignatureId: techSignatureId,
        clientSignatureId: clientFileId,
        clientSignatureName: clientName.trim(),
        finishedAt: job.finishedAt ?? new Date().toISOString(),
        lockedAt: new Date().toISOString(),
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.headerTitle} numberOfLines={1} allowFontScaling={false}>
                Sign-off · {job.reference}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {job.clientName}
              </Text>
            </View>
          </View>

          <View style={styles.steps}>
            <StepBadge label="1. Technician" active={step === 'technician'} done={!!techSignatureId} />
            <View style={styles.stepLine} />
            <StepBadge label="2. Client" active={step === 'client'} done={step === 'done'} />
          </View>

          {step === 'technician' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Technician signature</Text>
              <Text style={styles.cardHint}>{job.technicianName || user?.name || ''}</Text>
              <View style={styles.padWrap}>
                <SignatureCanvas
                  ref={techRef}
                  onOK={handleTechSign}
                  onEmpty={() => Alert.alert('Signature', 'Please sign before continuing.')}
                  webStyle={signatureWebStyle}
                  imageType="image/png"
                  trimWhitespace
                  autoClear={false}
                  descriptionText=""
                />
              </View>
              <View style={styles.padActions}>
                <Pressable onPress={() => techRef.current?.clearSignature()} style={styles.ghostBtn}>
                  <Ionicons name="refresh-outline" size={16} color={colors.error} />
                  <Text style={styles.ghostBtnText}>Clear</Text>
                </Pressable>
                <PrimaryButton
                  label={saving ? 'Uploading…' : 'Save & continue'}
                  icon="arrow-forward"
                  onPress={() => techRef.current?.readSignature()}
                  disabled={saving}
                />
              </View>
            </View>
          ) : null}

          {step === 'client' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Client signature</Text>
              <FormField
                label="Client / Person signing"
                value={clientName}
                onChangeText={setClientName}
                placeholder="Full name"
                required
              />
              <View style={styles.padWrap}>
                <SignatureCanvas
                  ref={clientRef}
                  onOK={handleClientSign}
                  onEmpty={() => Alert.alert('Signature', 'Please ask the client to sign.')}
                  webStyle={signatureWebStyle}
                  imageType="image/png"
                  trimWhitespace
                  autoClear={false}
                  descriptionText=""
                />
              </View>
              <View style={styles.padActions}>
                <Pressable onPress={() => clientRef.current?.clearSignature()} style={styles.ghostBtn}>
                  <Ionicons name="refresh-outline" size={16} color={colors.error} />
                  <Text style={styles.ghostBtnText}>Clear</Text>
                </Pressable>
                <PrimaryButton
                  label={saving ? 'Finalising…' : 'Sign & lock'}
                  icon="lock-closed-outline"
                  onPress={() => clientRef.current?.readSignature()}
                  disabled={saving}
                />
              </View>
            </View>
          ) : null}

          {step === 'done' ? (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={styles.successText}>Job card signed and locked.</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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

const signatureWebStyle = `.m-signature-pad { box-shadow: none; border: none; }
                           .m-signature-pad--body { border: 1px dashed #E5E7EB; border-radius: 12px; }
                           .m-signature-pad--footer { display: none; }
                           body, html { background: white; height: 220px; margin: 0; padding: 0; }`;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyTitle: { ...typography.subheading, color: colors.black },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  headerTitle: { ...typography.screenTitle, color: colors.black },
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
  stepBadgeActive: { borderColor: colors.black },
  stepBadgeDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepBadgeText: { ...typography.caption, color: colors.grey600, fontWeight: '600' },
  stepBadgeTextActive: { color: colors.white },
  stepLine: { flex: 1, height: 1, backgroundColor: colors.grey200 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { ...typography.subheading, color: colors.black },
  cardHint: { ...typography.caption, color: colors.grey600 },
  padWrap: {
    height: 220,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  padActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
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
