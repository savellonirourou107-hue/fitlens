/**
 * /sync/daily-summary API
 * 上传/读取今日聚合数字
 * 失败时不抛阻塞业务（fire-and-forget），但保留错误供调试
 */
import { apiFetch, ApiError, NetworkError } from './client';

export interface DailySummary {
  date: string; // YYYY-MM-DD
  intakeKcal: number;
  burnedKcal: number;
  targetKcal: number;
}

export async function putDailySummary(payload: DailySummary): Promise<{
  date: string;
  updatedAt: string;
} | null> {
  try {
    return await apiFetch('/sync/daily-summary', {
      method: 'PUT',
      body: payload,
    });
  } catch (e) {
    // 离线 / 401 / 服务端报错：吞掉，UI 不阻塞
    if (e instanceof NetworkError || e instanceof ApiError) {
      console.warn('[sync] putDailySummary failed:', e.message);
      return null;
    }
    throw e;
  }
}

export async function getDailySummary(
  date: string,
): Promise<DailySummary | null> {
  try {
    return await apiFetch<DailySummary>(
      `/sync/daily-summary?date=${encodeURIComponent(date)}`,
    );
  } catch (e) {
    if (e instanceof NetworkError || e instanceof ApiError) {
      return null;
    }
    throw e;
  }
}