/**
 * FitLens 全局状态（zustand）
 * 内存态 + DB 持久化双层；启动时由 App 入口 hydrate。
 */
import { create } from 'zustand';
import { parseISO } from 'date-fns';
import {
  UserProfile,
  Meal,
  ExerciseEntry,
  DailySummary,
  DiaryEntry,
} from '../types';
import {
  dailyTargetKcal,
  buildDailySummaryFromMeals,
  lastNDays,
} from '../core/calc';
import * as repo from '../core/repository';

export interface AppState {
  profile: UserProfile | null;
  meals: Meal[];
  exercises: ExerciseEntry[];
  diaries: DiaryEntry[];
  hydrated: boolean;
  /** hydrate 失败时的错误信息；UI 可据此展示重试提示 */
  hydrateError: string | null;

  setProfile: (p: UserProfile) => void;
  addMeal: (meal: Meal) => void;
  updateMeal: (id: string, patch: Partial<Meal>) => void;
  removeMeal: (id: string) => void;
  addExercise: (e: ExerciseEntry) => void;
  removeExercise: (id: string) => void;
  upsertDiary: (diary: DiaryEntry) => void;
  removeDiary: (id: string) => void;
  getDiaryByDate: (date: string) => DiaryEntry | undefined;
  setHydrated: (b: boolean) => void;
  clearHydrateError: () => void;
  hydrateFromDb: () => Promise<void>;
  getMealsByDate: (date: string) => Meal[];
  getExercisesByDate: (date: string) => ExerciseEntry[];
  getDailySummary: (date: string) => DailySummary;
  get7DayTrend: (today: string) => DailySummary[];
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: null,
  meals: [],
  exercises: [],
  diaries: [],
  hydrated: false,
  hydrateError: null,

  setProfile: (p) => {
    // 先持久化，成功后再更新内存态；失败时保持旧状态不变（避免内存与 DB 不一致）
    void repo
      .saveProfile(p)
      .then(() => set({ profile: p }))
      .catch((e) => console.error('saveProfile failed', e));
  },
  addMeal: (meal) => {
    void repo
      .saveMeal(meal)
      .then(() => set((state) => ({ meals: [...state.meals, meal] })))
      .catch((e) => console.error('saveMeal failed', e));
  },
  updateMeal: (id, patch) => {
    const prev = get().meals;
    const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
    // 仅乐观更新内存态；DB 持久化不在本 action 范围内（如需更新 DB 调用方应单独保存）
    set({ meals: next });
  },
  removeMeal: (id) => {
    void repo
      .deleteMealDb(id)
      .then(() => set((state) => ({ meals: state.meals.filter((m) => m.id !== id) })))
      .catch((e) => console.error('deleteMeal failed', e));
  },
  addExercise: (e) => {
    void repo
      .saveExercise(e)
      .then(() => set((state) => ({ exercises: [...state.exercises, e] })))
      .catch((err) => console.error('saveExercise failed', err));
  },
  removeExercise: (id) => {
    void repo
      .deleteExerciseDb(id)
      .then(() =>
        set((state) => ({ exercises: state.exercises.filter((x) => x.id !== id) })),
      )
      .catch((e) => console.error('deleteExercise failed', e));
  },
  upsertDiary: (diary) => {
    void repo
      .upsertDiaryDb(diary)
      .then(() =>
        set((state) => {
          const exists = state.diaries.some((d) => d.date === diary.date);
          return {
            diaries: exists
              ? state.diaries.map((d) => (d.date === diary.date ? diary : d))
              : [...state.diaries, diary],
          };
        }),
      )
      .catch((e) => console.error('upsertDiary failed', e));
  },
  removeDiary: (id) => {
    void repo
      .deleteDiaryDb(id)
      .then(() => set((state) => ({ diaries: state.diaries.filter((d) => d.id !== id) })))
      .catch((e) => console.error('deleteDiary failed', e));
  },
  getDiaryByDate: (date) => get().diaries.find((d) => d.date === date),
  setHydrated: (b) => set({ hydrated: b }),
  clearHydrateError: () => set({ hydrateError: null }),
  hydrateFromDb: async () => {
    try {
      const [profile, meals, exercises, diaries] = await Promise.all([
        repo.loadProfile(),
        repo.loadAllMeals(),
        repo.loadAllExercises(),
        repo.loadAllDiaries(),
      ]);
      set({ profile, meals, exercises, diaries, hydrated: true, hydrateError: null });
    } catch (e) {
      console.error('hydrateFromDb failed', e);
      // 保持 hydrated: false，UI 可据此显示重试提示；记录错误信息
      set({
        hydrated: false,
        hydrateError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  getMealsByDate: (date) => get().meals.filter((m) => m.date === date),
  getExercisesByDate: (date) =>
    get().exercises.filter((x) => x.date === date),

  getDailySummary: (date) => {
    const { profile, meals, exercises } = get();
    const todayMeals = meals.filter((m) => m.date === date);
    const todayExercises = exercises.filter((x) => x.date === date);
    const target = profile ? dailyTargetKcal(profile) : 0;
    return buildDailySummaryFromMeals(
      date,
      todayMeals.map((m) => ({ items: m.items })),
      todayExercises,
      target,
    );
  },

  get7DayTrend: (today) => {
    const days = lastNDays(7, parseISO(today));
    return days.map((d) => get().getDailySummary(d));
  },
}));
