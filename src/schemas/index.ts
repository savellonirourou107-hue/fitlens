/**
 * FitLens Zod 校验 schema
 * 用途：校验后端 AI 返回结果及用户输入。原则——所有 AI 返回结果必须 zod 校验。
 */
import { z } from 'zod';

export const sexSchema = z.enum(['male', 'female']);
export const activityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export const goalSchema = z.enum(['mild_loss', 'loss', 'extreme_loss', 'maintain']);
export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const exerciseTypeSchema = z.enum([
  'walking',
  'running',
  'cycling',
  'strength',
  'yoga',
  'swimming',
  'hiit',
  'other',
]);
export const intensitySchema = z.enum(['low', 'moderate', 'high']);

export const foodItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  portionGrams: z.number().nonnegative(),
  caloriesKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(['ai', 'manual']),
});

export const aiRecognitionResultSchema = z.object({
  items: z.array(foodItemSchema),
  modelVersion: z.string(),
  processingMs: z.number().nonnegative(),
});

export const userProfileSchema = z.object({
  id: z.number().int().optional(),
  sex: sexSchema,
  birthYear: z.number().int().min(1920).max(2015),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(25).max(400),
  activityLevel: activityLevelSchema,
  goal: goalSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const mealSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  mealType: mealTypeSchema,
  items: z.array(foodItemSchema),
  imageUri: z.string().nullable().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const exerciseEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  type: exerciseTypeSchema,
  durationMin: z.number().nonnegative(),
  intensity: intensitySchema,
  caloriesBurnedKcal: z.number().nonnegative(),
  createdAt: z.string(),
});

export type FoodItemDTO = z.infer<typeof foodItemSchema>;
export type AiRecognitionResultDTO = z.infer<typeof aiRecognitionResultSchema>;
export type UserProfileDTO = z.infer<typeof userProfileSchema>;
export type MealDTO = z.infer<typeof mealSchema>;
export type ExerciseEntryDTO = z.infer<typeof exerciseEntrySchema>;

/**
 * 安全解析后端 AI 识别结果。
 * @returns success + data，或 success=false + error
 */
export function safeParseAiResult(raw: unknown): {
  success: boolean;
  data?: AiRecognitionResultDTO;
  error?: z.ZodError;
} {
  const parsed = aiRecognitionResultSchema.safeParse(raw);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, error: parsed.error };
}
