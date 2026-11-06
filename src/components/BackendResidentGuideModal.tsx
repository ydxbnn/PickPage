import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Palette } from '../theme';

type Props = {
  visible: boolean;
  palette: Palette;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

export default function BackendResidentGuideModal({
  visible,
  palette,
  onOpenSettings,
  onDismiss,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityLabel="关闭后台常驻引导"
        />

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={[styles.engineBadge, { backgroundColor: palette.surfaceMuted }]}>
            <View style={[styles.engineDot, { backgroundColor: palette.success }]} />
            <Text style={[styles.engineBadgeText, { color: palette.textSecondary }]}>
              本地 Python 引擎 · 后台常驻
            </Text>
          </View>

          <Text style={[styles.title, { color: palette.text }]}>
            💡 开启后台常驻，让“拾页”更稳定
          </Text>
          <Text style={[styles.intro, { color: palette.textSecondary }]}>
            检测到本地抓取服务暂时未连接。开启后台常驻，能减少系统休眠对服务的打断。
          </Text>

          <View style={[styles.section, { backgroundColor: palette.surfaceMuted }]}>
            <Text style={[styles.sectionTitle, { color: palette.success }]}>
              ✅ 这个权限能干什么
            </Text>
            <Text style={[styles.sectionText, { color: palette.text }]}>
              允许本地 Python 引擎在后台持续运行，保障随时抓取网页、翻译 404 错误并提供防幻觉正文摘要。
            </Text>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: palette.dangerSurface, marginTop: 10 },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: palette.danger }]}>
              ❌ 这个权限不能干什么
            </Text>
            <Text style={[styles.sectionText, { color: palette.text }]}>
              绝不读取您的隐私相册、聊天记录或上传任何个人数据，所有计算均在手机本地完成。
            </Text>
          </View>

          <Text style={[styles.privacyNote, { color: palette.textSecondary }]}>
            仅引导系统后台设置，不会索取额外权限
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="立即前往系统后台设置"
              onPress={onOpenSettings}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: palette.accent, opacity: pressed ? 0.78 : 1 },
              ]}
            >
              <Text style={styles.primaryButtonText}>立即前往</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="暂时关闭后台常驻引导"
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: palette.surfaceMuted,
                  borderColor: palette.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
                暂时关闭
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 16, 13, 0.56)',
  },
  card: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  engineBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  engineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  engineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 14,
  },
  intro: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  section: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },
  privacyNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
