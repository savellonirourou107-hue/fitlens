/**
 * FitLens 本地持久化层（方案 A：纯本地 SQLite 存储）
 * 封装所有 SQLite CRUD 操作，统一负责 DB 蛇形字段 ↔ TS 驼峰字段映射。
 * 使用 expo-sqlite 新版 API：getDb() → db.runAsync / getAllAsync / getFirstAsync / withTransactionAsync。
 */
import * as SQLite from 'expo-sqlite';
import { getDb } from './db';
import {
  UserProfile,
  Meal,
  FoodItem,
  ExerciseEntry,
  DiaryEntry,
} from '../types';

// ===== Profile =====

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const db = await getDb();
  const now = profile.updatedAt;
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM user_profile LIMIT 1',
  );
  let id = profile.id ?? existing?.id;
  if (id) {
    await db.runAsync(
      `UPDATE user_profile
       SET sex = ?, birth_year = ?, height_cm = ?, weight_kg = ?,
           activity_level = ?, goal = ?, updated_at = ?
       WHERE id = ?`,
      profile.sex,
      profile.birthYear,
      profile.heightCm,
      profile.weightKg,
      profile.activityLevel,
      profile.goal,
      now,
      id,
    );
  } else {
    const res = await db.runAsync(
      `INSERT INTO user_profile
         (sex, birth_year, height_cm, weight_kg, activity_level, goal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      profile.sex,
      profile.birthYear,
      profile.heightCm,
      profile.weightKg,
      profile.activityLevel,
      profile.goal,
      profile.createdAt,
      now,
    );
    id = Number(res.lastInsertRowId);
  }
  return { ...profile, id };
}

export async function loadProfile(): Promise<UserProfile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: number;
    sex: UserProfile['sex'];
    birth_year: number;
    height_cm: number;
    weight_kg: number;
    activity_level: UserProfile['activityLevel'];
    goal: UserProfile['goal'];
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM user_profile LIMIT 1');
  if (!row) return null;
  return {
    id: row.id,
    sex: row.sex,
    birthYear: row.birth_year,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level,
    goal: row.goal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ===== Meals =====

interface MealRow {
  id: string;
  date: string;
  meal_type: Meal['mealType'];
  image_uri: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MealItemRow {
  id: string;
  meal_id: string;
  name: string;
  portion_grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number | null;
  source: FoodItem['source'];
}

function mapFoodItem(row: MealItemRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    portionGrams: row.portion_grams,
    caloriesKcal: row.calories_kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    confidence: row.confidence ?? undefined,
    source: row.source,
  };
}

export async function saveMeal(meal: Meal): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO meals
         (id, date, meal_type, image_uri, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      meal.id,
      meal.date,
      meal.mealType,
      meal.imageUri ?? null,
      meal.notes ?? null,
      meal.createdAt,
      meal.updatedAt,
    );
    // 子项：先删旧的（保证可重复保存），再批量插
    await db.runAsync('DELETE FROM meal_items WHERE meal_id = ?', meal.id);
    for (const it of meal.items) {
      await db.runAsync(
        `INSERT INTO meal_items
           (id, meal_id, name, portion_grams, calories_kcal, protein_g, carbs_g, fat_g, confidence, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        it.id,
        meal.id,
        it.name,
        it.portionGrams,
        it.caloriesKcal,
        it.proteinG,
        it.carbsG,
        it.fatG,
        it.confidence ?? null,
        it.source,
      );
    }
  });
}

export async function deleteMealDb(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meals WHERE id = ?', id);
}

export async function loadAllMeals(): Promise<Meal[]> {
  const db = await getDb();
  const mealRows = await db.getAllAsync<MealRow>(
    'SELECT * FROM meals ORDER BY created_at ASC',
  );
  if (mealRows.length === 0) return [];
  const itemRows = await db.getAllAsync<MealItemRow>(
    'SELECT * FROM meal_items',
  );
  const itemsByMeal = new Map<string, FoodItem[]>();
  for (const ir of itemRows) {
    const arr = itemsByMeal.get(ir.meal_id) ?? [];
    arr.push(mapFoodItem(ir));
    itemsByMeal.set(ir.meal_id, arr);
  }
  return mealRows.map((r) => ({
    id: r.id,
    date: r.date,
    mealType: r.meal_type,
    items: itemsByMeal.get(r.id) ?? [],
    imageUri: r.image_uri,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ===== Exercises =====

interface ExerciseRow {
  id: string;
  date: string;
  type: ExerciseEntry['type'];
  duration_min: number;
  intensity: ExerciseEntry['intensity'];
  calories_burned_kcal: number;
  created_at: string;
}

export async function saveExercise(e: ExerciseEntry): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO exercises
       (id, date, type, duration_min, intensity, calories_burned_kcal, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    e.id,
    e.date,
    e.type,
    e.durationMin,
    e.intensity,
    e.caloriesBurnedKcal,
    e.createdAt,
  );
}

export async function deleteExerciseDb(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
}

export async function loadAllExercises(): Promise<ExerciseEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises ORDER BY created_at ASC',
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type,
    durationMin: r.duration_min,
    intensity: r.intensity,
    caloriesBurnedKcal: r.calories_burned_kcal,
    createdAt: r.created_at,
  }));
}

// ===== Diaries =====

interface DiaryRow {
  id: string;
  date: string;
  content: string;
  mood: DiaryEntry['mood'] | null;
  created_at: string;
  updated_at: string;
}

export async function upsertDiaryDb(d: DiaryEntry): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO diaries
       (id, date, content, mood, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    d.id,
    d.date,
    d.content,
    d.mood ?? null,
    d.createdAt,
    d.updatedAt,
  );
}

export async function deleteDiaryDb(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM diaries WHERE id = ?', id);
}

export async function loadAllDiaries(): Promise<DiaryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DiaryRow>(
    'SELECT * FROM diaries ORDER BY date ASC',
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    content: r.content,
    mood: r.mood ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
