import { describe, expect, it } from 'vitest';
import {
  buildBudgetInsight,
  buildMacroPercentages,
  mealTypeCaption,
} from './insights';

describe('buildBudgetInsight', () => {
  it('marks a stable day when the user still has calories available', () => {
    const insight = buildBudgetInsight({
      intakeKcal: 980,
      burnedKcal: 220,
      targetKcal: 1600,
      deficitKcal: -840,
    });

    expect(insight.remainingKcal).toBe(840);
    expect(insight.progress).toBeCloseTo(980 / 1820, 4);
    expect(insight.tone).toBe('steady');
    expect(insight.title).toBe('缺口稳定');
  });

  it('marks an over-budget day without producing progress above 1', () => {
    const insight = buildBudgetInsight({
      intakeKcal: 2300,
      burnedKcal: 0,
      targetKcal: 1800,
      deficitKcal: 500,
    });

    expect(insight.remainingKcal).toBe(-500);
    expect(insight.progress).toBe(1);
    expect(insight.tone).toBe('over');
    expect(insight.title).toBe('已经超出');
  });
});

describe('buildMacroPercentages', () => {
  it('returns rounded protein, carb, and fat calorie percentages', () => {
    expect(buildMacroPercentages({ proteinG: 50, carbsG: 150, fatG: 40 })).toEqual({
      protein: 17,
      carbs: 52,
      fat: 31,
    });
  });

  it('returns zeros when there is no macro data', () => {
    expect(buildMacroPercentages({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe('mealTypeCaption', () => {
  it('uses short meal captions for timeline rows', () => {
    expect(mealTypeCaption('breakfast')).toBe('开启代谢');
    expect(mealTypeCaption('snack')).toBe('灵活补充');
  });
});
