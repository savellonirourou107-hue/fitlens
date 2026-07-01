/**
 * FitLens 后端 API 客户端
 * 后端地址通过环境变量或默认值配置。API Key 只在后端，前端不接触。
 *
 * 上传文件策略（兼容 Android/iOS/Web）：
 * - 上传前用 expo-image-manipulator 把图片最长边压到 1024px、quality 0.8
 * - Android: 用 SDK 56 新 `new File(uri)`（本身就是 Blob）直接 append 到 FormData
 * - Web:     用 fetch(blob:uri) 取 Blob，再 append
 * 这样避开了 RN FormData 在 Android 上不支持 {uri,name,type} 对象格式的坑
 * (报错: "Unsupported FormData implementation")
 *
 * 60 秒超时：使用 AbortController 显式设置，超过后 throw
 *
 * MIME 推断：优先用 ImagePickerAsset.mimeType / fileName 后缀，避免错把 jpg 当 jpeg 上传失败
 */

import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const DEFAULT_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) ||
  'http://localhost:4000';

export const BACKEND_URL = DEFAULT_BASE_URL;

/** 识别请求总超时（毫秒） */
export const RECOGNIZE_TIMEOUT_MS = 60_000;

/** AI 识别隐私提示文案（UI 复用，避免硬编码两份） */
export const AI_PRIVACY_NOTICE =
  '上传图片至服务器用于识别，不会公开展示。请避免上传身份证、聊天截图、人脸等敏感信息。';

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
  /** AI 营养顾问点评（后端新增，可选） */
  comment?: string;
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

/** ImagePicker asset 的最小字段（不强制依赖具体 SDK 类型） */
export interface ImageAssetLike {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
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
 * 推断图片 MIME 类型。
 * 优先级：asset.mimeType > asset.fileName 后缀 > fallback
 */
export function inferMime(
  asset: { mimeType?: string | null; fileName?: string | null } | null | undefined,
  fallback: string = 'image/jpeg',
): string {
  const fromAsset = asset?.mimeType?.trim();
  if (fromAsset) return fromAsset;
  const fromName = guessMime(asset?.fileName || '');
  if (fromName) return fromName;
  return fallback;
}

/**
 * 调用后端识别餐食图片。
 * @param imageUri 本地图片 uri（file:// / blob: / http(s)）
 * @param asset    可选的 ImagePicker asset，用于推断 MIME（不传则根据 uri 后缀）
 */
export async function recognizeMealImage(
  imageUri: string,
  asset?: ImageAssetLike | null,
): Promise<MealRecognitionData> {
  const { uri, mime } = await compressImage(imageUri, asset);
  const formData = await buildFormData(uri, mime);
  const res = await fetchWithTimeout(`${BACKEND_URL}/recognize/meal`, {
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
export async function recognizeExerciseImage(
  imageUri: string,
  asset?: ImageAssetLike | null,
): Promise<ExerciseRecognitionData> {
  const { uri, mime } = await compressImage(imageUri, asset);
  const formData = await buildFormData(uri, mime);
  const res = await fetchWithTimeout(`${BACKEND_URL}/recognize/exercise`, {
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
 * fetch 包装：60 秒超时（AbortController）。超时 throw '识别超时（60秒），请检查网络或重试'
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECOGNIZE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (
      e instanceof Error &&
      (e.name === 'AbortError' || e.message?.toLowerCase().includes('abort'))
    ) {
      throw new Error('识别超时（60秒），请检查网络或重试');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 上传前压缩图片。最长边 1024px，quality 0.8，统一 JPEG。
 * 压缩失败则降级用原 uri（不阻断识别流程）。
 */
export async function compressImage(
  imageUri: string,
  asset?: ImageAssetLike | null,
): Promise<{ uri: string; mime: string }> {
  const mime = inferMime(asset, guessMime(imageUri) || 'image/jpeg');
  try {
    const result = await manipulateAsync(
      imageUri,
      [{ resize: { width: 1024, height: 1024 } }],
      { compress: 0.8, format: SaveFormat.JPEG },
    );
    return { uri: result.uri, mime: 'image/jpeg' };
  } catch (e) {
    // 压缩失败就回退原图，避免识别完全用不了
    console.warn('[FitLens] compressImage failed, fallback to original:', e);
    return { uri: imageUri, mime };
  }
}

/**
 * 把本地图片 uri 转成 multipart FormData。
 * Android/iOS: SDK 56 新 `new File(uri)` 本身就是 Blob，直接 append。
 * Web:         fetch(blob:uri) 转 Blob。
 */
async function buildFormData(imageUri: string, mime: string): Promise<FormData> {
  const filename = deriveFilename(imageUri, mime);
  const blob = await uriToBlob(imageUri, mime);

  const formData = new FormData();
  // 标准浏览器/Web FormData: append(name, blob, filename)
  formData.append('image', blob, filename);
  return formData;
}

/**
 * 推导上传时用的文件名（保留扩展名给后端）。
 */
function deriveFilename(imageUri: string, mime: string): string {
  const tail = imageUri.split('/').pop() ?? '';
  const fromUri = tail.split('?')[0];
  if (fromUri && fromUri.includes('.')) return fromUri;
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'image/heic' || mime === 'image/heif'
          ? 'heic'
          : 'jpg';
  return `photo.${ext}`;
}

/**
 * 把任意图片 uri 转为 Blob。
 * - file:// 开头（Android/iOS）: 用 SDK 56 新 `new File(uri)`，File 本身就是 Blob，
 *   直接 append 到 FormData，无需 base64 → Uint8Array 中转
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
  // SDK 56: new File(uri) 继承 Blob，可直接 append 到 FormData
  try {
    return new File(uri) as unknown as Blob;
  } catch (e) {
    throw new Error(
      `读取图片失败: ${e instanceof Error ? e.message : String(e)} (uri=${uri.slice(0, 60)}…)`,
    );
  }
}

/** 根据文件名/uri 后缀推断 MIME，没匹配则返回 '' */
export function guessMime(nameOrUri: string): string {
  const cleaned = nameOrUri.split('?')[0] ?? '';
  const ext = cleaned.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return '';
}
