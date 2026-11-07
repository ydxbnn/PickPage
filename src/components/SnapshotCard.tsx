import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelativeTime } from '../format';
import type { Palette } from '../theme';
import type { Snapshot } from '../types';

type Props = {
  snapshot: Snapshot;
  palette: Palette;
  checking: boolean;
  onOpen: () => void;
  onOpenOriginal: () => void;
  onLongPress: () => void;
};

export default function SnapshotCard({
  snapshot,
  palette,
  checking,
  onOpen,
  onOpenOriginal,
  onLongPress,
}: Props) {
  const hasUrl = !!snapshot.url;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${snapshot.title}，点击查看来源网页，长按管理`}
      onPress={onOpen}
      onLongPress={onLongPress}
      delayLongPress={450}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
          {snapshot.title}
        </Text>
        {snapshot.dead ? (
          <View style={[styles.deadTag, { backgroundColor: palette.dangerSurface }]}>
            <Text style={[styles.deadTagText, { color: palette.danger }]}>已失效</Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.quote,
          {
            backgroundColor: palette.surfaceMuted,
            borderLeftColor: snapshot.dead ? palette.danger : palette.accent,
          },
        ]}
      >
        <Text style={[styles.snapshotText, { color: palette.text }]} numberOfLines={7}>
          {snapshot.text}
        </Text>
      </View>

      {snapshot.serviceMessage ? (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: palette.dangerSurface, borderLeftColor: palette.danger },
          ]}
        >
          <Text style={[styles.errorTitle, { color: palette.danger }]}>抓取没有完成</Text>
          <Text style={[styles.errorText, { color: palette.text }]}>
            {snapshot.serviceMessage}
          </Text>
        </View>
      ) : null}

      {snapshot.aiState === 'loading' ? (
        <View
          style={[
            styles.aiCard,
            { backgroundColor: palette.surfaceMuted, borderLeftColor: palette.accent },
          ]}
        >
          <View style={styles.aiHeader}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={[styles.aiLabel, { color: palette.accent }]}>AI 正在总结这页…</Text>
          </View>
        </View>
      ) : null}

      {snapshot.aiState === 'done' && snapshot.aiSummary ? (
        <View
          style={[
            styles.aiCard,
            { backgroundColor: palette.surfaceMuted, borderLeftColor: palette.success },
          ]}
        >
          <View style={styles.aiHeader}>
            <Text style={[styles.aiSpark, { color: palette.success }]}>✦</Text>
            <Text style={[styles.aiLabel, { color: palette.success }]}>AI 总结</Text>
          </View>
          <Text style={[styles.aiText, { color: palette.text }]}>{snapshot.aiSummary}</Text>
        </View>
      ) : null}

      {snapshot.aiState === 'error' && snapshot.aiError ? (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: palette.dangerSurface, borderLeftColor: palette.danger },
          ]}
        >
          <Text style={[styles.errorTitle, { color: palette.danger }]}>
            AI 总结没有生成
          </Text>
          <Text style={[styles.errorText, { color: palette.text }]}>
            {snapshot.aiError}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.sourceRow}>
          {checking ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <Text style={[styles.linkIcon, { color: hasUrl ? palette.accent : palette.textSecondary }]}>
              {hasUrl ? '↗' : '·'}
            </Text>
          )}
          <Text
            style={[styles.source, { color: hasUrl ? palette.accent : palette.textSecondary }]}
            numberOfLines={1}
          >
            {snapshot.url ?? '纯文字快照 · 无来源链接'}
          </Text>
        </View>
        <View style={styles.footerActions}>
          {hasUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看原文"
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                onOpenOriginal();
              }}
              style={({ pressed }) => [
                styles.originalButton,
                { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.originalText, { color: palette.accent }]}>
                查看原文 ↗
              </Text>
            </Pressable>
          ) : null}
          <Text style={[styles.time, { color: palette.textSecondary }]}>
            {formatRelativeTime(snapshot.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  deadTag: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  deadTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quote: {
    marginTop: 11,
    borderRadius: 10,
    borderLeftWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  snapshotText: {
    fontSize: 14,
    lineHeight: 21,
  },
  errorCard: {
    marginTop: 10,
    borderRadius: 12,
    borderLeftWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 4,
  },
  aiCard: {
    marginTop: 10,
    borderRadius: 12,
    borderLeftWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiSpark: {
    fontSize: 13,
    fontWeight: '800',
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  aiText: {
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 11,
  },
  sourceRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  linkIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  source: {
    flexShrink: 1,
    fontSize: 12,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalButton: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  originalText: {
    fontSize: 11,
    fontWeight: '800',
  },
  time: {
    fontSize: 11,
  },
});
