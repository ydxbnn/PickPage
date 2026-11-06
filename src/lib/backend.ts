const BACKEND_BASE_URL = 'http://127.0.0.1:8080';
const BACKEND_REQUEST_TIMEOUT_MS = 25000;

export type BackendPageResult = {
  code: number;
  message: string;
  title?: string;
  summary?: string;
  url?: string;
  final_url?: string;
};

/** 从本地 8080 Python 服务抓取网页，失败时返回后端已经翻译好的中文。 */
export async function fetchPageFromBackend(
  targetUrl: string,
  timeoutMs = BACKEND_REQUEST_TIMEOUT_MS,
): Promise<BackendPageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = `${BACKEND_BASE_URL}/fetch?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const raw = await response.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (
      data &&
      typeof data === 'object' &&
      typeof (data as BackendPageResult).code === 'number' &&
      typeof (data as BackendPageResult).message === 'string'
    ) {
      return data as BackendPageResult;
    }

    if (!response.ok) {
      return {
        code: response.status,
        message: `【错误翻译】本地抓取服务返回了 HTTP ${response.status}。`,
      };
    }
    return {
      code: 502,
      message: '【错误翻译】本地抓取服务返回了无法识别的内容。',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        code: 504,
        message: '【错误翻译】本地抓取服务响应超时，请稍后再试。',
      };
    }
    return {
      code: 502,
      message: '【错误翻译】连接不上本地抓取服务，请确认 8080 服务正在运行。',
    };
  } finally {
    clearTimeout(timer);
  }
}
