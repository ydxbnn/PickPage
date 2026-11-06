export type BackendStatus = 'SUCCESS' | 'EMPTY_BODY' | 'BLOCKED' | 'NETWORK_ERROR';

export type UserMode = 'newbie' | 'veteran';

export type Snapshot = {
  id: string;
  /** 用户复制时留下的原文 */
  text: string;
  /** 来源网页标题；抓取失败时用本地内容兜底 */
  title: string;
  /** 来源网页的 meta description */
  description: string | null;
  /** 来源链接；纯文字快照可能没有 */
  url: string | null;
  createdAt: number;
  fetchState: 'pending' | 'ok' | 'failed' | 'none';
  /** 访问时发现原网页已失效 */
  dead?: boolean;
  /** 设备端抓取并降噪后的正文摘要 */
  pageSummary?: string | null;
  /** 大模型生成的总结 */
  aiSummary?: string | null;
  /** AI 总结状态 */
  aiState?: 'idle' | 'loading' | 'done' | 'error' | 'skipped';
  /** 大模型请求失败时的友好说明 */
  aiError?: string | null;
  /** 抓取失败时展示的中文说明 */
  serviceMessage?: string | null;
};

export type Notice = {
  id: number;
  kind: 'dead' | 'info';
  title: string;
  message: string;
};
