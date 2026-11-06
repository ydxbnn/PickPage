import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type AISettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type AISummaryResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

export const DEFAULT_AI_SETTINGS: AISettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};

const API_KEY_STORAGE_KEY = 'pickpage.ai.api_key.v1';
const BASE_URL_STORAGE_KEY = '@pickpage/ai_base_url';
const MODEL_STORAGE_KEY = '@pickpage/ai_model';
const AI_REQUEST_TIMEOUT_MS = 30000;
const MAX_AI_SUMMARY_CHARS = 1000;

export function hasAIConfig(settings: AISettings): boolean {
  return Boolean(settings.apiKey.trim() && settings.baseUrl.trim() && settings.model.trim());
}

export async function loadAISettings(): Promise<AISettings> {
  const [apiKey, baseUrl, model] = await Promise.all([
    SecureStore.getItemAsync(API_KEY_STORAGE_KEY).catch(() => null),
    AsyncStorage.getItem(BASE_URL_STORAGE_KEY).catch(() => null),
    AsyncStorage.getItem(MODEL_STORAGE_KEY).catch(() => null),
  ]);

  return {
    apiKey: apiKey ?? '',
    baseUrl: baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
    model: model || DEFAULT_AI_SETTINGS.model,
  };
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  const apiKey = settings.apiKey.trim();
  const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
  const model = settings.model.trim();

  if (apiKey) {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
  } else {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY).catch(() => {});
  }

  await Promise.all([
    AsyncStorage.setItem(BASE_URL_STORAGE_KEY, baseUrl || DEFAULT_AI_SETTINGS.baseUrl),
    AsyncStorage.setItem(MODEL_STORAGE_KEY, model || DEFAULT_AI_SETTINGS.model),
  ]);
}

/** 校验并拼接 OpenAI 兼容的 Chat Completions 地址。 */
export function buildChatCompletionsUrl(rawBaseUrl: string): string {
  let baseUrl = rawBaseUrl.trim();
  if (!baseUrl) throw new Error('请填写 API 基础地址');
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('API 基础地址格式不正确');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('API 基础地址只支持 http 或 https');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('基础地址不要带查询参数或 # 片段');
  }

  const normalized = baseUrl.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  return `${normalized}/chat/completions`;
}

function aiErrorForStatus(status: number): string {
  if (status === 400) return '大模型请求参数不对，请检查模型名称或接口格式。';
  if (status === 401) return 'API Key 无效或已过期，请到设置里检查。';
  if (status === 403) return '当前 API Key 没有调用这个模型的权限。';
  if (status === 404) return '接口地址不存在，请检查 Base URL 是否填写正确。';
  if (status === 429) return '大模型请求太频繁或额度不足，请稍后再试。';
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return '大模型服务暂时不可用，请稍后再试。';
  }
  return `大模型接口返回了 HTTP ${status}，请检查服务地址和配置。`;
}

type ChatCompletionPayload = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

/** 调用用户配置的 OpenAI 兼容 Chat Completions 接口。 */
export async function summarizeWithAI(
  settings: AISettings,
  page: { title: string; summary: string; url: string },
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<AISummaryResult> {
  if (!hasAIConfig(settings)) {
    return { ok: false, message: '还没有配置 API Key，暂时无法生成 AI 总结。' };
  }

  let endpoint: string;
  try {
    endpoint = buildChatCompletionsUrl(settings.baseUrl);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'API 基础地址不正确。',
    };
  }

  const title = page.title.trim() || '无网页标题';
  const excerpt = page.summary.trim().slice(0, 800);
  const sourceUrl = page.url.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        temperature: 0.2,
        max_tokens: 500,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              '你是一个严谨的中文网页摘要助手。只能依据用户提供的网页标题和正文摘要进行总结，禁止补充未出现的信息，禁止编造。用 2 到 4 句话概括核心内容，控制在 160 个汉字以内，不要输出 Markdown 标题。',
          },
          {
            role: 'user',
            content: `网页标题：${title}\n来源链接：${sourceUrl}\n正文摘要：\n${excerpt}\n\n请只基于以上材料输出一段简洁、可信的中文总结。`,
          },
        ],
      }),
    });

    const raw = await response.text();
    let payload: ChatCompletionPayload | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as ChatCompletionPayload) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return { ok: false, message: aiErrorForStatus(response.status) };
    }

    const rawContent = payload?.choices?.[0]?.message?.content;
    let content = '';
    if (typeof rawContent === 'string') {
      content = rawContent;
    } else if (Array.isArray(rawContent)) {
      content = rawContent
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part) {
            const text = (part as { text?: unknown }).text;
            return typeof text === 'string' ? text : '';
          }
          return '';
        })
        .join('');
    }

    const cleaned = content.trim().slice(0, MAX_AI_SUMMARY_CHARS);
    if (!cleaned) {
      return { ok: false, message: '大模型没有返回可用的总结内容。' };
    }
    return { ok: true, text: cleaned };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, message: '大模型响应超时，请稍后再试。' };
    }
    return {
      ok: false,
      message: '连接大模型失败，请检查网络、Base URL 或 API Key。',
    };
  } finally {
    clearTimeout(timer);
  }
}
