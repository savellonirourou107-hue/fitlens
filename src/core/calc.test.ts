import { describe, it, expect } from 'vitest';
import {
  ageFromBirthYear,
  bmrHarrisBenedict,
  activityFactor,
  tdee,
  weeklyDeficitKcal,
  dailyTargetKcal,
  macroTargets,
  mealCalories,
  mealMacros,
  exerciseCalories,
  buildDailySummaryFromMeals,
  lastNDays,
} from './calc';
import type { FoodItem, ExerciseEntry, UserProfile } from '../types';

// 固定的“今天”注入：2026-06-30（JS 月份 0-based，5 = 6 月）
const NOW = new Date(2026, 5, 30);

describe('ageFromBirthYear', () => {
  it('计算年龄', () => {
    expect(ageFromBirthYear(2001, NOW)).toBe(25);
  });
});

describe('bmrHarrisBenedict', () => {
  it('男性 25岁 175cm 75kg 约 1780 kcal', () => {
    const bmr = bmrHarrisBenedict(
      { sex: 'male', weightKg: 75, heightCm: 175, birthYear: 2001 },
      NOW,
    );
    // 男: 88.362 + 13.397*75 + 4.799*175 - 5.677*25
    //   = 88.362 + 1004.775 + 839.825 - 141.925 = 1791.037 -> round 1791
    expect(bmr).toBe(1791);
  });

  it('女性同参数低于男性', () => {
    const bmr = bmrHarrisBenedict(
      { sex: 'female', weightKg: 75, heightCm: 175, birthYear: 2001 },
      NOW,
    );
    // 女: 447.593 + 9.247*75 + 3.098*175 - 4.330*25
    //   = 447.593 + 693.525 + 542.15 - 108.25 = 1575.018 -> round 1575
    expect(bmr).toBe(1575);
  });
});

describe('activityFactor', () => {
  it('sedentary = 1.2', () => {
    expect(activityFactor('sedentary')).toBe(1.2);
  });
  it('very_active = 1.9', () => {
    expect(activityFactor('very_active')).toBe(1.9);
  });
  it('未知水平抛错', () => {
    expect(() => activityFactor('foo' as never)).toThrow();
  });
});

describe('tdee', () => {
  it('TDEE = BMR * activityFactor', () => {
    const profile: UserProfile = {
      sex: 'male',
      birthYear: 2001,
      heightCm: 175,
      weightKg: 75,
      activityLevel: 'sedentary',
      goal: 'maintain',
      createdAt: '',
      updatedAt: '',
    };
    // BMR 1791 * 1.2 = 2149.2 -> round 2149
    expect(tdee(profile, NOW)).toBe(2149);
  });
});

describe('weeklyDeficitKcal', () => {
  it('loss=0.5kg -> 3850', () => {
    expect(weeklyDeficitKcal('loss')).toBe(3850);
  });
  it('maintain -> 0', () => {
    expect(weeklyDeficitKcal('maintain')).toBe(0);
  });
  it('extreme_loss=1.0kg -> 7700', () => {
    expect(weeklyDeficitKcal('extreme_loss')).toBe(7700);
  });
});

describe('dailyTargetKcal', () => {
  const base: UserProfile = {
    sex: 'male',
    birthYear: 2001,
    heightCm: 175,
    weightKg: 75,
    activityLevel: 'sedentary',
    goal: 'maintain',
    createdAt: '',
    updatedAt: '',
  };

  it('maintain 时等于 tdee', () => {
    expect(dailyTargetKcal({ ...base, goal: 'maintain' }, NOW)).toBe(2149);
  });

  it('loss 时 = tdee - 3850/7', () => {
    const target = dailyTargetKcal({ ...base, goal: 'loss' }, NOW);
    // 2149 - 3850/7 = 2149 - 550 = 1599
    expect(target).toBe(1599);
  });
});

describe('macroTargets', () => {
  it('蛋白质=1.8*weight, 脂肪=target*0.25/9, 碳水剩余/4', () => {
    const target = 1599;
    const weight = 75;
    const split = macroTargets(target, weight);
    expect(split.protein).toBe(Math.round(1.8 * 75)); // 135
    expect(split.fat).toBe(Math.round((target * 0.25) / 9)); // round(44.42) = 44
    const remaining = target - 135 * 4 - 44 * 9; // 1599 - 540 - 396 = 663
    expect(split.carbs).toBe(Math.round(Math.max(0, remaining) / 4)); // round(165.75)=166
  });
});

describe('mealCalories / mealMacros', () => {
  const items: FoodItem[] = [
    { id: '1', name: 'a', portionGrams: 100, caloriesKcal: 200.4, proteinG: 10, carbsG: 20, fatG: 5, source: 'manual' },
    { id: '2', name: 'b', portionGrams: 100, caloriesKcal: 100.3, proteinG: 5.2, carbsG: 10.1, fatG: 2.5, source: 'manual' },
  ];

  it('热量累加并取整', () => {
    expect(mealCalories(items)).toBe(Math.round(200.4 + 100.3)); // round(300.7)=301
  });

  it('三大营养素累加并取整', () => {
    const m = mealMacros(items);
    expect(m.protein).toBe(Math.round(10 + 5.2)); // 15
    expect(m.carbs).toBe(Math.round(20 + 10.1)); // 30
    expect(m.fat).toBe(Math.round(5 + 2.5)); // 8 (7.5 -> 8, banker's? Math.round(7.5)=8)
  });
});

describe('exerciseCalories', () => {
  it('running 9.8 MET, 30min, 70kg, moderate', () => {
    const v = exerciseCalories('running', 30, 70, 'moderate');
    // 9.8 * 3.5 * 70 / 200 * 30 * 1.0 = 9.8*3.5=34.3; *70=2401; /200=12.005; *30=360.15... 重新算
    expect(v).toBe(360);
  });

  it('low 系数 0.85', () => {
    const v = exerciseCalories('running', 30, 70, 'low');
    expect(v).toBe(Math.round(360.15 * 0.85));
  });
});

describe('lastNDays', () => {
  it('n=7 返回 7 个字符串，今天在前', () => {
    const days = lastNDays(7, NOW);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-06-30');
    expect(days[6]).toBe('2026-06-24');
  });
});

describe('buildDailySummaryFromMeals', () => {
  const items: FoodItem[] = [
    { id: '1', name: 'a', portionGrams: 100, caloriesKcal: 200, proteinG: 10, carbsG: 20, fatG: 5, source: 'manual' },
    { id: '2', name: 'b', portionGrams: 100, caloriesKcal: 100, proteinG: 5, carbsG: 10, fatG: 2, source: 'manual' },
  ];
  const meals = [{ items }];
  const exercises: ExerciseEntry[] = [
    {
      id: 'e1',
      date: '2026-06-30',
      type: 'running',
      durationMin: 30,
      intensity: 'moderate',
      caloriesBurnedKcal: 3602,
      createdAt: '',
    },
  ];

  it('intake/burned/net/deficit 正确', () => {
    const summary = buildDailySummaryFromMeals('2026-06-30', meals, exercises, 1519);
    expect(summary.intakeKcal).toBe(300);
    expect(summary.burnedKcal).toBe(3602);
    expect(summary.netKcal).toBe(300 - 3602); // -3302
    expect(summary.deficitKcal).toBe(300 - 3602 - 1519); // -4821
    expect(summary.proteinG).toBe(15);
    expect(summary.carbsG).toBe(30);
    expect(summary.fatG).toBe(7);
  });
});
