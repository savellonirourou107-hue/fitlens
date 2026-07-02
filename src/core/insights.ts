import type { DailySummary, MealType } from '../types';

export type BudgetTone = 'steady' | 'tight' | 'over' | 'empty';

export interface BudgetInsight {
  remainingKcal: number;
  progress: number;
  title: string;
  subtitle: string;
  tone: BudgetTone;
}

export function buildBudgetInsight(
  summary: Pick<DailySummary, 'intakeKcal' | 'burnedKcal' | 'targetKcal' | 'deficitKcal'>,
): BudgetInsight {
  const effectiveTarget = Math.max(0, summary.targetKcal + summary.burnedKcal);
  const remainingKcal = summary.targetKcal - summary.intakeKcal + summary.burnedKcal;
  const progress =
    effectiveTarget > 0
      ? Math.min(1, Math.max(0, summary.intakeKcal / effectiveTarget))
      : 0;

  if (summary.targetKcal <= 0) {
    return {
      remainingKcal,
      progress: 0,
      title: '先完善资料',
      subtitle: '填写身高体重后生成热量预算',
      tone: 'empty',
    };
  }

  if (remainingKcal < 0) {
    return {
      remainingKcal,
      progress,
      title: '已经超出',
      subtitle: `超出 ${Math.abs(remainingKcal)} kcal，晚餐尽量清淡`,
      tone: 'over',
    };
  }

  if (remainingKcal < 250) {
    return {
      remainingKcal,
      progress,
      title: '预算偏紧',
      subtitle: `还可摄入 ${remainingKcal} kcal，优先补蛋白`,
      tone: 'tight',
    };
  }

  return {
    remainingKcal,
    progress,
    title: '缺口稳定',
    subtitle: `当前缺口 ${Math.abs(summary.deficitKcal)} kcal，节奏不错`,
    tone: 'steady',
  };
}

export function buildMacroPercentages({
  proteinG,
  carbsG,
  fatG,
}: Pick<DailySummary, 'proteinG' | 'carbsG' | 'fatG'>) {
  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbsKcal + fatKcal;

  if (total <= 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  return {
    protein: Math.round((proteinKcal / total) * 100),
    carbs: Math.round((carbsKcal / total) * 100),
    fat: Math.round((fatKcal / total) * 100),
  };
}

export function mealTypeCaption(mealType: MealType): string {
  const captions: Record<MealType, string> = {
    breakfast: '开启代谢',
    lunch: '主餐补能',
    dinner: '控制收尾',
    snack: '灵活补充',
  };
  return captions[mealType];
}
