import type { Snapshot } from '../types';

const REQUEST_TIMEOUT_MS = 12000;
const MAX_HTML_CHARS = 2_000_000;
const MAX_SNAPSHOT_TEXT = 20_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  bull: '•',
  copy: '©',
  emsp: ' ',
  ensp: ' ',
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  middot: '·',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  reg: '®',
  rdquo: '”',
  rsquo: '’',
  times: '×',
  trade: '™',
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(x?)([0-9a-f]+);?/gi, (whole, hex: string, digits: string) => {
      const code = Number.parseInt(digits, hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (whole, name: string) => {
      const value = NAMED_ENTITIES[name.toLowerCase()];
      return value ?? whole;
    });
}

function collapseWhitespace(input: string): string {
  return input.replace(/[\s\u00a0\u3000]+/g, ' ').trim();
}

function stripHtml(input: string): string {
  return collapseWhitespace(
    decodeHtmlEntities(
      input
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

const URL_BODY = '[^\\s<>"\'“”‘’\\u3000，。；：！？、）】》」』]+';

/** 从复制内容里找出第一条来源链接；纯文本也能识别常见的裸域名。 */
export function extractSourceUrl(rawText: string): string | null {
  const text = rawText.trim();
  if (!text) return null;

  const withProtocol = text.match(new RegExp(`https?://${URL_BODY}`, 'i'))?.[0];
  if (withProtocol) {
    return sanitizeUrl(withProtocol);
  }

  const www = text.match(new RegExp(`www\\.${URL_BODY}`, 'i'))?.[0];
  if (www) {
    return sanitizeUrl(`https://${www}`);
  }

  // 整段内容就是一个域名时，也把它当作来源链接。
  const bare = text.match(
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i,
  )?.[0];
  if (bare) {
    return sanitizeUrl(`https://${bare}`);
  }

  return null;
}

function trimUnbalancedClosingParens(input: string): string {
  let candidate = input;
  while (candidate.endsWith(')')) {
    let open = 0;
    let close = 0;
    for (const char of candidate) {
      if (char === '(') open += 1;
      else if (char === ')') close += 1;
    }
    if (close <= open) break;
    candidate = candidate.slice(0, -1);
  }
  return candidate;
}

function sanitizeUrl(raw: string): string | null {
  let candidate = raw.trim();
  // 去掉复制文本里粘在链接末尾的常见中英文标点。
  candidate = candidate.replace(/[.,;!?，。；：！？、】》」』…\]}>»”’]+$/u, '');
  candidate = trimUnbalancedClosingParens(candidate);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sourceHost(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/** 网页抓取失败时，用复制内容或域名生成一个可读标题，保证列表不空。 */
export function fallbackTitle(text: string, url: string | null): string {
  const withoutUrl = text.replace(/https?:\/\/[^\s<>"'“”‘’]+/gi, ' ').replace(/\s+/g, ' ').trim();
  const cleanLine = withoutUrl
    .replace(/^[\s"'“”‘’【\[（(]+|[\s"'“”‘’】\]）)]+$/g, '')
    .replace(/^(?:标题|title|网页标题)\s*[:：]\s*/i, '')
    .trim();

  if (cleanLine.length >= 2) return truncate(cleanLine, 80);

  const host = sourceHost(url);
  if (host) return `${host} 的网页快照`;
  return '未命名快照';
}

export function createPendingSnapshot(text: string, now = Date.now()): Snapshot {
  const trimmed = text.trim().slice(0, MAX_SNAPSHOT_TEXT);
  const url = extractSourceUrl(trimmed);
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    title: fallbackTitle(trimmed, url),
    description: null,
    url,
    createdAt: now,
    fetchState: url ? 'pending' : 'none',
  };
}

function parseAttributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const attributePattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(tag))) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function readMetaTags(html: string): Record<string, string> {
  const metas: Record<string, string> = {};
  const tagPattern = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    const content = attrs.content;
    if (key && content && metas[key] === undefined) {
      metas[key] = stripHtml(content);
    }
  }
  return metas;
}

export type PageMetadata = {
  ok: boolean;
  title: string | null;
  description: string | null;
};

export function parseHtmlMetadata(html: string): PageMetadata {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const meta = readMetaTags(html);

  const title = truncate(
    stripHtml(titleMatch?.[1] ?? '') || meta['og:title'] || meta['twitter:title'] || '',
    140,
  );
  const description = truncate(
    meta.description ||
      meta['og:description'] ||
      meta['twitter:description'] ||
      '',
    280,
  );

  return {
    ok: true,
    title: title || null,
    description: description || null,
  };
}

/** 请求来源网页并提取 title / meta description。失败时返回 ok: false。 */
export async function fetchPageMetadata(
  url: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<PageMetadata> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
      },
    });

    if (!response.ok) {
      return { ok: false, title: null, description: null };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType && !/(?:text\/html|application\/xhtml|text\/plain|application\/xml)/.test(contentType)) {
      return { ok: true, title: null, description: null };
    }

    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    return parseHtmlMetadata(html);
  } catch {
    return { ok: false, title: null, description: null };
  } finally {
    clearTimeout(timer);
  }
}

export type UrlCheckResult = 'ok' | 'not_found' | 'network_error';

/**
 * 点击卡片前检查原网页是否还在。
 * 先 HEAD，遇到不支持 HEAD 的站点再回退到 GET。
 */
export async function checkUrlAlive(url: string, timeoutMs = 10000): Promise<UrlCheckResult> {
  const check = async (method: 'HEAD' | 'GET'): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.5',
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let response = await check('HEAD');
    if (response.status === 403 || response.status === 405 || response.status === 501) {
      response = await check('GET');
    }
    if (response.status === 404 || response.status === 410) return 'not_found';
    if (response.status >= 400) return 'not_found';
    return 'ok';
  } catch {
    return 'network_error';
  }
}
