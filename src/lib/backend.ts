import { extractPureText, type ScrapeResult } from './scraper';

export type BackendPageResult = ScrapeResult;

/** 保留原调用接口，实际抓取逻辑已完全迁移到设备端 TypeScript。 */
export async function fetchPageFromBackend(url: string): Promise<BackendPageResult> {
  return extractPureText(url);
}
