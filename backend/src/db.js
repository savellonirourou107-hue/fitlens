/**
 * 数据库连接（Neon Postgres）
 * - 用 @neondatabase/serverless 的 HTTP 单查询接口
 * - 无连接池，函数式风格适合 serverless
 *
 * 关键点：
 * - 所有 SQL 走 sql() 函数，参数化防注入
 * - 错误统一 throw，由上层中间件 catch
 */
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[db] DATABASE_URL is missing — set it in .env or Render env vars');
}

// 单测环境允许无 DATABASE_URL（仅用于纯函数测试如 JWT 签发）
// 真正用到 sql() 时才会报错
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

/**
 * 事务执行（Postgres 没有 sqlite 那种 BEGIN 语法，需用 neon.transaction）
 * 注意：neon.transaction 必须用同一个 sql 实例
 */
import { neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

export default sql;
export { sql };