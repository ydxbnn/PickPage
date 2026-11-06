export type FloatingMemoSnapshotEvent = {
  /** 用户点悬浮气泡里的「保存快照」时，捕捉到的剪贴板内容 */
  text: string;
};

export type FloatingMemoDismissEvent = {
  reason: string;
};

export type FloatingMemoClipboardEvent = {
  text: string;
};

export type FloatingMemoEvents = {
  onSnapshot(event: FloatingMemoSnapshotEvent): void;
  onDismiss(event: FloatingMemoDismissEvent): void;
  onClipboard(event: FloatingMemoClipboardEvent): void;
};
