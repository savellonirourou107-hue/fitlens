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
import { genId } from '../core/id';

export interface AppState {
  profile: UserProfile | null;
  meals: Meal[];
  exercises: ExerciseEntry[];
  diaries: DiaryEntry[];
  hydrated: boolean;

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

  setProfile: (p) => set({ profile: p }),
  addMeal: (meal) => set((state) => ({ meals: [...state.meals, meal] })),
  updateMeal: (id, patch) =>
    set((state) => ({
      meals: state.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeMeal: (id) =>
    set((state) => ({ meals: state.meals.filter((m) => m.id !== id) })),
  addExercise: (e) =>
    set((state) => ({ exercises: [...state.exercises, e] })),
  removeExercise: (id) =>
    set((state) => ({
      exercises: state.exercises.filter((x) => x.id !== id),
    })),
  upsertDiary: (diary) =>
    set((state) => {
      const exists = state.diaries.some((d) => d.date === diary.date);
      return {
        diaries: exists
          ? state.diaries.map((d) => (d.date === diary.date ? diary : d))
          : [...state.diaries, diary],
      };
    }),
  removeDiary: (id) =>
    set((state) => ({ diaries: state.diaries.filter((d) => d.id !== id) })),
  getDiaryByDate: (date) => get().diaries.find((d) => d.date === date),
  setHydrated: (b) => set({ hydrated: b }),

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
