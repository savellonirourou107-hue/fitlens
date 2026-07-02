/**
 * /auth/* 路由
 * - register / login / me / refresh / DELETE me
 * - bcrypt cost 12 哈希密码
 * - JWT payload 不放 email
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import sql from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { error, ok, randomString } from '../utils.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().max(120).transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8).max(72),
  nickname: z.string().min(2).max(16),
});

const loginSchema = z.object({
  email: z.string().email().max(120).transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1).max(72),
});

/** POST /auth/register */
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'INVALID_BODY', '请求参数不合法', {
      issues: parsed.error.issues,
    });
  }
  const { email, password, nickname } = parsed.data;

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    return error(res, 409, 'EMAIL_TAKEN', '该邮箱已被注册');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const avatarSeed = randomString(4);

  const inserted = await sql`
    INSERT INTO users (email, password_hash, nickname, avatar_seed)
    VALUES (${email}, ${passwordHash}, ${nickname}, ${avatarSeed})
    RETURNING id, email, nickname, avatar_seed, token_version, created_at
  `;
  const user = inserted[0];
  const token = signToken(user.id, user.token_version);

  return ok(
    res,
    {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarSeed: user.avatar_seed,
      },
      token,
    },
    201
  );
});

/** POST /auth/login */
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return error(res, 400, 'INVALID_BODY', '请求参数不合法');
  }
  const { email, password } = parsed.data;

  const rows = await sql`
    SELECT id, email, password_hash, nickname, avatar_seed, token_version
    FROM users WHERE email = ${email} LIMIT 1
  `;
  if (rows.length === 0) {
    // 统一文案防枚举
    return error(res, 401, 'AUTH_INVALID', '邮箱或密码错误');
  }
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return error(res, 401, 'AUTH_INVALID', '邮箱或密码错误');
  }
  const token = signToken(user.id, user.token_version);
  return ok(res, {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarSeed: user.avatar_seed,
    },
    token,
  });
});

/** GET /auth/me - 需要 requireAuth */
router.get('/me', requireAuth, async (req, res) => {
  const rows = await sql`
    SELECT id, email, nickname, avatar_seed, created_at, updated_at
    FROM users WHERE id = ${req.userId} LIMIT 1
  `;
  if (rows.length === 0) return error(res, 404, 'NOT_FOUND', '用户不存在');
  const u = rows[0];
  return ok(res, {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    avatarSeed: u.avatar_seed,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  });
});

/** POST /auth/refresh - 用旧 token 换新（30 天 ±7 天窗口内） */
router.post('/refresh', async (req, res) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return error(res, 401, 'AUTH_REQUIRED', '未登录或登录已过期');
  const { verifyToken } = await import('../auth.js');
  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (e) {
    return error(res, 401, 'AUTH_INVALID', '登录已失效，请重新登录');
  }
  // 检查 token_version 仍匹配
  const rows = await sql`
    SELECT id, token_version FROM users WHERE id = ${payload.sub} LIMIT 1
  `;
  if (rows.length === 0 || rows[0].token_version !== payload.ver) {
    return error(res, 401, 'AUTH_INVALID', '登录已失效，请重新登录');
  }
  const newToken = signToken(rows[0].id, rows[0].token_version);
  return ok(res, { token: newToken });
});

/** DELETE /auth/me - 注销账号（删除用户，级联删除 friendships + daily_summaries） */
router.delete('/me', requireAuth, async (req, res) => {
  await sql`DELETE FROM users WHERE id = ${req.userId}`;
  return ok(res, { deleted: true });
});

export default router;