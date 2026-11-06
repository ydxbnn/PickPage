import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import FloatingMemo from './modules/floating-memo';
import FaqModal from './src/components/FaqModal';
import NoticeBanner from './src/components/NoticeBanner';
import OnboardingModeModal from './src/components/OnboardingModeModal';
import SettingsModal from './src/components/SettingsModal';
import SnapshotCard from './src/components/SnapshotCard';
import {
  DEFAULT_AI_SETTINGS,
  hasAIConfig,
  loadAISettings,
  summarizeWithAI,
  type AISettings,
} from './src/lib/ai';
import { fetchPageFromBackend } from './src/lib/backend';
import { checkUrlAlive, createPendingSnapshot } from './src/lib/url';
import {
  loadFloatingEnabled,
  loadSnapshots,
  loadUserMode,
  saveFloatingEnabled,
  saveSnapshots,
  saveUserMode,
} from './src/storage';
import { darkPalette, lightPalette } from './src/theme';
import type { Notice, Snapshot, UserMode } from './src/types';

async function ensureNotificationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // 通知不显示不影响悬浮窗
  }
}

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? darkPalette : lightPalette;

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [faqVisible, setFaqVisible] = useState(false);
  const [faqTutorialOpen, setFaqTutorialOpen] = useState(false);
  const [userMode, setUserMode] = useState<UserMode | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  const snapshotsRef = useRef<Snapshot[]>([]);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeIdRef = useRef(0);
  const pendingEnableRef = useRef(false);
  const aiSettingsRef = useRef<AISettings>(DEFAULT_AI_SETTINGS);

  const topInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;

  const commitSnapshots = useCallback((next: Snapshot[]) => {
    snapshotsRef.current = next;
    setSnapshots(next);
    void saveSnapshots(next);
  }, []);

  const patchSnapshot = useCallback(
    (id: string, patch: Partial<Snapshot>) => {
      const next = snapshotsRef.current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      commitSnapshots(next);
    },
    [commitSnapshots],
  );

  const showNotice = useCallback((noticeValue: Omit<Notice, 'id'>, duration = 5200) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeIdRef.current += 1;
    setNotice({ ...noticeValue, id: noticeIdRef.current });
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, duration);
  }, []);

  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setNotice(null);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    FloatingMemo.setDarkMode(isDark).catch(() => {});
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    loadAISettings()
      .then((settings) => {
        if (cancelled) return;
        setAISettings(settings);
        aiSettingsRef.current = settings;
      })
      .catch(() => {
        // 安全存储不可用时保持未配置状态，不影响抓取和快照。
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAISettingsSaved = useCallback((next: AISettings) => {
    setAISettings(next);
    aiSettingsRef.current = next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    loadUserMode()
      .then((mode) => {
        if (cancelled) return;
        setUserMode(mode);
        if (!mode) {
          timer = setTimeout(() => setOnboardingVisible(true), 700);
        }
      })
      .catch(() => {
        // 读取失败时仍可使用老手模式
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleSelectMode = useCallback(async (mode: UserMode) => {
    setUserMode(mode);
    await saveUserMode(mode);
    setOnboardingVisible(false);
    if (mode === 'newbie') {
      setFaqTutorialOpen(true);
      setFaqVisible(true);
    }
  }, []);

  const openFaq = useCallback((tutorialOpen = false) => {
    setFaqTutorialOpen(tutorialOpen);
    setFaqVisible(true);
  }, []);

  const startWatcher = useCallback(async () => {
    try {
      await FloatingMemo.startClipboardWatcher();
    } catch {
      // 个别系统会限制剪贴板监听，不影响已有功能
    }
  }, []);

  const stopWatcher = useCallback(async () => {
    try {
      await FloatingMemo.stopClipboardWatcher();
    } catch {
      // 忽略
    }
  }, []);

  /** 保存剪贴板内容，并在后台补齐网页 title / meta description。 */
  const saveSnapshotFromText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;

      const pending = createPendingSnapshot(text);
      commitSnapshots([pending, ...snapshotsRef.current]);

      if (!pending.url) return;

      const backend = await fetchPageFromBackend(pending.url);
      if (!snapshotsRef.current.some((item) => item.id === pending.id)) return;

      const backendBody = backend.body_text?.trim() ?? '';
      if (backend.status !== 'SUCCESS' || !backendBody) {
        const retryNote = backend.retryable ? '（建议重试）' : '（不建议重试）';
        const emptyHint = '这个页面正文是动态加载的，暂时抓不到';
        const message =
          backend.status === 'EMPTY_BODY'
            ? `${emptyHint}\n${backend.reason || ''}`
            : `${backend.reason || '抓取没有完成。'}${retryNote}`;
        const isNotFound = backend.http_code === 404 || backend.http_code === 410;

        patchSnapshot(pending.id, {
          title: backend.title?.trim() || pending.title,
          fetchState: 'failed',
          serviceMessage: message,
          aiState: 'skipped',
          aiSummary: null,
          aiError: null,
          dead: isNotFound,
        });
        return;
      }

      const pageTitle = backend.title?.trim() || pending.title;
      const settingsForRequest = aiSettingsRef.current;
      const aiReady = hasAIConfig(settingsForRequest);

      patchSnapshot(pending.id, {
        title: pageTitle,
        pageSummary: backendBody,
        description: backendBody,
        fetchState: 'ok',
        serviceMessage: null,
        dead: false,
        aiState: aiReady ? 'loading' : 'skipped',
        aiError: null,
      });

      if (!aiReady) return;

      const aiResult = await summarizeWithAI(settingsForRequest, {
        title: pageTitle,
        summary: backendBody,
        url: pending.url,
      });
      if (!snapshotsRef.current.some((item) => item.id === pending.id)) return;

      if (aiResult.ok) {
        patchSnapshot(pending.id, {
          aiState: 'done',
          aiSummary: aiResult.text,
          aiError: null,
        });
      } else {
        patchSnapshot(pending.id, {
          aiState: 'error',
          aiSummary: null,
          aiError: aiResult.message,
        });
      }
    },
    [commitSnapshots, patchSnapshot],
  );

  // 首次加载：恢复本地列表与悬浮窗状态。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, floatingPref] = await Promise.all([loadSnapshots(), loadFloatingEnabled()]);
      if (cancelled) return;

      snapshotsRef.current = stored;
      setSnapshots(stored);
      setLoaded(true);

      if (!floatingPref) return;
      try {
        const hasPermission = await FloatingMemo.hasOverlayPermission();
        const ok = hasPermission && (await FloatingMemo.show());
        if (cancelled) return;
        setFloatingEnabled(ok);
        if (ok) {
          await startWatcher();
          await ensureNotificationPermission();
        } else {
          await saveFloatingEnabled(false);
        }
      } catch {
        if (!cancelled) setFloatingEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startWatcher]);

  // 原生悬浮面板点了「保存快照」。
  useEffect(() => {
    const sub = FloatingMemo.addListener('onSnapshot', (event) => {
      void saveSnapshotFromText(event.text);
    });
    return () => sub.remove();
  }, [saveSnapshotFromText]);

  // 长按关闭或通知栏关闭后，同步主界面开关。
  useEffect(() => {
    const sub = FloatingMemo.addListener('onDismiss', () => {
      setFloatingEnabled(false);
      void saveFloatingEnabled(false);
      void stopWatcher();
    });
    return () => sub.remove();
  }, [stopWatcher]);

  const enableFloating = useCallback(async () => {
    try {
      if (!(await FloatingMemo.hasOverlayPermission())) {
        pendingEnableRef.current = true;
        await FloatingMemo.requestOverlayPermission();
        Alert.alert(
          '需要悬浮窗权限',
          '请开启「显示在其他应用上层」，然后回到 PickPage，悬浮窗会自动打开。',
        );
        return;
      }

      await ensureNotificationPermission();
      const ok = await FloatingMemo.show();
      setFloatingEnabled(ok);
      await saveFloatingEnabled(ok);
      if (ok) {
        await startWatcher();
      } else {
        Alert.alert('开启失败', '悬浮窗没有显示成功，请稍后再试。');
      }
    } catch {
      Alert.alert('开启失败', '悬浮窗没有显示成功，请检查系统权限。');
    }
  }, [startWatcher]);

  const disableFloating = useCallback(async () => {
    try {
      await FloatingMemo.hide();
    } catch {
      // 忽略
    }
    setFloatingEnabled(false);
    await saveFloatingEnabled(false);
    await stopWatcher();
  }, [stopWatcher]);

  const toggleFloating = useCallback(() => {
    if (floatingEnabled) void disableFloating();
    else void enableFloating();
  }, [disableFloating, enableFloating, floatingEnabled]);

  // 从系统授权页回来：若用户刚才点了开启，则自动继续。
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      (async () => {
        if (pendingEnableRef.current) {
          pendingEnableRef.current = false;
          try {
            if (await FloatingMemo.hasOverlayPermission()) await enableFloating();
          } catch {
            // 忽略
          }
          return;
        }

        if (!floatingEnabled) return;
        try {
          const showing = await FloatingMemo.isShowing();
          if (!showing) {
            setFloatingEnabled(false);
            await saveFloatingEnabled(false);
            await stopWatcher();
          } else {
            await startWatcher();
          }
        } catch {
          // 忽略
        }
      })();
    });
    return () => sub.remove();
  }, [enableFloating, floatingEnabled, startWatcher, stopWatcher]);

  const handleOpenSnapshot = useCallback(
    async (snapshot: Snapshot) => {
      if (checkingId) return;

      if (!snapshot.url) {
        showNotice({
          kind: 'info',
          title: '这是一条纯文字快照',
          message: '没有来源链接可检查，原文已完整保存在本机。',
        });
        return;
      }

      setCheckingId(snapshot.id);
      try {
        const result = await checkUrlAlive(snapshot.url);
        if (result === 'ok') {
          if (snapshot.dead) patchSnapshot(snapshot.id, { dead: false });
          try {
            await Linking.openURL(snapshot.url);
          } catch {
            patchSnapshot(snapshot.id, { dead: true });
            showNotice(
              {
                kind: 'dead',
                title: '原网页已失效，正在为你展示本地快照',
                message: `无法打开：${snapshot.url}`,
              },
              7600,
            );
          }
          return;
        }

        patchSnapshot(snapshot.id, { dead: true });
        showNotice(
          {
            kind: 'dead',
            title: '原网页已失效，正在为你展示本地快照',
            message:
              result === 'network_error'
                ? '网络请求失败，可能是链接失效或当前没有网络。'
                : `原网址：${snapshot.url}`,
          },
          7600,
        );
      } finally {
        setCheckingId(null);
      }
    },
    [checkingId, patchSnapshot, showNotice],
  );

  const handleManageSnapshot = useCallback(
    (snapshot: Snapshot) => {
      Alert.alert(snapshot.title, '这条快照只保存在你的手机里。', [
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            commitSnapshots(snapshotsRef.current.filter((item) => item.id !== snapshot.id));
          },
        },
        { text: '取消', style: 'cancel' },
      ]);
    },
    [commitSnapshots],
  );

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { paddingTop: topInset + 14 }]}>
        <View style={styles.brand}>
          <Text style={[styles.appName, { color: palette.text }]}>PickPage</Text>
          <Text style={[styles.tagline, { color: palette.textSecondary }]}>
            网页快照 · 不再失联
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开设置"
            onPress={() => setSettingsVisible(true)}
            style={({ pressed }) => [
              styles.settingsButton,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Text style={[styles.settingsIcon, { color: palette.text }]}>⚙</Text>
          </Pressable>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: floatingEnabled }}
            accessibilityLabel={floatingEnabled ? '关闭悬浮窗' : '开启悬浮窗'}
            onPress={toggleFloating}
            style={({ pressed }) => [
              styles.floatingPill,
              {
                backgroundColor: palette.surface,
                borderColor: floatingEnabled ? palette.accent : palette.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: floatingEnabled ? palette.success : palette.textSecondary },
              ]}
            />
            <Text
              style={[
                styles.floatingText,
                { color: floatingEnabled ? palette.accent : palette.textSecondary },
              ]}
            >
              悬浮窗 {floatingEnabled ? '开' : '关'}
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={snapshots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {!floatingEnabled && loaded ? (
              <Pressable
                onPress={() => void enableFloating()}
                style={({ pressed }) => [
                  styles.enableCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={styles.enableTextWrap}>
                  <Text style={[styles.enableTitle, { color: palette.text }]}>
                    复制一下，就留住一页
                  </Text>
                  <Text style={[styles.enableDesc, { color: palette.textSecondary }]}>
                    开启悬浮窗后，复制内容时气泡会闪一下，点开即可保存快照。
                  </Text>
                </View>
                <Text style={[styles.enableAction, { color: palette.accent }]}>开启 →</Text>
              </Pressable>
            ) : null}

            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                快照{loaded ? ` · ${snapshots.length}` : ''}
              </Text>
              {snapshots.length > 0 ? (
                <Text style={[styles.sectionHint, { color: palette.textSecondary }]}>
                  长按删除
                </Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <SnapshotCard
            snapshot={item}
            palette={palette}
            checking={checkingId === item.id}
            onOpen={() => void handleOpenSnapshot(item)}
            onLongPress={() => handleManageSnapshot(item)}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <View style={[styles.emptyMark, { borderColor: palette.border }]}>
                <Text style={[styles.emptyIcon, { color: palette.accent }]}>▤</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>还没有留过一页</Text>
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
                复制一段文字或链接，{'\n'}点悬浮气泡上的「保存快照」。
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          snapshots.length > 0 ? (
            <Text style={[styles.footerNote, { color: palette.textSecondary }]}>
              快照与原文只保存在本机
            </Text>
          ) : undefined
        }
      />

      {notice ? (
        <NoticeBanner
          notice={notice}
          palette={palette}
          topOffset={topInset + 86}
          onDismiss={dismissNotice}
        />
      ) : null}

      <OnboardingModeModal
        visible={onboardingVisible}
        palette={palette}
        onSelect={(mode) => void handleSelectMode(mode)}
      />

      <FaqModal
        visible={faqVisible}
        palette={palette}
        initialTutorialOpen={faqTutorialOpen}
        onClose={() => setFaqVisible(false)}
      />

      <SettingsModal
        visible={settingsVisible}
        palette={palette}
        initialSettings={aiSettings}
        userMode={userMode}
        onSelectMode={(mode) => void handleSelectMode(mode)}
        onOpenFaq={() => {
          setSettingsVisible(false);
          openFaq(true);
        }}
        onClose={() => setSettingsVisible(false)}
        onSaved={handleAISettingsSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  brand: {
    flex: 1,
    paddingRight: 14,
  },
  appName: {
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 12,
    letterSpacing: 0.3,
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 17,
    lineHeight: 20,
    marginTop: -1,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  floatingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 42,
  },
  enableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 20,
  },
  enableTextWrap: {
    flex: 1,
  },
  enableTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  enableDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  enableAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionHint: {
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 28,
  },
  emptyMark: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyIcon: {
    fontSize: 28,
    marginTop: -2,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 9,
  },
  footerNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.8,
  },
});
