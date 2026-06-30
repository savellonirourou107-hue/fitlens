/**
 * FitLens 后端 API 客户端
 * 后端地址通过环境变量或默认值配置。API Key 只在后端，前端不接触。
 */

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
}

function isError(r: unknown): r is ApiError {
  return typeof r === 'object' && r !== null && (r as ApiError).success === false;
}

/**
 * 调用后端识别餐食图片。
 * @param imageUri 本地图片 uri（file:// 或 blob）
 * @returns 识别结果
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
    const msg = isError(json) ? json.error : `识别失败 (HTTP ${res.status})`;
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
    const msg = isError(json) ? json.error : `识别失败 (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return (json as { data: ExerciseRecognitionData }).data;
}

/** 把本地图片 uri 转成 multipart FormData（兼容 web file:// 和 blob:） */
async function buildFormData(imageUri: string): Promise<FormData> {
  const formData = new FormData();
  const filename = imageUri.split('/').pop() || 'photo.jpg';
  const isWebBlob = imageUri.startsWith('blob:');
  // @ts-expect-error RN FormData 接受 { uri, name, type }
  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: isWebBlob ? 'image/jpeg' : guessMime(filename),
  });
  return formData;
}

function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
