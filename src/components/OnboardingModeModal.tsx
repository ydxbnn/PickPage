import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '../theme';
import type { UserMode } from '../types';

type Props = {
  visible: boolean;
  palette: Palette;
  onSelect: (mode: UserMode) => void;
};

export default function OnboardingModeModal({ visible, palette, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: palette.surfaceMuted }]}>
            <Text style={[styles.badgeText, { color: palette.accent }]}>第一次来拾页</Text>
          </View>
          <Text style={[styles.title, { color: palette.text }]}>你是哪一派？</Text>
          <Text style={[styles.desc, { color: palette.textSecondary }]}>
            选好模式后不再自动打扰；随时可以在设置里切换，也能重新打开完整教程。
          </Text>

          <Pressable
            onPress={() => onSelect('newbie')}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.accent, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={styles.primaryText}>我是新手，带我看一遍</Text>
          </Pressable>

          <Pressable
            onPress={() => onSelect('veteran')}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: palette.surfaceMuted,
                borderColor: palette.border,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.secondaryText, { color: palette.text }]}>
              我是老手，直接开始
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(10, 16, 13, 0.56)',
  },
  card: {
    width: '100%',
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    marginTop: 14,
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 18,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
