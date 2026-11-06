import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelativeTime } from '../format';
import type { Palette } from '../theme';
import type { Snapshot } from '../types';

type Props = {
  snapshot: Snapshot;
  palette: Palette;
  checking: boolean;
  onOpen: () => void;
  onLongPress: () => void;
};

export default function SnapshotCard({
  snapshot,
  palette,
  checking,
  onOpen,
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
        <Text style={[styles.time, { color: palette.textSecondary }]}>
          {formatRelativeTime(snapshot.createdAt)}
        </Text>
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
  time: {
    fontSize: 11,
  },
});
