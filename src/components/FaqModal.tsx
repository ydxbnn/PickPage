import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Palette } from '../theme';

type Props = {
  visible: boolean;
  palette: Palette;
  initialTutorialOpen?: boolean;
  onClose: () => void;
  onOpenRedLight: () => void;
};

type FaqItem = {
  id: string;
  title: string;
  answer: string;
  badge?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const THIRD_PARTY_WARNING =
  'Key 会经过第三方服务器，本 App 纯本地隐私承诺在中转场景不适用，请自行评估可信度。';

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert('无法打开浏览器', '请手动在浏览器访问该地址。');
  });
}

export default function FaqModal({
  visible,
  palette,
  initialTutorialOpen = false,
  onClose,
  onOpenRedLight,
}: Props) {
  const [tutorialOpen, setTutorialOpen] = useState(initialTutorialOpen);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setTutorialOpen(initialTutorialOpen);
    setOpenIds(new Set());
  }, [initialTutorialOpen, visible]);

  const toggle = (id: string) => {
    setOpenIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groups = useMemo(() => {
    const api: FaqItem[] = [
      {
        id: 'api-openai',
        title: 'OpenAI 官方 API Key',
        badge: '官方',
        answer: '打开官网创建 Key；Base URL 填 https://api.openai.com/v1，模型填对应 GPT 名称。',
        actionLabel: '打开 OpenAI 官网',
        onAction: () => openUrl('https://platform.openai.com/api-keys'),
      },
      {
        id: 'api-deepseek',
        title: 'DeepSeek 官方 API Key',
        badge: '官方',
        answer: '官网创建 Key；Base URL 填 https://api.deepseek.com/v1，模型填 deepseek-chat。',
        actionLabel: '打开 DeepSeek 官网',
        onAction: () => openUrl('https://platform.deepseek.com/api_keys'),
      },
      {
        id: 'api-gemini',
        title: 'Gemini 官方 API Key',
        badge: '官方',
        answer: '在 Google AI Studio 创建 Key；使用兼容端点时请按页面说明填写 Base URL 与模型。',
        actionLabel: '打开 Gemini 官网',
        onAction: () => openUrl('https://aistudio.google.com/app/apikey'),
      },
      {
        id: 'api-relay',
        title: '第三方中转站（示例）',
        badge: '第三方',
        answer: THIRD_PARTY_WARNING,
        actionLabel: '打开第三方站点',
        onAction: () => openUrl('https://openrouter.ai/keys'),
      },
    ];

    const trouble: FaqItem[] = [
      {
        id: 'help-key',
        title: 'API Key 怎么填？',
        answer: '设置 → API Key 粘贴 Key；Base URL 与模型必须匹配。401 多为 Key 错，404 多为地址错。',
      },
      {
        id: 'help-red',
        title: '红灯一直亮怎么办？',
        answer: '点首页红灯打开处理弹框，先用「一键重启后端」，不行再点「跳转电池优化白名单」。',
        actionLabel: '打开红灯处理',
        onAction: onOpenRedLight,
      },
      {
        id: 'help-fetch',
        title: '抓取失败 / 正文为空？',
        answer: '404/403/429/5xx 看 reason 提示；EMPTY_BODY 是动态加载页面，静态抓取抓不到正文，不会调用 AI。',
      },
    ];

    const privacy: FaqItem[] = [
      {
        id: 'privacy-local',
        title: '本地沙盒，不上云',
        answer: '快照、摘要与日志默认只存本机；API Key 存在 Android Keystore，不写入普通存储。',
      },
      {
        id: 'privacy-third-party',
        title: '第三方中转例外',
        answer: THIRD_PARTY_WARNING,
      },
    ];

    return [
      { key: 'api' as const, title: 'API 导航', items: api },
      { key: 'trouble' as const, title: '常见问题排查', items: trouble },
      { key: 'privacy' as const, title: '隐私说明', items: privacy },
    ];
  }, [onOpenRedLight]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: palette.text }]}>FAQ · 新手指南</Text>
            <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
              官方导航、故障排查与隐私说明
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭 FAQ"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={[styles.closeText, { color: palette.text }]}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => setTutorialOpen((value) => !value)}
            style={[
              styles.tutorialEntry,
              { backgroundColor: palette.surface, borderColor: palette.accent },
            ]}
          >
            <View style={styles.tutorialEntryText}>
              <Text style={[styles.tutorialEntryTitle, { color: palette.text }]}>
                完整新手教程
              </Text>
              <Text style={[styles.tutorialEntrySub, { color: palette.textSecondary }]}>
                从启动后端到 AI 总结，一步步走完
              </Text>
            </View>
            <Text style={[styles.tutorialChevron, { color: palette.accent }]}>
              {tutorialOpen ? '−' : '+'}
            </Text>
          </Pressable>

          {tutorialOpen ? (
            <View
              style={[
                styles.tutorialPanel,
                { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.tutorialStep, { color: palette.text }]}>
                1. 启动本地 mimi_server.py，确认 /health 返回 200。
              </Text>
              <Text style={[styles.tutorialStep, { color: palette.text }]}>
                2. 设置里填 API Key、Base URL、模型；官方与第三方入口见下方。
              </Text>
              <Text style={[styles.tutorialStep, { color: palette.text }]}>
                3. 复制网页内容，点悬浮气泡「保存快照」；SUCCESS 才会生成 AI 总结。
              </Text>
              <Text style={[styles.tutorialStep, { color: palette.text }]}>
                4. 亮红灯时用一键重启或电池白名单；3 次红灯进入深度排查。
              </Text>
            </View>
          ) : null}

          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={[styles.groupTitle, { color: palette.textSecondary }]}>
                {group.title}
              </Text>
              {group.items.map((item) => {
                const expanded = openIds.has(item.id);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.faqCard,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                    ]}
                  >
                    <Pressable onPress={() => toggle(item.id)} style={styles.faqTitleRow}>
                      <Text style={[styles.faqTitle, { color: palette.text }]}>
                        {item.title}
                      </Text>
                      {item.badge ? (
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                item.badge === '官方'
                                  ? palette.surfaceMuted
                                  : palette.dangerSurface,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color:
                                  item.badge === '官方' ? palette.success : palette.danger,
                              },
                            ]}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[styles.chevron, { color: palette.textSecondary }]}>
                        {expanded ? '−' : '+'}
                      </Text>
                    </Pressable>

                    {expanded ? (
                      <View style={styles.answerWrap}>
                        <Text
                          style={[styles.answer, { color: palette.textSecondary }]}
                          numberOfLines={3}
                        >
                          {item.answer}
                        </Text>
                        {item.actionLabel && item.onAction ? (
                          <Pressable
                            onPress={item.onAction}
                            style={({ pressed }) => [
                              styles.actionButton,
                              {
                                backgroundColor: palette.surfaceMuted,
                                borderColor: palette.border,
                                opacity: pressed ? 0.7 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.actionText, { color: palette.accent }]}>
                              {item.actionLabel}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 3 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  closeText: { fontSize: 25, lineHeight: 28 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
  tutorialEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  tutorialEntryText: { flex: 1 },
  tutorialEntryTitle: { fontSize: 15, fontWeight: '800' },
  tutorialEntrySub: { fontSize: 11, lineHeight: 17, marginTop: 3 },
  tutorialChevron: { fontSize: 22 },
  tutorialPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    gap: 8,
  },
  tutorialStep: { fontSize: 12, lineHeight: 19 },
  group: { marginTop: 20 },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 2,
  },
  faqCard: {
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  faqTitle: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  badge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  chevron: { fontSize: 19, width: 16, textAlign: 'center' },
  answerWrap: { paddingHorizontal: 14, paddingBottom: 12 },
  answer: { fontSize: 12, lineHeight: 19 },
  actionButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginTop: 8,
  },
  actionText: { fontSize: 12, fontWeight: '800' },
});
