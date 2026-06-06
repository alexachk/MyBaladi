import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { useMemo, useRef, useState, type RefObject } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { colors, layout, radius, spacing, typography } from '../../../constants/theme';
import { useAuth, useJobCards } from '../../../context/JobCardsContext';
import { uploadAttachment } from '../../../lib/appwrite/storage';
import {
  buildVisitLockPatch,
  formatSignOffVisitLabel,
  isVisitLocked,
  resolveSignOffVisitId,
  signableDoneVisits,
} from '../../../lib/jobSignatures';
import { promptVisitSignOffReadiness } from '../../../lib/jobSignOffReadiness';
import { normalizeVisitsList, visitStatus } from '../../../lib/jobVisits';

type Step = 'technician' | 'client' | 'done';

const PAD_HEIGHT = 200;

const signatureWebStyle = `
  * { box-sizing: border-box; }
  .m-signature-pad {
    box-shadow: none;
    border: none;
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
  .m-signature-pad--body {
    border: none;
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
  .m-signature-pad--footer { display: none !important; }
  body, html {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden !important;
    position: fixed;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    overscroll-behavior: none;
    background: transparent;
  }
  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100% !important;
    height: 100% !important;
    touch-action: none;
  }
`;

export default function SignJobCardScreen() {
  const { id, visitId: visitIdParam } = useLocalSearchParams<{ id: string; visitId?: string }>();
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
  const [isDrawing, setIsDrawing] = useState(false);
  const insets = useSafeAreaInsets();

  const signableVisits = useMemo(() => (job ? signableDoneVisits(job) : []), [job]);

  const defaultVisitId = useMemo(
    () => (job ? resolveSignOffVisitId(job, visitIdParam) : null),
    [job, visitIdParam],
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
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={[styles.empty, { paddingTop: insets.top }]}>
          <Text style={styles.emptyTitle}>Job card not found</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!signableVisits.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={[styles.empty, { paddingTop: insets.top }]}>
          <Text style={styles.emptyTitle}>No visit ready for sign-off</Text>
          <Text style={styles.emptyHint}>Finish a visit on site first, or unlock a locked visit.</Text>
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const uploadBase64Png = async (base64DataUrl: string, label: string): Promise<string> => {
    const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const filename = `signature-${label}-${Date.now()}.png`;
    const file = new File(Paths.cache, filename);
    if (file.exists) file.delete();
    file.write(bytes);
    const fileId = await uploadAttachment({
      uri: file.uri,
      name: filename,
      type: 'image/png',
      size: file.size ?? bytes.length,
    });
    try {
      file.delete();
    } catch {
      // ignore
    }
    return fileId;
  };

  const persistVisitLock = async (
    signOff: Parameters<typeof buildVisitLockPatch>[3],
    successMessage: string,
  ) => {
    if (!activeVisitId) {
      Alert.alert('Sign-off', 'Select a visit first.');
      return;
    }
    const visit = normalizeVisitsList(job.visits ?? []).find((row) => row.id === activeVisitId);
    if (!visit || visitStatus(visit) !== 'done') {
      Alert.alert('Sign-off', 'Only completed visits can be signed or locked.');
      return;
    }
    if (isVisitLocked(visit, job)) {
      Alert.alert('Sign-off', 'This visit is already locked.');
      return;
    }
    if (!user?.$id) return;

    setSaving(true);
    try {
      await updateJobCard(
        job.id,
        buildVisitLockPatch(job, activeVisitId, user.$id, signOff),
      );
      setStep('done');
      Alert.alert('Sign-off', successMessage);
      setTimeout(() => router.replace(`/job/${job.id}`), 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      Alert.alert('Sign-off', message);
    } finally {
      setSaving(false);
    }
  };

  const handleLockWithoutSignature = () => {
    if (!activeVisitId) return;
    promptVisitSignOffReadiness(job, activeVisitId, () => {
      Alert.alert(
        'Lock visit',
        'Lock this visit without signatures? Its mission and work records will be read-only.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Lock',
            onPress: () => persistVisitLock({}, 'Visit locked.'),
          },
        ],
      );
    }, () => router.back());
  };

  const confirmBeforeClientStep = () => {
    if (!activeVisitId) {
      setStep('client');
      return;
    }
    promptVisitSignOffReadiness(
      job,
      activeVisitId,
      () => setStep('client'),
      () => router.back(),
    );
  };

  const handleTechSign = async (signature: string) => {
    setSaving(true);
    try {
      const fileId = await uploadBase64Png(signature, 'tech');
      setTechSignatureId(fileId);
      setTechnicianSignedAt(new Date().toISOString());
      confirmBeforeClientStep();
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
    if (!activeVisitId || !user?.$id) return;

    setSaving(true);
    try {
      const clientFileId = await uploadBase64Png(signature, 'client');
      const lockedAt = new Date().toISOString();
      await updateJobCard(
        job.id,
        buildVisitLockPatch(job, activeVisitId, user.$id, {
          technicianSignatureId: techSignatureId,
          clientSignatureId: clientFileId,
          clientSignatureName: clientName.trim(),
          technicianSignedAt: technicianSignedAt ?? lockedAt,
          lockedAt,
        }),
      );
      setStep('done');
      setTimeout(() => router.replace(`/job/${job.id}`), 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      Alert.alert('Sign-off', message);
    } finally {
      setSaving(false);
    }
  };

  const renderVisitPicker = () => {
    if (signableVisits.length <= 1) {
      return visitPickerLabel ? <Text style={styles.visitHint}>Visit: {visitPickerLabel}</Text> : null;
    }
    const visits = normalizeVisitsList(job.visits ?? []);
    return (
      <View style={styles.visitPick}>
        <Text style={styles.visitPickLabel}>Sign-off visit</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {signableVisits.map((visit) => {
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
    );
  };

  const activePadRef = step === 'technician' ? techRef : clientRef;

  const renderSignDock = (
    ref: RefObject<SignatureViewRef | null>,
    onOk: (sig: string) => void,
    emptyMessage: string,
    primaryLabel: string,
    onPrimary: () => void,
  ) => (
    <View style={styles.signDock} collapsable={false}>
      <Text style={styles.padHint}>Sign in the box below</Text>
      <View style={styles.padFrame} collapsable={false}>
        <SignatureCanvas
          key={step}
          ref={ref}
          onOK={onOk}
          onBegin={() => setIsDrawing(true)}
          onEnd={() => setIsDrawing(false)}
          onEmpty={() => Alert.alert('Signature', emptyMessage)}
          webStyle={signatureWebStyle}
          webviewContainerStyle={styles.padWebContainer}
          webviewProps={{
            scrollEnabled: false,
            bounces: false,
            overScrollMode: 'never',
            nestedScrollEnabled: false,
            showsHorizontalScrollIndicator: false,
            showsVerticalScrollIndicator: false,
            androidLayerType: 'software',
            cacheEnabled: true,
            setSupportMultipleWindows: false,
            style: styles.padWebView,
          }}
          style={styles.padCanvas}
          imageType="image/png"
          trimWhitespace
          autoClear={false}
          descriptionText=""
          scrollable={false}
          nestedScrollEnabled={false}
          androidHardwareAccelerationDisabled
        />
      </View>
      <View style={styles.padActions}>
        <Pressable onPress={() => ref.current?.clearSignature()} style={styles.ghostBtn}>
          <Ionicons name="refresh-outline" size={16} color={colors.error} />
          <Text style={styles.ghostBtnText}>Clear</Text>
        </Pressable>
        <View style={styles.primaryBtnWrap}>
          <PrimaryButton
            label={saving ? 'Saving…' : primaryLabel}
            icon={step === 'technician' ? 'arrow-forward' : 'lock-closed-outline'}
            onPress={onPrimary}
            disabled={saving}
          />
        </View>
      </View>
    </View>
  );

  const renderMeta = () => {
    if (step === 'technician') {
      return (
        <View style={styles.metaCard}>
          <Text style={styles.cardTitle}>Technician signature</Text>
          <Text style={styles.cardHint}>{job.technicianName || user?.name || ''}</Text>
          {renderVisitPicker()}
        </View>
      );
    }
    if (step === 'client') {
      return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.metaCard}>
            <Text style={styles.cardTitle}>Client signature</Text>
            {renderVisitPicker()}
            <FormField
              label="Client / Person signing"
              value={clientName}
              onChangeText={setClientName}
              placeholder="Full name"
              required
            />
          </View>
        </TouchableWithoutFeedback>
      );
    }
    return (
      <View style={styles.successCard}>
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        <Text style={styles.successText}>Visit signed and locked.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <View style={styles.page}>
        <View style={[styles.headerZone, { paddingTop: insets.top + spacing.sm }]}>
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
                Visit sign-off
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
        </View>

        {step === 'done' ? (
          <View style={styles.doneWrap}>{renderMeta()}</View>
        ) : (
          <ScrollView
            style={styles.workArea}
            contentContainerStyle={styles.workContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={!isDrawing}
            keyboardDismissMode="on-drag"
          >
            {renderMeta()}
            <View style={styles.signSection} collapsable={false}>
              {renderSignDock(
                activePadRef,
                step === 'technician' ? handleTechSign : handleClientSign,
                step === 'technician' ? 'Please sign before continuing.' : 'Please ask the client to sign.',
                step === 'technician'
                  ? saving
                    ? 'Uploading…'
                    : 'Save & continue'
                  : saving
                    ? 'Finalising…'
                    : 'Sign & lock visit',
                () => activePadRef.current?.readSignature(),
              )}
              {step === 'technician' ? (
                <PrimaryButton
                  label="Lock without signature"
                  icon="lock-closed-outline"
                  variant="ghost"
                  onPress={handleLockWithoutSignature}
                  disabled={saving}
                />
              ) : null}
            </View>
          </ScrollView>
        )}
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
  page: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyTitle: { ...typography.subheading, color: colors.black },
  emptyHint: { ...typography.caption, color: colors.grey600, textAlign: 'center' },
  headerZone: { flexShrink: 0 },
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
  workArea: { flex: 1 },
  workContent: { gap: spacing.md, paddingBottom: spacing.md },
  signSection: { gap: spacing.md },
  doneWrap: { flex: 1, justifyContent: 'center' },
  metaCard: {
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
  signDock: {
    flexShrink: 0,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey200,
    padding: spacing.lg,
    gap: spacing.md,
  },
  padHint: { ...typography.label, color: colors.grey600 },
  padFrame: {
    height: PAD_HEIGHT,
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.grey200,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  padWebContainer: {
    height: PAD_HEIGHT,
    width: '100%',
    flex: 0,
    flexGrow: 0,
    backgroundColor: colors.white,
  },
  padWebView: {
    height: PAD_HEIGHT,
    width: '100%',
    flex: 0,
    flexGrow: 0,
    backgroundColor: colors.white,
  },
  padCanvas: {
    width: '100%',
    height: PAD_HEIGHT,
    flex: 0,
    flexGrow: 0,
    backgroundColor: colors.white,
  },
  padActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.grey200,
  },
  primaryBtnWrap: { flex: 1, maxWidth: 220 },
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
