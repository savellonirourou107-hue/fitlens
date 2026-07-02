/**
 * 数据库迁移脚本
 * - 顺序执行 migrations/ 目录下所有 .sql 文件
 * - 用文件名数字前缀排序（001_, 002_, 003_...）
 * - 用 CREATE TABLE IF NOT EXISTS / CREATE TYPE ... DO $$ ... $$ 幂等
 *
 * 用法：
 *   DATABASE_URL=postgresql://... npm run migrate
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Run:');
  console.error('   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require npm run migrate');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function run() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found in', MIGRATIONS_DIR);
    return;
  }

  console.log(`📦 Found ${files.length} migration file(s):\n`);
  for (const f of files) console.log('  •', f);
  console.log();

  for (const file of files) {
    const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`▶ Running ${file}...`);
    try {
      // neon() 的 sql.query() 支持多条 SQL 串
      await sql.query(content);
      console.log(`  ✔ ${file} done`);
    } catch (e) {
      console.error(`  ✖ ${file} failed:`, e.message);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations applied successfully.');
}

run().catch((e) => {
  console.error('Migration script crashed:', e);
  process.exit(1);
});