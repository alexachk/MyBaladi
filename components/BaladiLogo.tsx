import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../constants/theme';

type LogoVariant = 'full' | 'compact' | 'icon';

interface BaladiLogoProps {
  variant?: LogoVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showSubtitle?: boolean;
}

function LogoMark({ size }: { size: number }) {
  return (
    <View
      style={[
        markStyles.mark,
        {
          width: size,
          height: size,
          borderRadius: size * 0.24,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          markStyles.letter,
          {
            fontSize: size * 0.62,
            lineHeight: size * 0.7,
          },
        ]}
      >
        B
      </Text>
      <View
        style={[
          markStyles.dot,
          {
            right: size * 0.16,
            bottom: size * 0.16,
            width: size * 0.11,
            height: size * 0.11,
            borderRadius: size * 0.06,
          },
        ]}
      />
    </View>
  );
}

function Wordmark({ size, showSubtitle }: { size: number; showSubtitle: boolean }) {
  const dotDiameter = size * 0.3;
  const iWrapWidth = size * 0.42;
  return (
    <View style={wordmarkStyles.container}>
      <View style={wordmarkStyles.row}>
        <Text allowFontScaling={false} style={[wordmarkStyles.my, { fontSize: size * 0.52 }]}>
          My
        </Text>
        <Text allowFontScaling={false} style={[wordmarkStyles.baladi, { fontSize: size }]}>
          Balad
        </Text>
        <View style={[wordmarkStyles.iWrap, { width: iWrapWidth }]}>
          <Text allowFontScaling={false} style={[wordmarkStyles.baladi, { fontSize: size }]}>
            i
          </Text>
          <View
            style={[
              wordmarkStyles.iDot,
              {
                width: dotDiameter,
                height: dotDiameter,
                borderRadius: dotDiameter / 2,
                top: size * 0.06,
              },
            ]}
          />
        </View>
      </View>
      {showSubtitle ? (
        <Text
          allowFontScaling={false}
          style={[
            wordmarkStyles.subtitle,
            {
              fontSize: size * 0.3,
              letterSpacing: size * 0.08,
              marginTop: size * 0.12,
            },
          ]}
        >
          BALADI FRÈRES SAL
        </Text>
      ) : null}
    </View>
  );
}

export function BaladiLogo({
  variant = 'full',
  size,
  style,
  showSubtitle = true,
}: BaladiLogoProps) {
  if (variant === 'icon') {
    return (
      <View style={style}>
        <LogoMark size={size ?? 56} />
      </View>
    );
  }

  if (variant === 'compact') {
    const markSize = size ?? 32;
    return (
      <View style={[layoutStyles.compactRow, style]}>
        <LogoMark size={markSize} />
        <Wordmark size={markSize * 0.55} showSubtitle={false} />
      </View>
    );
  }

  const markSize = size ?? 52;
  return (
    <View style={[layoutStyles.fullRow, style]}>
      <LogoMark size={markSize} />
      <Wordmark size={markSize * 0.58} showSubtitle={showSubtitle} />
    </View>
  );
}

export function BaladiLogoMark({ size = 56 }: { size?: number }) {
  return <LogoMark size={size} />;
}

const markStyles = StyleSheet.create({
  mark: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: colors.black,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: -1,
  },
  dot: {
    position: 'absolute',
    backgroundColor: colors.black,
  },
});

const wordmarkStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  my: {
    color: colors.grey600,
    fontWeight: '500',
    marginRight: 3,
    includeFontPadding: false,
  },
  baladi: {
    color: colors.black,
    fontWeight: '800',
    letterSpacing: -0.6,
    includeFontPadding: false,
  },
  iWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iDot: {
    position: 'absolute',
    backgroundColor: colors.primary,
    alignSelf: 'center',
  },
  subtitle: {
    color: colors.grey600,
    fontWeight: '600',
  },
});

const layoutStyles = StyleSheet.create({
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
