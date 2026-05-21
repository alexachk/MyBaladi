import { useMemo } from 'react';
import { PanResponder, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

type Edge = 'left' | 'right';

interface Props {
  onOpen: () => void;
  /** Which screen edge listens for the gesture. */
  edge?: Edge;
  /** Width of the edge zone that listens for the gesture. Default 24px. */
  edgeWidth?: number;
  /** Minimum horizontal swipe distance to trigger open. Default 60px. */
  triggerDistance?: number;
  style?: ViewStyle;
}

export function EdgeSwipeOpener({
  onOpen,
  edge = 'left',
  edgeWidth = 24,
  triggerDistance = 60,
  style,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          const x = evt.nativeEvent.pageX;
          if (edge === 'left') return x <= edgeWidth;
          return x >= screenWidth - edgeWidth;
        },
        onMoveShouldSetPanResponder: (evt, gesture) => {
          const x = evt.nativeEvent.pageX;
          const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2;
          if (edge === 'left') {
            return x <= edgeWidth + 12 && horizontal && gesture.dx > 8;
          }
          return x >= screenWidth - edgeWidth - 12 && horizontal && gesture.dx < -8;
        },
        onPanResponderRelease: (_, gesture) => {
          const horizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy);
          const passed =
            edge === 'left'
              ? horizontal && gesture.dx > triggerDistance
              : horizontal && gesture.dx < -triggerDistance;
          if (passed) onOpen();
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [edge, edgeWidth, triggerDistance, onOpen, screenWidth],
  );

  return (
    <View
      collapsable={false}
      style={[
        styles.zone,
        edge === 'left' ? { left: 0, width: edgeWidth } : { right: 0, width: edgeWidth },
        style,
      ]}
      {...responder.panHandlers}
    />
  );
}

const styles = StyleSheet.create({
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: 'transparent',
  },
});
