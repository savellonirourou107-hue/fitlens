/**
 * 通用 fetch 封装
 * - 自动从 SecureStore 读 token 加 Authorization header
 * - 401 自动清 token（业务层根据状态决定是否跳登录）
 * - 30s 超时
 * - 网络/超时/服务端错误统一抛 ApiError，子模块 catch 时给用户友好提示
 */
import { getToken, clearToken } from '../storage/secureStore';

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) ||
  'https://fitlens-backend-v2.onrender.com';

export const API_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'UNKNOWN') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** 网络/超时：服务端启动中或离线 */
export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message, 0, 'NETWORK');
  }
}

/** 401 抛出，会清 token */
export class AuthError extends ApiError {
  constructor(message: string) {
    super(message, 401, 'AUTH_INVALID');
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // 是否带 Authorization（默认 true）
  timeoutMs?: number;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = API_TIMEOUT_MS } = opts;
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') {
      throw new NetworkError('服务器启动中，请稍后再试');
    }
    throw new NetworkError('网络不可用，已保留本地数据');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && auth) {
    await clearToken();
    throw new AuthError('登录已过期，请重新登录');
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(`服务器返回异常 (HTTP ${res.status})`, res.status);
  }

  if (!res.ok || (json && json.success === false)) {
    const code = json?.error?.code || 'UNKNOWN';
    const msg = json?.error?.message || `请求失败 (HTTP ${res.status})`;
    if (res.status === 401) {
      await clearToken();
      throw new AuthError(msg);
    }
    throw new ApiError(msg, res.status, code);
  }

  return (json?.data ?? json) as T;
}

/* ==================== AI 识别（multipart，/recognize/* 公开）==================== */

import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export const RECOGNIZE_TIMEOUT_MS = 30_000;

export const AI_PRIVACY_NOTICE =
  '上传图片至服务器用于识别，不会公开展示。请避免上传身份证、聊天截图、人脸等敏感信息。';

export interface RecognizedFoodItem {
  name: string;
  portionGrams: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealRecognitionData {
  items: RecognizedFoodItem[];
  modelVersion: string;
  processingMs: number;
  message?: string;
  comment?: string;
}

export interface ExerciseRecognitionData {
  type: 'walking' | 'running' | 'cycling' | 'strength' | 'yoga' | 'swimming' | 'hiit' | 'other';
  durationMin: number;
  caloriesBurnedKcal: number;
  source?: string;
  rawText?: string;
  modelVersion?: string;
  processingMs?: number;
}

export interface ImageAssetLike {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export function guessMime(nameOrUri: string): string {
  const cleaned = nameOrUri.split('?')[0] ?? '';
  const ext = cleaned.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return '';
}

export function inferMime(
  asset: { mimeType?: string | null; fileName?: string | null } | null | undefined,
  fallback = 'image/jpeg',
): string {
  const fromAsset = asset?.mimeType?.trim();
  if (fromAsset) return fromAsset;
  const fromName = guessMime(asset?.fileName || '');
  if (fromName) return fromName;
  return fallback;
}

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
    console.warn('[FitLens] compressImage failed, fallback to original:', e);
    return { uri: imageUri, mime };
  }
}

async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith('blob:') || uri.startsWith('http://') || uri.startsWith('https://')) {
    const res = await fetch(uri);
    return res.blob();
  }
  try {
    return new File(uri) as unknown as Blob;
  } catch (e) {
    throw new Error(`读取图片失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function deriveFilename(imageUri: string, mime: string): string {
  const tail = imageUri.split('/').pop() ?? '';
  const fromUri = tail.split('?')[0];
  if (fromUri && fromUri.includes('.')) return fromUri;
  const ext =
    mime === 'image/png' ? 'png' :
    mime === 'image/webp' ? 'webp' :
    mime === 'image/heic' || mime === 'image/heif' ? 'heic' :
    'jpg';
  return `photo.${ext}`;
}

async function recognizeWithImage<T>(path: string, imageUri: string, asset?: ImageAssetLike | null): Promise<T> {
  const { uri, mime } = await compressImage(imageUri, asset);
  const filename = deriveFilename(uri, mime);
  const blob = await uriToBlob(uri);
  const formData = new FormData();
  formData.append('image', blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RECOGNIZE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const json: any = await res.json();
    if (!res.ok || (json && json.success === false)) {
      throw new Error(json?.error?.message || `识别失败 (HTTP ${res.status})`);
    }
    return (json?.data ?? json) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function recognizeMealImage(imageUri: string, asset?: ImageAssetLike | null): Promise<MealRecognitionData> {
  return recognizeWithImage<MealRecognitionData>('/recognize/meal', imageUri, asset);
}

export async function recognizeExerciseImage(imageUri: string, asset?: ImageAssetLike | null): Promise<ExerciseRecognitionData> {
  return recognizeWithImage<ExerciseRecognitionData>('/recognize/exercise', imageUri, asset);
}
