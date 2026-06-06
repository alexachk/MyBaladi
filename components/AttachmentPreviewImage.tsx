import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { getAttachmentPreviewUri } from '../lib/appwrite/storage';

interface AttachmentPreviewImageProps {
  fileId: string;
  width?: number;
  style?: StyleProp<ImageStyle>;
}

export function AttachmentPreviewImage({ fileId, width = 400, style }: AttachmentPreviewImageProps) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAttachmentPreviewUri(fileId, width).then((next) => {
      if (!cancelled) setUri(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fileId, width]);

  if (!uri) {
    return (
      <View style={[style, styles.placeholder]}>
        <ActivityIndicator color={colors.grey400} />
      </View>
    );
  }

  return <Image source={{ uri }} style={style} />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grey100,
  },
});
