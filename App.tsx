import * as Clipboard from 'expo-clipboard';
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
  TextInput,
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
import { checkUrlAlive, createPendingSnapshot, extractSourceUrl } from './src/lib/url';
import {
  loadDraftUrl,
  loadFloatingEnabled,
  loadMinimalMode,
  loadSnapshots,
  loadUserMode,
  saveDraftUrl,
  saveFloatingEnabled,
  saveMinimalMode,
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
  const [manualFetching, setManualFetching] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [minimalMode, setMinimalMode] = useState(false);
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
  const urlInputRef = useRef('');
  const lastClipboardRef = useRef('');
  const wentBackgroundRef = useRef(false);
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

  const handleToggleMinimalMode = useCallback((enabled: boolean) => {
    setMinimalMode(enabled);
    setFaqVisible(false);
    void saveMinimalMode(enabled);
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
            : backend.status === 'BLOCKED'
              ? backend.reason || '对方开了防爬，请用浏览器打开原网页。'
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
        Alert.alert('抓取失败', message);
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

  const handleClipboardFetch = useCallback(async () => {
    if (manualFetching) return;
    setManualFetching(true);
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (!text) {
        showNotice({
          kind: 'info',
          title: '剪贴板是空的',
          message: '先复制一段网页链接或文字，再回来点「从剪贴板抓取」。',
        });
        return;
      }
      lastClipboardRef.current = text;
      urlInputRef.current = text;
      setUrlInput(text);
      void saveDraftUrl(text);
      await saveSnapshotFromText(text);
    } catch {
      Alert.alert('读取剪贴板失败', '请确认 App 在前台，并允许读取剪贴板后重试。');
    } finally {
      setManualFetching(false);
    }
  }, [manualFetching, saveSnapshotFromText, showNotice]);

  const handleTypedFetch = useCallback(async () => {
    const text = urlInputRef.current.trim();
    if (!text) {
      showNotice({
        kind: 'info',
        title: '还没有链接',
        message: '粘贴一个网页链接，或先点「从剪贴板抓取」。',
      });
      return;
    }
    if (manualFetching) return;
    setManualFetching(true);
    try {
      await saveSnapshotFromText(text);
    } catch {
      Alert.alert('抓取失败', '抓取过程中出现异常，请稍后重试。');
    } finally {
      setManualFetching(false);
    }
  }, [manualFetching, saveSnapshotFromText, showNotice]);

  // 回到前台自动检测剪贴板；退到后台时保存 URL 草稿和快照。
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        wentBackgroundRef.current = true;
        void saveDraftUrl(urlInputRef.current);
        void saveSnapshots(snapshotsRef.current);
        return;
      }
      if (nextState !== 'active' || !wentBackgroundRef.current) return;
      wentBackgroundRef.current = false;
      (async () => {
        try {
          const text = (await Clipboard.getStringAsync()).trim();
          if (!text || text === lastClipboardRef.current) return;
          lastClipboardRef.current = text;
          if (!extractSourceUrl(text)) return;

          urlInputRef.current = text;
          setUrlInput(text);
          void saveDraftUrl(text);
          Alert.alert('检测到新链接', '已填入抓取框，是否立即抓取？', [
            { text: '稍后', style: 'cancel' },
            {
              text: '抓取',
              onPress: () => {
                void saveSnapshotFromText(text).catch(() => {
                  Alert.alert('抓取失败', '抓取过程中出现异常，请重试。');
                });
              },
            },
          ]);
        } catch {
          // 系统不允许后台恢复时读取剪贴板，静默即可。
        }
      })();
    });
    return () => sub.remove();
  }, [saveSnapshotFromText]);

  // 首次加载：恢复本地列表与悬浮窗状态。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, floatingPref, draftUrl, minimalPref] = await Promise.all([
        loadSnapshots(),
        loadFloatingEnabled(),
        loadDraftUrl(),
        loadMinimalMode(),
      ]);
      if (cancelled) return;

      snapshotsRef.current = stored;
      setSnapshots(stored);
      urlInputRef.current = draftUrl;
      setUrlInput(draftUrl);
      setMinimalMode(minimalPref);
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
      void saveSnapshotFromText(event.text).catch(() => {
        Alert.alert('快照保存失败', '抓取过程中出现异常，请重试。');
      });
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

  const latestSnapshot = snapshots[0] ?? null;
  const minimalSummary = latestSnapshot
    ? latestSnapshot.aiState === 'loading'
      ? '正在生成总结…'
      : latestSnapshot.aiState === 'error'
        ? latestSnapshot.aiError || '总结失败，可以再试一次。'
        : latestSnapshot.aiSummary ||
          latestSnapshot.pageSummary ||
          latestSnapshot.serviceMessage ||
          '正在准备内容…'
    : '复制网页链接后，点上面的按钮开始。';

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

          {!minimalMode ? (
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
          ) : null}
        </View>
      </View>

      {minimalMode ? (
        <View style={styles.minimalContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="一键读取剪贴板并总结"
            disabled={manualFetching}
            onPress={() => void handleClipboardFetch()}
            style={({ pressed }) => [
              styles.minimalMainButton,
              {
                backgroundColor: palette.accent,
                opacity: manualFetching ? 0.6 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <Text style={styles.minimalMainTitle}>
              {manualFetching ? '正在读取并总结…' : '一键读取剪贴板并总结'}
            </Text>
            <Text style={styles.minimalMainDesc}>
              复制网页链接后点这里，剩下的交给拾页
            </Text>
          </Pressable>

          {!hasAIConfig(aiSettings) ? (
            <Pressable
              onPress={() => setSettingsVisible(true)}
              style={({ pressed }) => [
                styles.minimalKeyHint,
                { backgroundColor: palette.surface, borderColor: palette.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.minimalKeyHintText, { color: palette.accent }]}>
                先去设置填一次 API Key → 默认已填好 DeepSeek
              </Text>
            </Pressable>
          ) : null}

          <View
            style={[
              styles.minimalResult,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.minimalResultLabel, { color: palette.textSecondary }]}>
              最近一次总结
            </Text>
            <Text style={[styles.minimalResultTitle, { color: palette.text }]} numberOfLines={2}>
              {latestSnapshot?.title || '还没有内容'}
            </Text>
            <Text style={[styles.minimalResultText, { color: palette.textSecondary }]} numberOfLines={12}>
              {minimalSummary}
            </Text>
          </View>
        </View>
      ) : (
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

            <View
              style={[
                styles.inputCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <TextInput
                value={urlInput}
                onChangeText={(value) => {
                  setUrlInput(value);
                  urlInputRef.current = value;
                  void saveDraftUrl(value);
                }}
                onSubmitEditing={() => void handleTypedFetch()}
                placeholder="粘贴网页链接"
                placeholderTextColor={palette.textSecondary}
                selectionColor={palette.accent}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                editable={!manualFetching}
                style={[styles.urlInput, { color: palette.text }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="抓取输入的链接"
                disabled={manualFetching}
                onPress={() => void handleTypedFetch()}
                style={({ pressed }) => [
                  styles.urlFetchButton,
                  { backgroundColor: palette.accent, opacity: manualFetching ? 0.55 : pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={styles.urlFetchText}>{manualFetching ? '…' : '抓取'}</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="从剪贴板抓取"
              disabled={manualFetching}
              onPress={() => void handleClipboardFetch()}
              style={({ pressed }) => [
                styles.manualCard,
                {
                  backgroundColor: palette.accent,
                  opacity: manualFetching ? 0.6 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <View style={styles.manualTextWrap}>
                <Text style={styles.manualTitle}>
                  {manualFetching ? '正在抓取…' : '从剪贴板抓取'}
                </Text>
                <Text style={styles.manualDesc}>
                  复制网页链接后回到这里，点一下直接抓取
                </Text>
              </View>
              <Text style={styles.manualAction}>
                {manualFetching ? '请稍候' : '抓取 →'}
              </Text>
            </Pressable>

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
      )}


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
        minimalMode={minimalMode}
        onToggleMinimalMode={handleToggleMinimalMode}
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
  minimalContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 26,
  },
  minimalMainButton: {
    minHeight: 210,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  minimalMainTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  minimalMainDesc: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  minimalKeyHint: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
  },
  minimalKeyHintText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  minimalResult: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 16,
  },
  minimalResultLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  minimalResultTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
    marginTop: 8,
  },
  minimalResultText: {
    fontSize: 13,
    lineHeight: 22,
    marginTop: 10,
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
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginBottom: 10,
  },
  urlInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    fontSize: 14,
    paddingVertical: 6,
  },
  urlFetchButton: {
    minWidth: 62,
    minHeight: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlFetchText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  manualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 10,
  },
  manualTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  manualTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  manualDesc: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  manualAction: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
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
