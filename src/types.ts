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
};

export type Notice = {
  id: number;
  kind: 'dead' | 'info';
  title: string;
  message: string;
};
