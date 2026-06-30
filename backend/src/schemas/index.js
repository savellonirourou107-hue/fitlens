/**
 * FitLens 后端 Zod 校验 schema
 * 用途：校验 MiniMax AI 识别返回结果。原则——所有 AI 返回结果必须 zod 校验。
 * 与前端 src/schemas/index.ts 保持结构一致。
 */
import { z } from 'zod';

/**
 * 单个食物项。后端 AI 识别返回的最小可用结构（不含前端 id/source 等附加字段）。
 */
export const foodItemSchema = z.object({
  name: z.string().min(1).max(80),
  portionGrams: z.number().nonnegative(),
  caloriesKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
});

/**
 * 一餐识别结果：至少识别出一个食物。
 */
export const mealRecognitionSchema = z.object({
  items: z.array(foodItemSchema).min(1, '至少识别出一个食物'),
});

/**
 * 运动类型枚举，与前端 exerciseTypeSchema 对齐。
 */
export const exerciseRecognitionSchema = z.object({
  type: z.enum([
    'walking',
    'running',
    'cycling',
    'strength',
    'yoga',
    'swimming',
    'hiit',
    'other',
  ]),
  durationMin: z.number().nonnegative(),
  caloriesBurnedKcal: z.number().nonnegative(),
  source: z.string().optional(),
  rawText: z.string().optional(),
});

/**
 * 安全解析一餐识别结果。
 * @param {unknown} raw MiniMax 返回的原始对象
 * @returns {{ success: boolean, data?: any, error?: import('zod').ZodError }}
 */
export function safeParseMeal(raw) {
  const parsed = mealRecognitionSchema.safeParse(raw);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, error: parsed.error };
}

/**
 * 安全解析运动识别结果。
 * @param {unknown} raw MiniMax 返回的原始对象
 * @returns {{ success: boolean, data?: any, error?: import('zod').ZodError }}
 */
export function safeParseExercise(raw) {
  const parsed = exerciseRecognitionSchema.safeParse(raw);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, error: parsed.error };
}
