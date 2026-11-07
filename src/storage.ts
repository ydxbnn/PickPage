import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Snapshot, UserMode } from './types';

const SNAPSHOTS_KEY = '@pickpage/snapshots/v1';
const FLOATING_KEY = '@pickpage/floating_enabled/v1';
const USER_MODE_KEY = '@pickpage/user_mode/v1';
const DRAFT_URL_KEY = '@pickpage/draft_url/v1';

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Snapshot>;
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.title === 'string' &&
    typeof item.createdAt === 'number'
  );
}

export async function loadSnapshots(): Promise<Snapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSnapshot).map((item) => ({
      ...item,
      description: item.description ?? null,
      url: item.url ?? null,
      fetchState: item.fetchState ?? (item.url ? 'failed' : 'none'),
      pageSummary: item.pageSummary ?? null,
      aiSummary: item.aiSummary ?? null,
      aiState: item.aiState ?? 'idle',
      aiError: item.aiError ?? null,
      serviceMessage: item.serviceMessage ?? null,
    }));
  } catch {
    return [];
  }
}

export async function saveSnapshots(snapshots: Snapshot[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch {
    // 写入失败时保留内存中的列表，下一次操作会再次尝试。
  }
}

export async function loadFloatingEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FLOATING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveFloatingEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(FLOATING_KEY, enabled ? '1' : '0');
  } catch {
    // 忽略
  }
}


export async function loadUserMode(): Promise<UserMode | null> {
  try {
    const value = await AsyncStorage.getItem(USER_MODE_KEY);
    return value === 'newbie' || value === 'veteran' ? value : null;
  } catch {
    return null;
  }
}

export async function saveUserMode(mode: UserMode): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_MODE_KEY, mode);
  } catch {
    // 忽略
  }
}


export async function loadDraftUrl(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(DRAFT_URL_KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function saveDraftUrl(value: string): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(DRAFT_URL_KEY, value);
    else await AsyncStorage.removeItem(DRAFT_URL_KEY);
  } catch {
    // 草稿写入失败不影响主流程
  }
}
