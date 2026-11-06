import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '../theme';
import type { Notice } from '../types';

type Props = {
  notice: Notice;
  palette: Palette;
  topOffset: number;
  onDismiss: () => void;
};

export default function NoticeBanner({ notice, palette, topOffset, onDismiss }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const isDead = notice.kind === 'dead';
  const foreground = isDead ? '#FFFFFF' : palette.text;
  const secondary = isDead ? 'rgba(255,255,255,0.82)' : palette.textSecondary;
  const background = isDead ? palette.danger : palette.surface;

  useEffect(() => {
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
      mass: 0.8,
    }).start();
  }, [notice.id, progress]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: topOffset,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        onPress={onDismiss}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: background,
            borderColor: isDead ? background : palette.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isDead ? 'rgba(255,255,255,0.18)' : palette.surfaceMuted },
          ]}
        >
          <Text style={[styles.icon, { color: isDead ? '#FFFFFF' : palette.accent }]}>
            {isDead ? '!' : 'i'}
          </Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: foreground }]}>{notice.title}</Text>
          {notice.message ? (
            <Text style={[styles.message, { color: secondary }]} numberOfLines={2}>
              {notice.message}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.close, { color: secondary }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  icon: {
    fontSize: 15,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  close: {
    fontSize: 19,
    lineHeight: 22,
    paddingHorizontal: 2,
  },
});
