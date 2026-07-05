/**
 * FitLens 纯计算函数模块
 * 原则：所有函数独立、可测试，无副作用，时间通过参数注入。
 */
import { differenceInYears, format, subDays } from 'date-fns';
import {
  ACTIVITY_LEVELS,
  EXERCISE_TYPES,
} from '../types';
import type {
  MacroSplit,
  FoodItem,
  UserProfile,
  ExerciseEntry,
  DailySummary,
  ActivityLevel,
  Intensity,
  MealType,
} from '../types';

/** 从出生年份计算年龄 */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  if (!Number.isFinite(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear()) {
    throw new Error(`非法出生年份: ${birthYear}`);
  }
  return differenceInYears(now, new Date(birthYear, 0, 1));
}

/** Harris-Benedict BMR 公式（修订版 1984，单位 kcal/day）
 *  男: BMR = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
 *  女: BMR = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age
 */
export function bmrHarrisBenedict(
  profile: Pick<UserProfile, 'sex' | 'weightKg' | 'heightCm' | 'birthYear'>,
  now: Date = new Date(),
): number {
  const { sex, weightKg, heightCm } = profile;
  // 入口校验：阻断 NaN/Infinity/负数/超界输入沿调用链污染下游
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    throw new Error(`非法体重: ${weightKg} kg`);
  }
  if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250) {
    throw new Error(`非法身高: ${heightCm} cm`);
  }
  const age = ageFromBirthYear(profile.birthYear, now);
  if (sex === 'male') {
    return Math.round(88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age);
  }
  return Math.round(447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age);
}

/** 从 ActivityLevel 查活动系数 */
export function activityFactor(level: ActivityLevel): number {
  const info = ACTIVITY_LEVELS.find((a) => a.value === level);
  if (!info) throw new Error(`未知活动水平: ${level}`);
  return info.factor;
}

/** 总每日能量消耗 TDEE（kcal/day） */
export function tdee(profile: UserProfile, now: Date = new Date()): number {
  return Math.round(bmrHarrisBenedict(profile, now) * activityFactor(profile.activityLevel));
}

/** 根据目标计算每周热量缺口（kcal/week） */
export function weeklyDeficitKcal(goal: string): number {
  const goalsRecord: Record<string, number> = {
    mild_loss: 0.25,
    loss: 0.5,
    extreme_loss: 1.0,
    maintain: 0,
  };
  const weekKg = goalsRecord[goal] ?? 0;
  return Math.floor(weekKg * 7700);
}

/** 每日目标热量（kcal），下限 1200 */
export function dailyTargetKcal(profile: UserProfile, now: Date = new Date()): number {
  const t = tdee(profile, now);
  if (profile.goal === 'maintain') return Math.max(1200, Math.min(4000, t));
  const deficitPerWeek = weeklyDeficitKcal(profile.goal);
  const target = t - deficitPerWeek / 7;
  return Math.max(1200, Math.min(4000, Math.round(target)));
}

/** 三大营养素目标分配 */
export function macroTargets(targetKcal: number, weightKg: number): MacroSplit {
  const proteinG = Math.round(1.8 * weightKg);
  const fatG = Math.round((targetKcal * 0.25) / 9);
  const remainingKcal = targetKcal - proteinG * 4 - fatG * 9;
  const carbsG = Math.round(Math.max(0, remainingKcal) / 4);
  return { protein: proteinG, carbs: carbsG, fat: fatG };
}

/** 一顿餐的热量总和 */
export function mealCalories(items: FoodItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.caloriesKcal, 0));
}

/** 一顿餐的三大营养素总和 */
export function mealMacros(items: FoodItem[]): MacroSplit {
  const protein = Math.round(items.reduce((s, i) => s + i.proteinG, 0));
  const carbs = Math.round(items.reduce((s, i) => s + i.carbsG, 0));
  const fat = Math.round(items.reduce((s, i) => s + i.fatG, 0));
  return { protein, carbs, fat };
}

/**
 * 运动消耗估算（kcal）
 * 公式: MET * 3.5 * weightKg / 200 * durationMin * intensityCoeff
 */
export function exerciseCalories(
  type: string,
  durationMin: number,
  weightKg: number,
  intensity: Intensity,
): number {
  const met = EXERCISE_TYPES.find((e) => e.value === type)?.met ?? 4.0;
  const intensityCoeff: Record<Intensity, number> = {
    low: 0.85,
    moderate: 1.0,
    high: 1.15,
  };
  return Math.round(met * 3.5 * weightKg / 200 * durationMin * intensityCoeff[intensity]);
}

/** 从当天餐食和运动构建 DailySummary */
export function buildDailySummaryFromMeals(
  date: string,
  meals: { items: FoodItem[] }[],
  exercises: ExerciseEntry[],
  targetKcal: number,
): DailySummary {
  let protein = 0,
    carbs = 0,
    fat = 0;
  for (const m of meals) {
    const mc = mealMacros(m.items);
    protein += mc.protein;
    carbs += mc.carbs;
    fat += mc.fat;
  }
  const intakeKcal = meals.reduce((sum, m) => sum + mealCalories(m.items), 0);
  const burnedKcal = Math.round(
    exercises.reduce((sum, e) => sum + e.caloriesBurnedKcal, 0),
  );
  return {
    date,
    intakeKcal,
    burnedKcal,
    netKcal: intakeKcal - burnedKcal,
    targetKcal,
    deficitKcal: intakeKcal - burnedKcal - targetKcal,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
  };
}

/** 最近 N 天的日期列表（字符串 YYYY-MM-DD） */
export function lastNDays(n: number, today: Date = new Date()): string[] {
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    result.push(format(subDays(today, i), 'yyyy-MM-dd'));
  }
  return result;
}
