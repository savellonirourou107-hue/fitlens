/**
 * FitLens SQLite 数据库层
 * 原则：代码定义 schema + 启动时迁移（schema 写在代码里，App 启动执行）。
 */
import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'fitlens.db';

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sex TEXT NOT NULL,
  birth_year INTEGER NOT NULL,
  height_cm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  activity_level TEXT NOT NULL,
  goal TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  image_uri TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_items (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  portion_grams REAL NOT NULL,
  calories_kcal REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  confidence REAL,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  intensity TEXT NOT NULL,
  calories_burned_kcal REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diaries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  mood TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON meal_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_exercises_date ON exercises(date);
CREATE INDEX IF NOT EXISTS idx_diaries_date ON diaries(date);
`;

let dbInstance: SQLite.SQLiteDatabase | null = null;

/** 获取数据库单例 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbInstance;
}

/** 初始化数据库：打开 + 执行 schema + 开启外键 */
export async function initDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDb();
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}

/**
 * 预留迁移入口。未来版本追加迁移逻辑：
 * 读取 PRAGMA user_version，按版本号逐步执行 ALTER / 迁移脚本。
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // 当前 v1：schema 已由 initDb 创建。后续迁移在此追加。
  await db.execAsync('PRAGMA user_version = 1;');
}
