import type { BackendStatus, RedIssue } from '../types';

const BACKEND_BASE_URL = 'http://127.0.0.1:8080';
const BACKEND_REQUEST_TIMEOUT_MS = 40000;
const HEALTH_TIMEOUT_MS = 2500;

export type BackendPageResult = {
  status: BackendStatus;
  reason: string;
  http_code: number;
  body_text: string;
  retry_count: number;
  title?: string;
  retryable?: boolean;
};

export async function checkBackendHealth(timeoutMs = HEALTH_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** 从本地 8080 Python 服务抓取网页；统一返回四分类状态。 */
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

    if (data && typeof data === 'object') {
      const value = data as Partial<BackendPageResult>;
      if (
        typeof value.status === 'string' &&
        typeof value.reason === 'string' &&
        typeof value.http_code === 'number' &&
        typeof value.body_text === 'string' &&
        typeof value.retry_count === 'number'
      ) {
        return value as BackendPageResult;
      }
    }

    return {
      status: 'NETWORK_ERROR',
      reason: '本地接口返回异常。｜请重启 8080 后端。',
      http_code: response.status,
      body_text: '',
      retry_count: 0,
      retryable: true,
    };
  } catch (error) {
    return {
      status: 'NETWORK_ERROR',
      reason:
        error instanceof Error && error.name === 'AbortError'
          ? '本地接口响应超时。｜稍等再试或重启后端。'
          : '连接不上本地服务。｜请先启动 8080 后端。',
      http_code: 0,
      body_text: '',
      retry_count: 0,
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBackendLogs(maxLines = 200): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/logs?lines=${maxLines}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return '后端日志读取失败。';
    const data = (await response.json()) as { logs?: unknown };
    return typeof data.logs === 'string' ? data.logs : '后端暂无可读日志。';
  } catch {
    return '后端离线，无法读取服务日志。';
  } finally {
    clearTimeout(timer);
  }
}

export async function restartBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/restart`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function issueFromBackendError(result: BackendPageResult, url: string): RedIssue {
  return {
    status: result.status,
    reason: result.reason,
    httpCode: result.http_code,
    retryCount: result.retry_count,
    retryable: Boolean(result.retryable),
    source: 'fetch',
    url,
    at: Date.now(),
  };
}
