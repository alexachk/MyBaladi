import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AttachmentImageModal, type AttachmentImagePreview } from './AttachmentImageModal';
import { AttachmentPreviewImage } from './AttachmentPreviewImage';
import { PdfPreviewModal } from './PdfPreviewModal';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  deleteAttachment,
  getAttachmentName,
  openAttachment,
  uploadAttachment,
} from '../lib/appwrite/storage';
import {
  attachmentVisitLabel,
  removeAttachmentVisit,
  setAttachmentVisit,
  visitIdForAttachment,
  type AttachmentVisitLinks,
} from '../lib/jobCardAttachments';
import { visitIdLocked, visitLinkOptionsForEdit, type VisitLinkOption } from '../lib/jobVisitLink';
import { normalizeVisitsList, type StoredJobVisit } from '../lib/jobVisits';
import { PickerSheet } from './PickerSheet';

export interface JobAttachmentsChange {
  photoIds: string[];
  documentIds: string[];
  attachmentVisitLinks: AttachmentVisitLinks;
}

interface Props {
  photoIds: string[];
  documentIds: string[];
  attachmentVisitLinks?: AttachmentVisitLinks;
  visits?: StoredJobVisit[];
  visitOptions?: VisitLinkOption[];
  lockedVisitIds?: string[];
  disabled?: boolean;
  embedded?: boolean;
  onChange: (next: JobAttachmentsChange) => Promise<void>;
}

export function JobAttachments({
  photoIds,
  documentIds,
  attachmentVisitLinks = {},
  visits = [],
  visitOptions,
  lockedVisitIds = [],
  disabled,
  embedded,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const [linkPickerFileId, setLinkPickerFileId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<AttachmentImagePreview | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ fileId: string; name: string } | null>(null);

  const normalizedVisits = useMemo(() => normalizeVisitsList(visits), [visits]);
  const options = useMemo(
    () =>
      visitOptions?.length
        ? visitOptions
        : [{ id: null, label: 'General (whole job)' }],
    [visitOptions],
  );
  const linkPickerOptions = useMemo(() => {
    if (!linkPickerFileId) return [];
    const keepVisitId = linkPickerFileId.startsWith('__pending_')
      ? null
      : visitIdForAttachment(linkPickerFileId, attachmentVisitLinks);
    return visitLinkOptionsForEdit(options, lockedVisitIds, keepVisitId).map((opt) => ({
      id: opt.id ?? '__general__',
      label: opt.label,
    }));
  }, [linkPickerFileId, options, lockedVisitIds, attachmentVisitLinks]);

  const unlockedVisitOptions = useMemo(
    () => options.filter((opt) => opt.id && !visitIdLocked(opt.id, lockedVisitIds)),
    [options, lockedVisitIds],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const id of documentIds) {
        const name = await getAttachmentName(id);
        if (cancelled || !name) continue;
        setDocumentNames((prev) => (prev[id] ? prev : { ...prev, [id]: name }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentIds]);

  const rememberDocumentName = (id: string, name: string) => {
    setDocumentNames((prev) => ({ ...prev, [id]: name }));
  };

  const isFileLocked = (fileId: string) => {
    const visitId = visitIdForAttachment(fileId, attachmentVisitLinks);
    return Boolean(visitId && lockedVisitIds.includes(visitId));
  };

  const applyChange = async (
    nextPhotos: string[],
    nextDocs: string[],
    nextLinks: AttachmentVisitLinks,
  ) => {
    await onChange({
      photoIds: nextPhotos,
      documentIds: nextDocs,
      attachmentVisitLinks: nextLinks,
    });
  };

  const openAddVisitPicker = (kind: 'photo' | 'document') => {
    if (!unlockedVisitOptions.length) {
      if (kind === 'photo') void pickPhotoSource(null);
      else void pickDocuments(null);
      return;
    }
    Alert.alert('Link to visit', 'Assign this attachment to a visit or keep it general.', [
      { text: 'General', onPress: () => (kind === 'photo' ? pickPhotoSource(null) : pickDocuments(null)) },
      {
        text: 'Choose visit',
        onPress: () => setLinkPickerFileId(`__pending_${kind}__`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAddPhoto = () => {
    if (disabled) return;
    openAddVisitPicker('photo');
  };

  const pickPhotoSource = (visitId: string | null) => {
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => pickFromCamera(visitId) },
      { text: 'From library', onPress: () => pickFromLibrary(visitId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromCamera = async (visitId: string | null) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets?.length) return;
    await uploadPhotoAsset(result.assets[0], visitId);
  };

  const pickFromLibrary = async (visitId: string | null) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || !result.assets?.length) return;
    for (const asset of result.assets) {
      await uploadPhotoAsset(asset, visitId);
    }
  };

  const uploadPhotoAsset = async (asset: ImagePicker.ImagePickerAsset, visitId: string | null) => {
    setBusy(true);
    try {
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const type = asset.mimeType ?? 'image/jpeg';
      const size = asset.fileSize ?? new File(asset.uri).size ?? 0;
      const id = await uploadAttachment({ uri: asset.uri, name, type, size });
      const nextLinks = setAttachmentVisit(attachmentVisitLinks, id, visitId);
      await applyChange([...photoIds, id], documentIds, nextLinks);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      Alert.alert('Photo', message);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const pickDocuments = async (visitId: string | null) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.*', 'text/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    setBusy(true);
    try {
      let nextPhotoIds = photoIds;
      let nextDocumentIds = documentIds;
      let nextLinks = attachmentVisitLinks;
      for (const asset of result.assets) {
        const id = await uploadAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
          size: asset.size ?? 0,
        });
        rememberDocumentName(id, asset.name);
        nextLinks = setAttachmentVisit(nextLinks, id, visitId);
        nextDocumentIds = [...nextDocumentIds, id];
      }
      await applyChange(nextPhotoIds, nextDocumentIds, nextLinks);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      Alert.alert('Document', message);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const handleAddDoc = async () => {
    if (disabled) return;
    openAddVisitPicker('document');
  };

  const handleRemovePhoto = (id: string) => {
    if (disabled || isFileLocked(id)) return;
    Alert.alert('Remove photo', 'Delete this photo permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePhotoById(id);
        },
      },
    ]);
  };

  const handleRemoveDoc = (id: string) => {
    if (disabled || isFileLocked(id)) return;
    Alert.alert('Remove document', 'Delete this document permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await applyChange(
            photoIds,
            documentIds.filter((x) => x !== id),
            removeAttachmentVisit(attachmentVisitLinks, id),
          );
          setDocumentNames((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          await deleteAttachment(id);
        },
      },
    ]);
  };

  const handleVisitLinkSelect = (fileId: string, optId: string) => {
    const visitId = optId === '__general__' ? null : optId;
    if (fileId.startsWith('__pending_')) {
      const kind = fileId.includes('photo') ? 'photo' : 'document';
      setLinkPickerFileId(null);
      if (kind === 'photo') pickPhotoSource(visitId);
      else void pickDocuments(visitId);
      return;
    }
    void applyChange(photoIds, documentIds, setAttachmentVisit(attachmentVisitLinks, fileId, visitId));
    setLinkPickerFileId(null);
  };

  const renderVisitChip = (fileId: string) => {
    if (!options.length) return null;
    const locked = isFileLocked(fileId);
    return (
      <Pressable
        onPress={() => !disabled && !locked && setLinkPickerFileId(fileId)}
        style={({ pressed }) => [styles.visitChip, pressed && styles.pressed]}
        disabled={disabled || locked}
      >
        <Ionicons name="calendar-outline" size={11} color={colors.info} />
        <Text style={styles.visitChipText} numberOfLines={1}>
          {attachmentVisitLabel(fileId, normalizedVisits, attachmentVisitLinks)}
        </Text>
        {!disabled && !locked ? (
          <Ionicons name="chevron-down" size={11} color={colors.grey400} />
        ) : null}
      </Pressable>
    );
  };

  const deletePhotoById = async (id: string) => {
    await applyChange(
      photoIds.filter((x) => x !== id),
      documentIds,
      removeAttachmentVisit(attachmentVisitLinks, id),
    );
    await deleteAttachment(id);
  };

  const handleOpenAttachment = async (id: string) => {
    try {
      await openAttachment(id, {
        onImagePreview: setImagePreview,
        onPdfPreview: setPdfPreview,
      });
    } catch {
      Alert.alert('Error', 'Could not open file.');
    }
  };

  const content = (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Photos & documents</Text>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      <Text style={styles.subLabel}>Photos ({photoIds.length})</Text>
      {photoIds.length === 0 && disabled ? (
        <Text style={styles.dim}>No photos attached.</Text>
      ) : (
        <View style={styles.photoGrid}>
          {photoIds.map((id) => (
            <View key={id} style={styles.photoCell}>
              <Pressable
                onLongPress={() => handleRemovePhoto(id)}
                onPress={() => void handleOpenAttachment(id)}
                style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
              >
                <AttachmentPreviewImage fileId={id} width={400} style={styles.photoImg} />
              </Pressable>
              {renderVisitChip(id)}
            </View>
          ))}
          {!disabled ? (
            <Pressable
              onPress={handleAddPhoto}
              style={({ pressed }) => [styles.photo, styles.photoAdd, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={26} color={colors.grey600} />
              <Text style={styles.photoAddLabel}>Add</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <Text style={[styles.subLabel, { marginTop: spacing.md }]}>Documents ({documentIds.length})</Text>
      {documentIds.length === 0 && disabled ? (
        <Text style={styles.dim}>No documents attached.</Text>
      ) : (
        <View style={styles.docList}>
          {documentIds.map((id) => (
            <View key={id} style={styles.docCell}>
              <Pressable
                onPress={() => void handleOpenAttachment(id)}
                onLongPress={() => handleRemoveDoc(id)}
                style={({ pressed }) => [styles.docRow, pressed && styles.pressed]}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.black} />
                <Text style={styles.docName} numberOfLines={1}>
                  {documentNames[id] ?? id}
                </Text>
                <Ionicons name="open-outline" size={16} color={colors.grey400} />
              </Pressable>
              {renderVisitChip(id)}
            </View>
          ))}
          {!disabled ? (
            <Pressable onPress={handleAddDoc} style={({ pressed }) => [styles.docAdd, pressed && styles.pressed]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.black} />
              <Text style={styles.docAddText}>Attach document</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {!disabled ? (
        <Text style={styles.hint}>Link each file to a visit or general. Long-press to remove.</Text>
      ) : null}

      <PickerSheet
        visible={linkPickerFileId !== null}
        title="Link to visit"
        compact
        options={linkPickerOptions}
        onSelect={(opt) => {
          if (!linkPickerFileId) return;
          handleVisitLinkSelect(linkPickerFileId, opt.id);
        }}
        onClose={() => setLinkPickerFileId(null)}
      />
    </>
  );

  return (
    <>
      {embedded ? <View style={styles.embedded}>{content}</View> : <View style={styles.card}>{content}</View>}
      <AttachmentImageModal
        visible={imagePreview !== null}
        preview={imagePreview}
        onClose={() => setImagePreview(null)}
        canDelete={Boolean(imagePreview && !disabled && !isFileLocked(imagePreview.fileId))}
        onDelete={imagePreview ? () => deletePhotoById(imagePreview.fileId) : undefined}
      />
      <PdfPreviewModal
        visible={pdfPreview !== null}
        title={pdfPreview?.name ?? 'Document'}
        source={pdfPreview ? { kind: 'fileId', fileId: pdfPreview.fileId } : null}
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
  embedded: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.subheading, color: colors.black },
  subLabel: { ...typography.label, color: colors.grey600 },
  dim: { ...typography.caption, color: colors.grey400 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCell: { width: 80, gap: 4 },
  photo: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.grey100,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImg: { width: '100%', height: '100%' },
  photoAdd: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.grey200, gap: 2 },
  photoAddLabel: { ...typography.caption, color: colors.grey600, fontSize: 11 },
  visitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.infoLight,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
    maxWidth: 80,
  },
  visitChipText: { flex: 1, ...typography.caption, color: colors.black, fontSize: 9, fontWeight: '600' },
  docList: { gap: 6 },
  docCell: { gap: 4 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.grey100,
    borderRadius: radius.md,
  },
  docName: { flex: 1, ...typography.caption, color: colors.black, fontSize: 12 },
  docAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.grey200,
  },
  docAddText: { ...typography.caption, color: colors.black, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.grey400, fontSize: 11, marginTop: spacing.sm },
  pressed: { opacity: 0.85 },
});
