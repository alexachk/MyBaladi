import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../constants/theme';

interface MachineryBackgroundProps {
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  position?: 'top' | 'bottom' | 'center';
}

export function MachineryBackground({
  opacity = 0.18,
  style,
  position = 'bottom',
}: MachineryBackgroundProps) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, style]}>
      <View style={styles.tint} />
      <Image
        source={require('../assets/machinery-bg.png')}
        style={[styles.image, positionStyle(position), { opacity }]}
        resizeMode="cover"
      />
    </View>
  );
}

function positionStyle(position: 'top' | 'bottom' | 'center') {
  if (position === 'top') return { top: 0, height: '70%' as const };
  if (position === 'center') return { top: '15%' as const, height: '70%' as const };
  return { bottom: 0, height: '75%' as const };
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  image: {
    position: 'absolute',
    left: -140,
    right: -20,
    width: undefined,
  },
});
