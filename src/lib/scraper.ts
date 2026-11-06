import axios from 'axios';
import { load } from 'cheerio/slim';

import type { BackendStatus } from '../types';

export type ScrapeResult = {
  status: BackendStatus;
  reason: string;
  http_code: number;
  body_text: string;
  retry_count: number;
  title?: string;
  retryable?: boolean;
};

const REQUEST_TIMEOUT_MS = 25000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const SUMMARY_TARGET = 500;
const SUMMARY_MIN = 300;
const MIN_PARAGRAPH_LENGTH = 18;

const USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

const COPY = {
  success: '抓取成功',
  empty: '正文为空，可能是动态加载。｜页面来了，正文还在路上。',
  blocked: '访问被拒绝，对方可能开了反爬。｜门锁了，对方还拉了窗帘。',
  forbidden: '请求太频繁，不是你的锅。｜服务器在喘气，稍等再试。',
  notFound: '页面不存在，可能已被删除。｜这页跑路了，连影子都没留。',
  server: '对方服务器出错，不是你的锅。｜对面在冒烟，稍等再试。',
  timeout: '连接超时，网络可能不稳定。｜网络开小差，喝口水再试。',
  network: '连接失败，可能网址有误或断网。｜网线打结了，检查一下再试。',
  parse: '页面解析失败，可能格式不兼容。｜这页太绕，先换一篇试试。',
};

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function result(
  status: BackendStatus,
  reason: string,
  httpCode: number,
  bodyText = '',
  retryable = false,
  title = '',
): ScrapeResult {
  return {
    status,
    reason,
    http_code: httpCode,
    body_text: bodyText,
    retry_count: 0,
    retryable,
    title,
  };
}

function statusResult(statusCode: number): ScrapeResult {
  if (statusCode === 401 || statusCode === 403 || statusCode === 407 || statusCode === 451) {
    return result('BLOCKED', COPY.blocked, statusCode, '', true);
  }
  if (statusCode === 429) {
    return result('BLOCKED', COPY.forbidden, statusCode, '', true);
  }
  if (statusCode === 404 || statusCode === 410) {
    return result('NETWORK_ERROR', COPY.notFound, statusCode, '', false);
  }
  if (statusCode >= 500) {
    return result('NETWORK_ERROR', COPY.server, statusCode, '', true);
  }
  if (statusCode >= 400) {
    return result('NETWORK_ERROR', COPY.network, statusCode, '', true);
  }
  return result('NETWORK_ERROR', COPY.network, statusCode, '', true);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** 截成 300~500 字，尽量停在句号处。 */
function summarize(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length <= SUMMARY_TARGET) return normalized;

  const windowText = normalized.slice(0, SUMMARY_TARGET);
  const stops = ['。', '！', '？', '.', '!', '?', '；', ';'];
  let lastStop = -1;
  for (const stop of stops) {
    lastStop = Math.max(lastStop, windowText.lastIndexOf(stop));
  }
  if (lastStop >= SUMMARY_MIN - 1) {
    return windowText.slice(0, lastStop + 1).trim();
  }
  return windowText.trim();
}

function parseArticle(html: string, fallbackTitle: string): { title: string; text: string } {
  const $ = load(html);

  const title =
    normalizeText($('meta[property="og:title"]').attr('content') || '') ||
    normalizeText($('title').first().text()) ||
    normalizeText(fallbackTitle);

  $(
    [
      'script',
      'style',
      'nav',
      'footer',
      'header',
      'aside',
      'noscript',
      'iframe',
      'svg',
      'form',
      'button',
      'input',
      'select',
      'textarea',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.nav',
      '.navbar',
      '.footer',
      '.sidebar',
      '.ad',
      '.ads',
      '.advertisement',
      '.cookie',
      '.popup',
      '.share',
    ].join(','),
  ).remove();

  const paragraphs: string[] = [];
  $('p').each((_, element) => {
    const text = normalizeText($(element).text());
    if (text.length >= MIN_PARAGRAPH_LENGTH) paragraphs.push(text);
  });

  let text = paragraphs.join('\n');
  if (text.length < 80) {
    const fallback = $('article, main, [role="main"], body').first();
    text = normalizeText(fallback.text());
  }

  return { title, text };
}

/**
 * 在设备端直接抓取网页并提取高纯度正文，不再依赖本地 Python 服务。
 * 对 404/403/429/5xx/超时返回统一四分类结构。
 */
export async function extractPureText(url: string): Promise<ScrapeResult> {
  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(url);
    if (normalizedUrl.protocol !== 'http:' && normalizedUrl.protocol !== 'https:') {
      return result('NETWORK_ERROR', COPY.network, 0, '', false);
    }
  } catch {
    return result('NETWORK_ERROR', COPY.network, 0, '', false);
  }

  try {
    const response = await axios.get<string>(normalizedUrl.toString(), {
      timeout: REQUEST_TIMEOUT_MS,
      maxContentLength: MAX_HTML_BYTES,
      maxBodyLength: MAX_HTML_BYTES,
      responseType: 'text',
      transformResponse: [(data) => data],
      headers: {
        'User-Agent': randomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });

    const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    let parsed: { title: string; text: string };
    try {
      parsed = parseArticle(html, normalizedUrl.hostname);
    } catch {
      return result('NETWORK_ERROR', COPY.parse, response.status, '', true);
    }

    const body = summarize(parsed.text);
    if (!body || body.length < 20) {
      return result('EMPTY_BODY', COPY.empty, response.status, '', false, parsed.title);
    }

    return result('SUCCESS', COPY.success, response.status, body, false, parsed.title);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status) return statusResult(error.response.status);
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return result('NETWORK_ERROR', COPY.timeout, 0, '', true);
      }
      return result('NETWORK_ERROR', COPY.network, 0, '', true);
    }
    return result('NETWORK_ERROR', COPY.network, 0, '', true);
  }
}
