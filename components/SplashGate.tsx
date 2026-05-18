import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BaladiLogo } from './BaladiLogo';
import { MachineryBackground } from './MachineryBackground';
import { colors, spacing, typography } from '../constants/theme';

interface SplashGateProps {
  children: ReactNode;
  durationMs?: number;
}

export function SplashGate({ children, durationMs = 2500 }: SplashGateProps) {
  const [done, setDone] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 14,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: durationMs - 400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setDone(true));
    }, durationMs);

    return () => clearTimeout(t);
  }, [durationMs, opacity, scale, fadeOut, progress]);

  if (done) return <>{children}</>;

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      {children}
      <Animated.View
        pointerEvents={done ? 'none' : 'auto'}
        style={[styles.overlay, { opacity: fadeOut }]}
      >
        <MachineryBackground opacity={0.18} position="bottom" />
        <Animated.View style={[styles.center, { opacity, transform: [{ scale }] }]}>
          <BaladiLogo variant="full" size={72} />
          <Text style={styles.tagline}>Heavy equipment & field services</Text>
        </Animated.View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: barWidth }]} />
        </View>
        <Text style={styles.credit}>Made by Alexandre EL ACHKAR</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  center: {
    alignItems: 'center',
    gap: spacing.md,
  },
  tagline: {
    ...typography.caption,
    color: colors.grey600,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progressTrack: {
    position: 'absolute',
    bottom: spacing.xxl + 24,
    left: spacing.xl,
    right: spacing.xl,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.grey200,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  credit: {
    position: 'absolute',
    bottom: spacing.lg,
    ...typography.caption,
    color: colors.grey400,
    fontStyle: 'italic',
  },
});
