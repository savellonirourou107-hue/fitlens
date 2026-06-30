/**
 * FitLens 类型定义
 * 减肥热量记录 App — 纯类型与常量，无运行时逻辑
 */

export type Sex = 'male' | 'female';

/** 活动水平枚举 */
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export interface ActivityLevelInfo {
  value: ActivityLevel;
  label: string;
  factor: number;
}

export const ACTIVITY_LEVELS: ActivityLevelInfo[] = [
  { value: 'sedentary', label: '久坐', factor: 1.2 },
  { value: 'light', label: '轻度活跃', factor: 1.375 },
  { value: 'moderate', label: '中度活跃', factor: 1.55 },
  { value: 'active', label: '高度活跃', factor: 1.725 },
  { value: 'very_active', label: '极高活跃', factor: 1.9 },
];

export type Goal = 'mild_loss' | 'loss' | 'extreme_loss' | 'maintain';

export interface GoalInfo {
  value: Goal;
  label: string;
  weeklyKg: number;
}

export const GOALS: GoalInfo[] = [
  { value: 'mild_loss', label: '温和减脂', weeklyKg: 0.25 },
  { value: 'loss', label: '标准减脂', weeklyKg: 0.5 },
  { value: 'extreme_loss', label: '极速减脂', weeklyKg: 1.0 },
  { value: 'maintain', label: '维持体重', weeklyKg: 0 },
];

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserProfile {
  id?: number;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  createdAt: string;
  updatedAt: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

export interface FoodItem {
  id: string;
  name: string;
  portionGrams: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence?: number;
  source: 'ai' | 'manual';
}

export interface Meal {
  id: string;
  date: string;
  mealType: MealType;
  items: FoodItem[];
  imageUri?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExerciseType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'strength'
  | 'yoga'
  | 'swimming'
  | 'hiit'
  | 'other';

export const EXERCISE_TYPES: { value: ExerciseType; label: string; met: number }[] = [
  { value: 'walking', label: '走路', met: 3.5 },
  { value: 'running', label: '跑步', met: 9.8 },
  { value: 'cycling', label: '骑行', met: 7.5 },
  { value: 'strength', label: '力量训练', met: 6.0 },
  { value: 'yoga', label: '瑜伽', met: 3.0 },
  { value: 'swimming', label: '游泳', met: 8.0 },
  { value: 'hiit', label: 'HIIT', met: 8.0 },
  { value: 'other', label: '其他', met: 4.0 },
];

export type Intensity = 'low' | 'moderate' | 'high';

export interface ExerciseEntry {
  id: string;
  date: string;
  type: ExerciseType;
  durationMin: number;
  intensity: Intensity;
  caloriesBurnedKcal: number;
  createdAt: string;
}

/** 心情等级（可选） */
export type Mood = 'great' | 'good' | 'ok' | 'bad' | 'terrible';

export const MOOD_LABELS: Record<Mood, string> = {
  great: '很棒',
  good: '不错',
  ok: '一般',
  bad: '不好',
  terrible: '糟糕',
};

export const MOOD_EMOJI: Record<Mood, string> = {
  great: '😄',
  good: '🙂',
  ok: '😐',
  bad: '😕',
  terrible: '😣',
};

/** 每日日记：记录感想/感悟/收获 */
export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  mood?: Mood;
  createdAt: string;
  updatedAt: string;
}

export interface DailySummary {
  date: string;
  intakeKcal: number;
  burnedKcal: number;
  netKcal: number;
  targetKcal: number;
  deficitKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface AIRecognitionResult {
  items: FoodItem[];
  modelVersion: string;
  processingMs: number;
}
