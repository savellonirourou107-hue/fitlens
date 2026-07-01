/**
 * FitLens 后端 API 客户端
 * 后端地址通过环境变量或默认值配置。API Key 只在后端，前端不接触。
 *
 * 上传文件策略（兼容 Android/iOS/Web）：
 * - Android: 用 expo-file-system 读取本地文件为 Blob，再 append 到 FormData
 * - Web:     用 fetch(blob:uri) 取 Blob，再 append
 * 这样避开了 RN FormData 在 Android 上不支持 {uri,name,type} 对象格式的坑
 * (报错: "Unsupported FormData implementation")
 */

import * as FileSystem from 'expo-file-system';

const DEFAULT_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) ||
  'http://localhost:4000';

export const BACKEND_URL = DEFAULT_BASE_URL;

/** AI 餐食识别返回的食物项 */
export interface RecognizedFoodItem {
  name: string;
  portionGrams: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** 餐食识别结果 */
export interface MealRecognitionData {
  items: RecognizedFoodItem[];
  modelVersion: string;
  processingMs: number;
  message?: string;
}

/** 运动识别结果 */
export interface ExerciseRecognitionData {
  type: 'walking' | 'running' | 'cycling' | 'strength' | 'yoga' | 'swimming' | 'hiit' | 'other';
  durationMin: number;
  caloriesBurnedKcal: number;
  source?: string;
  rawText?: string;
  modelVersion?: string;
  processingMs?: number;
}

interface ApiError {
  success: false;
  error: string;
  details?: unknown;
  message?: string;
}

function isError(r: unknown): r is ApiError {
  return typeof r === 'object' && r !== null && (r as ApiError).success === false;
}

/**
 * 调用后端识别餐食图片。
 */
export async function recognizeMealImage(imageUri: string): Promise<MealRecognitionData> {
  const formData = await buildFormData(imageUri);
  const res = await fetch(`${BACKEND_URL}/recognize/meal`, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'application/json' },
  });
  const json: unknown = await res.json();
  if (!res.ok || isError(json)) {
    const msg = isError(json)
      ? (json.message || json.error)
      : `识别失败 (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return (json as { data: MealRecognitionData }).data;
}

/**
 * 调用后端识别运动截图。
 */
export async function recognizeExerciseImage(imageUri: string): Promise<ExerciseRecognitionData> {
  const formData = await buildFormData(imageUri);
  const res = await fetch(`${BACKEND_URL}/recognize/exercise`, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'application/json' },
  });
  const json: unknown = await res.json();
  if (!res.ok || isError(json)) {
    const msg = isError(json)
      ? (json.message || json.error)
      : `识别失败 (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return (json as { data: ExerciseRecognitionData }).data;
}

/**
 * 把本地图片 uri 转成 multipart FormData。
 * Android: 用 expo-file-system 读取为 Blob（兼容 RN Android）。
 * Web:     用 fetch(blob:uri) 转 Blob。
 */
async function buildFormData(imageUri: string): Promise<FormData> {
  const filename = imageUri.split('/').pop() || 'photo.jpg';
  const mime = guessMime(filename);
  const blob = await uriToBlob(imageUri, mime);

  const formData = new FormData();
  // 标准浏览器/Web FormData: append(name, blob, filename)
  formData.append('image', blob, filename);
  return formData;
}

/**
 * 把任意图片 uri 转为 Blob。
 * - file:// 开头（Android/iOS）: 用 expo-file-system 读 base64 再 atob 转 Uint8Array → Blob
 * - blob: 开头（Web）: fetch(blob:uri) 拿 Blob
 * - http(s)://（罕见）: 直接 fetch
 */
async function uriToBlob(uri: string, mime: string): Promise<Blob> {
  // Web blob:
  if (uri.startsWith('blob:')) {
    const res = await fetch(uri);
    return await res.blob();
  }
  // 远程 URL（极少用到）
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const res = await fetch(uri);
    return await res.blob();
  }
  // Android/iOS 本地文件: file://, content://, ph:// 等
  // expo-file-system 读 base64 (新 API：FileSystem.readAsStringAsync with encoding)
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    return base64ToBlob(base64, mime);
  } catch (e) {
    throw new Error(
      `读取图片失败: ${e instanceof Error ? e.message : String(e)} (uri=${uri.slice(0, 60)}…)`,
    );
  }
}

/** base64 字符串 → Blob */
function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}