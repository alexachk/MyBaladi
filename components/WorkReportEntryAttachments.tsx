import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  deleteAttachment,
  getAttachmentName,
  getFilePreviewUrl,
  getFileViewUrl,
  uploadAttachment,
} from '../lib/appwrite/storage';

interface WorkReportEntryAttachmentsProps {
  photoIds: string[];
  documentIds: string[];
  disabled?: boolean;
  onChange?: (next: { photoIds: string[]; documentIds: string[] }) => void;
}

export function WorkReportEntryAttachments({
  photoIds,
  documentIds,
  disabled = false,
  onChange,
}: WorkReportEntryAttachmentsProps) {
  const [busy, setBusy] = useState(false);
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const readOnly = disabled || !onChange;

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

  const patch = async (next: { photoIds: string[]; documentIds: string[] }) => {
    if (!onChange) return;
    await onChange(next);
  };

  const handleAddPhoto = () => {
    if (readOnly) return;
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => pickFromCamera() },
      { text: 'From library', onPress: () => pickFromLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ['images'] });
    if (result.canceled || !result.assets?.length) return;
    await uploadPhotoAsset(result.assets[0]);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6,
    });
    if (result.canceled || !result.assets?.length) return;
    for (const asset of result.assets) {
      await uploadPhotoAsset(asset);
    }
  };

  const uploadPhotoAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setBusy(true);
    try {
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const type = asset.mimeType ?? 'image/jpeg';
      const size = asset.fileSize ?? new File(asset.uri).size ?? 0;
      const id = await uploadAttachment({ uri: asset.uri, name, type, size });
      await patch({ photoIds: [...photoIds, id], documentIds });
    } catch (error) {
      Alert.alert('Photo', error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddDoc = async () => {
    if (readOnly) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.*', 'text/*', 'image/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    setBusy(true);
    try {
      let nextDocumentIds = documentIds;
      for (const asset of result.assets) {
        const id = await uploadAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
          size: asset.size ?? 0,
        });
        setDocumentNames((prev) => ({ ...prev, [id]: asset.name }));
        nextDocumentIds = [...nextDocumentIds, id];
      }
      await patch({ photoIds, documentIds: nextDocumentIds });
    } catch (error) {
      Alert.alert('Document', error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (id: string) => {
    if (readOnly) return;
    Alert.alert('Remove photo', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await patch({ photoIds: photoIds.filter((x) => x !== id), documentIds });
          await deleteAttachment(id);
        },
      },
    ]);
  };

  const removeDoc = (id: string) => {
    if (readOnly) return;
    Alert.alert('Remove document', 'Delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await patch({ photoIds, documentIds: documentIds.filter((x) => x !== id) });
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

  if (readOnly && !photoIds.length && !documentIds.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>Photos & docs</Text>
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {(photoIds.length > 0 || !readOnly) && (
        <View style={styles.photoRow}>
          {photoIds.map((id) => (
            <Pressable
              key={id}
              onPress={() => Linking.openURL(getFileViewUrl(id))}
              onLongPress={() => removePhoto(id)}
              style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
            >
              <Image source={{ uri: getFilePreviewUrl(id, 200) }} style={styles.photoImg} />
            </Pressable>
          ))}
          {!readOnly ? (
            <Pressable
              onPress={handleAddPhoto}
              style={({ pressed }) => [styles.photo, styles.addTile, pressed && styles.pressed]}
            >
              <Ionicons name="camera-outline" size={18} color={colors.grey600} />
            </Pressable>
          ) : null}
        </View>
      )}

      {(documentIds.length > 0 || !readOnly) && (
        <View style={styles.docRow}>
          {documentIds.map((id) => (
            <Pressable
              key={id}
              onPress={() => Linking.openURL(getFileViewUrl(id))}
              onLongPress={() => removeDoc(id)}
              style={({ pressed }) => [styles.docChip, pressed && styles.pressed]}
            >
              <Ionicons name="document-outline" size={12} color={colors.black} />
              <Text style={styles.docText} numberOfLines={1}>
                {documentNames[id] ?? 'Document'}
              </Text>
            </Pressable>
          ))}
          {!readOnly ? (
            <Pressable
              onPress={handleAddDoc}
              style={({ pressed }) => [styles.docChip, styles.docAdd, pressed && styles.pressed]}
            >
              <Ionicons name="attach-outline" size={12} color={colors.primary} />
              <Text style={styles.docAddText}>Doc</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...typography.caption, color: colors.grey600, fontWeight: '600', fontSize: 11 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photo: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.grey100,
  },
  photoImg: { width: '100%', height: '100%' },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.grey200,
  },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.grey100,
    borderWidth: 1,
    borderColor: colors.grey200,
  },
  docAdd: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  docText: { ...typography.caption, color: colors.black, fontSize: 11, maxWidth: 140 },
  docAddText: { ...typography.caption, color: colors.primary, fontWeight: '700', fontSize: 11 },
  pressed: { opacity: 0.85 },
});
