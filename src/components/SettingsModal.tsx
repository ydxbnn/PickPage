import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  buildChatCompletionsUrl,
  DEFAULT_AI_SETTINGS,
  saveAISettings,
  type AISettings,
} from '../lib/ai';
import type { Palette } from '../theme';

type Props = {
  visible: boolean;
  palette: Palette;
  initialSettings: AISettings;
  onClose: () => void;
  onSaved: (settings: AISettings) => void;
};

const TOP_INSET =
  Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;

export default function SettingsModal({
  visible,
  palette,
  initialSettings,
  onClose,
  onSaved,
}: Props) {
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setApiKey(initialSettings.apiKey);
    setBaseUrl(initialSettings.baseUrl);
    setModel(initialSettings.model);
    setShowKey(false);
    setSaving(false);
  }, [initialSettings, visible]);

  const handleSave = async () => {
    const next: AISettings = {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || DEFAULT_AI_SETTINGS.baseUrl,
      model: model.trim() || DEFAULT_AI_SETTINGS.model,
    };

    if (next.apiKey) {
      try {
        buildChatCompletionsUrl(next.baseUrl);
      } catch (error) {
        Alert.alert(
          '地址无法使用',
          error instanceof Error ? error.message : '请检查 API 基础地址。',
        );
        return;
      }
    }

    setSaving(true);
    try {
      await saveAISettings(next);
      onSaved(next);
      onClose();
    } catch {
      Alert.alert(
        '保存失败',
        'API Key 安全存储写入失败，请确认系统安全存储可用后重试。',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: palette.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: TOP_INSET + 12, borderBottomColor: palette.border }]}>
          <View>
            <Text style={[styles.title, { color: palette.text }]}>设置</Text>
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
              AI 总结 · 本地抓取
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭设置"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={[styles.closeText, { color: palette.text }]}>×</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.heroCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.heroTitle, { color: palette.text }]}>让摘要有据可依</Text>
            <Text style={[styles.heroDesc, { color: palette.textSecondary }]}>
              抓取成功后，拾页会把网页标题和正文摘要发送给你配置的大模型，生成一段
              不编造、可追溯的中文总结。
            </Text>
          </View>

          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
            API KEY（安全存储）
          </Text>
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor={palette.textSecondary}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.keyInput, { color: palette.text }]}
            />
            <Pressable
              onPress={() => setShowKey((previous) => !previous)}
              hitSlop={10}
              style={styles.showKeyButton}
            >
              <Text style={[styles.showKeyText, { color: palette.accent }]}>
                {showKey ? '隐藏' : '显示'}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            API Key 存储在系统加密存储中，不会写入快照，也不会出现在日志里。
          </Text>

          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
            API 基础地址
          </Text>
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <TextInput
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://api.deepseek.com/v1"
              placeholderTextColor={palette.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { color: palette.text }]}
            />
          </View>
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            DeepSeek：https://api.deepseek.com/v1{'\n'}
            OpenAI：https://api.openai.com/v1
          </Text>

          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>模型名称</Text>
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="deepseek-chat"
              placeholderTextColor={palette.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: palette.text }]}
            />
          </View>

          <View
            style={[
              styles.securityNote,
              { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.securityTitle, { color: palette.text }]}>🔒 隐私说明</Text>
            <Text style={[styles.securityText, { color: palette.textSecondary }]}>
              API Key 只会发送到你填写的 Base URL，用于调用 Chat Completions 接口。
              除网页标题与正文摘要外，App 不会上传相册、聊天记录或其他个人数据。
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => void handleSave()}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: palette.accent,
                opacity: saving ? 0.6 : pressed ? 0.8 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>保存设置</Text>
            )}
          </Pressable>
          <Text style={[styles.footerHint, { color: palette.textSecondary }]}>
            API Key 留空时，抓取和快照仍可正常使用，但不会调用大模型。
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  closeText: {
    fontSize: 25,
    lineHeight: 28,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 44,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 22,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 2,
  },
  inputWrap: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 13,
  },
  keyInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 13,
    letterSpacing: 0.4,
  },
  showKeyButton: {
    paddingLeft: 12,
    paddingVertical: 8,
  },
  showKeyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  helper: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
    marginBottom: 18,
  },
  securityNote: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginTop: 4,
    marginBottom: 22,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  securityText: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footerHint: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },
});
