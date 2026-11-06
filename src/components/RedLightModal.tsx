import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Palette } from '../theme';
import type { RedIssue } from '../types';

type Props = {
  visible: boolean;
  palette: Palette;
  issue: RedIssue | null;
  backendOnline: boolean;
  redStreak: number;
  restarting: boolean;
  exporting: boolean;
  canOpenBattery: boolean;
  onClose: () => void;
  onRestart: () => void;
  onOpenBattery: () => void;
  onShowResidentHelp: () => void;
  onExportLogs: () => void;
};

type ActionButtonProps = {
  title: string;
  hint: string;
  disabled?: boolean;
  disabledReason?: string;
  busy?: boolean;
  primary?: boolean;
  palette: Palette;
  onPress: () => void;
};

function ActionButton({
  title,
  hint,
  disabled,
  disabledReason,
  busy,
  primary,
  palette,
  onPress,
}: ActionButtonProps) {
  return (
    <View style={styles.actionWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionButton,
          {
            backgroundColor: primary ? palette.accent : palette.surfaceMuted,
            borderColor: primary ? palette.accent : palette.border,
            opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={primary ? '#FFFFFF' : palette.accent} />
        ) : (
          <>
            <Text
              style={[
                styles.actionTitle,
                { color: primary ? '#FFFFFF' : palette.text },
              ]}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.actionHint,
                { color: primary ? 'rgba(255,255,255,0.82)' : palette.textSecondary },
              ]}
            >
              {hint}
            </Text>
          </>
        )}
      </Pressable>
      {disabled && disabledReason ? (
        <Text style={[styles.disabledReason, { color: palette.textSecondary }]}>
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

export default function RedLightModal({
  visible,
  palette,
  issue,
  backendOnline,
  redStreak,
  restarting,
  exporting,
  canOpenBattery,
  onClose,
  onRestart,
  onOpenBattery,
  onShowResidentHelp,
  onExportLogs,
}: Props) {
  const reason = issue?.reason || '暂无服务错误记录。｜可先做一次自检。';
  const statusLine = issue
    ? `${issue.status} · HTTP ${issue.httpCode || '--'} · 重试 ${issue.retryCount} 次`
    : '服务状态未知';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.redDot, { backgroundColor: palette.danger }]}>
              <Text style={styles.redDotText}>!</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: palette.text }]}>本地服务亮红灯</Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                {statusLine}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭排查弹框" onPress={onClose} hitSlop={10}>
              <Text style={[styles.close, { color: palette.textSecondary }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.reasonBox, { backgroundColor: palette.dangerSurface }]}>
              <Text style={[styles.reason, { color: palette.danger }]}>{reason}</Text>
              <Text style={[styles.retryLine, { color: palette.textSecondary }]}>
                {issue?.retryable ? '建议稍后再试' : '暂不建议继续重试'}
                {redStreak > 0 ? ` · 连续红灯 ${redStreak}/3` : ''}
              </Text>
            </View>

            <ActionButton
              title="一键重启后端"
              hint="重启本地 Python 服务并等待它恢复"
              disabled={!backendOnline}
              disabledReason="后端当前离线，App 无法直接启动 Termux 进程；请先在终端执行启动脚本。"
              busy={restarting}
              primary
              palette={palette}
              onPress={onRestart}
            />

            <ActionButton
              title="跳转电池优化白名单"
              hint="Android 系统设置 · 允许后台常驻"
              disabled={!canOpenBattery}
              disabledReason="当前系统不支持直接跳转，请手动前往系统设置 → 应用 → 电池。"
              palette={palette}
              onPress={onOpenBattery}
            />

            <ActionButton
              title="后台常驻设置说明"
              hint="查看系统省电限制与放行步骤"
              palette={palette}
              onPress={onShowResidentHelp}
            />

            {redStreak >= 3 ? (
              <View
                style={[
                  styles.deepBox,
                  { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.deepTitle, { color: palette.danger }]}>
                  深度排查模式
                </Text>
                <Text style={[styles.deepDesc, { color: palette.textSecondary }]}>
                  连续 3 次红灯，已收集本次错误与服务日志，可导出后排查。
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={exporting}
                  onPress={onExportLogs}
                  style={({ pressed }) => [
                    styles.exportButton,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.danger,
                      opacity: exporting ? 0.55 : pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  {exporting ? (
                    <ActivityIndicator color={palette.danger} />
                  ) : (
                    <Text style={[styles.exportText, { color: palette.danger }]}>
                      导出排查日志
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
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
    paddingHorizontal: 18,
    backgroundColor: 'rgba(10, 16, 13, 0.6)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    elevation: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  redDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redDotText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  close: {
    fontSize: 25,
    lineHeight: 26,
    paddingHorizontal: 2,
  },
  scroll: {
    marginTop: 12,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  reasonBox: {
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 12,
  },
  reason: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  retryLine: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  actionWrap: {
    marginBottom: 9,
  },
  actionButton: {
    minHeight: 54,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  disabledReason: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  deepBox: {
    marginTop: 4,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 13,
  },
  deepTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  deepDesc: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  exportButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  exportText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
