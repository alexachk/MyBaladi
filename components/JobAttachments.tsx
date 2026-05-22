import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import {
  deleteAttachment,
  getAttachmentName,
  getFilePreviewUrl,
  getFileViewUrl,
  uploadAttachment,
} from '../lib/appwrite/storage';

interface Props {
  photoIds: string[];
  documentIds: string[];
  disabled?: boolean;
  embedded?: boolean;
  onChange: (next: { photoIds: string[]; documentIds: string[] }) => Promise<void>;
}

export function JobAttachments({ photoIds, documentIds, disabled, embedded, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});

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

  const handleAddPhoto = async () => {
    if (disabled) return;
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
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets?.length) return;
    await uploadPhotoAsset(result.assets[0]);
  };

  const pickFromLibrary = async () => {
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
      await onChange({ photoIds: [...photoIds, id], documentIds });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      Alert.alert('Photo', message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddDoc = async () => {
    if (disabled) return;
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
      for (const asset of result.assets) {
        const id = await uploadAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
          size: asset.size ?? 0,
        });
        rememberDocumentName(id, asset.name);
        nextDocumentIds = [...nextDocumentIds, id];
      }
      await onChange({ photoIds: nextPhotoIds, documentIds: nextDocumentIds });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      Alert.alert('Document', message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePhoto = (id: string) => {
    if (disabled) return;
    Alert.alert('Remove photo', 'Delete this photo permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onChange({ photoIds: photoIds.filter((x) => x !== id), documentIds });
          await deleteAttachment(id);
        },
      },
    ]);
  };

  const handleRemoveDoc = (id: string) => {
    if (disabled) return;
    Alert.alert('Remove document', 'Delete this document permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onChange({ photoIds, documentIds: documentIds.filter((x) => x !== id) });
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

  void Paths;

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
            <Pressable
              key={id}
              onLongPress={() => handleRemovePhoto(id)}
              onPress={() => Linking.openURL(getFileViewUrl(id))}
              style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
            >
              <Image source={{ uri: getFilePreviewUrl(id, 400) }} style={styles.photoImg} />
            </Pressable>
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
            <Pressable
              key={id}
              onPress={() => Linking.openURL(getFileViewUrl(id))}
              onLongPress={() => handleRemoveDoc(id)}
              style={({ pressed }) => [styles.docRow, pressed && styles.pressed]}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.black} />
              <Text style={styles.docName} numberOfLines={1}>
                {documentNames[id] ?? id}
              </Text>
              <Ionicons name="open-outline" size={16} color={colors.grey400} />
            </Pressable>
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
        <Text style={styles.hint}>Camera, gallery, or files. Long-press to remove.</Text>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={styles.embedded}>{content}</View>;
  }

  return <View style={styles.card}>{content}</View>;
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
  docList: { gap: 6 },
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
